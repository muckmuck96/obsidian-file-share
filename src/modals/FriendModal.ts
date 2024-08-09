import FileSharePlugin from "main";
import { App, Modal, Notice } from "obsidian";
import { FileShareSettingTab } from "settings/FileShareSettingTab";

export class FriendModal extends Modal {
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

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.classList.add("setting-tab-modal");

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

	saveFriend(): void {
		const username = this.usernameInput.value;
		const publicKey = this.publicKeyInput.value;

		if (username === "" || publicKey === "") {
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
}
