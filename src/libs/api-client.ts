import { ModuleApiBase, newLogger } from 'yellow-server-common';
import { Mutex } from 'async-mutex';
import { FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType, FileUploadRole } from './FileTransfer/types';
import { makeAttachmentRecord, pickFileUploadRecordFields } from './FileTransfer/utils';
import { DownloadChunkP2PNotFoundError } from './FileTransfer/errors';
import { UPLOAD_RECORD_PICKED_FIELDS_FOR_FRONTEND } from './FileTransfer/constants.ts';
import { FILE_TRANSFER_SETTINGS } from './FileTransfer/settings.ts';

let Log = newLogger('api-client');

enum MessageFormat {
 plaintext = 'plaintext',
 html = 'html'
}

export class ApiClient extends ModuleApiBase {
 message_seen_mutex: Mutex;

 // TODO: move this function to common:
 isEnumValue(value: string): boolean {
  return Object.values(MessageFormat).includes(value as MessageFormat);
 }

 constructor(app) {
  super(app, ['new_message', 'seen_message', 'seen_inbox_message', 'message_update', 'upload_update', 'download_chunk', 'ask_for_chunk']);
  this.commands = {
   ...this.commands,
   message_send: { method: this.message_send.bind(this), reqUserSession: true },
   message_seen: { method: this.message_seen.bind(this), reqUserSession: true },
   message_delete: { method: this.message_delete.bind(this), reqUserSession: true },
   message_reaction: { method: this.message_reaction.bind(this), reqUserSession: true },
   messages_list: { method: this.messages_list.bind(this), reqUserSession: true },
   conversations_list: { method: this.conversations_list.bind(this), reqUserSession: true },
   upload_begin: { method: this.upload_begin.bind(this), reqUserSession: true },
   upload_chunk: { method: this.upload_chunk.bind(this), reqUserSession: true },
   upload_get: { method: this.upload_get.bind(this), reqUserSession: true },
   upload_cancel: { method: this.upload_cancel.bind(this), reqUserSession: true },
   download_chunk: { method: this.download_chunk.bind(this), reqUserSession: true },
   upload_update_status: { method: this.upload_update_status.bind(this), reqUserSession: true }
  };
  this.message_seen_mutex = new Mutex();
  this.runFileUploadsCleanup();
 }

 async runFileUploadsCleanup() {
  while (true) {
   // wait for next iteration
   await new Promise(resolve => setTimeout(resolve, FILE_TRANSFER_SETTINGS.CLEANUP_INTERVAL_MS));
   Log.info('Running file uploads cleanup');
   // first get appropriate records from db
   const dbRecords = await this.app.data.getFileUploadsForCheck();
   // now combine it with in-memory records from fileTransferManager
   const inMemoryRecords = Array.from(this.app.fileTransferManager.records.values());
   // combine both where memory records have priority
   const records = [...inMemoryRecords, ...dbRecords].reduce((acc, record) => {
    if (!acc.some(r => r.id === record.id)) acc.push(record);
    return acc;
   }, []);
   Log.info('Checking and validating file uploads', dbRecords.length);
   await this.app.fileTransferManager.checkAndValidateFileUploads(dbRecords, async (updatedRecord: FileUploadRecord) => {
    await this.send_upload_update_notification({ record: updatedRecord });
   });
  }
 }

