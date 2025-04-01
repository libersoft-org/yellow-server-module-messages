import BaseRepository from './_base.ts';
import database from '@/libs/db.ts';
import { MessageReaction, ReactionByShortcodeOrUnicode } from './types.ts';
import { newLogger } from 'yellow-server-common';

let Log = newLogger('MessagesReactions.repo');

class MessagesReactionsRepo extends BaseRepository {
 async addMessageReaction(userID: number, userAddress: string, messageUid: string, reaction: ReactionByShortcodeOrUnicode): Promise<void> {
  // todo: check permissions (ideally on service level)

  return database('messages_reactions').insert({
   id_users: userID,
   user_address: userAddress,
   message_uid: messageUid,
   emoji_codepoints_rgi: reaction.emoji_codepoints_rgi
  });
 }

 async deleteMessageReaction(userID: number, userAddress: string, messageUid: string, reaction: ReactionByShortcodeOrUnicode): Promise<void> {
  // todo: check permissions (ideally on service level)

  return database('messages_reactions').where('message_uid', messageUid).andWhere('id_users', userID).andWhere('user_address', userAddress).andWhere('emoji_codepoints_rgi', reaction.emoji_codepoints_rgi).delete();
 }

 async getSingleMessageReactions(messageUid: string): Promise<MessageReaction[]> {
  // todo: check permissions (ideally on service level)

  const reactions = await database('messages_reactions').select('*').where('message_uid', messageUid);

  return reactions;
 }

 async getMessagesReactions(messageUids: string[]): Promise<MessageReaction[]> {
  // todo: check permissions (ideally on service level)

  const messagesReactions = await database('messages_reactions').select('*').whereIn('message_uid', messageUids);

  return messagesReactions;
 }
}

export default MessagesReactionsRepo;
