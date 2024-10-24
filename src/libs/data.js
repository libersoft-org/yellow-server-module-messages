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
  const res = await this.db.query(
   `

   WITH user_messages AS (
    SELECT
     messages.*,
     CASE
      WHEN messages.address_from = ? THEN messages.address_to
      ELSE messages.address_from
     END AS other_address
    FROM
    WHERE messages.id_users = ?
   ),

   last_messages AS (
    SELECT
     user_messages.other_address,
     user_messages.message AS last_message_text,
     user_messages.created AS last_message_date,
     ROW_NUMBER() OVER (PARTITION BY user_messages.other_address ORDER BY user_messages.created DESC) AS row_number
    FROM user_messages
   ),

   unread_counts AS (
    SELECT
     messages.address_from AS other_address,
     COUNT(*) AS unread_count
    FROM messages
    WHERE
     messages.address_to = ?
     AND messages.seen IS NULL
     AND messages.address_from != ?
     AND messages.id_users = ?
    GROUP BY messages.address_from
   ),

   SELECT

    lm.other_address AS address,
    lm.last_message_text,
    lm.last_message_date,
    COALESCE(uc.unread_count, 0) AS unread_count

   FROM last_messages
   LEFT JOIN unread_counts ON unread_counts.other_address = last_messages.other_address
   WHERE last_messages.row_number = 1
   ORDER BY last_messages.last_message_date DESC;
  `,
   [userAddress, userID, userAddress, userAddress,userID]
  );
  return res.length > 0 ? res : false;
 }

 async userListMessages(userID, address, count = 10, lastID = 0) {
  if (lastID === 'unseen') {
   // find the first unseen message ID:
   const res1 = await this.db.query(
    `
    WITH my_email AS (
     SELECT CONCAT(u.username, '@', d.name) AS email
      FROM users u
      JOIN domains d ON u.id_domains = d.id
      WHERE u.id = ?
     )
     SELECT id
     FROM messages
     WHERE id_users = ?
       AND address_to = (SELECT email FROM my_email)
       AND seen IS NULL
     ORDER BY id ASC LIMIT 1
    `,
    [userID, userID]
   );
   let first_unseen_ID = res1.length > 0 ? res1[0].id : null;
   if (first_unseen_ID === null) {
    // nothing unseen, use the last message ID
    const res2 = await this.db.query(
     `
     WITH my_email AS (
      SELECT CONCAT(u.username, '@', d.name) AS email
      FROM users u
      JOIN domains d ON u.id_domains = d.id
      WHERE u.id = ?
     )
     SELECT id
     FROM messages
     WHERE id_users = ?
     AND address_to = (SELECT email FROM my_email)
     ORDER BY id DESC LIMIT 1
     `,
     [userID, userID]
    );
    first_unseen_ID = res2.length > 0 ? res2[0].id : 0;
   }
   if (first_unseen_ID === null) {
    return [];
   }
   // go three messages back for instant context
   const res3 = await this.db.query(
    `
     WITH my_email AS (
    SELECT CONCAT(u.username, '@', d.name) AS email
    FROM users u
    JOIN domains d ON u.id_domains = d.id
    WHERE u.id = ?
  )
  SELECT id, uid, address_from, address_to, message, seen, created
  FROM messages
  WHERE id_users = ?
    AND (
      (address_from = ? AND address_to = (SELECT email FROM my_email))
      OR
      (address_from = (SELECT email FROM my_email) AND address_to = ?)
    )
    AND id < ?
  ORDER BY id DESC LIMIT 3
    `,
    [userID, userID, address, address, first_unseen_ID]
   );
   lastID = res3.length > 0 ? res3.at(-1).id : first_unseen_ID;
  }
  const res4 = await this.db.query(
   `
 WITH my_email AS (
    SELECT CONCAT(u.username, '@', d.name) AS email
    FROM users u
    JOIN domains d ON u.id_domains = d.id
    WHERE u.id = ?
  )
  SELECT id, uid, address_from, address_to, message, seen, created
  FROM messages
  WHERE id_users = ?
  AND (
    (address_from = (SELECT email FROM my_email) AND address_to = ?)
    OR
    (address_from = ? AND address_to = (SELECT email FROM my_email))
  )
  AND id > ?
  ORDER BY id DESC
  LIMIT ?
  `,
   [userID, userID, address, address, lastID, count]
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