 async download_chunk(c) {
  const { uploadId, offsetBytes, chunkSize } = c.params;
  const record = await this.app.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 'RECORD_NOT_FOUND', message: 'Record not found' };
  if (record.type === FileUploadRecordType.SERVER) {
   const { chunk } = await this.app.fileTransferManager.getFileChunk(uploadId, offsetBytes, chunkSize);
   return { error: false, chunk };
  } else if (record.type === FileUploadRecordType.P2P) {
   try {
    // todo: change chunkId to offsetBytes and chunkSize to support dynamic chunk size in future
    const chunkId = Math.floor(offsetBytes / chunkSize);
    const { chunk } = await this.app.fileTransferManager.getFileChunkP2P(uploadId, chunkId);
    // prefetch
    // todo: make better & support dynamic chunksize in future
    const existingP2PChunks = this.app.fileTransferManager.p2pTempChunks.get(uploadId);
    const chunksLength = existingP2PChunks?.length;
    if (chunksLength) {
     const prefetchTolerance = 10;
     const prefetchDiff = chunksLength - prefetchTolerance;
     if (chunk.chunkId >= prefetchDiff) {
      const lastChunk = existingP2PChunks[chunksLength - 1];
      if (lastChunk) {
       this.signals.notifyUser(record.fromUserId, 'ask_for_chunk', {
        uploadId,
        offsetBytes: lastChunk.chunkId * chunkSize,
        chunkSize
       });
      }
     }
    }

    // non-blocking p2p memory chunks clear
    setTimeout(() => {
     const forgetTolerance = 10;
     // set null to chunks that are not needed anymore (based on prev chunk.chunkId and forgetTolerance)
     if (chunksLength && chunk.chunkId > forgetTolerance) {
      for (let i = 0; i < chunk.chunkId - forgetTolerance; i++) {
       existingP2PChunks[i] = null;
      }
     }
    });
    return { error: false, chunk };
   } catch (e) {
    if (e instanceof DownloadChunkP2PNotFoundError) {
     this.signals.notifyUser(record.fromUserId, 'ask_for_chunk', {
      uploadId,
      offsetBytes,
      chunkSize
     });
     return { error: 'WAIT_FOR_CHUNK', message: 'Wait for chunk' };
    } else {
     return { error: 'CHUNK_UNAVAILABLE', message: 'Chunk could not be obtained' };
    }
   }
  } else {
   return { error: 'UNKNOWN RECORD TYPE', message: 'Unknown record type' };
  }
 }

 async upload_chunk(c) {
  const { chunk } = c.params;
  const process = await this.app.fileTransferManager.processChunk(chunk);
  let record = process.record;
  if (record.status === FileUploadRecordStatus.BEGUN) {
   record = await this.app.fileTransferManager.patchRecord(record.id, { status: FileUploadRecordStatus.UPLOADING });
   // with first chunk received, update status to UPLOADING
   await this.send_upload_update_notification({ record });
  }
  if (record.type === FileUploadRecordType.SERVER) {
   // update progress
   this.send_upload_update_notification({
    record,
    uploadData: {
     uploadedBytes: record.chunksReceived.length * record.chunkSize
    }
   });
  }
  // check if finished
  // todo: check if its ok for p2p
  if (record.status === FileUploadRecordStatus.FINISHED) this.send_upload_update_notification({ record });
  return { error: false, message: 'Chunk accepted' };
 }

 async upload_get(c) {
  const { id } = c.params;
  try {
   const record = await this.app.fileTransferManager.getRecord(id);
   // check file access permission
   const owners = await this.app.data.getAttachmentsByFileTransferId(record.id);
   if (!owners.some(owner => owner.userId === c.userID)) return { error: 2, message: 'You are not allowed to access this record' };
   return {
    error: false,
    data: {
     record: pickFileUploadRecordFields(record, UPLOAD_RECORD_PICKED_FIELDS_FOR_FRONTEND),
     uploadData: {
      uploadedBytes: record.chunksReceived.length * record.chunkSize,
      role: c.userID === record.fromUserId ? FileUploadRole.SENDER : FileUploadRole.RECEIVER
     }
    }
   };
  } catch (err) {
   Log.error('Upload record not found', err);
   return { error: 'RECORD_NOT_FOUND', message: 'Record not found' };
  }
 }

 async upload_begin(c) {
  const { records, recipients } = c.params;
  if (!records) return { error: 'RECORDS_MISSING', message: 'Records are missing' };
  if (!recipients) return { error: 'RECIPIENTS_MISSING', message: 'Recipients are missing' };
  const allowedRecords: any[] = [];
  const disallowedRecords: any[] = [];
  for (let record of records) {
   const { id, fileOriginalName, fileMimeType, fileSize, type, chunkSize, fromUserUid, metadata } = record;
   const updatedRecord = await this.app.fileTransferManager.uploadBegin({
    id,
    fromUserId: c.userID,
    fromUserUid,
    type,
    fileOriginalName,
    fileMimeType,
    fileSize,
    chunkSize,
    metadata
   });
   // create attachment for sender
   await this.app.data.createAttachment(
    makeAttachmentRecord({
     userId: c.userID,
     fileTransferId: updatedRecord.id,
     // todo: when encrypted, this should be separate file path???
     filePath: updatedRecord.type === FileUploadRecordType.P2P ? null : FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.USER_FILE_NAME_STRATEGY(updatedRecord)
    })
   );
   // create attachments for each recipient
   for (let recipientAddress of recipients) {
    // todo: refactor this to a separate function
    let [usernameTo, domainTo] = recipientAddress.split('@');
    if (!usernameTo || !domainTo) {
     Log.error('Invalid username format', recipientAddress);
     continue;
    }
    usernameTo = usernameTo.toLowerCase();
    domainTo = domainTo.toLowerCase();
    const domainToID = await this.core.api.getDomainIDByName(domainTo);
    if (!domainToID) {
     Log.error('Domain name not found on this server', domainTo);
     continue;
    }
    const userToID = await this.core.api.getUserIDByUsernameAndDomainID(usernameTo, domainToID);
    await this.app.data.createAttachment(
     makeAttachmentRecord({
      userId: userToID,
      fileTransferId: updatedRecord.id,
      filePath: updatedRecord.type === FileUploadRecordType.P2P ? null : FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.USER_FILE_NAME_STRATEGY(updatedRecord)
     })
    );
   }
   allowedRecords.push(updatedRecord);
  }

  return { error: false, message: 'Upload started', allowedRecords, disallowedRecords };
 }

 async upload_cancel(c) {
  const { uploadId } = c.params;
  let record = await this.app.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 'RECORD_NOT_FOUND', message: 'Record not found' };
  record = await this.app.fileTransferManager.patchRecord(record.id, {
   status: FileUploadRecordStatus.CANCELED
  });
  await this.send_upload_update_notification({ record });
  return { error: false, message: 'Upload canceled' };
 }

 async upload_update_status(c) {
  const { uploadId, status: newStatus } = c.params;
  let record = await this.app.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 'RECORD_NOT_FOUND', message: 'Record not found' };
  const updateStatusAndSendNotification = async (status: FileUploadRecordStatus) => {
   record = await this.app.fileTransferManager.patchRecord(record.id, { status });
   await this.send_upload_update_notification({ record });
  };

  if (newStatus === FileUploadRecordStatus.CANCELED) {
   if (record.status !== FileUploadRecordStatus.UPLOADING || record.status !== FileUploadRecordStatus.BEGUN || record.status !== FileUploadRecordStatus.PAUSED) {
    return { error: 'INVALID_STATUS_CHANGE', message: 'Invalid status change to CANCELED from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.CANCELED);
  } else if (newStatus === FileUploadRecordStatus.PAUSED) {
   if (record.status !== FileUploadRecordStatus.UPLOADING) {
    return { error: 'INVALID_STATUS_CHANGE', message: 'Invalid status change to PAUSED from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.PAUSED);
  } else if (newStatus === FileUploadRecordStatus.UPLOADING) {
   if (record.status !== FileUploadRecordStatus.PAUSED) {
    return { error: 'INVALID_STATUS_CHANGE', message: 'Invalid status change to UPLOADING from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.UPLOADING);
  } else if (newStatus === FileUploadRecordStatus.ERROR) {
   await updateStatusAndSendNotification(FileUploadRecordStatus.ERROR);
  } else {
   return { error: 'INVALID_STATUS', message: 'Invalid status: ' + record.status };
  }
  return { error: false, message: 'Upload updated' };
 }

 async send_upload_update_notification({ record, uploadData }: { record: FileUploadRecord; uploadData?: any }, ignoreUserIds = []) {
  return await this.app.data.getAttachmentsByFileTransferId(record.id).then(attachments => {
   for (let attachment of attachments) {
    if (ignoreUserIds.includes(attachment.userId)) {
     continue;
    }
    this.signals.notifyUser(attachment.userId, 'upload_update', {
     record: pickFileUploadRecordFields(record, UPLOAD_RECORD_PICKED_FIELDS_FOR_FRONTEND),
     uploadData
    });
   }
  });
 }

 async message_send(c) {
  if (!c.params) return { error: 'PARAMETERS_MISSING', message: 'Parameters are missing' };
  if (!c.params.address) return { error: 'RECIPIENT_ADDRESS_MISSING', message: 'Recipient address is missing' };
  const userToAddress = c.params.address;
  let [usernameTo, domainTo] = userToAddress.split('@');
  if (!usernameTo || !domainTo) return { error: 'INVALID_USERNAME_FORMAT', message: 'Invalid username format' };
  usernameTo = usernameTo.toLowerCase();
  domainTo = domainTo.toLowerCase();
  const domainToID = await this.core.api.getDomainIDByName(domainTo);
  if (!domainToID) return { error: 'DOMAIN_NOT_FOUND', message: 'Domain name not found on this server' };
  const userToID = await this.core.api.getUserIDByUsernameAndDomainID(usernameTo, domainToID);
  if (!userToID) return { error: 'USERNAME_NOT_FOUND', message: 'User name not found on this server' };
  const userFromInfo = await this.core.api.userGetUserInfo(c.userID);
  const userFromDomain = await this.core.api.getDomainNameByID(userFromInfo.id_domains);
  const userFromAddress = userFromInfo.username + '@' + userFromDomain;
  if (!c.params.message) return { error: 'MESSAGE_MISSING', message: 'Message is missing' };
  let format = c.params.format ? c.params.format : 'plaintext';
  if (!this.isEnumValue(format)) return { error: 'INVALID_MESSAGE_FORMAT', message: 'Invalid message format' };
  if (!c.params.uid) return { error: 'MESSAGE_UID_MISSING', message: 'Message UID is missing' };
  const uid = c.params.uid;
  // TODO: don't define "created" here, rather do SELECT on table after INSERT
  const created = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const address_from = userFromInfo.username + '@' + userFromDomain;
  const address_to = usernameTo + '@' + domainTo;
  //console.log('message_send:', c.userID, uid, userFromAddress, userToAddress, c.params.message, format, created);
  const msg1_insert = await this.app.data.createMessage(c.corr, c.userID, uid, userFromAddress, userToAddress, userFromAddress, userToAddress, c.params.message, format, created);
  const msg1 = {
   id: Number(msg1_insert.insertId),
   uid,
   prev: msg1_insert.prev,
   address_from,
   address_to,
   message: c.params.message,
   format,
   created
  };
  this.signals.notifyUser(c.userID, 'new_message', msg1, c.corr);
  if (userToID !== userFromInfo.id) {
   // TODO: don't use "created" here, rather do SELECT on table after INSERT
   const msg2_insert = await this.app.data.createMessage(c.corr, userToID, uid, userToAddress, userFromAddress, userFromAddress, userToAddress, c.params.message, format, created);
   const msg2 = {
    id: Number(msg2_insert.insertId),
    uid,
    prev: msg2_insert.prev,
    address_from,
    address_to,
    message: c.params.message,
    format,
    created
   };
   this.signals.notifyUser(userToID, 'new_message', msg2, c.corr);
  }
  return { error: false, message: 'Message sent', uid };
 }

 async message_delete(c) {
  if (!c.params) return { error: 'PARAMETERS_MISSING', message: 'Parameters are missing' };
  if (!c.params.uid) return { error: 'MESSAGE_UID_MISSING', message: 'Message UID is missing' };

  Log.debug('message_delete params', c.params);
  const userId = c.userID;
  Log.debug('message_delete userId', userId);

  await this.app.data.deleteMessage(userId, c.params.uid);
 }

 async message_reaction(c) {
  if (!c.params) return { error: 'PARAMETERS_MISSING', message: 'Parameters are missing' };
  if (!c.params.messageUid) return { error: 'MESSAGE_UID_MISSING', message: 'Message UID is missing' };
  if (!c.params.operation) return { error: 'OPERATION_MISSING', message: 'Operation is missing' };
  if (!c.params.reaction) return { error: 'REACTION_OBJECT_MISSING', message: 'Reaction object is missing' };
  if (!c.params.reaction.emoji_codepoints_rgi) return { error: 'REACTION_NOT_SPECIFIED', message: 'You must define emoji_codepoints_rgi in the reaction object' };

  const { messageUid, operation, reaction } = c.params;

  const userId = c.userID;
  const userFromInfo = await this.core.api.userGetUserInfo(userId);
  const userFromDomain = await this.core.api.getDomainNameByID(userFromInfo.id_domains);
  const userFromAddress = userFromInfo.username + '@' + userFromDomain;

  const dispatchNotification = async () => {
   const recipients = await this.app.repos.messages.findMessageRecipients(messageUid);
   const currentReactions = await this.app.repos.messagesReactions.getSingleMessageReactions(messageUid);
   recipients.forEach(recipient => {
    this.signals.notifyUser(recipient.id_users, 'message_update', {
     type: 'reaction',
     message: {
      uid: messageUid,
      reactions: currentReactions
     }
    });
   });
  };

  if (operation === 'set') {
   const res = await this.app.services.messagesReactions.setUserMessageReaction(userId, userFromAddress, messageUid, reaction);
   Log.debug('op change res', operation, res);
   dispatchNotification();
  } else if (operation === 'unset') {
   const res = await this.app.services.messagesReactions.unsetUserMessageReaction(userId, userFromAddress, messageUid, reaction);
   Log.debug('op change res', operation, res);
   dispatchNotification();
  }

  return { error: false, message: 'Reaction was changed' };
 }

 async message_seen(c) {
  if (!c.params) return { error: 'PARAMETERS_MISSING', message: 'Parameters are missing' };
  if (!c.params.uid) return { error: 'MESSAGE_UID_MISSING', message: 'Message UID is missing' };
  if (!c.userID) throw new Error('User ID is missing'); // TODO: why not return?
  let result = await this.message_seen_mutex.runExclusive(async () => {
   // TRANSACTION BEGIN
   const res = await this.app.data.userGetMessage(c.userID, c.params.uid);
   if (!res) return { error: 'WRONG_MESSAGE_ID', message: 'Wrong message ID' };
   //Log.debug(c.corr, 'res....seen:', res);
   if (res.seen) return { error: 'SEEN_ALREADY_SET', message: 'Seen flag was already set' };
   await this.app.data.userMessageSeen(c.params.uid);
   // TRANSACTION END
   return true;
  });
  if (result !== true) return result;
  const res2 = await this.app.data.userGetMessage(c.userID, c.params.uid);
  const [username, domain] = res2.address_from.split('@');
  const userFromID = await this.core.api.getUserIDByUsernameAndDomainName(username, domain);
  this.signals.notifyUser(
   userFromID,
   'seen_message',
   {
    uid: c.params.uid,
    seen: res2.seen
   },
   c.corr
  );
  this.signals.notifyUser(
   c.userID,
   'seen_inbox_message',
   {
    uid: c.params.uid,
    address_from: res2.address_from,
    seen: res2.seen
   },
   c.corr
  );
  return { error: false, message: 'Seen flag set successfully' };
 }

 async messages_list(c) {
  if (!c.params) return { error: 'PARAMETERS_MISSING', message: 'Parameters are missing' };
  if (!c.params.address) return { error: 'RECIPIENT_ADDRESS_MISSING', message: 'Recipient address is missing' };
  const messages = await this.app.data.userListMessages(c.userID, c.userAddress, c.params.address, c.params?.base, c.params?.prev, c.params?.next);
  await this.app.data.fetchAdditionalDataForMessages(messages);
  return { error: false, data: { messages } };
 }

 async conversations_list(c) {
  const conversations = await this.app.data.userListConversations(c.userID, c.userAddress);
  Log.debug(c.corr, 'conversations:');
  for (let i in conversations) {
   Log.debug(c.corr, i);
  }
  conversations.meta = undefined;
  return { error: false, data: { conversations } };
 }
}
