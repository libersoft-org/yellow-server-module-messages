import BaseRepository from './_base.ts';

class MessagesRepo extends BaseRepository {
 async findMessageRecipients(messageUid: string) {
  return this.db('messages').select('id_users', 'address_from', 'address_to').where('uid', messageUid);
 }
}

export default MessagesRepo;
