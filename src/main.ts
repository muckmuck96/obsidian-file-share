import { Menu, Plugin, TAbstractFile, TFile } from "obsidian";
import { FileShareModal } from "modals/FileShareModal";
import {
	DEFAULT_SETTINGS,
	FileShareSettingTab,
} from "settings/FileShareSettingTab";
import { IFileShareSettings } from "interfaces/IFileShareSettings";
import { Secure } from "security/Secure";
import { Socket } from "core/Socket";
import { FileTransmitter } from "core/FileTransmitter";
import { FileRequestQueue } from "core/FileRequestQueue";

class FileSharePlugin extends Plugin {
	socket: Socket;
	settings: IFileShareSettings;
	connectionStatus: HTMLElement;
	secure: Secure;
	fileTransmitter: FileTransmitter;
	fileRequestQueue: FileRequestQueue;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.secure = new Secure(this);

		this.app.workspace.onLayoutReady(async () => {
			if (!this.settings.privateKey || !this.settings.publicKey) {
				const { privateKey, publicKey } =
					await this.secure.generateKeyPair();
				this.settings.privateKey = privateKey;
				this.settings.publicKey = publicKey;
				await this.saveSettings();
			}
		});

		this.connectionStatus = this.addStatusBarItem();

		this.socket = new Socket(this);
		this.socket.init();

		this.fileTransmitter = new FileTransmitter(this);

		this.fileRequestQueue = new FileRequestQueue(this.fileTransmitter.sendFile, this);

		this.addRibbonIcon("refresh-cw", "Toggle connection", () => {
			this.socket.toggleConnection();
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", this.onFileMenu.bind(this))
		);

		this.addSettingTab(new FileShareSettingTab(this.app, this));
	}

	onunload(): void {
		this.socket.close();
	}

	getDefaultSettings(): IFileShareSettings {
		return DEFAULT_SETTINGS;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onFileMenu(menu: Menu, file: TAbstractFile): void {
		if (file instanceof TFile) {
			menu.addItem((item) => {
				item.setTitle("Send to ...")
					.setIcon("paper-plane")
					.onClick(() => {
						new FileShareModal(
							this,
							this.socket,
							this.settings.friends,
							file
						).open();
					});
			});
		}
	}
}

export default FileSharePlugin;
