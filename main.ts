// main.ts
import {
	App,
	Menu,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import { FileShareModal } from "./fileShareModal";
import * as crypto from "crypto";

interface Friend {
	username: string;
	hash: string;
	publicKey: string;
}

interface P2PFileShareSettings {
	socketUrl: string;
	friends: Friend[];
	uniqueHash: string;
	receiveFolder: string;
	privateKey: string;
	publicKey: string;
}

const DEFAULT_SETTINGS: P2PFileShareSettings = {
	socketUrl: "ws://127.0.0.1:3000",
	friends: [],
	uniqueHash: "",
	receiveFolder: "/",
	privateKey: '',
	publicKey: ''
};

class FileSharePlugin extends Plugin {
	ws: WebSocket;
	settings: P2PFileShareSettings;

	async onload() {
		await this.loadSettings();

		// Generate RSA key pair if it doesn't exist
		if (!this.settings.privateKey || !this.settings.publicKey) {
			const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
			  modulusLength: 2048,
			});
			this.settings.privateKey = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
			this.settings.publicKey = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
			await this.saveSettings();
		  }

		// Generate a unique hash if it doesn't exist
		if (!this.settings.uniqueHash) {
			this.settings.uniqueHash = this.generateUniqueHash();
			await this.saveSettings();
		}
		this.initializeWebSocket();
		

		this.addRibbonIcon("refresh-cw", "Reconnect", () => {
			if (this.ws.readyState !== WebSocket.OPEN) {
			  this.initializeWebSocket();
			  new Notice('Attempting to reconnect WebSocket...');
			} else {
			  new Notice('WebSocket is already connected.');
			}
		});

		// Add the context menu option
		this.registerEvent(
			this.app.workspace.on("file-menu", this.onFileMenu.bind(this))
		);

		this.addSettingTab(new FileShareSettingTab(this.app, this));
	}

	initializeWebSocket() {
		this.ws = new WebSocket(this.settings.socketUrl);
	  
		this.ws.onopen = () => {
			console.log("WebSocket connection opened");
			this.ws.send(
				JSON.stringify({
					type: "login",
					name: this.settings.uniqueHash || "",
				})
			);
		};

		this.ws.onmessage = (message) => {
			const data = JSON.parse(message.data);
			switch (data.type) {
				case "file":
					this.receiveFile(data);
					break;
			}
		};
	  
		this.ws.onclose = () => {
		  console.log('WebSocket connection closed');
		  new Notice('WebSocket connection closed. You may need to reconnect.');
		};
	  
		this.ws.onerror = (error) => {
		  console.error('WebSocket error:', error);
		  new Notice('WebSocket error occurred. Check console for details.');
		};
	  }

	onunload() {
		this.ws.close();
	}

	generateUniqueHash() {
		const systemInfo = `${
			navigator.userAgent
		}-${Date.now()}-${Math.random()}`;
		return crypto.createHash("sha256").update(systemInfo).digest("hex");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async receiveFile(data: {type: string, filename: string, file: string, aesKey: string, iv: string, name: string}) {
		const receiveFolder = this.settings.receiveFolder;
		const filePath = `${receiveFolder}/${data.filename}`;
	
		const encryptedFile = Buffer.from(data.file, 'base64');
		const encryptedAesKey = Buffer.from(data.aesKey, 'base64');
		const iv = Buffer.from(data.iv, 'base64');
	
		// Decrypt the AES key using the receiver's private key (RSA)
		const aesKey = crypto.privateDecrypt(crypto.createPrivateKey(this.settings.privateKey), encryptedAesKey);
	
		// Decrypt the file using AES-256
		const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
		const decryptedFile = Buffer.concat([decipher.update(encryptedFile), decipher.final()]);
	
		try {
		  await this.app.vault.createBinary(filePath, decryptedFile);
		  new Notice(`File received and saved to ${filePath}`);
		} catch (error) {
		  console.error('Error saving received file:', error);
		  new Notice('Failed to save the received file.');
		}
	  }

	onFileMenu(menu: Menu, file: TAbstractFile) {
		if (file instanceof TFile) {
			menu.addItem((item) => {
				item.setTitle("Send to ...")
					.setIcon("paper-plane")
					.onClick(() => {
						new FileShareModal(
							this.app,
							this.ws,
							this.settings.friends,
							file
						).open();
					});
			});
		}
	}
}

class FileShareSettingTab extends PluginSettingTab {
	plugin: FileSharePlugin;

