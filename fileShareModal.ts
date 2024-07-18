import { Modal, Notice, TFile } from "obsidian";
import * as crypto from "crypto";

interface Friend {
	username: string;
	publicKey: string;
}

class FileShareModal extends Modal {
	private ws: WebSocket;
	private file: TFile | null;
	private friends: Friend[];
	private inputEl: HTMLInputElement;
	private listEl: HTMLElement;

	constructor(
		app: any,
		ws: WebSocket,
		friends: Friend[],
		file: TFile | null = null
	) {
		super(app);
		this.ws = ws;
		this.file = file;
		this.friends = friends;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("file-share-modal");

		this.inputEl = contentEl.createEl("input", {
			type: "text",
			placeholder: "Select a friend to share the file with",
		});
		this.listEl = contentEl.createEl("div", { cls: "file-share-list" });

		this.inputEl.addEventListener("input", () => this.updateList());

		this.updateList();
	}

	updateList() {
		const query = this.inputEl.value.toLowerCase();
		this.listEl.empty();

		const filteredFriends = this.friends.filter((friend) =>
			friend.username.toLowerCase().includes(query)
		);

		if (filteredFriends.length === 0) {
			this.listEl.createEl("div", {
				text: "No friends found",
				cls: "no-friends",
			});
		} else {
			filteredFriends.forEach((friend) => {
				const itemEl = this.listEl.createEl("div", {
					text: friend.username,
					cls: "file-share-item",
				});
				itemEl.addEventListener("click", () =>
					this.checkOnlineAndSendFile(friend)
				);
			});
		}
	}

	checkOnlineAndSendFile(friend: Friend) {
		this.ws.send(
			JSON.stringify({
				type: "checkOnline",
				target: friend.publicKey,
			})
		);

		this.ws.onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (
				data.type === "checkOnline" &&
				data.target === friend.publicKey
			) {
				if (data.online) {
					this.encryptAndSendFile(friend);
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			}
		};
	}

	serializePublicKey(publicKey: string) {
		return Buffer.from(publicKey, "base64").toString();
	}

	async encryptAndSendFile(friend: Friend) {
		if (!this.file) {
			new Notice("No file selected");
			return;
		}

		const publicKey = this.serializePublicKey(friend.publicKey);
		const file = this.file;
		const fileContent = await this.app.vault.readBinary(file);

		const aesKey = crypto.randomBytes(32); // AES-256 key
		const iv = crypto.randomBytes(16); // Initialization vector

		// Encrypt the file using AES-256
		const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
		const encryptedFile = Buffer.concat([
			cipher.update(Buffer.from(fileContent)),
			cipher.final(),
		]);

		// Encrypt the AES key using the receiver's public key (RSA)
		const encryptedAesKey = crypto.publicEncrypt(publicKey, aesKey);

		const payload = {
			file: encryptedFile.toString("base64"),
			aesKey: encryptedAesKey.toString("base64"),
			iv: iv.toString("base64"),
			filename: file.name,
		};

		this.ws.send(
			JSON.stringify({
				type: "file",
				payload: payload,
				target: friend.publicKey,
			})
		);

		new Notice(`File sent to ${friend.username}`);
		this.close();
	}
}

export { FileShareModal };
