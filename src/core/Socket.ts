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
		if (this.ws.readyState !== WebSocket.OPEN) {
			new Notice("Cannot send message: Not connected to FileShare server.");
			console.error("WebSocket is not open. ReadyState:", this.ws.readyState);
			return;
		}
		const payload = Object.assign({ type }, data);
		this.ws.send(JSON.stringify(payload));
	}

	getWS(): WebSocket {
		return this.ws;
	}

	setConnectionStatus(connectionStatus: string): void {
		this.plugin.connectionStatus.innerText = `FileShare: ${connectionStatus}`;
	}

	async verifySocketURL(): Promise<void> {
		if (!this.plugin.secure.isSocketURLSecure()) {
			new Notice(
				"Socket URL could not be validated for SSL. Using default socket server..."
			);
			this.plugin.settings.socketUrl =
				this.plugin.getDefaultSettings().socketUrl;
			this.plugin.settings.useCustomSocketUrl = false;
			await this.plugin.saveSettings();
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

	async init(): Promise<void> {
		await this.verifySocketURL();
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
				} else if (data.type == "fileMetadata") {
					this.plugin.fileTransmitter.receiveFileMetadata(data.payload);
				} else if (data.type == "fileChunk") {
					this.plugin.fileTransmitter.receiveFileChunk(data.payload);
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
