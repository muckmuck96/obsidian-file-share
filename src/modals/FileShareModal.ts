import { Notice, SuggestModal, TFile } from "obsidian";
import FileSharePlugin from "main";
import { IFriend } from "interfaces/IFriend";
import { Socket } from "core/Socket";

class FileShareModal extends SuggestModal<IFriend> {
	private plugin: FileSharePlugin;
	private socket: Socket;
	private file: TFile | null;
	private friends: IFriend[];

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

	getSuggestions(query: string): IFriend[] {
		return this.friends.filter((friend) =>
			friend.username.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(friend: IFriend, el: HTMLElement) {
		el.createEl("div", { text: friend.username });
	}

	onChooseSuggestion(friend: IFriend, evt: MouseEvent | KeyboardEvent) {
		this.checkOnlineAndSendFile(friend);
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
