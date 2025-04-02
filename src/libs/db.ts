import knex from 'knex';
import knexFile from '../knexfile.ts';

const env = process.env.NODE_ENV || 'development';
const pickedConfig = knexFile[env];

if (!pickedConfig) {
 throw new Error(`No knex config found for environment: ${env}`);
}

const database = knex(pickedConfig);

export default database;
