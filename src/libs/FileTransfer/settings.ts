import { ServerFileUploadRecord } from './types.ts';

export const FILE_TRANSFER_SETTINGS = {
 ENABLE_PERSISTENCE: true, // todo: full implementation for memory-only support
 CLEANUP_INTERVAL_MS: 1000 * 5,
 P2P_TRANSFER: {
  MAX_FILE_SIZE_B: 1024 * 1024 * 100,
  DEFAULT_TIMEOUT_ERROR_MS: 1000 * 60 * 5,
  STATUS_PAUSED_TIMEOUT_ERROR_MS: 1000 * 60 * 60
 },
 SERVER_TRANSFER: {
  MAX_FILE_SIZE_B: 1024 * 1024 * 100,
  DEFAULT_TIMEOUT_ERROR_MS: 1000 * 60 * 5,
  STATUS_PAUSED_TIMEOUT_ERROR_MS: 1000 * 60 * 60,
  FILE_NAME_STRATEGY: (record: ServerFileUploadRecord) => {
   return record.id + record.fileExtension;
  },
  USER_FILE_NAME_STRATEGY: (record: ServerFileUploadRecord) => {
   return 'todo: see USER_FILE_NAME_STRATEGY in code';
  },
  FILE_FOLDER_PATH_STRATEGY: (record: ServerFileUploadRecord) => {
   return 'uploads';
  }
 }
};
