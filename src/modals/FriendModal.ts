import FileSharePlugin from "main";
import { App, Modal, Notice, Setting } from "obsidian";
import { FileShareSettingTab } from "settings/FileShareSettingTab";

export class FriendModal extends Modal {
	plugin: FileSharePlugin;
	index: number | null;
	fileShareSettingTab: FileShareSettingTab;
	username: string;
	publicKey: string;

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

		if (this.index === null) {
			this.plugin.settings.friends.push({ username, publicKey });
		} else {
			this.plugin.settings.friends[this.index] = { username, publicKey };
		}

		this.plugin.saveSettings();
		this.close();
		this.fileShareSettingTab.display();
	}

	loadModalForm(): void {
		this.username = "";
		this.publicKey = "";
		if (this.index !== null) {
			const friend = this.plugin.settings.friends[this.index];
			this.username = friend.username;
			this.publicKey = friend.publicKey;
		}
	}
}
