import {v4 as uuidv4} from 'uuid'
import {AttachmentRecord, type FileUploadRecord, FileUploadRecordStatus, FileUploadRecordType} from './types.ts'

type MakeFileUploadRecordData = Partial<FileUploadRecord>
 & Pick<FileUploadRecord, 'type' | 'fileName' | 'fileMimeType' | 'fileSize' | 'filePath' | 'chunkSize'>

type MakeAttachmentRecordData = Partial<AttachmentRecord>
 & Pick<AttachmentRecord, 'userId' | 'fileTransferId' | 'filePath'>

export function makeFileUploadRecord (data: MakeFileUploadRecordData): FileUploadRecord {
 const defaults = {
  id: uuidv4(),
  status: FileUploadRecordStatus.BEGUN,
  type: FileUploadRecordType.SERVER,
  fileName: '',
  fileMimeType: '',
  fileSize: 0,
  filePath: '',
  tempFilePath: '',
  chunkSize: 0,
  fromUserId : 0,
  chunksReceived: [],
 }
 return Object.assign(defaults, data)
}

export function makeAttachmentRecord (data: MakeAttachmentRecordData): AttachmentRecord {
 const defaults = {
  id: uuidv4(),
 }
 return Object.assign(defaults, data)
}
