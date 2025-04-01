import Data from './data';
import { ApiClient } from './api-client';
import { ModuleAppBase } from 'yellow-server-common';
import path from 'path';
import FileTransferManager from './FileTransfer/FileTransferManager.ts';
import Repositories from '@/libs/repositories/_repositories.ts';
import database from '@/libs/db.ts';
import Services from '@/libs/services/_services.ts';

import.meta?.hot?.dispose(() => {
 console.log('DISPOSE  ');
});

interface LogTopicFilter {
 [key: string]: string;
}

interface Settings {
 web: {
  http_port: number;
  allow_network: boolean;
 };
 database: {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
 };
 log: {
  level: string;
  stdout: {
   enabled: boolean;
   levels: LogTopicFilter[];
  };
  file: {
   enabled: boolean;
   name: string;
   levels: LogTopicFilter[];
  };
  database: {
   enabled: boolean;
   level: string;
  };
  json: {
   enabled: boolean;
   name: string;
   level: string;
  };
  elasticsearch: {
   enabled: boolean;
  };
 };
}

class App extends ModuleAppBase {
 defaultSettings: Settings;
 api: ApiClient;

 // @ts-ignore (defined in this.init)
 data: Data;
 // @ts-ignore (defined in this.init)
 fileTransferManager: FileTransferManager;
 // @ts-ignore (defined in this.init)
 repos: Repositories;
 // @ts-ignore (defined in this.init)
 services: Services;

 constructor() {
  const info = {
   appPath: path.dirname(import.meta.dir) + '/',
   appName: 'Yellow Server Module Messages',
   appVersion: '0.01'
  };
  super(info, path.dirname(__dirname));
  this.defaultSettings = {
   web: {
    http_port: 25001,
    allow_network: false
   },
   database: {
    host: '127.0.0.1',
    port: 3306,
    user: 'yellow_module_org_libersoft_messages',
    password: 'password',
    name: 'yellow_module_org_libersoft_messages'
   },
   log: {
    level: 'info',
    stdout: {
     enabled: true,
     levels: [{ '*': 'info' }]
    },
    file: {
     enabled: true,
     name: 'server.log',
     levels: [{ '*': 'info' }]
    },
    database: {
     enabled: true,
     level: 'debug'
    },
    json: {
     enabled: false,
     name: 'json.log',
     level: 'debug'
    },
    elasticsearch: {
     enabled: false
    }
   }
  };
  this.api = new ApiClient(this);
 }

 async init() {
  this.repos = new Repositories(database);
  this.data = new Data(this.info.settings.database, this.repos);
  this.services = new Services(this.repos);

  this.fileTransferManager = new FileTransferManager({
   createRecordOnServer: this.data.createFileUpload.bind(this.data),
   findRecordOnServer: this.data.getFileUpload.bind(this.data),
   patchRecordOnServer: this.data.patchFileUpload.bind(this.data)
  });
 }
}

export default App;
