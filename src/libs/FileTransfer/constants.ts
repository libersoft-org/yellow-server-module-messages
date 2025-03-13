import { FileUploadRecord } from './types.ts';

export const UPLOAD_RECORD_PICKED_FIELDS_FOR_FRONTEND: (keyof FileUploadRecord)[] = ['id', 'type', 'status', 'errorType', 'fileOriginalName', 'fileMimeType', 'fileSize', 'chunkSize', 'fromUserId', 'fromUserUid', 'metadata'];
