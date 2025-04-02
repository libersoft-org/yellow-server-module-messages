import MessagesRepo from './Messages.repo.ts';
import MessagesReactionsRepo from './MessagesReactions.repo.ts';
import { Knex } from 'knex';

class Repositories {
 messages: MessagesRepo;
 messagesReactions: MessagesReactionsRepo;

 constructor(db: Knex) {
  this.messages = new MessagesRepo(this, db);
  this.messagesReactions = new MessagesReactionsRepo(this, db);
 }
}

export default Repositories;
