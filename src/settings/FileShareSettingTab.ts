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

		new Setting(containerEl)
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
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.socketUrl)
					.setDisabled(!this.plugin.settings.useCustomSocketUrl)
					.onChange(async (value) => {
						this.plugin.settings.socketUrl = value;
						await this.plugin.saveSettings();
					})
			);

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
			new Setting(containerEl)
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

	addFriend(): void {
		const modal = new FriendModal(this.app, this.plugin, null, this);
		modal.open();
	}

	editFriend(index: number): void {
		const modal = new FriendModal(this.app, this.plugin, index, this);
		modal.open();
	}
}
