import { Menu, Notice, Plugin, TAbstractFile, TFile, TFolder } from "obsidian";
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
import { FileValidator } from "utils/FileValidator";
import { FileTreeDecorator } from "ui/FileTreeDecorator";
import { ReleaseNotesManager } from "utils/ReleaseNotesManager";
import { ReleaseNotesModal } from "modals/ReleaseNotesModal";

class FileSharePlugin extends Plugin {
	socket: Socket;
	settings: IFileShareSettings;
	connectionStatus: HTMLElement;
	secure: Secure;
	fileTransmitter: FileTransmitter;
	fileRequestQueue: FileRequestQueue;
	fileValidator: FileValidator;
	fileTreeDecorator: FileTreeDecorator;
	private friendCommandIds: string[] = []; // Track registered friend command IDs

	async onload(): Promise<void> {
		await this.loadSettings();

		this.secure = new Secure(this);
		this.fileValidator = new FileValidator(this);

		this.app.workspace.onLayoutReady(async () => {
			if (!this.settings.privateKey || !this.settings.publicKey) {
				const { privateKey, publicKey } =
					await this.secure.generateKeyPair();
				this.settings.privateKey = privateKey;
				this.settings.publicKey = publicKey;
				await this.saveSettings();
			}

			// Check for version updates
			this.checkForUpdates();
		});

		this.connectionStatus = this.addStatusBarItem();

		this.socket = new Socket(this);
		this.socket.init();

		this.fileTransmitter = new FileTransmitter(this);

		this.fileRequestQueue = new FileRequestQueue(this.fileTransmitter.sendFile.bind(this.fileTransmitter), this);

		// Initialize file tree decorator after workspace is ready
		this.app.workspace.onLayoutReady(() => {
			this.fileTreeDecorator = new FileTreeDecorator(this);
		});

		this.addRibbonIcon("refresh-cw", "Toggle connection", () => {
			this.socket.toggleConnection();
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", this.onFileMenu.bind(this))
		);

		// Add command for "Send to..." (opens friend selection modal)
		this.addCommand({
			id: "send-file-to",
			name: "Send current file to...",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						new FileShareModal(
							this,
							this.socket,
							this.settings.friends,
							activeFile
						).open();
					}
					return true;
				}
				return false;
			},
		});

		// Register commands for each friend with a hotkey
		this.registerFriendCommands();

		this.addSettingTab(new FileShareSettingTab(this.app, this));
	}

	onunload(): void {
		this.socket.close();
		if (this.fileTreeDecorator) {
			this.fileTreeDecorator.cleanup();
		}
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
		} else if (file instanceof TFolder) {
			menu.addItem((item) => {
				item.setTitle("Send folder to ...")
					.setIcon("paper-plane")
					.onClick(() => {
						new FileShareModal(
							this,
							this.socket,
							this.settings.friends,
							null,
							file
						).open();
					});
			});
		}
	}

	registerFriendCommands(): void {
		this.friendCommandIds = [];

		// Register a command for each friend that has hotkey enabled
		this.settings.friends.forEach((friend, index) => {
			if (friend.enableHotkey) {
				// Generate unique command ID based on username
				const commandId = this.generateHotkeyId(friend.username);
				this.friendCommandIds.push(commandId);

				this.addCommand({
					id: commandId,
					name: `Send current file to ${friend.username}`,
					checkCallback: (checking: boolean) => {
						const activeFile = this.app.workspace.getActiveFile();
						if (activeFile) {
							if (!checking) {
								this.sendFileToFriend(activeFile, friend);
							}
							return true;
						}
						return false;
					},
				});
			}
		});
	}

	generateHotkeyId(username: string): string {
		// Convert username to a safe command ID
		// Remove special characters and convert to lowercase kebab-case
		return `send-to-${username
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")}`;
	}

	async sendFileToFriend(file: TFile, friend: any): Promise<void> {
		// Check if socket is connected first
		if (this.socket.getWS().readyState !== WebSocket.OPEN) {
			new Notice("You are not connected to the FileShare server. Please connect first.");
			return;
		}

		// Validate the file first
		const validation = await this.fileValidator.validateFile(file);
		if (!validation.valid) {
			this.fileValidator.showValidationError(validation.error!);
			return;
		}

		// Check if friend is online
		this.socket.send("checkOnline", { target: friend.publicKey });

		// Use onmessage handler (matching FileShareModal behavior)
		this.socket.getWS().onmessage = (message: MessageEvent) => {
			const data = JSON.parse(message.data);
			if (
				data.type === "checkOnline" &&
				data.target === friend.publicKey
			) {
				if (data.online) {
					this.fileRequestQueue.addRequest(file, friend);
					if (this.settings.scanSendingFiles) {
						this.fileTransmitter.scanFileAndSend(file, friend);
					}
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			} else if (data.type === "response") {
				this.fileRequestQueue.handleResponse(data.id, data.accepted, data.hash);
			}
		};
	}

	async checkForUpdates(): Promise<void> {
		try {
			const currentVersion = this.manifest.version;

			if (this.settings.lastSeenVersion !== currentVersion) {
				const release = await ReleaseNotesManager.fetchLatestRelease();

				if (release) {
					new ReleaseNotesModal(
						this.app,
						currentVersion,
						release.name,
						release.body
					).open();
				}

				this.settings.lastSeenVersion = currentVersion;
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
			// Silently fail - don't bother the user with update check errors
		}
	}
}

export default FileSharePlugin;
