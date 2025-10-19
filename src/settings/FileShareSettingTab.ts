import { IFileShareSettings } from "interfaces/IFileShareSettings";
import FileSharePlugin from "main";
import { App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import { FriendModal } from "modals/FriendModal";

export const DEFAULT_SETTINGS: IFileShareSettings = {
	useCustomSocketUrl: false,
	socketUrl: "wss://ws-fileshare.asss.ist",
	friends: [],
	receiveFolder: "/",
	privateKey: "",
	publicKey: "",
	autoAcceptFiles: false,
	scanSendingFiles: false,
	chunkSize: 262144, // 256KB in bytes
	maxFileSize: 524288000, // 500MB in bytes
	lastSeenVersion: "0.0.0",
	preserveFolderStructure: true,
};

export class FileShareSettingTab extends PluginSettingTab {
	plugin: FileSharePlugin;

	constructor(app: App, plugin: FileSharePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Your key")
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
			)
			.addExtraButton((button) =>
				button
					.setIcon("reset")
					.setTooltip("Generate new key pair")
					.onClick(async () => {
						const confirmation = confirm(
							"Are you sure you want to generate a new key pair? Your current key will be lost."
						);
						if (confirmation) {
							const { privateKey, publicKey } =
								await this.plugin.secure.generateKeyPair();
							this.plugin.settings.privateKey = privateKey;
							this.plugin.settings.publicKey = publicKey;
							await this.plugin.saveSettings();
							this.display();
						}
					})
			);

		new Setting(containerEl)
			.setName("Receive folder")
			.setDesc("Select the folder where received files will be saved.")
			.addDropdown((drop) => {
				const folders = this.plugin.app.vault
					.getAllLoadedFiles()
					.filter((file) => file instanceof TFolder);
				folders.forEach((folder) => {
					// Truncate long folder names for display
					const displayName = folder.path.length > 40
						? folder.path.substring(0, 37) + "..."
						: folder.path;
					drop.addOption(folder.path, displayName);
				});
				drop.setValue(this.plugin.settings.receiveFolder);
				drop.onChange(async (value) => {
					this.plugin.settings.receiveFolder = value;
					await this.plugin.saveSettings();
				});
				// Add CSS class for fixed width
				drop.selectEl.addClass("file-share-receive-folder-dropdown");
			});

		new Setting(containerEl)
			.setName("Scan files for first-level embedded links")
			.setDesc(
				"Enhance the ability to automatically scan your outgoing file for first-level embedded links to other documents or images, ensuring they are transmitted alongside the corresponding attachments."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.scanSendingFiles)
					.onChange(async (value) => {
						this.plugin.settings.scanSendingFiles = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Preserve folder structure")
			.setDesc(
				"When receiving files that were sent from a folder, recreate the folder structure in your receive folder. If disabled, all files will be saved directly to the receive folder."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.preserveFolderStructure)
					.onChange(async (value) => {
						this.plugin.settings.preserveFolderStructure = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Need any help?")
			.setDesc(
				"Feel free to explore the documentation for comprehensive guidance and support."
			)
			.addButton((button) =>
				button
					.setButtonText("Open documentation")
					.setCta()
					.onClick(() =>
						window.open(
							"https://muckmuck96.github.io/obsidian-file-share/",
							"_blank"
						)
					)
			);

		new Setting(containerEl)
			.setName("Add Friend")
			.addButton((button) =>
				button.setButtonText("Add").onClick(() => this.addFriend())
			);

		this.plugin.settings.friends.forEach((friend, index) => {
			const hotkeyId = this.plugin.generateHotkeyId(friend.username);
			const friendDescription = friend.enableHotkey
				? `Hotkey enabled (Command ID: ${hotkeyId})`
				: 'No hotkey';

			const setting = new Setting(containerEl)
				.setName(`Username: ${friend.username}`)
				.setDesc(friendDescription)
				.addToggle((toggle) =>
					toggle
						.setTooltip("Enable hotkey")
						.setValue(friend.enableHotkey || false)
						.onChange(async (value) => {
							friend.enableHotkey = value;
							await this.plugin.saveSettings();
							this.plugin.registerFriendCommands();
							this.display();
						})
				)
				.addButton((button) =>
					button
						.setButtonText("Edit")
						.onClick(() => this.editFriend(index))
				)
				.addButton((button) =>
					button.setButtonText("Delete").onClick(() => {
						this.plugin.settings.friends.splice(index, 1);
						this.plugin.saveSettings();
						this.plugin.registerFriendCommands(); // Re-register commands after deleting
						this.display();
					})
				);

			// Add link to hotkey settings if hotkey is enabled
			if (friend.enableHotkey) {
				setting.addExtraButton((button) =>
					button
						.setIcon("settings")
						.setTooltip("Open hotkey settings")
						.onClick(() => {
							// Open Obsidian's hotkey settings and filter by this command
							// @ts-ignore - accessing internal API
							this.app.setting.open();
							// @ts-ignore - accessing internal API
							this.app.setting.openTabById('hotkeys');
						})
				);
			}
		});

		containerEl.createEl("hr");

		// Advanced Settings Section (Collapsible)
		const advancedSettingsHeader = new Setting(containerEl)
			.setName("Advanced Settings")
			.setDesc(
				"⚠️ Only change these settings if you know what you are doing."
			)
			.setHeading();

		const advancedSettingsContent = containerEl.createDiv();
		advancedSettingsContent.style.display = "none";

		advancedSettingsHeader.addToggle((toggle) =>
			toggle
				.setValue(false)
				.setTooltip("Show/hide advanced settings")
				.onChange((value) => {
					advancedSettingsContent.style.display = value
						? "block"
						: "none";
				})
		);

		new Setting(advancedSettingsContent)
			.setName("Chunk size (KB)")
			.setDesc(
				"Size of each chunk when sending files. Smaller chunks are more reliable for unstable connections, larger chunks are faster. Range: 64KB - 1024KB (1MB)."
			)
			.addSlider((slider) => {
				slider
					.setLimits(64, 1024, 64)
					.setValue(this.plugin.settings.chunkSize / 1024)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.chunkSize = value * 1024;
						await this.plugin.saveSettings();
					});
			});

			new Setting(advancedSettingsContent)
			.setName("Auto-accept incoming files")
			.setDesc(
				"Enable to automatically accept incoming files. Attention: There is a potential security risk to do that."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoAcceptFiles)
					.onChange(async (value) => {
						let confirmation = true;
						if (!this.plugin.settings.autoAcceptFiles && value) {
							confirmation = confirm(
								"Are you sure you want to activate this option?."
							);
						}
						if (confirmation) {
							this.plugin.settings.autoAcceptFiles = value;
							await this.plugin.saveSettings();
						}
						this.display();
					});
			});

		new Setting(advancedSettingsContent)
			.setName("Socket URL")
			.setDesc(
				"Socket URL to exchange files end-to-end encrypted. Only SSL supported."
			)
			.addToggle((toggle) =>
				toggle
					.setTooltip("Use custom")
					.setValue(this.plugin.settings.useCustomSocketUrl)
					.onChange(async (value) => {
						if (!value) {
							this.plugin.settings.socketUrl =
								this.plugin.getDefaultSettings().socketUrl;
						}
						this.plugin.settings.useCustomSocketUrl = value;
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addText((text) => {
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.socketUrl)
					.setDisabled(!this.plugin.settings.useCustomSocketUrl)
					.onChange(async (value) => {
						this.plugin.settings.socketUrl = value;
						await this.plugin.saveSettings();
					});

				// Add blur event to validate when user loses focus
				text.inputEl.addEventListener("blur", async () => {
					// Validate socket URL security when focus is lost
					if (this.plugin.settings.useCustomSocketUrl && !this.plugin.secure.isSocketURLSecure()) {
						new Notice(
							"Socket URL could not be validated for SSL. Reverting to default socket server..."
						);
						this.plugin.settings.socketUrl =
							this.plugin.getDefaultSettings().socketUrl;
						this.plugin.settings.useCustomSocketUrl = false;
						await this.plugin.saveSettings();
						this.display();
					}
				});
			});
	}

	addFriend(): void {
		const modal = new FriendModal(this.app, this.plugin, null, this);
		modal.open();
	}

	editFriend(index: number): void {
		const modal = new FriendModal(this.app, this.plugin, index, this);
		modal.open();
	}
}
