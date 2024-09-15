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

	renderSuggestion(friend: IFriend, el: HTMLElement): void {
		el.createEl("div", { text: friend.username });
	}

	onChooseSuggestion(friend: IFriend, evt: MouseEvent | KeyboardEvent): void {
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
					if(this.file != null) {
						this.plugin.fileRequestQueue.addRequest(this.file, friend);
						if(this.plugin.settings.scanSendingFiles) {
							this.plugin.fileTransmitter.scanFileAndSend(this.file, friend);
						}
					}
				} else {
					new Notice(`${friend.username} is offline at the moment`);
				}
			} else if (data.type === "response") {
				this.plugin.fileRequestQueue.handleResponse(data.id, data.accepted, data.hash);
			}
		};
	}
}

export { FileShareModal };
