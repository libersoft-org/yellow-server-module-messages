import type { Knex } from 'knex';
import 'ts-node/register'; // Ensure TypeScript support
import settings from './settings.json' with { type: 'json' };

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
