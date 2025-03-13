export enum FileUploadRecordType {
 P2P = 'P2P',
 SERVER = 'SERVER'
}

export enum FileUploadRecordStatus {
 BEGUN = 'BEGUN',
 UPLOADING = 'UPLOADING',
 PAUSED = 'PAUSED',
 FINISHED = 'FINISHED',
 CANCELED = 'CANCELED',
 ERROR = 'ERROR'
}

export enum FileUploadRecordErrorType {
 TIMEOUT_BY_SERVER = 'TIMEOUT_BY_SERVER'
}

export interface BaseFileUploadRecord {
 id: string;
 fromUserId: number;
 fromUserUid: string;
 type: FileUploadRecordType;
 status: FileUploadRecordStatus;
 errorType: FileUploadRecordErrorType | null;

 fileOriginalName: string;
 fileMimeType: string;
 fileSize: number;

 fileName: string | null; // only for SERVER type
 fileFolder: string | null; // only for SERVER type
 fileExtension: string | null; // only for SERVER type

 chunkSize: number;
 chunksReceived: number[];

 metadata: object | null;

 created: Date;
 updated: Date;
}

export interface P2PFileUploadRecord extends BaseFileUploadRecord {
 type: FileUploadRecordType.P2P;
}

export interface ServerFileUploadRecord extends BaseFileUploadRecord {
 type: FileUploadRecordType.SERVER;
 fileName: string;
 fileFolder: string;
 fileExtension: string;
}

export type FileUploadRecord = ServerFileUploadRecord | P2PFileUploadRecord;

export interface AttachmentRecord {
 id: string;
 userId: number;
 fileTransferId: string;
 filePath: string | null;
}

export interface FileUploadChunk {
 chunkId: number;
 uploadId: string;
 checksum: string;
 data: string; // base64
}

export enum FileTransferManagerEvents {
 UPLOAD_BEGIN = 'uploadBegin',
 AFTER_PROCESS_CHUNK = 'afterProcessChunk',
 UPLOAD_FINISH = 'uploadFinish'
}

export enum FileUploadRole {
 SENDER = 'SENDER',
 RECEIVER = 'RECEIVER'
}

export type FileUploadBeginData = Pick<FileUploadRecord, 'id' | 'fromUserId' | 'fromUserUid' | 'type' | 'fileOriginalName' | 'fileMimeType' | 'fileSize' | 'fileFolder' | 'chunkSize' | 'metadata'>;
