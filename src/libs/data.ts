import { DataGeneric, newLogger } from 'yellow-server-common';
import { Mutex } from 'async-mutex';
import { AttachmentRecord, FileUploadRecord, FileUploadRecordStatus } from './FileTransfer/types.ts';
import * as changeKeys from 'change-case/keys';
import { convertUploadRecordFromDB, convertUploadRecordToDB } from './FileTransfer/utils.ts';
import { MessageReaction } from '@/libs/repositories/types.ts';
import Repositories from '@/libs/repositories/_repositories.ts';

let Log = newLogger('data');

interface Message {
 id: number;
 id_users: number;
 uid: string;
 address_from: string;
 address_to: string;
 message: string;
 seen: Date | null;
 created: Date;
 prev: number | string | undefined;
 next: number | string | undefined;
 reactions: MessageReaction[];
}

interface Conversation {
 address: string;
 last_message_text: string;
 last_message_date: Date;
 unread_count: number;
}

class Data extends DataGeneric {
 createMessageMutex: Mutex;
 repos: Repositories;

 constructor(settings: any, repos: Repositories) {
  super(settings);
  this.createMessageMutex = new Mutex();
  this.repos = repos;
 }

 async createDB(): Promise<void> {
  /*
  try {
   await this.db.query('CREATE TABLE IF NOT EXISTS messages (id INT PRIMARY KEY AUTO_INCREMENT, id_users INT, uid VARCHAR(255) NOT NULL, address_from VARCHAR(255) NOT NULL, address_to VARCHAR(255) NOT NULL, message TEXT NOT NULL, format VARCHAR(16) NOT NULL DEFAULT "plaintext", seen TIMESTAMP NULL DEFAULT NULL, created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (uid, id_users))');
   await this.db.query(`
    CREATE TABLE IF NOT EXISTS attachments
    (
     id
     varchar
    (
     36
    ) NOT NULL,
     file_transfer_id varchar
    (
     36
    ) NOT NULL,
     user_id int
    (
     11
    ) unsigned NOT NULL,
     file_path text DEFAULT NULL,
     created timestamp NOT NULL DEFAULT current_timestamp
    (
    ),
     updated timestamp NOT NULL DEFAULT current_timestamp
    (
    ) ON UPDATE current_timestamp
    (
    )
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE =utf8mb4_unicode_ci;
   `);
   await this.db.query(`
    CREATE TABLE IF NOT EXISTS file_uploads
    (
     id
     varchar
    (
     36
    ) NOT NULL,
     from_user_id int
    (
     11
    ) unsigned NOT NULL,
     from_user_uid varchar
    (
     255
    ) NOT NULL,
     type varchar
    (
     255
    ) NOT NULL,
     status varchar
    (
     255
    ) NOT NULL,
     error_type varchar
    (
     255
    ) DEFAULT NULL,
     file_original_name text NOT NULL,
     file_mime_type text NOT NULL,
     file_size bigint
    (
     20
    ) unsigned NOT NULL,
     file_name text DEFAULT NULL,
     file_folder text DEFAULT NULL,
     file_extension text DEFAULT NULL,
     chunk_size int
    (
     10
    ) unsigned NOT NULL,
     chunks_received longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '[]',
     created timestamp NOT NULL DEFAULT current_timestamp
    (
    ),
     updated timestamp NOT NULL DEFAULT current_timestamp
    (
    ) ON UPDATE current_timestamp
    (
    )
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE =utf8mb4_unicode_ci;
   `);
   await this.db.query(`
    ALTER TABLE file_uploads
     ADD metadata json NULL AFTER chunks_received;
   `);
  } catch (ex) {
   Log.info(ex);
  }
  try {
   await this.db.query(`
    ALTER TABLE messages add constraint unique_uid_id_users unique (uid, id_users);
   `);
  } catch (ex) {
   Log.info(ex);
   //process.exit(1);
  }*/
 }

