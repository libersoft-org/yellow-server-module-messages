import WebServer from './webserver.js';
import Data from './data.js';
import { Common } from './common.js';

class App {
 async run() {
  const args = process.argv.slice(2);
  switch (args.length) {
   case 0:
    await this.startServer();
    break;
   case 1:
    if (args[0] === '--create-settings') await this.createSettings();
    else if (args[0] === '--create-database') await this.createDatabase();
    else this.getHelp();
    break;
   default:
    this.getHelp();
    break;
  }
 }

 async startServer() {
  try {
   await this.loadSettings();
   const header = Common.appName + ' ver. ' + Common.appVersion;
   const dashes = '='.repeat(header.length);
   Log.info(dashes);
   Log.info(header);
   Log.info(dashes);
   Log.info('');
   await this.checkDatabase();
   this.webServer = new WebServer();
   await this.webServer.run();
  } catch (ex) {
   Log.info(ex);
  }
 }

 getHelp() {
  Log.info('Command line arguments:');
  Log.info('');
  Log.info('--help - to see this help');
  Log.info('--create-settings - to create a default settings file named "' + Common.settingsFile + '"');
  Log.info('--create-database - to create a tables in database defined in the settings file');
 }

 async loadSettings() {
  const file = Bun.file(Common.settingsFile);
  if (await file.exists()) {
   try {
    Common.settings = await file.json();
   } catch {
    Log.info('Settings file "' + Common.settingsFile + '" has an invalid format.', 2);
    process.exit(1);
   }
  } else {
   Log.info('Settings file "' + Common.settingsFile + '" not found. Please run this application again using: "./start.sh --create-settings"', 2);
   process.exit(1);
  }
 }

 async createSettings() {
  const file = Bun.file(Common.settingsFile);
  if (await file.exists()) {
   Log.info('Settings file "' + Common.settingsFile + '" already exists. If you need to replace it with default one, delete the old one first.', 2);
   process.exit(1);
  } else {
   let settings = {
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
    other: {
     log_file: 'module-messages.log',
     log_to_file: true
    }
   };
   await Bun.write(Common.settingsFile, JSON.stringify(settings, null, 1));
   Log.info('Settings file was created sucessfully.');
  }
 }

 async checkDatabase() {
  const data = new Data();
  if (!(await data.databaseExists())) {
   Log.info('Database is not yet created. Please run "./start.sh --create-database" first.', 2);
   process.exit(1);
  }
 }

 async createDatabase() {
  await this.loadSettings();
  const data = new Data();
  await data.createDB();
  Log.info('Database creation completed.');
  process.exit(1);
 }
}

export default App;
