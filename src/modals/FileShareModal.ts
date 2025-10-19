import { Notice, SuggestModal, TFile, TFolder } from "obsidian";
import FileSharePlugin from "main";
import { IFriend } from "interfaces/IFriend";
import { Socket } from "core/Socket";

class FileShareModal extends SuggestModal<IFriend> {
	private plugin: FileSharePlugin;
	private socket: Socket;
	private file: TFile | null;
	private folder: TFolder | null;
	private friends: IFriend[];

	constructor(
		plugin: FileSharePlugin,
		socket: Socket,
		friends: IFriend[],
		file: TFile | null = null,
		folder: TFolder | null = null
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.socket = socket;
		this.file = file;
		this.folder = folder;
		this.friends = friends;
	}

	getSuggestions(query: string): IFriend[] {
		return this.friends.filter((friend) =>
			friend.username.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(friend: IFriend, el: HTMLElement): void {
		el.createEl("div", { text: friend.username });
	}

	onChooseSuggestion(friend: IFriend, evt: MouseEvent | KeyboardEvent): void {
		this.checkOnlineAndSendFile(friend);
	}

	async checkOnlineAndSendFile(friend: IFriend): Promise<void> {
		// Check if socket is connected first
		if (this.socket.getWS().readyState !== WebSocket.OPEN) {
			new Notice("You are not connected to the FileShare server. Please connect first.");
			return;
		}

		// Validate file first before checking online status
		if (this.file != null) {
			const validation = await this.plugin.fileValidator.validateFile(this.file);
			if (!validation.valid) {
				this.plugin.fileValidator.showValidationError(validation.error || "Invalid file");
				return;
			}
		}

		this.socket.send("checkOnline", { target: friend.publicKey });

		this.socket.getWS().onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (
				data.type === "checkOnline" &&
				data.target === friend.publicKey
			) {
				if (data.online) {
					if(this.file != null) {
						this.plugin.fileRequestQueue.addRequest(this.file, friend);
						if(this.plugin.settings.scanSendingFiles) {
							this.plugin.fileTransmitter.scanFileAndSend(this.file, friend);
						}
					} else if(this.folder != null) {
						// Send all files from folder
						this.sendFolderFiles(this.folder, friend);
					}
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			} else if (data.type === "response") {
				this.plugin.fileRequestQueue.handleResponse(data.id, data.accepted, data.hash);
			}
		};
	}

	private async sendFolderFiles(folder: TFolder, friend: IFriend): Promise<void> {
		// Get all files in the folder recursively
		const files = this.getAllFilesInFolder(folder);

		if (files.length === 0) {
			new Notice("No files found in folder");
			return;
		}

		let validFileCount = 0;
		let invalidFileCount = 0;

		for (const file of files) {
			// Validate each file
			const validation = await this.plugin.fileValidator.validateFile(file);
			if (validation.valid) {
				// Calculate relative path from the base folder
				const relativePath = this.getRelativePath(folder, file);
				this.plugin.fileRequestQueue.addRequest(file, friend, relativePath);

				// Scan for embedded links if option is enabled
				if(this.plugin.settings.scanSendingFiles) {
					await this.plugin.fileTransmitter.scanFileAndSend(file, friend, relativePath);
				}

				validFileCount++;
			} else {
				console.log(`Skipping invalid file: ${file.name} - ${validation.error}`);
				invalidFileCount++;
			}
		}

		if (validFileCount > 0) {
			new Notice(`Sending ${validFileCount} file(s) from folder "${folder.name}" to ${friend.username}`);
		}

		if (invalidFileCount > 0) {
			new Notice(`Skipped ${invalidFileCount} invalid file(s)`);
		}
	}

	private getRelativePath(baseFolder: TFolder, file: TFile): string {
		// Get the relative path from the base folder to the file
		// e.g., if baseFolder is "MyFolder" and file is "MyFolder/Sub/file.md"
		// return "Sub/file.md"
		const basePath = baseFolder.path;
		const filePath = file.parent ? file.parent.path : "";

		if (filePath.startsWith(basePath)) {
			const relative = filePath.substring(basePath.length);
			return relative.startsWith("/") ? relative.substring(1) : relative;
		}

		return "";
	}

	private getAllFilesInFolder(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		// Recursively get all files from the folder
		const processFolder = (currentFolder: TFolder) => {
			for (const child of currentFolder.children) {
				if (child instanceof TFile) {
					files.push(child);
				} else if (child instanceof TFolder) {
					processFolder(child);
				}
			}
		};

		processFolder(folder);
		return files;
	}
}

export { FileShareModal };
