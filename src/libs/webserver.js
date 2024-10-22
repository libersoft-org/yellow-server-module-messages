import path from 'path';
import API from './api.js';
import { Common } from './common.js';

class WebServer {
 async run() {
  try {
   this.wsClients = new Map();
   this.api = new API(this);
   await this.startServer();
  } catch (ex) {
   Common.addLog('Cannot start web server.', 2);
   Common.addLog(ex, 2);
  }
 }

 async startServer() {
  try {
   Bun.serve({
    fetch: this.getFetch(),
    websocket: this.getWebSocket(),
    port: Common.settings.web.http_port
   });
   Common.addLog('HTTP server is running on port: ' + Common.settings.web.http_port);
  } catch (ex) {
   Common.addLog('Error: ' + ex.message, 2);
   process.exit(1);
  }
 }

 getFetch() {
  return async (req, server) => {
   if (server.upgrade(req)) return;
   let clientIP = server.requestIP(req).address;
   const forwardedHeaders = [req.headers.get('x-forwarded-for'), req.headers.get('cf-connecting-ip'), req.headers.get('x-real-ip'), req.headers.get('forwarded'), req.headers.get('x-client-ip'), req.headers.get('x-cluster-client-ip'), req.headers.get('true-client-ip'), req.headers.get('proxy-client-ip'), req.headers.get('wl-proxy-client-ip')];
   for (const header of forwardedHeaders) {
    if (header) {
     clientIP = header.split(',')[0];
     break;
    }
   }
   Common.addLog(req.method + ' request from: ' + clientIP + ', URL: ' + req.url);
   return new Response('<h1>404 Not Found</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } });
  };
 }

 getWebSocket() {
  const api = this.api;
  return {
   message: async (ws, message) => {
    Common.addLog('WebSocket message from: ', ws.remoteAddress, ', message: ', message);
    const res = JSON.stringify(await api.processAPI(ws, message));
    Common.addLog('WebSocket message to: ' + ws.remoteAddress + ', message: ' + res);
    ws.send(res);
   },
   open: ws => {
    this.wsClients.set(ws, { subscriptions: new Set() });
    Common.addLog('WebSocket connected: ' + ws.remoteAddress);
   },
   close: (ws, code, message) => {
    this.wsClients.delete(ws);
    Common.addLog('WebSocket disconnected: ' + ws.remoteAddress + ', code: ' + code + (message ? ', message: ' + message : ''));
   },
   drain: ws => {
    // the socket is ready to receive more data
    console.log('DRAIN', ws);
   }
  };
 }
}

export default WebServer;
