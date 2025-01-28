import { makeFileUploadRecord } from './utils.ts';
import { type FileUploadChunk, FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType } from './types.ts';
import fs from 'node:fs/promises';
import * as fsSync from 'fs';
import { EventEmitter } from 'node:events';
import { newLogger } from 'yellow-server-common';
import { DownloadChunkP2PNotFoundError } from './errors.ts';

let Log = newLogger('FileTransferManager');

class FileTransferManager extends EventEmitter {
 records: Map<string, FileUploadRecord> = new Map();
 findRecord: (id: string) => Promise<FileUploadRecord>;
 p2pTempChunks: Map<string, FileUploadChunk[]> = new Map();

 constructor(settings: { findRecord: (id: string) => Promise<FileUploadRecord> }) {
  super();
  this.findRecord = settings.findRecord;
 }

 async uploadBegin(data: Pick<FileUploadRecord, 'id' | 'fromUserId' | 'type' | 'fileName' | 'fileMimeType' | 'fileSize' | 'filePath'>) {
  const record = makeFileUploadRecord({
   id: data.id,
   fromUserId: data.fromUserId,
   type: data.type,
   fileName: data.fileName,
   fileMimeType: data.fileMimeType,
   fileSize: data.fileSize,
   filePath: data.filePath,
   chunkSize: 1024 * 64,
   tempFilePath: 'uploads/' + data.id + '-' + data.fileName //+ '.tmp'
   // tempFilePath: data.filePath + '/' + data.fileName //+ '.tmp'
  });

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
   await fs.appendFile(record.tempFilePath, buffer);
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
  await fs.rename(record.tempFilePath, record.filePath + '/' + record.fileName);
  // this.emit(FileTransferManagerEvents.UPLOAD_FINISH, {record})
  return { record };
 }

 async getRecord(id: string) {
  const record = this.records.get(id);

  if (record) {
   return record;
  }

  console.log('id', id);

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
  const filePath = record.filePath + '/' + record.fileName;
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

 async downloadAttachment(record: FileUploadRecord, callback: (chunk: FileUploadChunk) => void) {
  let chunkId = -1;
  const chunkSize = record.chunkSize;
  const filePath = `${record.filePath}/${record.fileName}`;

  try {
   const fd = fsSync.openSync(filePath, 'r'); // Open the file for reading
   const buffer = Buffer.alloc(chunkSize); // Allocate a buffer for the chunk
   let bytesRead;

   // Read the file manually in chunks
   while ((bytesRead = fsSync.readSync(fd, buffer, 0, chunkSize, null)) > 0) {
    chunkId++;
    const chunkData = {
     chunkId,
     uploadId: record.id,
     checksum: '', // Add checksum logic if needed
     data: buffer.slice(0, bytesRead).toString('base64'), // Convert chunk to Base64
     fileSize: record.fileSize,
     chunkSize
    };

    // Debug and pass the chunk to the callback
    callback(chunkData);
   }

   // Clean up after reading
   fsSync.closeSync(fd);
   Log.debug('File transfer complete');
  } catch (error: any) {
   Log.error('Error while reading file:', error.message);
   throw error;
  }
 }

 async downloadAttachmentP2P(record: FileUploadRecord, callback: (chunk: FileUploadChunk) => void) {
  setInterval(() => {
   const tempChunks = this.p2pTempChunks.get(record.id) || [];
   if (tempChunks.length > 0) {
    const chunk = tempChunks.shift();
    if (chunk) {
     Log.debug('Sending chunk', chunk.chunkId, chunk.data.length);

     const chunkData = {
      chunkId: chunk.chunkId,
      uploadId: record.id,
      checksum: '', // Add checksum logic if needed
      data: chunk.data, // Convert chunk to Base64
      fileSize: record.fileSize,
      chunkSize: record.chunkSize
     };
     callback(chunkData);
    }
   }
  }, 1000);
 }
}

export default FileTransferManager;
