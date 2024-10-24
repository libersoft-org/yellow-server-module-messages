

class ApiCore {

  constructor() {
    this.ws = undefined;
    this.requests = new Map();
    this.api = new Proxy({}, {
      get: (_target, prop) => {
        return async (...args) => {
          return await this.call(prop, args);
        }
      }
    }
  }

 async call(command, params)
 {

  const requestID = Math.random().toString(36).substring(7);
  let msg = {type: 'command', command, params};

  let promise = new Promise((resolve, reject) => {
   this.requests[requestID] = (res) => { resolve(res); }
   this.ws.send(JSON.stringify(msg));
  });

  await promise;

 }


 async getDomainIDByName(name){
  return await this.call('getDomainIDByName', {name});
 }

}