 async createFileUpload(fileUploadRecord: FileUploadRecord) {
  fileUploadRecord = convertUploadRecordToDB(fileUploadRecord) as FileUploadRecord;
  // @ts-ignore
  const values = [fileUploadRecord.id, fileUploadRecord.from_user_id, fileUploadRecord.from_user_uid, fileUploadRecord.type, fileUploadRecord.file_original_name, fileUploadRecord.file_name, fileUploadRecord.file_mime_type, fileUploadRecord.file_size, fileUploadRecord.file_folder, fileUploadRecord.file_extension, fileUploadRecord.chunk_size, fileUploadRecord.status, fileUploadRecord.metadata];
  return await this.db.query(
   `
    INSERT INTO file_uploads (id, from_user_id, from_user_uid, type, file_original_name, file_name, file_mime_type,
                              file_size, file_folder, file_extension, chunk_size, status, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   `,
   values
  );
 }

 async getFileUpload(id: string) {
  const data = (await this.db.query('SELECT * FROM file_uploads WHERE id = ?', [id])) as any;
  return convertUploadRecordFromDB(data?.[0]);
 }

 async getFileUploadsForCheck() {
  const data = await this.db.query('SELECT * FROM file_uploads WHERE status = ? OR status = ? OR status = ? ORDER BY created DESC', [FileUploadRecordStatus.BEGUN, FileUploadRecordStatus.UPLOADING, FileUploadRecordStatus.PAUSED]);
  return data.map(convertUploadRecordFromDB);
 }

 async patchFileUpload(id: string, data: Partial<FileUploadRecord>) {
  data = convertUploadRecordToDB(data);
  const keys = Object.keys(data);
  const values = Object.values(data);
  const set = keys.map((key, i) => `${key} = ?`).join(', ');
  return await this.db.query(
   `UPDATE file_uploads
                              SET ${set}
                              WHERE id = ?`,
   [...values, id]
  );
 }

 async createAttachment(attachmentRecord: AttachmentRecord) {
  return await this.db.query(
   `
    INSERT INTO attachments (id, user_id, file_transfer_id, file_path)
    VALUES (?, ?, ?, ?)
   `,
   [attachmentRecord.id, attachmentRecord.userId, attachmentRecord.fileTransferId, attachmentRecord.filePath]
  );
 }

 async getAttachmentsByFileTransferId(fileTransferId: string) {
  let records = (await this.db.query(
   `
    SELECT *
    FROM attachments
    WHERE file_transfer_id = ?
   `,
   [fileTransferId]
  )) as AttachmentRecord[];

  if (records) {
   records = records.map(record => changeKeys.camelCase(record) as AttachmentRecord);
  }

  return records;
 }

 async createMessage(corr: object, userID: number, uid: string, user_address: string, conversation: string, address_from: string, address_to: string, message: string, format: string, created: Date | null = null): Promise<any> {
  // TODO: after we switch to conversations as a separate table get rid of created parameter
  return await this.createMessageMutex.runExclusive(async () => {
   Log.debug(corr, 'data.createMessage: ', userID, uid, address_from, address_to, format, message);
   const last_id = this.getLastMessageID(userID, user_address, conversation);
   let r = await this.db.query('INSERT INTO messages (id_users, uid, address_from, address_to, message, format, created) VALUES (?, ?, ?, ?, ?, ?, ?)', [userID, uid, address_from, address_to, message, format, created]);
   r.prev = last_id; /* note: we could set null here, client would create lazy loader and run an extra query to fill a possible hole. */
   // TODO: let's do the following after we switch to conversations as a separate table
   // TODO: to get rid of Mutex we can SELECT previous message ID as ID less than last message ID (r.id) AFTER INSERT.
   return r;
  });
 }

 async userGetMessage(userID: number, uid: string): Promise<Message | false> {
  const res: Message[] = await this.db.query<Message[]>('SELECT id, id_users, uid, address_from, address_to, message, format, seen, created FROM messages WHERE uid = ? and id_users = ?', [uid, userID]);
  return res.length === 1 ? res[0] : false;
 }

 async userMessageSeen(uid: string): Promise<void> {
  await this.db.query('UPDATE messages SET seen = CURRENT_TIMESTAMP WHERE uid = ?', [uid]);
 }

