export interface IFileChunk {
	chunkIndex: number;
	totalChunks: number;
	chunkData: string;
	aesKey: string;
	iv: string;
	filename: string;
	fileId: string;
	signature: string;
}

export interface IChunkedFilePayload {
	fileId: string;
	filename: string;
	totalChunks: number;
	totalSize: number;
	sender: string;
}

export interface IFileChunkProgress {
	fileId: string;
	filename: string;
	totalChunks: number;
	receivedChunks: number;
	chunks: Map<number, Buffer>;
	aesKey?: Buffer;
	iv?: Buffer;
	signature?: string;
	sender?: string;
	sourceFolderPath?: string;
}
