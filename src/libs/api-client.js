import Data from './data';
import { Log, ModuleApiBase } from "yellow-server-common";
import { Mutex } from 'async-mutex';


export class ApiClient extends ModuleApiBase {
 constructor(webServer) {
  super(
   webServer,
   ['new_message', 'seen_message', 'seen_inbox_message']);
  this.commands = {...this.commands,
     message_send: { method: this.message_send, reqUserSession: true },
     message_seen: { method: this.message_seen, reqUserSession: true },
     messages_list: { method: this.messages_list, reqUserSession: true },
     conversations_list: { method: this.conversations_list, reqUserSession: true },
  };

  this.data = new Data();
  this.userSeenMutex = new Mutex();

 }

 async message_send(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  let [usernameTo, domainTo] = c.params.address.split('@');
  if (!usernameTo || !domainTo) return { error: 4, message: 'Invalid username format' };
  usernameTo = usernameTo.toLowerCase();
  domainTo = domainTo.toLowerCase();

  const domainToID = await this.core.api.getDomainIDByName(domainTo);

  if (!domainToID) return { error: 5, message: 'Domain name not found on this server' };
  const userToID = await this.core.api.getUserIDByUsernameAndDomainID(usernameTo, domainToID);
  if (!userToID) return { error: 6, message: 'User name not found on this server' };
  const userFromInfo = await this.core.api.userGetUserInfo(c.userID);
  const userFromDomain = await this.core.api.getDomainNameByID(userFromInfo.id_domains);
  if (!c.params.message) return { error: 7, message: 'Message is missing' };
  if (!c.params.uid) return { error: 8, message: 'Message UID is missing' };
  const uid = c.params.uid;
  const res = await this.data.userSendMessage(c.userID, uid, userFromInfo.username + '@' + userFromDomain, usernameTo + '@' + domainTo, c.params.message);
  if (userToID !== userFromInfo.id) await this.data.userSendMessage(userToID, uid, userFromInfo.username + '@' + userFromDomain, usernameTo + '@' + domainTo, c.params.message);
  const msg = {
   id: res.lastInsertRowid,
   uid,
   address_from: userFromInfo.username + '@' + userFromDomain,
   address_to: usernameTo + '@' + domainTo,
   message: c.params.message
  };
  this.signals.notifyUser(userToID, 'new_message', msg);
  this.signals.notifyUser(c.userID, 'new_message', msg);
  return { error: 0, message: 'Message sent', uid };
 }



  async message_seen(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.uid) return { error: 2, message: 'Message UID is missing' };
  if (!c.userID) throw new Error('User ID is missing');

  let result = await this.userSeenMutex.runExclusive(async () => {
   // TRANSACTION BEGIN
   const res = await this.data.userGetMessage(c.userID, c.params.uid);
   if (!res) return { error: 3, message: 'Wrong message ID' };
   Log.debug('res....seen:', res);
   if (res.seen) return { error: 4, message: 'Seen flag was already set' };
   await this.data.userMessageSeen(c.params.uid);
   // TRANSACTION END
   return true;
  });
  if (result !== true) return result;

  const res2 = await this.data.userGetMessage(c.userID, c.params.uid);
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
  const messages = await this.data.userListMessages(c.userID, c.userAddress, c.params.address, c.params?.count, c.params?.lastID);
  return { error: 0, data: { messages } };
 }

 async conversations_list(c) {
  const conversations = await this.data.userListConversations(c.userID, c.userAddress);
  return { error: 0, data: { conversations } };
 }
}

