export enum FileUploadRecordType {
  P2P = 'P2P',
  SERVER = 'SERVER',
}

export enum FileUploadRecordStatus {
  BEGUN = 'BEGUN',
  UPLOADING = 'UPLOADING',
  FINISHED = 'FINISHED',
  STOPPED = 'STOPPED',
}

export interface FileUploadRecord {
 id: string
 fromUserId: number
 type: FileUploadRecordType
 status: FileUploadRecordStatus

 fileName: string
 fileMimeType: string
 fileSize: number
 filePath: string

 tempFilePath: string

 chunkSize: number
 chunksReceived: number[]
}

export interface FileUploadChunk {
 chunkId: number
 uploadId: string
 checksum: string
 data: string // base64
}

export enum FileTransferManagerEvents {
 UPLOAD_BEGIN = 'uploadBegin',
 AFTER_PROCESS_CHUNK = 'afterProcessChunk',
 UPLOAD_FINISH = 'uploadFinish',
}
