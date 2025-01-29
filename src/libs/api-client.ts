import { ModuleApiBase, newLogger } from 'yellow-server-common';
import { Mutex } from 'async-mutex';
import FileTransferManager from './FileTransfer/FileTransferManager';
import { FileUploadRecordStatus, FileUploadRecordType, FileUploadRole } from './FileTransfer/types';
import { makeAttachmentRecord } from './FileTransfer/utils';
import { DownloadChunkP2PNotFoundError } from './FileTransfer/errors';

let Log = newLogger('api-client');

enum MessageFormat {
 plaintext = 'plaintext',
 html = 'html'
}

export class ApiClient extends ModuleApiBase {
 message_seen_mutex: Mutex;
 fileTransferManager: FileTransferManager;

 // TODO: move this function to common:
 isEnumValue(value: string): boolean {
  return Object.values(MessageFormat).includes(value as MessageFormat);
 }

 constructor(app) {
  super(app, ['new_message', 'seen_message', 'seen_inbox_message', 'upload_update', 'download_chunk', 'ask_for_chunk']);
  this.commands = {
   ...this.commands,
   message_send: { method: this.message_send.bind(this), reqUserSession: true },
   message_seen: { method: this.message_seen.bind(this), reqUserSession: true },
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

  // todo: MAKE THIS SYNC AFTER FIXING INIT!!! // todo: don't do this before app start
  setTimeout(() => {
   this.fileTransferManager = new FileTransferManager({
    findRecord: app.data.getFileUpload.bind(app.data)
   });
  });
 }

 async download_chunk(c) {
  const { uploadId, offsetBytes, chunkSize } = c.params;

  const record = await this.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 1, message: 'Record not found' };

  if (record.type === FileUploadRecordType.SERVER) {
   const { chunk } = await this.fileTransferManager.getFileChunk(uploadId, offsetBytes, chunkSize);
   return {
    error: 0,
    chunk
   };
  } else if (record.type === FileUploadRecordType.P2P) {
   try {
    // todo: change chunkId to offsetBytes and chunkSize to support dynamic chunk size in future
    const chunkId = Math.floor(offsetBytes / chunkSize);
    const { chunk } = await this.fileTransferManager.getFileChunkP2P(uploadId, chunkId);

    // prefetch
    // todo: make better & support dynamic chunksize
    const existingP2PChunks = this.fileTransferManager.p2pTempChunks.get(uploadId);
    const chunksLength = existingP2PChunks?.length;
    const prefetchTolerance = 5;
    const prefetchDiff = chunksLength - prefetchTolerance;
    if (chunk.chunkId > prefetchDiff) {
     const lastChunk = existingP2PChunks[chunksLength - 1];
     if (lastChunk) {
      this.signals.notifyUser(record.fromUserId, 'ask_for_chunk', {
       uploadId,
       offsetBytes: lastChunk.chunkId * chunkSize,
       chunkSize
      });
     }
    }

    return {
     error: 0,
     chunk
    };
   } catch (e) {
    if (e instanceof DownloadChunkP2PNotFoundError) {
     this.signals.notifyUser(record.fromUserId, 'ask_for_chunk', {
      uploadId,
      offsetBytes,
      chunkSize
     });
     return { error: 2, message: 'Wait for chunk' };
    } else {
     return { error: 3, message: 'Chunk could not be obtained' };
    }
   }
  } else {
   return { error: 4, message: 'Unknown record type' };
  }
 }

 async upload_begin(c) {
  const { records, recipients } = c.params;

  if (!records) return { error: 1, message: 'Records are missing' };
  if (!recipients) return { error: 2, message: 'Recipients are missing' };

  const allowedRecords = [];
  const disallowedRecords = [];
  for (let record of records) {
   const { id, fileName, fileMimeType, fileSize, type } = record;
   const updatedRecord = await this.fileTransferManager.uploadBegin({
    id,
    fromUserId: c.userID,
    type,
    fileName,
    fileMimeType,
    fileSize,
    filePath: 'uploads/message-attachments'
   });
   await this.app.data.createFileUpload(updatedRecord);

   // create attachment for sender
   await this.app.data.createAttachment(
    makeAttachmentRecord({
     userId: c.userID,
     fileTransferId: updatedRecord.id,
     filePath: updatedRecord.filePath // todo: when encrypted, this should be separate file path???
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
      filePath: updatedRecord.filePath // todo: when encrypted, this should be separate file path???
     })
    );
   }

   allowedRecords.push(updatedRecord);
  }

