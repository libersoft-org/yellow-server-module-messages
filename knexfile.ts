import type { Knex } from 'knex';
// import 'ts-node/register'; // Ensure TypeScript support
const settingsPath = process.env.VITE_YELLOW_SETTINGS_PATH || './settings.json';


/* todo: adapted from module-app-base.ts */
async function loadSettings() {
 const file = Bun.file(settingsPath);
 if (await file.exists()) {
  try {
   return await file.json();
  } catch {
   console.log('Settings file "' + this.info.settingsFile + '" has an invalid format.');
   process.exit(1);
  }
 } else {
  console.log('Settings file "' + this.info.settingsFile + '" not found. Please run this application again using: "./start.sh --create-settings"');
  process.exit(1);
 }
}

const settings = await loadSettings();


// more info: https://knexjs.org/guide/#configuration-options
const config: { [key: string]: Knex.Config } = {
 development: {
  client: 'mysql',

  connection: {
   host: settings.database.host,
   port: settings.database.port,
   database: settings.database.name,
   user: settings.database.user,
   password: settings.database.password
  },
  pool: {
   min: 2,
   max: 10
  },
  migrations: {
   tableName: 'knex_migrations'
  }
 }

 // staging: {
 //  client: "postgresql",
 //  connection: {
 //   database: "my_db",
 //   user: "username",
 //   password: "password"
 //  },
 //  pool: {
 //   min: 2,
 //   max: 10
 //  },
 //  migrations: {
 //   tableName: "knex_migrations"
 //  }
 // },
 //
 // production: {
 //  client: "postgresql",
 //  connection: {
 //   database: "my_db",
 //   user: "username",
 //   password: "password"
 //  },
 //  pool: {
 //   min: 2,
 //   max: 10
 //  },
 //  migrations: {
 //   tableName: "knex_migrations"
 //  }
 // }
};

export default config;
