import path from 'path';
import ApiClient from './api-client.js';
import { Log } from 'yellow-server-common';
import { Info } from './info.js';


class WebServer {
 async run() {
  this.wsClients = new Map();
  this.api = new ApiClient(this);
  await this.startServer();
 }

 async startServer() {
   Bun.serve({
    fetch: this.getFetch(),
    websocket: this.getWebSocket(),
    port: Info.settings.web.http_port
   });
   Log.info('HTTP server is running on port: ' + Info.settings.web.http_port);
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
   Log.info(req.method + ' request from: ' + clientIP + ', URL: ', req.url);
   const url = new URL(req.url);
   if (url.pathname === "/health") return new Response("OK!");
   return new Response('<h1>404 Not Found</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } });
  };
 }

 getWebSocket() {
  const api = this.api;
  return {
   message: async (ws, message) => {
    Log.info('WebSocket message from: ', ws.remoteAddress, ', message: ', message);
    const res = JSON.stringify(await api.processAPI(ws, message));
    Log.info('WebSocket message to: ' + ws.remoteAddress + ', message: ' + res);
    ws.send(res);
   },
   open: ws => {
    this.wsClients.set(ws, { subscriptions: new Set() });
    Log.info('WebSocket connected: ' + ws.remoteAddress);
   },
   close: (ws, code, message) => {
    this.wsClients.delete(ws);
    Log.info('WebSocket disconnected: ' + ws.remoteAddress + ', code: ' + code + (message ? ', message: ' + message : ''));
   },
   drain: ws => {
    // the socket is ready to receive more data
    console.log('DRAIN', ws);
   }
  };
 }
}

export default WebServer;
