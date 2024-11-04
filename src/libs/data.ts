import { Log, DataGeneric } from 'yellow-server-common';

interface Message {
 id: number;
 id_users: number;
 uid: string;
 address_from: string;
 address_to: string;
 message: string;
 seen: Date | null;
 created: Date;
};

interface Conversation {
 address: string;
 last_message_text: string;
 last_message_date: Date;
 unread_count: number;
};

class Data extends DataGeneric {
 constructor(settings) {
  super(settings);
 }

 async createDB(): Promise<void> {
  try {
   await this.db.query(
    'CREATE TABLE IF NOT EXISTS messages (id INT PRIMARY KEY AUTO_INCREMENT, id_users INT, uid VARCHAR(255) NOT NULL, address_from VARCHAR(255) NOT NULL, address_to VARCHAR(255) NOT NULL, message TEXT NOT NULL, seen TIMESTAMP NULL DEFAULT NULL, created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)'
   );
  } catch (ex) {
   Log.info(ex);
   process.exit(1);
  }
 }

 async createMessage(
  userID: number,
  uid: string,
  address_from: string,
  address_to: string,
  message: string,
  created: Date = null
 ): Promise<any> {
  Log.debug('data.createMessage: ', userID, uid, address_from, address_to, message);
  return await this.db.query(
   'INSERT INTO messages (id_users, uid, address_from, address_to, message, created) VALUES (?, ?, ?, ?, ?, ?)',
   [userID, uid, address_from, address_to, message, created]
  );
 }

 async userGetMessage(userID: number, uid: string): Promise<Message | false> {
  const res: Message[] = await this.db.query<Message>(
   'SELECT id, id_users, uid, address_from, address_to, message, seen, created FROM messages WHERE uid = ? and id_users = ?',
    [uid, userID]
  );
  return res.length === 1 ? res[0] : false;
 }

 async userMessageSeen(uid: string): Promise<void> {
  await this.db.query('UPDATE messages SET seen = CURRENT_TIMESTAMP WHERE uid = ?', [uid]);
 }

 async userListConversations(userID: number, userAddress: string): Promise<Conversation[] | false> {
  Log.debug('userListConversations', userID, userAddress);

  const res: Conversation[] = await this.db.query<Conversation>(
   `
      SELECT
        conv.other_address as address,
        m.message as last_message_text,
        m.created as last_message_date,
        conv.unread_count
      FROM (
        SELECT
          IF(address_from = ?, address_to, address_from) AS other_address,
          MAX(id) AS last_message_id,
          (SELECT COUNT(*) FROM messages WHERE address_to = ? AND address_from = other_address AND id_users = ? AND seen IS NULL) AS unread_count
        FROM messages
        WHERE ? IN (address_from, address_to)
          AND id_users = ?
        GROUP BY other_address
      ) AS conv
      JOIN messages m ON m.id = conv.last_message_id
      WHERE m.id_users = ?;
      `,
    [userAddress, userAddress, userID, userAddress, userID, userID]
  );
  return res;
 }

 async userListMessages(
  userID: number,
  address_my: string,
  address_other: string,
  prevCount = 0,
  nextCount = 0,
  lastID: number | 'unseen' = 0
 ): Promise<Message[]> {

  if (lastID === 'unseen') {
   let base = await this.getFirstUnseenMessage(userID, address_my);
   if (base == null) base = await this.getLastMessage(userID, address_my);
   if (base == null) return [];

   if (prevCount > 0) {
    const prevID = await this.getPrevMessage(userID, address_my, base, prevCount);


    const res3: Message[] = await this.db.query<Message>(
     `
        SELECT id, uid, address_from, address_to, message, seen, created
        FROM messages
        WHERE id_users = ?
          AND (
            (address_from = ? AND address_to = ?)
            OR
            (address_from = ? AND address_to = ?)
          )
          AND id < ?
        ORDER BY id DESC LIMIT 30
        `,
     [userID, address_other, address_my, address_my, address_other, first_unseen_ID]
    );
    lastID = res3.length > 0 ? res3[res3.length - 1].id : first_unseen_ID;
   }

   const res4: Message[] = await this.db.query<Message>(
    `
      SELECT id, uid, address_from, address_to, message, seen, created
      FROM messages
      WHERE id_users = ?
        AND (
          (address_from = ? AND address_to = ?)
          OR
          (address_from = ? AND address_to = ?)
        )
        AND id > ?
      ORDER BY id DESC
      LIMIT ?
      `,
    [userID, address_my, address_other, address_other, address_my, lastID, count]
   );
   return res4.map((message: Message) => this.addSeenFlagToSelfMessages(message));
  }
 }

 private async getLastMessage(userID: number, address_my: string) {
  const res2: { id: number }[] = await this.db.query<{ id: number }>(
   `
          SELECT id
          FROM messages
          WHERE id_users = ?
            AND address_to = ?
          ORDER BY id DESC LIMIT 1
          `,
   [userID, address_my]
  );
  return res2?.[0].id;
 }

 private async getFirstUnseenMessage(userID: number, address_my: string) {
  // Find the first unseen message ID
  const res1: { id: number }[] = await this.db.query<{ id: number }>(
   `
        SELECT id
        FROM messages
        WHERE id_users = ?
          AND address_to = ?
          AND seen IS NULL
        ORDER BY id ASC LIMIT 1
        `,
   [userID, address_my]
  );
  return res1?.[0].id;
 }

 addSeenFlagToSelfMessages(message: Message): Message {
  if (message.address_from === message.address_to) {
   message.seen = message.created;
  }
  return message;
 }
}

export default Data;
