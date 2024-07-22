import { Modal, Notice, TFile } from "obsidian";
import * as crypto from "crypto";
import FileSharePlugin from "main";

interface Friend {
	username: string;
	publicKey: string;
}

class FileShareModal extends Modal {
	private plugin: FileSharePlugin;
	private ws: WebSocket;
	private file: TFile | null;
	private friends: Friend[];
	private inputEl: HTMLInputElement;
	private listEl: HTMLElement;

	constructor(
		plugin: FileSharePlugin,
		ws: WebSocket,
		friends: Friend[],
		file: TFile | null = null
	) {
		super(plugin.app);
		this.plugin = plugin;
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
					const requestData = JSON.stringify({ type: 'request', target: friend.publicKey, filename: this.file?.name });
					const dataSign = this.signData(requestData);
					this.ws.send(JSON.stringify({
						type: 'request',
						target: friend.publicKey,
						filename: this.file?.name,
						signature: dataSign
					}));
					new Notice(`Request sent to ${friend.username} for file ${this.file?.name}`);
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			} else if (data.type === "response") {
				if (data.accepted) {
					new Notice(`File request accepted by ${friend.username}`);
					this.encryptAndSendFile(friend, data.hash);
				} else {
					new Notice(`File request declined by ${friend.username}`);
				}
			}
		};
	}

	async signFile() {
		if (!this.file) {
			new Notice("No file selected");
			return;
		}

		const file = this.file;
		const fileContent = await this.app.vault.readBinary(file);

		const sign = crypto.createSign("SHA256");
		sign.update(Buffer.from(fileContent));
		const signature = sign.sign(this.plugin.settings.privateKey, "base64");
		return signature;
	}

	signData(data: string): string {
		const sign = crypto.createHmac('SHA256', this.plugin.settings.privateKey); 
		sign.update(data);
		return sign.digest('base64');
	}

	async encryptAndSendFile(friend: Friend, hash: string) {
		if (!this.file) {
			new Notice("No file selected");
			return;
		}

		const signature = await this.signFile();
		const publicKey = this.plugin.serializePublicKey(friend.publicKey);
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
			signature,
			sender: this.plugin.settings.publicKey
		};

		this.ws.send(
			JSON.stringify({
				type: "file",
				payload: payload,
				target: friend.publicKey,
				hash: hash
			})
		);

		new Notice(`File sent to ${friend.username}`);
		this.close();
	}
}

export { FileShareModal };