	constructor(app: App, plugin: FileSharePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "File Share Settings" });

		// Unique Hash Setting
		new Setting(containerEl)
			.setName("Unique Hash")
			.setDesc("Give this to a friend")
			.addText((text) =>
				text.setValue(this.plugin.settings.uniqueHash).setDisabled(true)
			)
			.addExtraButton((button) =>
				button
					.setIcon("copy")
					.setTooltip("Copy to clipboard")
					.onClick(() => {
						navigator.clipboard.writeText(
							this.plugin.settings.uniqueHash
						);
						new Notice("Hash copied to clipboard");
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon("refresh-cw")
					.setTooltip("Regenerate hash")
					.onClick(async () => {
						this.plugin.settings.uniqueHash =
							this.plugin.generateUniqueHash();
						await this.plugin.saveSettings();
						this.display();
						new Notice("Hash regenerated");
					})
		);
		
		// Display the user's public key
		new Setting(containerEl)
			.setName('Your Public Key')
			.setDesc('This is your public key. Share it with your friends.')
			.addTextArea(text => {
				text.setValue(this.plugin.settings.publicKey)
					.setDisabled(true);
			})
			.addExtraButton((button) =>
				button
					.setIcon("copy")
					.setTooltip("Copy to clipboard")
					.onClick(() => {
						navigator.clipboard.writeText(
							this.plugin.settings.publicKey
						);
						new Notice("Public Key copied to clipboard");
					})
			);

		// Folder Setting
		new Setting(containerEl)
			.setName("Receive Folder")
			.setDesc("Select the folder where received files will be saved.")
			.addDropdown((drop) => {
				const folders = this.plugin.app.vault
					.getAllLoadedFiles()
					.filter((file) => file instanceof TFolder);
				folders.forEach((folder) => {
					drop.addOption(folder.path, folder.path);
				});
				drop.setValue(this.plugin.settings.receiveFolder);
				drop.onChange(async (value) => {
					this.plugin.settings.receiveFolder = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Socket URL")
			.setDesc("Socket URL to exchange sdp data automatically")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.socketUrl)
					.onChange(async (value) => {
						this.plugin.settings.socketUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Add Friend")
			.addButton((button) =>
				button.setButtonText("Add").onClick(() => this.addFriend())
			);
		this.plugin.settings.friends.forEach((friend, index) => {
			const setting = new Setting(containerEl)
				.setName(friend.username)
				.setDesc(`Hash: ${friend.hash}`)
				.addButton((button) =>
					button
						.setButtonText("Edit")
						.onClick(() => this.editFriend(index))
				)
				.addButton((button) =>
					button.setButtonText("Delete").onClick(() => {
						this.plugin.settings.friends.splice(index, 1);
						this.plugin.saveSettings();
						this.display();
					})
				);
		});
	}

	addFriend() {
		const modal = new FriendModal(this.app, this.plugin, null, this);
		modal.open();
	}

	editFriend(index: number) {
		const modal = new FriendModal(this.app, this.plugin, index, this);
		modal.open();
	}
}

class FriendModal extends Modal {
	plugin: FileSharePlugin;
	index: number | null;
	usernameInput: HTMLInputElement;
	hashInput: HTMLInputElement;
	fileShareSettingTab: FileShareSettingTab;
	publicKeyTextArea: HTMLTextAreaElement;

	constructor(
		app: App,
		plugin: FileSharePlugin,
		index: number | null,
		fileShareSettingTab: FileShareSettingTab
	) {
		super(app);
		this.plugin = plugin;
		this.index = index;
		this.fileShareSettingTab = fileShareSettingTab;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", {
			text: this.index === null ? "Add Friend" : "Edit Friend",
		});

		this.usernameInput = contentEl.createEl("input", { type: "text" });
		this.hashInput = contentEl.createEl("input", { type: "text" });
		this.publicKeyTextArea = contentEl.createEl('textarea', { type: 'text' });

		if (this.index !== null) {
			const friend = this.plugin.settings.friends[this.index];
			this.usernameInput.value = friend.username;
			this.hashInput.value = friend.hash;
			this.publicKeyTextArea.value = friend.publicKey;
		}

		const saveButton = contentEl.createEl("button", { text: "Save" });
		saveButton.addEventListener("click", () => this.saveFriend());
	}

	saveFriend() {
		const username = this.usernameInput.value;
		const hash = this.hashInput.value;
		const publicKey = this.publicKeyTextArea.value;

		if (this.index === null) {
			this.plugin.settings.friends.push({ username, hash, publicKey });
		} else {
			this.plugin.settings.friends[this.index] = { username, hash, publicKey };
		}

		this.plugin.saveSettings();
		this.close();
		this.fileShareSettingTab.display();

	}
}

export default FileSharePlugin;
