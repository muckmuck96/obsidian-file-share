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
import AcceptFileModal from "acceptFileModal";

interface Friend {
	username: string;
	publicKey: string;
}

interface P2PFileShareSettings {
	socketUrl: string;
	friends: Friend[];
	receiveFolder: string;
	privateKey: string;
	publicKey: string;
	autoAcceptFiles: boolean;
}

const DEFAULT_SETTINGS: P2PFileShareSettings = {
	socketUrl: "wss://ws-fileshare.asss.ist",
	friends: [],
	receiveFolder: "/",
	privateKey: "",
	publicKey: "",
	autoAcceptFiles: false,
};

class FileSharePlugin extends Plugin {
	ws: WebSocket;
	settings: P2PFileShareSettings;
	connectionStatus: HTMLElement;

	async onload() {
		await this.loadSettings();

		// Generate RSA key pair if it doesn't exist
		if (!this.settings.privateKey || !this.settings.publicKey) {
			const { privateKey, publicKey } = crypto.generateKeyPairSync(
				"rsa",
				{
					modulusLength: 2048,
				}
			);
			this.settings.privateKey = privateKey
				.export({ type: "pkcs1", format: "pem" })
				.toString();
			this.settings.publicKey = Buffer.from(
				publicKey.export({ type: "pkcs1", format: "pem" }).toString()
			).toString("base64");
			await this.saveSettings();
		}

		this.connectionStatus = this.addStatusBarItem();
		this.setConnectionStatus("disconnected");

		this.initializeWebSocket();

		this.addRibbonIcon("refresh-cw", "Toggle connection", () => {
			if (this.ws.readyState === WebSocket.OPEN) {
				this.ws.close();
				new Notice("Closing connection...");
			} else if (this.ws.readyState !== WebSocket.OPEN) {
				this.initializeWebSocket();
				new Notice("Trying to connect...");
			}
		});

		// Add the context menu option
		this.registerEvent(
			this.app.workspace.on("file-menu", this.onFileMenu.bind(this))
		);

		this.addSettingTab(new FileShareSettingTab(this.app, this));
	}

	setConnectionStatus(connectionStatus: string) {
		this.connectionStatus.innerHTML = `FileShare: ${connectionStatus}`;
	}

	initializeWebSocket() {
		this.ws = new WebSocket(this.settings.socketUrl);

		this.ws.onopen = () => {
			console.log("WebSocket connection opened");
			this.setConnectionStatus("connected");
			this.ws.send(
				JSON.stringify({
					type: "login",
					name: this.settings.publicKey || "",
				})
			);
		};

		this.ws.onmessage = (message) => {
			const data = JSON.parse(message.data);
			switch (data.type) {
				case "file":
					if (this.settings.autoAcceptFiles) {
						this.receiveFile(data);
					} else {
						new AcceptFileModal(this.app, data.filename, () =>
							this.receiveFile(data)
						).open();
					}
					break;
			}
		};

		this.ws.onclose = () => {
			console.log("WebSocket connection closed");
			this.setConnectionStatus("disconnected");
			new Notice("FileShare connection closed.");
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			new Notice("WebSocket error occurred. Check console for details.");
		};
	}

	onunload() {
		this.ws.close();
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

	async receiveFile(data: {
		type: string;
		filename: string;
		file: string;
		aesKey: string;
		iv: string;
		name: string;
	}) {
		const receiveFolder = this.settings.receiveFolder;
		const filePath = `${receiveFolder}/${data.filename}`;

		const encryptedFile = Buffer.from(data.file, "base64");
		const encryptedAesKey = Buffer.from(data.aesKey, "base64");
		const iv = Buffer.from(data.iv, "base64");

		// Decrypt the AES key using the receiver's private key (RSA)
		const aesKey = crypto.privateDecrypt(
			crypto.createPrivateKey(this.settings.privateKey),
			encryptedAesKey
		);

		// Decrypt the file using AES-256
		const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
		const decryptedFile = Buffer.concat([
			decipher.update(encryptedFile),
			decipher.final(),
		]);

		try {
			await this.app.vault.createBinary(filePath, decryptedFile);
			new Notice(`File received and saved to ${filePath}`);
		} catch (error) {
			console.error("Error saving received file:", error);
			new Notice("Failed to save the received file.");
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

		// Display the user's public key
		new Setting(containerEl)
			.setName("Your Key")
			.setDesc("This is your key. Share it with your friends.")
			.addText((text) => {
				text.setValue(this.plugin.settings.publicKey).setDisabled(true);
			})
			.addExtraButton((button) =>
				button
					.setIcon("copy")
					.setTooltip("Copy to clipboard")
					.onClick(() => {
						navigator.clipboard.writeText(
							this.plugin.settings.publicKey
						);
						new Notice("Key copied to clipboard");
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
			.setName("Auto-accept incoming files")
			.setDesc(
				"Enable to automatically accept incoming files. Attention: There is a potential security risk to do that."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoAcceptFiles)
					.onChange(async (value) => {
						this.plugin.settings.autoAcceptFiles = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Socket URL")
			.setDesc("Socket URL to exchange files end-to-end encrypted")
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
				.setName(`Username: ${friend.username}`)
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
	fileShareSettingTab: FileShareSettingTab;
	publicKeyInput: HTMLInputElement;

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
		contentEl.classList.add("setting-tab-modal"); // Add a class for styling

		contentEl.createEl("h2", {
			text: this.index === null ? "Add Friend" : "Edit Friend",
		});

		const form = contentEl.createEl("div", { cls: "form-group" });

		const usernameDiv = form.createEl("div", { cls: "setting-item" });
		usernameDiv.createEl("label", { text: "Username" });
		this.usernameInput = usernameDiv.createEl("input", {
			type: "text",
			cls: "input",
		});

		const publicKeyDiv = form.createEl("div", { cls: "setting-item" });
		publicKeyDiv.createEl("label", { text: "Key" });
		this.publicKeyInput = publicKeyDiv.createEl("input", {
			type: "text",
			cls: "input",
		});

		if (this.index !== null) {
			const friend = this.plugin.settings.friends[this.index];
			this.usernameInput.value = friend.username;
			this.publicKeyInput.value = friend.publicKey;
		}

		const saveButton = contentEl.createEl("button", {
			text: "Save",
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => this.saveFriend());
	}

	saveFriend() {
		const username = this.usernameInput.value;
		const publicKey = this.publicKeyInput.value;

		if (this.index === null) {
			this.plugin.settings.friends.push({ username, publicKey });
		} else {
			this.plugin.settings.friends[this.index] = { username, publicKey };
		}

		this.plugin.saveSettings();
		this.close();
		this.fileShareSettingTab.display();
	}
}

export default FileSharePlugin;
