import Data from './data';
import { Log, Signals } from "yellow-server-common";
import { ApiCore } from './api-core.js';
import { Mutex } from 'async-mutex';


class ApiClient {
 constructor(webServer) {
  this.webServer = webServer;
  this.clients = new Map();
  this.core = new ApiCore();
  this.data = new Data();
  this.signals = new Signals(
   ['new_message', 'seen_message', 'seen_inbox_message'],
   this.clients,
   (wsGuid, _clientData, msg) => this.core.send({...msg, type: 'notify', wsGuid } )
  );

  this.userSeenMutex = new Mutex();
  this.commands = {

   subscribe: { method: this.signals.subscribe.bind(this.signals) },
   unsubscribe: { method: this.signals.unsubscribe.bind(this.signals) },

   message_send: { method: this.userSend, reqUserSession: true },
   message_seen: { method: this.userSeen, reqUserSession: true },
   messages_list: { method: this.userMessagesList, reqUserSession: true },
   conversations_list: { method: this.userConversationsList, reqUserSession: true },
  };
 }

 async processWsMessage(ws, json) {
  let req;
  try {
   req = JSON.parse(json);
  } catch (ex) {
   return {error: 902, message: 'Invalid JSON command'};
  }

  if (req.type === 'response') {
   let requestID = req.requestID;
   let cb = this.core.requests[requestID];
   Log.debug('result from core for requestID:', requestID, req.result);
   if (cb) {
    cb(req.result);
    delete this.core.requests[requestID];
   }
   else
   {
    Log.warning('No callback for the response:', req);
   }
   return;
  }
  else if (req.type === 'request') {
   return await this.processAPI(ws, req);
  }
  else
  {
   Log.warning('Unknown message type:', req);
  }
 }



 async processAPI(ws, req) {

  /* fixme, this is a temporary solution */
  if (this.core.ws && this.core.ws != ws)
  {
   console.info('APICore was already in use');
  }
  this.core.ws = ws;

  //Log.debug('API request: ' + JSON.stringify(req));

  let resp = {type: 'response'};

  if (req.requestID) resp.requestID = req.requestID;
  if (req.wsGuid) resp.wsGuid = req.wsGuid;

  let command = req.data?.command;
  Log.debug('API command: ' + command);

  if (!command) return { ...resp, error: 999, message: 'Command not set' };
  const command_fn = this.commands[command];
  //Log.debug('API command_fn: ' + command_fn);
  if (!command_fn) return { ...resp, error: 903, message: 'Unknown API command' };

  const context = { ws };

  if (req.wsGuid) context.wsGuid = req.wsGuid;
  if (req.userID) context.userID = req.userID;
  if (req.userAddress) context.userAddress = req.userAddress;
  updateUserData(context);

  if (command_fn.reqUserSession)
  {
   if (!req.sessionID) return { ...resp, error: 996, message: 'User session is missing' };
  }

  if (req.data?.params) context.params = req.data.params;

  let method_result = await command_fn.method.call(this, context);
  return { ...resp, ...method_result };
 }



 updateUserData(req) {
  if (req.userID) {
   let userData = this.clients.get(req.wsGuid);
   if (!userData) {
    userData = {};
    this.clients.set(req.wsGuid, userData);
   }
   userData.userID = req.userID;
  }
 }



 async userSend(c) {
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
  this.notifyUser(userToID, 'new_message', msg);
  this.notifyUser(c.userID, 'new_message', msg);
  return { error: 0, message: 'Message sent', uid };
 }



  async userSeen(c) {
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



 async userConversationsList(c) {
  const conversations = await this.data.userListConversations(c.userID, c.userAddress);
  return { error: 0, data: { conversations } };
 }



 async userMessagesList(c) {
  if (!c.params) return { error: 1, message: 'Parameters are missing' };
  if (!c.params.address) return { error: 2, message: 'Recipient address is missing' };
  const messages = await this.data.userListMessages(c.userID, c.userAddress, c.params.address, c.params?.count, c.params?.lastID);
  return { error: 0, data: { messages } };
 }
}

export default ApiClient;
