import { UserID } from '../types.ts';
import BaseService from './_base.ts';
import { ReactionByCodepointsRDI, ReactionByShortcodeOrUnicode } from '@/libs/repositories/types.ts';

class MessagesReactionsService extends BaseService {
 async setUserMessageReaction(userId: UserID, userAddress: string, messageUid: string, reaction: ReactionByShortcodeOrUnicode) {
  // check if the message exists

  await this.repos.messagesReactions.addMessageReaction(userId, userAddress, messageUid, reaction);
 }

 async unsetUserMessageReaction(userId: UserID, userAddress: string, messageUid: string, reaction: ReactionByShortcodeOrUnicode) {
  await this.repos.messagesReactions.deleteMessageReaction(userId, userAddress, messageUid, reaction);
 }
}

export default MessagesReactionsService;
