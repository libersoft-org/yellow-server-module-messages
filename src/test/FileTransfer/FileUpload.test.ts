import FileUpload from '../../libs/FileTransfer/FileUpload';
import { makeFileUploadRecord } from '../../libs/FileTransfer/utils';
import { FileUploadRecordType } from '../../libs/FileTransfer/types';

import * as fs from 'node:fs/promises';

describe('works', () => {
 it('run', async () => {
  const testFileName = 'file-to-upload-1.png';
  const testFilePath = 'test/_resources';

  const record = makeFileUploadRecord({
   type: FileUploadRecordType.SERVER,
   fileName: 'file-to-upload-1.png',
   fileMimeType: 'image/jpeg',
   fileSize: 4086,
   filePath: 'test/_uploads/file-transfer',
   tempFilePath: 'test/_uploads/file-transfer/test.jpg',
   chunkSize: 1024
  });
  const fileUpload = new FileUpload(record);

  await fileUpload.start();

  // get file buffer
  const file = await fs.readFile(testFilePath + '/' + testFileName);

  // split file into chunks
  const chunkSize = 1024 * 64;
  for (let i = 0; i < file.length; i += chunkSize) {
   await fileUpload.addChunk({
    chunkId: i / chunkSize,
    uploadId: record.id,
    checksum: '',
    data: file.subarray(i, i + chunkSize)
   });
  }
 });
});
