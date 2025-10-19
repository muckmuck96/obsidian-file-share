import { IFriend } from "interfaces/IFriend";
import { IFileChunkProgress } from "interfaces/IFileChunk";
import FileSharePlugin from "main";
import { Notice, TFile } from "obsidian";

export class FileTransmitter {
	private plugin: FileSharePlugin;
	private activeTransfers: Map<string, { currentChunk: number; totalChunks: number }>;
	private receivingFiles: Map<string, IFileChunkProgress>;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
		this.activeTransfers = new Map();
		this.receivingFiles = new Map();
	}
	async sendFile(
		file: TFile | null,
		friend: IFriend,
		hash: string,
		sourceFolderPath?: string
	): Promise<void> {
		if (!file) {
			new Notice("No file selected");
			return;
		}

		// Check file size to determine if chunking is needed
		const fileStats = await this.plugin.app.vault.adapter.stat(file.path);
		if (!fileStats) {
			new Notice("Could not read file");
			return;
		}

		// Use chunked transfer for files larger than chunk size
		if (fileStats.size > this.plugin.settings.chunkSize) {
			await this.sendFileChunked(file, friend, hash, sourceFolderPath);
		} else {
			// Use legacy single-payload transfer for small files
			const encryptedFilePayload = await this.plugin.secure.encryptFile(
				file,
				friend
			);
			const payload = Object.assign(
				{ sender: this.plugin.settings.publicKey },
				encryptedFilePayload
			);

			this.plugin.socket.send("file", {
				payload: payload,
				target: friend.publicKey,
				hash: hash,
				sourceFolderPath: sourceFolderPath,
			});

			new Notice(`File sent to ${friend.username}`);
		}
	}

	async sendFileChunked(
		file: TFile,
		friend: IFriend,
		hash: string,
		sourceFolderPath?: string
	): Promise<void> {
		const result = await this.plugin.secure.encryptFileChunked(file, friend);
		if (!result) {
			new Notice("Failed to encrypt file");
			return;
		}

		const { metadata, chunks } = result;
		this.activeTransfers.set(metadata.fileId, {
			currentChunk: 0,
			totalChunks: metadata.totalChunks,
		});

		// Send metadata first
		this.plugin.socket.send("fileMetadata", {
			payload: metadata,
			target: friend.publicKey,
			hash: hash,
			sourceFolderPath: sourceFolderPath,
		});

		// Send chunks with delay to avoid overwhelming the socket
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];

			this.plugin.socket.send("fileChunk", {
				payload: chunk,
				target: friend.publicKey,
				hash: hash,
				sourceFolderPath: sourceFolderPath,
			});

			this.activeTransfers.set(metadata.fileId, {
				currentChunk: i + 1,
				totalChunks: metadata.totalChunks,
			});

			// Small delay between chunks to avoid overwhelming the socket
			if (i < chunks.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 10));
			}
		}

		new Notice(`File sent to ${friend.username} in ${chunks.length} chunks`);
		this.activeTransfers.delete(metadata.fileId);
	}

	getTransferProgress(fileId: string): { currentChunk: number; totalChunks: number } | undefined {
		return this.activeTransfers.get(fileId);
	}

	async receiveFile(data: {
		type: string;
		filename: string;
		file: string;
		aesKey: string;
		iv: string;
		name: string;
		signature: string;
		sender: string;
		sourceFolderPath?: string;
	}): Promise<void> {
		if (!data.sender) {
			new Notice("Sender not found");
			return;
		}

		const filePath = this.constructReceivePath(data.filename, data.sourceFolderPath);

		const encryptedFile = Buffer.from(data.file, "base64");
		const encryptedAesKey = Buffer.from(data.aesKey, "base64");
		const iv = Buffer.from(data.iv, "base64");

		const decryptedFile = await this.plugin.secure.decryptFile(
			encryptedAesKey,
			iv,
			encryptedFile
		);

		const isVerified = await this.plugin.secure.verifySignature(
			decryptedFile,
			data.signature,
			this.plugin.secure.serializePublicKey(data.sender)
		);

		if (!isVerified) {
			new Notice("Signature verification failed. File not saved.");
			return;
		}

		try {
			// Ensure the folder exists before saving
			await this.ensureFolderExists(filePath);
			await this.plugin.app.vault.createBinary(filePath, decryptedFile);
			new Notice(`File received and saved to ${filePath}`);
		} catch (error) {
			console.error("Error saving received file:", error);
			new Notice("Failed to save the received file.");
		}
	}

	private constructReceivePath(filename: string, sourceFolderPath?: string): string {
		const receiveFolder = this.plugin.settings.receiveFolder;

		// If preserveFolderStructure is enabled and sourceFolderPath is provided
		if (this.plugin.settings.preserveFolderStructure && sourceFolderPath) {
			// Combine receive folder with source folder path
			const fullPath = `${receiveFolder}/${sourceFolderPath}/${filename}`;
			return fullPath.replace(/\/+/g, '/'); // Clean up double slashes
		}

		// Default behavior: save directly to receive folder
		return `${receiveFolder}/${filename}`;
	}

	private async ensureFolderExists(filePath: string): Promise<void> {
		// Extract the directory path from the full file path
		const parts = filePath.split('/');
		parts.pop(); // Remove filename
		const folderPath = parts.join('/');

		// Check if folder exists, create if it doesn't
		const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			try {
				await this.plugin.app.vault.createFolder(folderPath);
			} catch (error) {
				// Folder might already exist, ignore error
				console.log(`Folder creation note: ${error}`);
			}
		}
	}

	async scanFileAndSend(file: TFile, friend: IFriend, sourceFolderPath?: string): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const links = content.match(/\[\[(.*?)\]\]/g);
		if (!links) {
			return;
		}

		for (const link of links) {
			const fileName = link.replace(/\[\[(.*?)\]\]/g, "$1");
			const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				fileName,
				file.path
			);
			if (linkedFile) {
				// Validate linked file before adding to queue
				const validation = await this.plugin.fileValidator.validateFile(linkedFile);
				if (validation.valid) {
					// Don't pass sourceFolderPath for embedded linked files
					this.plugin.fileRequestQueue.addRequest(linkedFile, friend);
				} else {
					// Silently skip invalid files or optionally log them
					console.log(`Skipping invalid linked file: ${linkedFile.name} - ${validation.error}`);
				}
			}
		}
	}

	async receiveFileMetadata(data: {
		fileId: string;
		filename: string;
		totalChunks: number;
		totalSize: number;
		sender: string;
		sourceFolderPath?: string;
	}): Promise<void> {
		if (!data.sender) {
			new Notice("Sender not found");
			return;
		}

		this.receivingFiles.set(data.fileId, {
			fileId: data.fileId,
			filename: data.filename,
			totalChunks: data.totalChunks,
			receivedChunks: 0,
			chunks: new Map(),
			sender: data.sender,
			sourceFolderPath: data.sourceFolderPath,
		});

		new Notice(`Receiving file: ${data.filename} (${data.totalChunks} chunks)`);
	}

	async receiveFileChunk(data: {
		chunkIndex: number;
		totalChunks: number;
		chunkData: string;
		aesKey: string;
		iv: string;
		filename: string;
		fileId: string;
		signature: string;
	}): Promise<void> {
		const fileProgress = this.receivingFiles.get(data.fileId);
		if (!fileProgress) {
			new Notice("Received chunk for unknown file");
			return;
		}

		// Decrypt the chunk
		const encryptedChunk = Buffer.from(data.chunkData, "base64");
		const encryptedAesKey = Buffer.from(data.aesKey, "base64");
		const iv = Buffer.from(data.iv, "base64");

		const decryptedChunk = await this.plugin.secure.decryptChunk(
			encryptedAesKey,
			iv,
			encryptedChunk
		);

		// Store the decrypted chunk
		fileProgress.chunks.set(data.chunkIndex, decryptedChunk);
		fileProgress.receivedChunks++;

		// Store metadata for verification
		if (!fileProgress.signature) {
			fileProgress.signature = data.signature;
		}

		// Check if we have all chunks
		if (fileProgress.receivedChunks === fileProgress.totalChunks) {
			await this.reassembleFile(fileProgress);
		}
	}

	async reassembleFile(fileProgress: IFileChunkProgress): Promise<void> {
		// Reassemble all chunks in order
		const chunks: Buffer[] = [];
		for (let i = 0; i < fileProgress.totalChunks; i++) {
			const chunk = fileProgress.chunks.get(i);
			if (!chunk) {
				new Notice(`Missing chunk ${i} for file ${fileProgress.filename}`);
				this.receivingFiles.delete(fileProgress.fileId);
				return;
			}
			chunks.push(chunk);
		}

		const completeFile = Buffer.concat(chunks);

		// Verify signature
		if (fileProgress.signature && fileProgress.sender) {
			const isVerified = await this.plugin.secure.verifySignature(
				completeFile,
				fileProgress.signature,
				this.plugin.secure.serializePublicKey(fileProgress.sender)
			);

			if (!isVerified) {
				new Notice("Signature verification failed. File not saved.");
				this.receivingFiles.delete(fileProgress.fileId);
				return;
			}
		}

		// Save the file
		const filePath = this.constructReceivePath(fileProgress.filename, fileProgress.sourceFolderPath);

		try {
			// Ensure the folder exists before saving
			await this.ensureFolderExists(filePath);
			await this.plugin.app.vault.createBinary(filePath, completeFile);
			new Notice(`File received and saved to ${filePath}`);
		} catch (error) {
			console.error("Error saving received file:", error);
			new Notice("Failed to save the received file.");
		}

		this.receivingFiles.delete(fileProgress.fileId);
	}

	getReceivingProgress(fileId: string): IFileChunkProgress | undefined {
		return this.receivingFiles.get(fileId);
	}
}
