import { v4 as uuidv4 } from 'uuid';
import { AttachmentRecord, type FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType, P2PFileUploadRecord, ServerFileUploadRecord } from './types.ts';
import { FILE_TRANSFER_SETTINGS } from './settings.ts';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';

type MakeP2PFileUploadRecordData = Partial<P2PFileUploadRecord> & Pick<P2PFileUploadRecord, 'fromUserId' | 'fromUserUid' | 'fileOriginalName' | 'fileMimeType' | 'fileSize' | 'chunkSize'>;

type MakeServerFileUploadRecordData = Partial<ServerFileUploadRecord> & Pick<ServerFileUploadRecord, 'fromUserId' | 'fromUserUid' | 'fileOriginalName' | 'fileMimeType' | 'fileSize' | 'chunkSize'>;

type MakeAttachmentRecordData = Partial<AttachmentRecord> & Pick<AttachmentRecord, 'userId' | 'fileTransferId' | 'filePath'>;

export function makeServerFileUploadRecord(data: MakeServerFileUploadRecordData): ServerFileUploadRecord {
 const defaults = {
  id: uuidv4(),
  status: FileUploadRecordStatus.BEGUN,
  type: FileUploadRecordType.SERVER,
  errorType: null,
  chunksReceived: []
 };
 const record = Object.assign(defaults, data) as ServerFileUploadRecord;
 record.fileOriginalName = sanitizeFilename(record.fileOriginalName);
 record.fileName = FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.FILE_NAME_STRATEGY(record as any) as string;
 record.fileFolder = FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.FILE_FOLDER_PATH_STRATEGY(record as any);
 record.fileExtension = path.extname(record.fileOriginalName);
 return record;
}

export function makeP2PFileUploadRecord(data: MakeP2PFileUploadRecordData): P2PFileUploadRecord {
 const defaults = {
  id: uuidv4(),
  status: FileUploadRecordStatus.BEGUN,
  type: FileUploadRecordType.P2P,
  fileName: null,
  fileFolder: null,
  fileExtension: null,
  errorType: null,
  chunksReceived: []
 };
 const record = Object.assign(defaults, data) as P2PFileUploadRecord;
 record.fileOriginalName = sanitizeFilename(record.fileOriginalName);
 return record;
}

export function makeAttachmentRecord(data: MakeAttachmentRecordData): AttachmentRecord {
 const defaults = {
  id: uuidv4()
 };
 return Object.assign(defaults, data);
}

export function pickFileUploadRecordFields<K extends keyof FileUploadRecord>(record: FileUploadRecord, keepFields: K[]): Pick<FileUploadRecord, K> {
 const filteredRecord = {} as Pick<FileUploadRecord, K>;
 keepFields.forEach(field => {
  if (field in record) {
   filteredRecord[field] = record[field];
  }
 });
 return filteredRecord;
}

export function makeFilePath(record: FileUploadRecord): string {
 return record.fileFolder + '/' + record.fileName;
}

export function makeTempFilePath(record: FileUploadRecord): string {
 return makeFilePath(record) + '.tmp';
}
