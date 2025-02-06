export enum FileUploadRecordType {
 P2P = 'P2P',
 SERVER = 'SERVER'
}

export enum FileUploadRecordStatus {
 BEGUN = 'BEGUN',
 UPLOADING = 'UPLOADING',
 FINISHED = 'FINISHED',
 CANCELED = 'CANCELED',
 PAUSED = 'PAUSED',
 ERROR = 'ERROR'
}

export enum FileUploadErrorType {
 TIMEOUT_BY_SERVER = 'TIMEOUT_BY_SERVER'
}

export interface BaseFileUploadRecord {
 id: string;
 fromUserId: number;
 fromUserUid: string;
 type: FileUploadRecordType;
 status: FileUploadRecordStatus;
 errorType: FileUploadErrorType | null;

 fileOriginalName: string;
 fileMimeType: string;
 fileSize: number;

 fileName: string | null; // only for SERVER type
 fileFolder: string | null; // only for SERVER type
 fileExtension: string | null; // only for SERVER type

 chunkSize: number;
 chunksReceived: number[];
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

export type FileUploadBeginData = Pick<FileUploadRecord, 'id' | 'fromUserId' | 'fromUserUid' | 'type' | 'fileOriginalName' | 'fileMimeType' | 'fileSize' | 'fileFolder' | 'chunkSize'>;
