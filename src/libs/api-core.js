import { Log } from "yellow-server-common";

export class ApiCore {

 constructor() {
  this.ws = undefined;
  this.requests = new Map();
  this.api = new Proxy({}, {
    get: (_target, prop) => {
     //console.log('get', prop);
     return async (...args) => {
      //console.log('call', prop, args);
      return await this.call(prop, args);
     }
    }
   }
  );
 }

 async call(command, params) {

  const requestID = Math.random().toString(36);
  let msg = { type: 'command', command, params, requestID };

  let promise = new Promise((resolve, reject) => {
   this.requests[requestID] = (res) => {
    //Log.debug('core call promise resolve:', res);
    resolve(res);
   }
   this.send(msg);
  });

  return await promise;
 }

 send(msg) {
  Log.info('send to core:', msg);
  this.ws.send(JSON.stringify(msg));
 }

}
