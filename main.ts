import { Plugin, Modal, Setting, Notice, TAbstractFile, TFile, Menu, PluginSettingTab, App } from 'obsidian';
import Peer from 'simple-peer';

interface P2PFileShareSettings {
	turnServer: string;
	turnUsername: string;
	turnCredential: string;
}

const DEFAULT_SETTINGS: P2PFileShareSettings = {
	turnServer: 'turn:your.turn.server:3478',
	turnUsername: '',
	turnCredential: ''
};

export default class P2PFileSharePlugin extends Plugin {
	settings: P2PFileShareSettings;

	private peer: Peer.Instance;
	private connectionState: string = 'disconnected';
	private _peerSignal: string = '';

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('refresh-cw', 'P2P File Share', () => {
			this.openConnectionSettings();
		});
		this.addStatusBarItem().setText(`P2P: ${this.connectionState}`);
		this.registerEvent(this.app.vault.on('create', this.onFileCreate.bind(this)));

		// Add the context menu option
		this.registerEvent(this.app.workspace.on('file-menu', this.onFileMenu.bind(this)));

		this.addSettingTab(new P2PFileShareSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	openConnectionSettings() {
		new P2PSettingsModal(this).open();
	}

	initP2PConnection(peerSignal: string, isInitiator: boolean) {
		console.log('Initializing P2P Connection', { peerSignal, isInitiator });
		const iceServers: [any] = [{ urls: 'stun:stun.l.google.com:19302' }];
		if (this.settings.turnCredential && this.settings.turnUsername && this.settings.turnServer) {
			iceServers.push({
				urls: this.settings.turnServer,
				username: this.settings.turnUsername,
				credential: this.settings.turnCredential
			});
		}
		this.peer = new Peer({
			initiator: isInitiator,
			trickle: false,
			config: {
				iceServers
			}
		});

		this.peer.on('signal', data => {
			const encodedSignal = this.encodeBase64(JSON.stringify(data));
			console.log('Signal Data', { data });
			if (isInitiator) {
				new Notice('Generated signal data. Send this to your peer.');
				new P2PReceiverModal(this, encodedSignal, false).open();
			}
		});

		this.peer.on('connect', () => {
			this.connectionState = 'connected';
			this.updateStatusBar();
			new Notice('P2P Connection established');
			console.log('P2P Connection established');
		});

		this.peer.on('data', data => {
			try {
				const fileData = JSON.parse(data.toString());
				const { name, content } = fileData;
				this.app.vault.create(name, content);
				console.log('Received file', { name });
			} catch (error) {
				console.error('Error parsing received data', error);
			}
		});

		this.peer.on('error', error => {
			console.error('Peer connection error', error);
		});

		this.peer.on('close', () => {
			this.connectionState = 'disconnected';
			this.updateStatusBar();
			new Notice('P2P Connection closed');
			console.log('P2P Connection closed');
		});

		this.peer.on('iceStateChange', (state) => {
			console.log('ICE state change', { state });
		});

		this.peer.on('iceCandidate', candidate => {
			console.log('ICE candidate', candidate);
		});

		if (!isInitiator && peerSignal) {
			try {
				const decodedSignal = JSON.parse(this.decodeBase64(peerSignal));
				this.peer.signal(decodedSignal);
				console.log('Signal data entered by receiver', { peerSignal });
			} catch (error) {
				console.error('Error parsing peer signal data', error);
			}
		}
	}

	onFileCreate(file: TAbstractFile) {
		// Do nothing for automatic file creation, we will handle file sending through context menu
	}

	onFileMenu(menu: Menu, file: TAbstractFile) {
		if (file instanceof TFile) {
			menu.addItem(item => {
				item.setTitle("Send via P2P")
					.setIcon("paper-plane")
					.onClick(() => {
						this.sendFile(file);
					});
			});
		}
	}

	sendFile(file: TFile) {
		file.vault.read(file).then(content => {
			const fileData = {
				name: file.path,
				content: content,
			};
			this.peer.send(JSON.stringify(fileData));
			new Notice(`File ${file.path} sent!`);
			console.log('File sent', { filePath: file.path });
		}).catch(error => {
			console.error('Error reading file content', error);
		});
	}

	updateStatusBar() {
		this.addStatusBarItem().setText(`P2P: ${this.connectionState}`);
	}

	get peerSignal(): string {
		return this._peerSignal;
	}

	set peerSignal(value: string) {
		this._peerSignal = value;
	}

	encodeBase64(data: string): string {
		return btoa(data);
	}

	decodeBase64(data: string): string {
		return atob(data);
	}
}

class P2PSettingsModal extends Modal {
	private plugin: P2PFileSharePlugin;

	constructor(plugin: P2PFileSharePlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.createEl('h2', { text: 'P2P Connection Settings' });

		new Setting(contentEl)
			.setName('Initiator')
			.addToggle(toggle => toggle.setValue(false).onChange(value => {
				this.plugin.initP2PConnection(this.plugin.peerSignal, value);
				this.close();
			}));

		new Setting(contentEl)
			.setName('Receiver')
			.addToggle(toggle => toggle.setValue(false).onChange(value => {
				this.close();
				new P2PReceiverModal(this.plugin, '', value).open();
			}));
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

class P2PReceiverModal extends Modal {
	private plugin: P2PFileSharePlugin;
	private signalData: string;
	private isReceiver: boolean;

	constructor(plugin: P2PFileSharePlugin, signalData: string, isReceiver: boolean) {
		super(plugin.app);
		this.plugin = plugin;
		this.signalData = signalData;
		this.isReceiver = isReceiver;
	}

	onOpen() {
		let { contentEl } = this;
		if (!this.isReceiver) {
			contentEl.createEl('h2', { text: 'Send this Signal Data to your Peer' });
			contentEl.createEl('textarea', { text: this.signalData });
		} else {
			contentEl.createEl('h2', { text: 'Enter Signal Data from Initiator' });

			new Setting(contentEl)
				.setName('Enter Peer Signal')
				.addText(text => text.onChange(value => {
					this.plugin.peerSignal = value;
				}));

			new Setting(contentEl)
				.addButton(button => {
					button.setButtonText('Connect')
						.setCta()
						.onClick(() => {
							this.plugin.initP2PConnection(this.plugin.peerSignal, false);
							this.close();
						});
				});
		}
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

class P2PFileShareSettingTab extends PluginSettingTab {
	plugin: P2PFileSharePlugin;

	constructor(app: App, plugin: P2PFileSharePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'P2P File Share Settings' });

		new Setting(containerEl)
			.setName('TURN Server URL')
			.setDesc('URL of the TURN server')
			.addText(text => text
				.setPlaceholder('turn:your.turn.server:3478')
				.setValue(this.plugin.settings.turnServer)
				.onChange(async (value) => {
					this.plugin.settings.turnServer = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('TURN Server Username')
			.setDesc('Username for the TURN server')
			.addText(text => text
				.setPlaceholder('username')
				.setValue(this.plugin.settings.turnUsername)
				.onChange(async (value) => {
					this.plugin.settings.turnUsername = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('TURN Server Credential')
			.setDesc('Credential for the TURN server')
			.addText(text => text
				.setPlaceholder('password')
				.setValue(this.plugin.settings.turnCredential)
				.onChange(async (value) => {
					this.plugin.settings.turnCredential = value;
					await this.plugin.saveSettings();
				}));
	}
}
