import Data from './data';
import { ApiClient } from './api-client';
import { ModuleAppBase } from 'yellow-server-common';
import { path } from 'path';

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
  other: {
    log_file: string;
    log_to_file: boolean;
  };
}

class App extends ModuleAppBase {
  defaultSettings: Settings;
  api: ApiClient;
  data: Data;
  info: any;

  constructor() {
    const info = {
      appName: 'Yellow Server Module Messages',
      appVersion: '0.01',
    };
    super(info, path.dirname(__dirname));
    this.defaultSettings = {
      web: {
        http_port: 25001,
        allow_network: false,
      },
      database: {
        host: '127.0.0.1',
        port: 3306,
        user: 'yellow_module_org_libersoft_messages',
        password: 'password',
        name: 'yellow_module_org_libersoft_messages',
      },
      other: {
        log_file: 'module-messages.log',
        log_to_file: true,
      },
    };
    this.api = new ApiClient(this);
  }

  async init() {
    this.data = new Data(this.info.settings.database);
  }
}

export default App;
