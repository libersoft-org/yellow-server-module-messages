import { UserID } from '../types.ts';
import Data from '../data.ts';
import BaseService from './_base.ts';
import { ReactionByCodepointsRDI, ReactionByUnicode } from '@/libs/repositories/types.ts';

class MessagesService extends BaseService {
 async getUserMessage(userId: UserID, args: { uid: string } | { id: number }) {}
}

export default MessagesService;
