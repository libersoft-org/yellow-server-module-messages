import Data from './data.js';
import { Common } from './common.js';

class API {
 constructor(webServer) {
  this.webServer = webServer;
  this.data = new Data();
  this.allowedEvents = ['new_message', 'seen_message'];
  this.clients = new Map();
  this.commands = {

   subscribe: { method: this.userSubscribe },
   unsubscribe: { method: this.userUnsubscribe },

   send: { method: this.userSend, reqUserSession: true },
   seen: { method: this.userSeen, reqUserSession: true },
   conversations_list: { method: this.userConversationsList, reqUserSession: true },
   messages_list: { method: this.userMessagesList, reqUserSession: true }
  };
 }

 async processAPI(ws, json) {
  if (!Common.isValidJSON(json)) return { error: 902, message: 'Invalid JSON command' };
  const req = JSON.parse(json);
  let resp = {};

  if (req.requestID) resp.requestID = req.requestID;
  if (req.wsGuid) resp.wsGuid = req.wsGuid;

  if (!req.data?.command) return { ...resp, error: 999, message: 'Command not set' };
  const command_fn = this.commands[req.command];
  if (!command_fn) return { ...resp, error: 903, message: 'Unknown command' };

  const context = { ws };

  if (command_fn.reqUserSession) {
   if (!req.sessionID) return { ...resp, error: 996, message: 'User session is missing' };
   if (req.userID) context.userID = req.userID;
  }

  if (req.params) context.params = req.params;

  let method_result = await apiMethod.method.call(this, context);
  return { ...resp, ...method_result };
 }

 async userSend(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  let [usernameTo, domainTo] = c.params.address.split('@');
  if (!usernameTo || !domainTo) return { error: 4, message: 'Invalid username format' };
  usernameTo = usernameTo.toLowerCase();
  domainTo = domainTo.toLowerCase();
  const domainToID = await this.data.getDomainIDByName(domainTo);
  if (!domainToID) return { error: 5, message: 'Domain name not found on this server' };
  const userToID = await this.data.getUserIDByUsernameAndDomainID(usernameTo, domainToID);
  if (!userToID) return { error: 6, message: 'User name not found on this server' };
  const userFromInfo = await this.data.userGetUserInfo(c.userID);
  const userFromDomain = await this.data.getDomainNameByID(userFromInfo.id_domains);
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
  this.notifySubscriber(userToID, 'new_message', msg);
  this.notifySubscriber(c.userID, 'new_message', msg);
  return { error: 0, message: 'Message sent', uid };
 }

 async userSeen(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.uid) return { error: 2, message: 'Message UID is missing' };
  const res = await this.data.userGetMessage(c.userID, c.params.uid);
  if (!res) return { error: 3, message: 'Wrong message ID' };
  if (res.seen) return { error: 4, message: 'Seen flag was already set' };
  await this.data.userMessageSeen(c.params.uid);
  const res2 = await this.data.userGetMessage(c.userID, c.params.uid);
  const [username, domain] = res2.address_from.split('@');
  const userFromID = await this.data.getUserIDByUsernameAndDomain(username, domain);
  this.notifySubscriber(userFromID, 'seen_message', {
   uid: c.params.uid,
   seen: res2.seen
  });
  return { error: 0, message: 'Seen flag set successfully' };
 }

 async userConversationsList(c) {
  const conversations = await this.data.userListConversations(c.userID);
  if (!conversations) return { error: 1, message: 'No conversations found' };
  return { error: 0, data: { conversations } };
 }

 async userMessagesList(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  const messages = await this.data.userListMessages(c.userID, c.params.address, c.params?.count, c.params?.lastID);
  return { error: 0, data: { messages } };
 }

 userSubscribe(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.event) return { error: 2, message: 'Event parameter is missing' };
  if (!this.allowedEvents.includes(c.params.event)) return { error: 3, message: 'Unsupported event name' };

  let clientData = this.clients.get(c.wsGuid);
  if (!clientData) {
   clientData = {subscriptions: new Set()};
   this.clients.set(c.wsGuid, clientData);
  }

  clientData.userID = c.userID;
  clientData.subscriptions.add(c.params.event);
  Common.addLog('Client ' + c.wsGuid + ' subscribed to event: ' + c.params.event);

  return { error: 0, message: 'Event subscribed' };
 }

 notifySubscriber(userID, event, data) {
  for (const [wsGuid, clientData] of this.clients) {
   if (clientData.userID === userID && clientData.subscriptions.has(event)) {
    const res = JSON.stringify({ event, data });
    Common.addLog('WebSocket event to: ' + ws.remoteAddress + ', message: ' + res);
    ws.send(res);
   }
  }
 }

 userUnsubscribe(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.event) return { error: 2, message: 'Event parameter is missing' };
  if (!this.allowedEvents.includes(c.params.event)) return { error: 3, message: 'Unsupported event name' };
  const clientData = this.webServer.wsClients.get(c.ws);
  if (!clientData) return { error: 4, message: 'Client not found' };
  if (!clientData.subscriptions?.has(c.params.event)) return { error: 5, message: 'Client is not subscribed to this event' };
  clientData.subscriptions?.delete(c.params.event);
  return { error: 0, message: 'Event unsubscribed' };
 }

 getUUID() {
  return crypto.randomUUID();
 }
}

export default API;
