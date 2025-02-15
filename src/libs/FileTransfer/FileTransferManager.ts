import { makeFilePath, makeP2PFileUploadRecord, makeServerFileUploadRecord, makeTempFilePath } from './utils.ts';
import { FileUploadBeginData, type FileUploadChunk, FileUploadRecordErrorType, FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType } from './types.ts';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { newLogger } from 'yellow-server-common';
import { DownloadChunkP2PNotFoundError } from './errors.ts';
import { FILE_TRANSFER_SETTINGS } from './settings.ts';
import _cloneDeep from 'lodash/cloneDeep';

let Log = newLogger('FileTransferManager');

interface FileTransferManagerSettings {
 createRecordOnServer: FileTransferManager['_createRecordOnServer'];
 findRecordOnServer: FileTransferManager['_findRecordOnServer'];
 patchRecordOnServer: FileTransferManager['_patchRecordOnServer'];
}

class FileTransferManager extends EventEmitter {
 records: Map<string, FileUploadRecord> = new Map();
 p2pTempChunks: Map<string, FileUploadChunk[]> = new Map();
 private readonly _createRecordOnServer?: (record: FileUploadRecord) => Promise<unknown>; // todo return type
 private readonly _findRecordOnServer?: (id: string) => Promise<FileUploadRecord>;
 private readonly _patchRecordOnServer?: (id: string, record: Partial<FileUploadRecord>) => Promise<unknown>; // todo return type

 constructor(settings: FileTransferManagerSettings) {
  super();
  this._createRecordOnServer = settings.createRecordOnServer;
  this._findRecordOnServer = settings.findRecordOnServer;
  this._patchRecordOnServer = settings.patchRecordOnServer;
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

  await this.createRecord(record);

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

   // check if finished
   if (record.chunksReceived.length === Math.ceil(record.fileSize / record.chunkSize)) {
    // todo: checksum
    record.status = FileUploadRecordStatus.FINISHED;
    record.chunksReceived = [];
    // move temp file to final location
    let dst = makeFilePath(record);
    await fs.rename(makeTempFilePath(record), dst);
   }

   await this.patchRecord(record.id, record);

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

  await this.patchRecord(record.id, record);

  return { record, chunk };
 }

 async getRecord(id: string) {
  const record = this.records.get(id);

  if (record) {
   return record;
  }

  // handle not found in memory
  if (!FILE_TRANSFER_SETTINGS.ENABLE_PERSISTENCE) {
   throw new Error('Record not found');
  }
  if (typeof this._findRecordOnServer !== 'function') {
   throw new Error('findRecordOnServer not set');
  }

  // proceed to find record in database
  const foundRecord = await this._findRecordOnServer(id);

  if (!foundRecord) {
   throw new Error('Record not found on server');
  }

  this.records.set(foundRecord.id, foundRecord);
  return foundRecord;
 }

 async patchRecord(id: string, _data: Partial<FileUploadRecord>) {
  const data = _cloneDeep(_data);

  // rm data that we should not update
  delete data.id;
  delete data.updated;

  // handle persistence
  if (FILE_TRANSFER_SETTINGS.ENABLE_PERSISTENCE) {
   if (typeof this._patchRecordOnServer !== 'function') {
    throw new Error('updateRecordOnServer not set');
   }

   await this._patchRecordOnServer(id, data);
  }

  // assemble updated record in case of db defaults/updates
  const currentRecord = await this.getRecord(id);
  const updatedRecord = { ...currentRecord, ...data, id } as FileUploadRecord;

  // update memory if set
  if (this.records.has(id)) {
   this.records.set(id, updatedRecord);
  }

  return updatedRecord;
 }

 async createRecord(data: FileUploadRecord) {
  if (FILE_TRANSFER_SETTINGS.ENABLE_PERSISTENCE) {
   if (typeof this._createRecordOnServer !== 'function') {
    throw new Error('createRecordOnServer not set');
   }

   await this._createRecordOnServer(data);
  }

  let record = { ...data } as FileUploadRecord;
  if (FILE_TRANSFER_SETTINGS.ENABLE_PERSISTENCE && this._findRecordOnServer) {
   // get updated data from server (in case of db defaults)
   const dbRecord = await this._findRecordOnServer(data.id);
   record = { ...record, ...dbRecord };
  }

  this.records.set(data.id, record);
  return data;
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
  const tempChunks = this.p2pTempChunks.get(uploadId) || [];
  const chunk = tempChunks[chunkId];

  if (!chunk) {
   throw new DownloadChunkP2PNotFoundError('Chunk not found');
  }

  return { chunk };
 }

 async checkAndValidateFileUploads(records: FileUploadRecord[], updatedRecordCallback: (record: FileUploadRecord) => Promise<void>) {
  for (let record of records) {
   if ([FileUploadRecordStatus.FINISHED, FileUploadRecordStatus.CANCELED, FileUploadRecordStatus.ERROR].includes(record.status)) {
    // clear from server memory
    this.records.delete(record.id);
    continue;
   }

   if ([FileUploadRecordStatus.BEGUN, FileUploadRecordStatus.UPLOADING, FileUploadRecordStatus.PAUSED].includes(record.status)) {
    // check record.upload time for timeout
    const now = Date.now();
    const diff = now - record.updated.getTime();
    Log.info('checking id', record.id);
    Log.info('checking time now', new Date().toTimeString());
    Log.info('checking time record', record.updated.toTimeString());
    let timeout = null;
    if (record.type === FileUploadRecordType.SERVER) {
     if (record.status === FileUploadRecordStatus.PAUSED) {
      timeout = FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.STATUS_PAUSED_TIMEOUT_ERROR_MS;
     } else {
      timeout = FILE_TRANSFER_SETTINGS.SERVER_TRANSFER.DEFAULT_TIMEOUT_ERROR_MS;
     }
    }
    if (record.type === FileUploadRecordType.P2P) {
     if (record.status === FileUploadRecordStatus.PAUSED) {
      timeout = FILE_TRANSFER_SETTINGS.P2P_TRANSFER.STATUS_PAUSED_TIMEOUT_ERROR_MS;
     } else {
      timeout = FILE_TRANSFER_SETTINGS.P2P_TRANSFER.DEFAULT_TIMEOUT_ERROR_MS;
     }
    }
    Log.debug('Checking record', record.id, 'for diff', diff, 'timeout', timeout);
    if (timeout && diff > timeout) {
     try {
      Log.info('Updating file upload record', record.id, record.status, record.errorType);
      record = await this.patchRecord(record.id, {
       status: FileUploadRecordStatus.ERROR,
       errorType: FileUploadRecordErrorType.TIMEOUT_BY_SERVER
      });
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