 async deleteMessage(userID: number, uid: string): Promise<void> {
  await this.db.query('DELETE FROM messages WHERE uid = ? AND id_users = ?', [uid, userID]);
 }

 async userListConversations(userID: number, userAddress: string): Promise<Conversation[] | false> {
  Log.debug('userListConversations', userID, userAddress);
  const res: Conversation[] = await this.db.query<Conversation[]>(
   `
    SELECT conv.other_address as address,
           m.message          as last_message_text,
           m.created          as last_message_date,
           conv.unread_count
    FROM (SELECT IF(address_from = ?, address_to, address_from) AS other_address,
                 MAX(id)                                        AS last_message_id,
                 (SELECT COUNT(*)
                  FROM messages
                  WHERE address_to = ?
                    AND address_from = other_address
                    AND id_users = ?
                    AND seen IS NULL)                           AS unread_count
          FROM messages
          WHERE ? IN (address_from, address_to)
            AND id_users = ?
          GROUP BY other_address) AS conv
          JOIN messages m ON m.id = conv.last_message_id
    WHERE m.id_users = ?
    ORDER BY last_message_date DESC;
   `,
   [userAddress, userAddress, userID, userAddress, userID, userID]
  );
  return res;
 }

 async fetchAdditionalDataForMessages(messages: Message[]) {
  const messageUids = messages.map(message => message.uid);
  const reactions = await this.repos.messagesReactions.getMessagesReactions(messageUids);
  return messages.map(message => {
   message.reactions = reactions.filter(reaction => reaction.message_uid === message.uid);
   return message;
  });
 }

 async userListMessages(userID: number, address_my: string, address_other: string, base: number | 'unseen' | string = 0, prevCount = 0, nextCount = 0): Promise<Message[]> {
  let base_id;
  Log.debug('userListMessages', userID, address_my, address_other, base, prevCount, nextCount);
  if (base === 'unseen') {
   base_id = await this.getFirstUnseenMessageID(userID, address_my, address_other);
   Log.debug('base_id', base_id);
   if (base_id == null) base_id = await this.getLastMessageID(userID, address_my, address_other);
   Log.debug('base_id', base_id);
   if (base_id == null || base_id === undefined) return [];
  } else if (typeof base === 'string' && base.startsWith('uid:')) {
   const uid = base.slice(4);
   const message = await this.userGetMessage(userID, uid);
   if (!message) return [];
   base_id = message.id;
  } else base_id = base;
  /* fixme...*/
  let result = [await this.getMessage(userID, base_id)];
  Log.debug('userListMessages result: ', JSON.stringify(result, null, 2));
  let prevMessages = [];
  if (prevCount > 0) {
   prevMessages = await this.getPrevMessages(userID, address_my, address_other, base_id, prevCount + 1);
   Log.debug('prevMessages: ', JSON.stringify(prevMessages, null, 2));
   result = prevMessages.concat(result);
  }
  let nextMessages = [];
  if (nextCount > 0) {
   nextMessages = await this.getNextMessages(userID, address_my, address_other, base_id, nextCount + 1);
   Log.debug('nextMessages: ', JSON.stringify(nextMessages, null, 2));
   result = result.concat(nextMessages);
  }
  this.linkupMessages(result);
  if (prevCount > 0) {
   if (prevMessages.length === prevCount + 1) result = result.slice(1);
  }
  if (nextCount > 0) {
   if (nextMessages.length === nextCount + 1) {
    Log.debug('remove last message.');
    result = result.slice(0, -1);
   }
  }
  if (result.length === 0) return [];
  const prevPrevMessage = await this.getPrevMessages(userID, address_my, address_other, result[0].id, 1);
  if (prevPrevMessage.length === 0) {
   result[0].prev = 'none';
  }
  const nextNextMessage = await this.getNextMessages(userID, address_my, address_other, result[result.length - 1].id, 1);
  if (nextNextMessage.length === 0) {
   result[result.length - 1].next = 'none';
  }
  return result; //.map((message: Message) => this.addSeenFlagToSelfMessages(message));
 }

