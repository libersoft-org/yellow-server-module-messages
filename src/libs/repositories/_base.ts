import { Knex } from 'knex';
import Repositories from './_repositories.ts';

abstract class BaseRepository {
 repos: Repositories;
 db: Knex;

 constructor(repos: Repositories, db: Knex) {
  this.repos = repos;
  this.db = db;
 }
}

export default BaseRepository;
