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
   user_messages AS (
    SELECT
     m.*,
     CASE
      WHEN m.address_from = ? THEN m.address_to
      ELSE m.address_from
     END AS other_address
    FROM messages m
    WHERE m.id_users = ?
    AND (m.address_from = ?
        OR m.address_to = ?)
   ),
   last_messages AS (
    SELECT
     um.other_address,
     um.message AS last_message_text,
     um.created AS last_message_date,
     ROW_NUMBER() OVER (PARTITION BY um.other_address ORDER BY um.created DESC) AS rn
    FROM user_messages um
   ),
   unread_counts AS (
    SELECT
     m.address_from AS other_address,
     COUNT(*) AS unread_count
    FROM messages m
    WHERE
     m.address_to = ?
     AND m.seen IS NULL
     AND m.address_from != ?
     AND m.id_users = ?
    GROUP BY m.address_from
   ),
   user_addresses AS (
    SELECT CONCAT(u.username, '@', d.name) AS address, u.visible_name
    FROM users u
    JOIN domains d ON u.id_domains = d.id
   )
   SELECT
    lm.other_address AS address,
    lm.last_message_text,
    lm.last_message_date,
    COALESCE(uc.unread_count, 0) AS unread_count
   FROM last_messages lm
   LEFT JOIN user_addresses ua ON ua.address = lm.other_address
   LEFT JOIN unread_counts uc ON uc.other_address = lm.other_address
   WHERE lm.rn = 1
   ORDER BY lm.last_message_date DESC;
  `,
   [userAddress, userID, userAddress, userAddress, userAddress, userAddress, userID, userID]
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
