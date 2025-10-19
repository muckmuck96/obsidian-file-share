import FileSharePlugin from "main";
import { App, Modal, Notice, Setting } from "obsidian";
import { FileShareSettingTab } from "settings/FileShareSettingTab";

export class FriendModal extends Modal {
	plugin: FileSharePlugin;
	index: number | null;
	fileShareSettingTab: FileShareSettingTab;
	username: string;
	publicKey: string;
	enableHotkey: boolean;

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

		this.loadModalForm();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: this.index === null ? "Add Friend" : "Edit Friend",
		});

		new Setting(contentEl).setName("Username").addText((text) => {
			text.setValue(this.username);
			text.onChange((value) => {
				this.username = value;
			});
		});

		new Setting(contentEl).setName("Key").addText((text) => {
			text.setValue(this.publicKey);
			text.onChange((value) => {
				this.publicKey = value;
			});
		});

		new Setting(contentEl)
			.setName("Enable hotkey")
			.setDesc(
				"Enable a direct send command for this friend. After enabling, you can assign a hotkey in Obsidian's hotkey settings."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.enableHotkey);
				toggle.onChange((value) => {
					this.enableHotkey = value;
				});
			});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Save")
				.setCta()
				.onClick(() => {
					this.saveFriend();
				})
		);
	}

	saveFriend(): void {
		const username = this.username;
		const publicKey = this.publicKey;
		const enableHotkey = this.enableHotkey;

		if (username.length == 0 || publicKey.length == 0) {
			new Notice("Please fill out all fields.");
			return;
		} else if (
			this.plugin.settings.friends
				.filter((_, idx) => this.index == null || this.index != idx)
				.some((friend) => friend.username === username)
		) {
			new Notice("A friend with this username is already set.");
			return;
		}

		const friendData = {
			username,
			publicKey,
			...(enableHotkey ? { enableHotkey: true } : {})
		};

		if (this.index === null) {
			this.plugin.settings.friends.push(friendData);
		} else {
			this.plugin.settings.friends[this.index] = friendData;
		}

		this.plugin.saveSettings();
		this.plugin.registerFriendCommands(); // Re-register commands with new hotkeys
		this.close();
		this.fileShareSettingTab.display();
	}

	loadModalForm(): void {
		this.username = "";
		this.publicKey = "";
		this.enableHotkey = false;
		if (this.index !== null) {
			const friend = this.plugin.settings.friends[this.index];
			this.username = friend.username;
			this.publicKey = friend.publicKey;
			this.enableHotkey = friend.enableHotkey || false;
		}
	}
}
