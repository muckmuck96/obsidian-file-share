import { Modal, Notice, TFile } from "obsidian";
import FileSharePlugin from "main";
import { IFriend } from "interfaces/IFriend";
import { Socket } from "core/Socket";

class FileShareModal extends Modal {
	private plugin: FileSharePlugin;
	private socket: Socket;
	private file: TFile | null;
	private friends: IFriend[];
	private inputEl: HTMLInputElement;
	private listEl: HTMLElement;

	constructor(
		plugin: FileSharePlugin,
		socket: Socket,
		friends: IFriend[],
		file: TFile | null = null
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.socket = socket;
		this.file = file;
		this.friends = friends;
	}

	onOpen(): void {
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

	updateList(): void {
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

	checkOnlineAndSendFile(friend: IFriend): void {
		this.socket.send("checkOnline", { target: friend.publicKey });

		this.socket.getWS().onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (
				data.type === "checkOnline" &&
				data.target === friend.publicKey
			) {
				if (data.online) {
					const requestData = JSON.stringify({
						type: "request",
						target: friend.publicKey,
						filename: this.file?.name,
					});
					const dataSign = this.plugin.secure.signData(requestData);
					this.socket.send("request", {
						target: friend.publicKey,
						filename: this.file?.name,
						signature: dataSign,
					});
					new Notice(
						`Request sent to ${friend.username} for file ${this.file?.name}`
					);
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			} else if (data.type === "response") {
				if (data.accepted) {
					new Notice(`File request accepted by ${friend.username}`);
					this.plugin.fileTransmitter.sendFile(
						this.file,
						friend,
						data.hash
					);
				} else {
					new Notice(`File request declined by ${friend.username}`);
				}
			}
		};
	}
}

export { FileShareModal };