 private linkupMessages(messages: Message[]) {
  Log.debug('linkupMessages', messages.length);
  Log.debug('linkupMessages', JSON.stringify(messages, null, 2));
  for (let i = 0; i < messages.length; i++) {
   Log.debug('linkupMessages', i, JSON.stringify(messages[i], null, 2));
   if (i > 0) messages[i].prev = messages[i - 1].id;
   if (i < messages.length - 1) messages[i].next = messages[i + 1].id;

   // debug server vs client-side linkup
   messages[i].prev_orig = messages[i].prev;
   messages[i].next_orig = messages[i].next;
  }
 }

 private async getPrevMessages(userID: number, address_my: string, address_other: string, base: number, count: number) {
  Log.debug('getPrevMessages', userID, address_my, address_other, base, count);
  const res3: Message[] = await this.db.query<Message>(
   `
    SELECT id,
           uid,
           address_from,
           address_to,
           message,
           format,
           seen,
           created
    FROM messages
    WHERE id_users = ?
      AND (
     (address_from = ? AND address_to = ?)
      OR
     (address_from = ? AND address_to = ?)
     )
      AND id < ?
    ORDER BY id DESC LIMIT ?
   `,
   [userID, address_other, address_my, address_my, address_other, base, count]
  );
  return res3.reverse();
 }

 private async getNextMessages(userID: number, address_my: string, address_other: string, base: number, count: number) {
  Log.debug('getNextMessages', userID, address_my, address_other, base, count);
  const res4: Message[] = await this.db.query<Message>(
   `
    SELECT id,
           uid,
           address_from,
           address_to,
           message,
           format,
           seen,
           created
    FROM messages
    WHERE id_users = ?
      AND (
     (address_from = ? AND address_to = ?)
      OR
     (address_from = ? AND address_to = ?)
     )
      AND id > ?
    ORDER BY id ASC LIMIT ?
   `,
   [userID, address_other, address_my, address_my, address_other, base, count]
  );
  return res4;
 }

 private async getMessage(userID: number, id: number) {
  Log.debug('getMessage', userID, id);
  const res: Message = await this.db.query<Message>(
   `SELECT *
                                                     FROM messages
                                                     WHERE id_users = ?
                                                       AND id = ?`,
   [userID, id]
  );
  Log.debug('getMessage', JSON.stringify(res, null, 2));
  return res[0];
 }

 private async getLastMessageID(userID: number, address_my: string, address_other: string) {
  const res2: { id: number }[] = await this.db.query<{ id: number }>(
   `
    SELECT id
    FROM messages
    WHERE id_users = ?
      AND (
     (address_from = ? AND address_to = ?)
      OR
     (address_from = ? AND address_to = ?)
     )
    ORDER BY id DESC LIMIT 1
   `,
   [userID, address_my, address_other, address_other, address_my]
  );
  return res2?.[0]?.id;
 }

 private async getFirstUnseenMessageID(userID: number, address_my: string, address_other: string) {
  // Find the first unseen message ID
  const res1: { id: number }[] = await this.db.query<{ id: number }>(
   `
    SELECT id
    FROM messages
    WHERE id_users = ?
      AND (address_from = ? AND address_to = ?)
      AND seen IS NULL
    ORDER BY id ASC LIMIT 1
   `,
   [userID, address_other, address_my]
  );
  return res1?.[0]?.id;
 }

 addSeenFlagToSelfMessages(message: Message): Message {
  if (message.address_from === message.address_to) message.seen = message.created;
  return message;
 }

 async checkDatabase(): Promise<string | null> {
  // check messages table for duplicated messages: any uid should only appear at most twice (one for each direction of 1:1 conversation)
  const res = await this.db.query('SELECT uid, COUNT(*) as count FROM messages GROUP BY uid HAVING count > 2');
  if (res.length > 0) {
   Log.warning('Duplicated messages found: ', res);
   return 'Proposed cleanup query: DELETE FROM messages WHERE uid IN (' + res.map((r: any) => '"' + r.uid + '"').join(',') + ')';
  }
  return null;
 }
}

export default Data;
