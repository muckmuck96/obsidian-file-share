import FileSharePlugin from "main";
import { Notice } from "obsidian";

export class Socket {
	private ws: WebSocket;
	private plugin: FileSharePlugin;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
		this.setConnectionStatus("disconnected");
	}

	close(): void {
		this.ws.close();
	}

	send(type: string, data: unknown): void {
		const payload = Object.assign({ type }, data);
		this.ws.send(JSON.stringify(payload));
	}

	getWS(): WebSocket {
		return this.ws;
	}

	setConnectionStatus(connectionStatus: string): void {
		this.plugin.connectionStatus.innerText = `FileShare: ${connectionStatus}`;
	}

	verifySocketURL(): void {
		if (!this.plugin.secure.isSocketURLSecure()) {
			new Notice(
				"Socket URL could not be validated for SSL. Using default socket server..."
			);
			this.plugin.settings.socketUrl =
				this.plugin.getDefaultSettings().socketUrl;
		}
	}

	toggleConnection(): void {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.close();
			new Notice("Closing connection...");
		} else if (this.ws.readyState !== WebSocket.OPEN) {
			this.init();
			new Notice("Trying to connect...");
		}
	}

	init(): void {
		this.verifySocketURL();
		this.ws = new WebSocket(this.plugin.settings.socketUrl);

		this.ws.onopen = () => {
			new Notice("FileShare connection opened.");
			this.setConnectionStatus("connected");
			this.send("login", { name: this.plugin.settings.publicKey || "" });
		};

		this.ws.onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (
				data.sender &&
				this.plugin.settings.friends.some(
					(friend) => friend.publicKey === data.sender
				)
			) {
				const sender = this.plugin.settings.friends.find(
					(friend) => friend.publicKey == data.sender
				);
				if (data.type == "file") {
					const expectedHash = this.plugin.secure.generateHash(data);
					if (data.hash === expectedHash) {
						this.plugin.fileTransmitter.receiveFile(data);
					}
				} else if (data.type == "request") {
					const accept =
						this.plugin.settings.autoAcceptFiles ||
						confirm(
							`${sender?.username} want to sent you: ${data.filename}. Accept it?`
						);
					const hash = accept
						? this.plugin.secure.generateHash(data)
						: "";
					this.send("response", {
						target: data.sender,
						accepted: accept,
						filename: data.filename,
						hash: hash,
						id: data.id,
					});
				}
			}
		};

		this.ws.onclose = () => {
			this.setConnectionStatus("disconnected");
			new Notice("FileShare connection closed.");
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			new Notice("WebSocket error occurred. Check console for details.");
		};
	}
}
