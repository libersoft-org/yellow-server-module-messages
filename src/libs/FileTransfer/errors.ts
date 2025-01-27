export class FileTransferError extends Error {
    constructor(message: any) {
        super(message);
        this.name = 'FileTransferError';
    }
}

export class DownloadChunkP2PError extends FileTransferError {
    constructor(message: any) {
        super(message);
        this.name = 'DownloadChunkP2PError';
    }
}

export class DownloadChunkP2PNotFoundError extends DownloadChunkP2PError {
    constructor(message: any) {
        super(message);
        this.name = 'DownloadChunkP2PNotFoundError';
    }
}