  return { error: 0, message: 'Upload started', allowedRecords, disallowedRecords };
 }

 async upload_cancel(c) {
  const { uploadId } = c.params;
  const record = await this.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 1, message: 'Record not found' };
  record.status = FileUploadRecordStatus.CANCELED;
  await this.app.data.updateFileUpload(record.id, {
   status: FileUploadRecordStatus.CANCELED
  });
  await this.send_upload_update_notification(record, [c.userID]);
  return { error: 0, message: 'Upload canceled' };
 }

 async upload_update_status(c) {
  const { uploadId, status: newStatus } = c.params;
  const record = await this.fileTransferManager.getRecord(uploadId);
  if (!record) return { error: 1, message: 'Record not found' };

  const updateStatusAndSendNotification = async status => {
   await this.app.data.updateFileUpload(record.id, {
    status
   });
   record.status = status;
   await this.send_upload_update_notification(record);
  };

  if (newStatus === FileUploadRecordStatus.CANCELED) {
   if (record.status !== FileUploadRecordStatus.UPLOADING || record.status !== FileUploadRecordStatus.BEGUN || record.status !== FileUploadRecordStatus.PAUSED || record.status !== FileUploadRecordStatus.CANCELED) {
    return { error: 3, message: 'Invalid status change to CANCELED from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.CANCELED);
  } else if (newStatus === FileUploadRecordStatus.PAUSED) {
   if (record.status !== FileUploadRecordStatus.UPLOADING) {
    return { error: 3, message: 'Invalid status change to PAUSED from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.PAUSED);
  } else if (newStatus === FileUploadRecordStatus.UPLOADING) {
   if (record.status !== FileUploadRecordStatus.PAUSED) {
    return { error: 3, message: 'Invalid status change to UPLOADING from ' + record.status };
   }
   await updateStatusAndSendNotification(FileUploadRecordStatus.UPLOADING);
  } else {
   return { error: 2, message: 'Invalid status: ' + record.status };
  }

  return { error: 0, message: 'Upload updated' };
 }

 async upload_chunk(c) {
  const { chunk } = c.params;
  const process = await this.fileTransferManager.processChunk(chunk);
  const { record } = process;

  await this.app.data.updateFileUpload(record.id, {
   chunks_received: JSON.stringify(record.chunksReceived),
   status: FileUploadRecordStatus.UPLOADING
  });

  if (record.status === FileUploadRecordStatus.BEGUN) {
   record.status = FileUploadRecordStatus.UPLOADING;
   this.send_upload_update_notification(record);
  }

  // check if finished
  if (record.status === FileUploadRecordStatus.FINISHED) {
   await this.app.data.updateFileUpload(record.id, {
    status: FileUploadRecordStatus.FINISHED
   });
   this.send_upload_update_notification(record);
  }

  return { error: 0, message: 'Chunk accepted' };
 }

 async upload_get(c) {
  const { id } = c.params;
  const record = await this.fileTransferManager.getRecord(id);
  //const record = await this.fileTransferManager.getRecord(id)

  // check file access permission
  const owners = await this.app.data.getAttachmentsByFileTransferId(record.id);
  if (!owners.some(owner => owner.userId === c.userID)) {
   return { error: 1, message: 'You are not allowed to access this record' };
  }

  Log.debug('upload_get', id, record);
  if (!record) return { error: 1, message: 'Record not found' };
  return {
   error: 0,
   data: {
    record,
    uploadData: {
     role: c.userID === record.fromUserId ? FileUploadRole.SENDER : FileUploadRole.RECEIVER
    }
   }
  };
 }

 async send_upload_update_notification(record, ignoreUserIds = []) {
  this.app.data.getAttachmentsByFileTransferId(record.id).then(attachments => {
   for (let attachment of attachments) {
    if (ignoreUserIds.includes(attachment.userId)) {
     continue;
    }
    this.signals.notifyUser(attachment.userId, 'upload_update', {
     record
    });
   }
  });
 }

 async message_send(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  const userToAddress = c.params.address;
  let [usernameTo, domainTo] = userToAddress.split('@');
  if (!usernameTo || !domainTo) return { error: 4, message: 'Invalid username format' };
  usernameTo = usernameTo.toLowerCase();
  domainTo = domainTo.toLowerCase();
  const domainToID = await this.core.api.getDomainIDByName(domainTo);
  if (!domainToID) return { error: 5, message: 'Domain name not found on this server' };
  const userToID = await this.core.api.getUserIDByUsernameAndDomainID(usernameTo, domainToID);
  if (!userToID) return { error: 6, message: 'User name not found on this server' };
  const userFromInfo = await this.core.api.userGetUserInfo(c.userID);
  const userFromDomain = await this.core.api.getDomainNameByID(userFromInfo.id_domains);
  const userFromAddress = userFromInfo.username + '@' + userFromDomain;
  if (!c.params.message) return { error: 7, message: 'Message is missing' };
  let format = c.params.format ? c.params.format : 'plaintext';
  if (!this.isEnumValue(format)) return { error: 8, message: 'Invalid message format' };
  if (!c.params.uid) return { error: 9, message: 'Message UID is missing' };
  const uid = c.params.uid;
  // TODO: don't define "created" here, rather do SELECT on table after INSERT
  const created = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const address_from = userFromInfo.username + '@' + userFromDomain;
  const address_to = usernameTo + '@' + domainTo;
  console.log('message_send:', c.userID, uid, userFromAddress, userToAddress, c.params.message, format, created);
  const msg1_insert = await this.app.data.createMessage(c.userID, uid, userFromAddress, userToAddress, userFromAddress, userToAddress, c.params.message, format, created);
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
  this.signals.notifyUser(c.userID, 'new_message', msg1);
  if (userToID !== userFromInfo.id) {
   // TODO: don't use "created" here, rather do SELECT on table after INSERT
   const msg2_insert = await this.app.data.createMessage(userToID, uid, userToAddress, userFromAddress, userFromAddress, userToAddress, c.params.message, format, created);
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
   this.signals.notifyUser(userToID, 'new_message', msg2);
  }
  return { error: 0, message: 'Message sent', uid };
 }

 async message_seen(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.uid) return { error: 2, message: 'Message UID is missing' };
  if (!c.userID) throw new Error('User ID is missing');
  let result = await this.message_seen_mutex.runExclusive(async () => {
   // TRANSACTION BEGIN
   const res = await this.app.data.userGetMessage(c.userID, c.params.uid);
   if (!res) return { error: 3, message: 'Wrong message ID' };
   //Log.debug(c.corr, 'res....seen:', res);
   if (res.seen) return { error: 4, message: 'Seen flag was already set' };
   await this.app.data.userMessageSeen(c.params.uid);
   // TRANSACTION END
   return true;
  });
  if (result !== true) return result;
  const res2 = await this.app.data.userGetMessage(c.userID, c.params.uid);
  const [username, domain] = res2.address_from.split('@');
  const userFromID = await this.core.api.getUserIDByUsernameAndDomainName(username, domain);
  this.signals.notifyUser(userFromID, 'seen_message', {
   uid: c.params.uid,
   seen: res2.seen
  });
  this.signals.notifyUser(c.userID, 'seen_inbox_message', {
   uid: c.params.uid,
   address_from: res2.address_from,
   seen: res2.seen
  });
  return { error: 0, message: 'Seen flag set successfully' };
 }

 async messages_list(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  const messages = await this.app.data.userListMessages(c.userID, c.userAddress, c.params.address, c.params?.base, c.params?.prev, c.params?.next);
  return { error: 0, data: { messages } };
 }

 async conversations_list(c) {
  const conversations = await this.app.data.userListConversations(c.userID, c.userAddress);
  Log.debug(c.corr, 'conversations:');
  for (let i in conversations) {
   Log.debug(c.corr, i);
  }
  conversations.meta = undefined;
  return { error: 0, data: { conversations } };
 }
}
