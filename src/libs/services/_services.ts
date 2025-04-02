import Repositories from '../repositories/_repositories.ts';
import MessagesService from '@/libs/services/Messages.service.ts';
import MessagesReactionsService from '@/libs/services/MessagesReactions.service.ts';

class Services {
 repos: Repositories;

 messages: MessagesService;
 messagesReactions: MessagesReactionsService;

 constructor(repositories: Repositories) {
  this.repos = repositories;
  this.messages = new MessagesService(this, repositories);
  this.messagesReactions = new MessagesReactionsService(this, repositories);
 }
}

export default Services;
