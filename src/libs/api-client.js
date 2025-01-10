import { newLogger, ModuleApiBase } from 'yellow-server-common';
import { Mutex } from 'async-mutex';
let Log = newLogger('api-client');

export class ApiClient extends ModuleApiBase {
 constructor(app) {
  super(app, ['new_message', 'seen_message', 'seen_inbox_message']);
  this.commands = { ...this.commands, message_send: { method: this.message_send.bind(this), reqUserSession: true }, message_seen: { method: this.message_seen.bind(this), reqUserSession: true }, messages_list: { method: this.messages_list.bind(this), reqUserSession: true }, conversations_list: { method: this.conversations_list.bind(this), reqUserSession: true } };
  this.message_seen_mutex = new Mutex();
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
  if (!c.params.uid) return { error: 8, message: 'Message UID is missing' };
  const uid = c.params.uid;
  const created = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const address_from = userFromInfo.username + '@' + userFromDomain;
  const address_to = usernameTo + '@' + domainTo;
  const msg1_insert = await this.app.data.createMessage(c.userID, uid, userFromAddress, userToAddress, userFromAddress, userToAddress, c.params.message, created);
  const msg1 = {
   id: Number(msg1_insert.insertId),
   uid,
   prev: msg1_insert.prev,
   address_from,
   address_to,
   message: c.params.message,
   created
  };
  this.signals.notifyUser(c.userID, 'new_message', msg1);
  if (userToID !== userFromInfo.id) {
   const msg2_insert = await this.app.data.createMessage(userToID, uid, userToAddress, userFromAddress, userFromAddress, userToAddress, c.params.message, created);
   const msg2 = {
    id: Number(msg2_insert.insertId),
    uid,
    prev: msg2_insert.prev,
    address_from,
    address_to,
    message: c.params.message,
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
