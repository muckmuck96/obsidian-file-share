import { IFriend } from "interfaces/IFriend";
import FileSharePlugin from "main";
import { Notice, TFile } from "obsidian";

export class FileTransmitter {
	private plugin: FileSharePlugin;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
	}
	async sendFile(
		file: TFile | null,
		friend: IFriend,
		hash: string
	): Promise<void> {
		if (!file) {
			new Notice("No file selected");
			return;
		}
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
		});

		new Notice(`File sent to ${friend.username}`);
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
	}): Promise<void> {
		if (!data.sender) {
			new Notice("Sender not found");
			return;
		}
		const receiveFolder = this.plugin.settings.receiveFolder;
		const filePath = `${receiveFolder}/${data.filename}`;

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
			await this.plugin.app.vault.createBinary(filePath, decryptedFile);
			new Notice(`File received and saved to ${filePath}`);
		} catch (error) {
			console.error("Error saving received file:", error);
			new Notice("Failed to save the received file.");
		}
	}
}
