import { makeFilePath, makeP2PFileUploadRecord, makeServerFileUploadRecord, makeTempFilePath } from './utils.ts';
import { FileUploadBeginData, type FileUploadChunk, FileUploadErrorType, FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType } from './types.ts';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { newLogger } from 'yellow-server-common';
import { DownloadChunkP2PNotFoundError } from './errors.ts';
import { FILE_TRANSFER_SETTINGS } from './settings.ts';

let Log = newLogger('FileTransferManager');

class FileTransferManager extends EventEmitter {
 records: Map<string, FileUploadRecord> = new Map();
 findRecord: (id: string) => Promise<FileUploadRecord>;
 p2pTempChunks: Map<string, FileUploadChunk[]> = new Map();

 constructor(settings: { findRecord: (id: string) => Promise<FileUploadRecord> }) {
  super();
  this.findRecord = settings.findRecord;
 }

 async uploadBegin(data: FileUploadBeginData) {
  let record: FileUploadRecord;
  if (data.type === FileUploadRecordType.SERVER) {
   record = makeServerFileUploadRecord({
    id: data.id,
    fromUserId: data.fromUserId,
    fromUserUid: data.fromUserUid,
    type: data.type,
    fileOriginalName: data.fileOriginalName,
    fileMimeType: data.fileMimeType,
    fileSize: data.fileSize,
    chunkSize: data.chunkSize
   });
  } else if (data.type === FileUploadRecordType.P2P) {
   record = makeP2PFileUploadRecord({
    id: data.id,
    fromUserId: data.fromUserId,
    fromUserUid: data.fromUserUid,
    type: data.type,
    fileOriginalName: data.fileOriginalName,
    fileSize: data.fileSize,
    fileMimeType: data.fileMimeType,
    chunkSize: data.chunkSize
   });
  } else {
   throw new Error('Invalid file transfer record type');
  }

  this.records.set(record.id, record);

  return record;
 }

 async processChunk(chunk: FileUploadChunk) {
  let record = await this.getRecord(chunk.uploadId);
  if (record.type === FileUploadRecordType.SERVER) {
   return await this.processChunkServer(chunk, record);
  } else if (record.type === FileUploadRecordType.P2P) {
   return await this.processChunkP2P(chunk, record);
  } else {
   throw new Error('Invalid record type');
  }
 }

 async processChunkServer(chunk: FileUploadChunk, record: FileUploadRecord) {
  try {
   const buffer = Buffer.from(chunk.data, 'base64');
   await fs.appendFile(makeTempFilePath(record), buffer);
   record.chunksReceived.push(chunk.chunkId);
   // this.emit(FileTransferManagerEvents.AFTER_PROCESS_CHUNK, {record, chunk})

   // check if finished
   if (record.chunksReceived.length === Math.ceil(record.fileSize / record.chunkSize)) {
    await this.finalizeUpload(record);
   }

   return { record, chunk };
  } catch (error) {
   // todo: handle error
   console.error('Error adding chunk', error);
  }
 }

 async processChunkP2P(chunk: FileUploadChunk, record: FileUploadRecord) {
  record.chunksReceived.push(chunk.chunkId);
  const tempChunks = this.p2pTempChunks.get(chunk.uploadId) || [];
  tempChunks[chunk.chunkId] = chunk;
  this.p2pTempChunks.set(chunk.uploadId, tempChunks);

  if (record.chunksReceived.length === Math.ceil(record.fileSize / record.chunkSize)) {
   record.status = FileUploadRecordStatus.FINISHED;
  }

  return { record, chunk };
 }

 async finalizeUpload(record: FileUploadRecord) {
  // todo: checksum
  record.status = FileUploadRecordStatus.FINISHED;
  // move temp file to final location
  let dst = makeFilePath(record);
  await fs.rename(makeTempFilePath(record), dst);
  return { record };
 }

 async getRecord(id: string) {
  const record = this.records.get(id);

  if (record) {
   return record;
  }

  // proceed to find record in database
  const foundRecord = await this.findRecord(id);

  if (!foundRecord) {
   throw new Error('Record not found');
  }

  this.records.set(foundRecord.id, foundRecord);
  return foundRecord;
 }

 async getFileChunk(uploadId: string, offsetBytes: number, chunkSize: number) {
  const record = await this.getRecord(uploadId);
  const filePath = makeFilePath(record);
  const file = Bun.file(filePath);
  const blob = file.slice(offsetBytes, offsetBytes + chunkSize);
  // blob to array
  const buffer = await blob.bytes();

  const chunk = {
   chunkId: Math.floor(offsetBytes / chunkSize),
   uploadId,
   checksum: '',
   // @ts-ignore
   data: buffer.toBase64()
  };

  return { chunk };
 }

 async getFileChunkP2P(uploadId: string, chunkId: number) {
  const record = await this.getRecord(uploadId);
  const tempChunks = this.p2pTempChunks.get(uploadId) || [];
  const chunk = tempChunks[chunkId];

  if (!chunk) {
   throw new DownloadChunkP2PNotFoundError('Chunk not found');
  }

  return { chunk };
 }

 async checkAndValidateFileUploads(records: FileUploadRecord[], updatedRecordCallback: (record: FileUploadRecord) => Promise<void>) {
  for (const record of records) {
   if ([FileUploadRecordStatus.FINISHED, FileUploadRecordStatus.CANCELED, FileUploadRecordStatus.ERROR].includes(record.status)) {
    continue;
   }

   if ([FileUploadRecordStatus.BEGUN, FileUploadRecordStatus.UPLOADING, FileUploadRecordStatus.PAUSED].includes(record.status)) {
    // check record.upload time for timeout
    const now = Date.now();
    const diff = now - record.updated.getTime();
    if ((record.type === FileUploadRecordType.SERVER && diff > FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.TIMEOUT_ERROR_MS) || (record.type === FileUploadRecordType.P2P && diff > FILE_TRANSFER_SETTINGS.P2P_TRANSFER.TIMEOUT_ERROR_MS)) {
     record.status = FileUploadRecordStatus.ERROR;
     record.errorType = FileUploadErrorType.TIMEOUT_BY_SERVER;
     try {
      await updatedRecordCallback(record);
     } catch (error) {
      Log.error('Error updating record', error);
     }
    }
   }
  }
  return records;
 }
}

export default FileTransferManager;
