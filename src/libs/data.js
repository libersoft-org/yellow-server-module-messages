import { Log, DataGeneric } from 'yellow-server-common';
import { Info } from './info.js';

class Data extends DataGeneric {

 constructor() {
  super(Info.settings.database);
 }

 async createDB() {
  try {
   await this.db.query('CREATE TABLE IF NOT EXISTS messages (id INT PRIMARY KEY AUTO_INCREMENT, id_users INT, uid VARCHAR(255) NOT NULL, address_from VARCHAR(255) NOT NULL, address_to VARCHAR(255) NOT NULL, message TEXT NOT NULL, seen TIMESTAMP DEFAULT NULL, created TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  } catch (ex) {
   Log.info(ex);
   process.exit(1);
  }
 }

 async userSendMessage(userID, uid, address_from, address_to, message) {
  return await this.db.query('INSERT INTO messages (id_users, uid, address_from, address_to, message) VALUES (?, ?, ?, ?, ?)', [userID, uid, address_from, address_to, message]);
 }

 async userGetMessage(userID, uid) {
  const res = await this.db.query('SELECT id, id_users, uid, address_from, address_to, message, seen, created FROM messages WHERE uid = ? and id_users = ?', [uid, userID]);
  return res.length === 1 ? res[0] : false;
 }

 async userMessageSeen(uid) {
  await this.db.query('UPDATE messages SET seen = CURRENT_TIMESTAMP WHERE uid = ?', [uid]);
 }

 async userListConversations(userID, userAddress) {
  Log.debug('userListConversations', userID, userAddress);

  const res = await this.db.query(
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
    SUM(CASE WHEN seen IS NULL AND address_to = ? THEN 1 ELSE 0 END) AS unread_count
  FROM messages
  WHERE ? IN (address_from, address_to)
    AND (id_users = ? OR id_users IS NULL)
  GROUP BY other_address
) AS conv
JOIN messages m ON m.id = conv.last_message_id
WHERE (m.id_users = ? OR m.id_users IS NULL);

  `,
   [userAddress, userAddress, userAddress, userID, userID]
  );
  return res.length > 0 ? res : false;
 }

 async userListMessages(userID, address_my, address_other, count = 10, lastID = 0) {

  /* todo
  prevCount
  lastID
  nextCount
   */

  if (lastID === 'unseen') {

   // find the first unseen message ID:
   const res1 = await this.db.query(
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
   let first_unseen_ID = res1.length > 0 ? res1[0].id : null;

   if (first_unseen_ID === null) {
    // nothing unseen, use the last message ID
    const res2 = await this.db.query(
     `
     SELECT id
     FROM messages
     WHERE id_users = ?
     AND address_to = ?
     ORDER BY id DESC LIMIT 1
     `,
     [userID, address_my]
    );
    first_unseen_ID = res2.length > 0 ? res2[0].id : 0;
   }

   if (first_unseen_ID === null) {
    return [];
   }

   // go three messages back for instant context
   const res3 = await this.db.query(
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
   lastID = res3.length > 0 ? res3.at(-1).id : first_unseen_ID;
  }

  const res4 = await this.db.query(
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
  return res4.map(i => {
   return this.addSeenFlagToSelfMessages(i, userID);
  });
 }

 addSeenFlagToSelfMessages(i, userID) {
  if (i.address_from === i.address_to) {
   i.seen = true;
  }
  return i;
 }
}

export default Data;
