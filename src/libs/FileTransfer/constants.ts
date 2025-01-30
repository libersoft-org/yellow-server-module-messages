import {FileUploadRecord} from "./types.ts";

export const UPLOAD_RECORD_PICKED_FIELDS_FOR_FRONTEND: (keyof FileUploadRecord)[] = [
  'id',
  'type',
  'status',
  'fileName',
  'fileMimeType',
  'fileSize',
  'chunkSize',
  'fromUserId',
]

