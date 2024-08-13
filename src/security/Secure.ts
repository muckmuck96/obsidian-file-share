import * as crypto from "crypto";
import { IEncryptedFilePayload } from "interfaces/IEncryptedFilePayload";
import { IFriend } from "interfaces/IFriend";
import { IKeyPairPayload } from "interfaces/IKeyPairPayload";
import FileSharePlugin from "main";
import { Notice, TFile } from "obsidian";

export class Secure {
	private plugin: FileSharePlugin;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
	}

	async generateKeyPair(): Promise<IKeyPairPayload> {
		const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
		});
		return {
			privateKey: privateKey
				.export({ type: "pkcs1", format: "pem" })
				.toString(),
			publicKey: Buffer.from(
				publicKey.export({ type: "pkcs1", format: "pem" }).toString()
			).toString("base64"),
		};
	}

	serializePublicKey(publicKey: string): string {
		return Buffer.from(publicKey, "base64").toString();
	}

	async verifySignature(
		decryptedFile: Buffer,
		receivedSignature: string,
		publicKey: string
	): Promise<boolean> {
		const verify = crypto.createVerify("SHA256");
		verify.update(decryptedFile);
		const verified = verify.verify(
			crypto.createPublicKey(publicKey),
			receivedSignature,
			"base64"
		);
		return verified;
	}

	async decryptFile(
		encryptedAesKey: NodeJS.ArrayBufferView,
		iv: Buffer,
		encryptedFile: NodeJS.ArrayBufferView
	): Promise<Buffer> {
		const aesKey = crypto.privateDecrypt(
			crypto.createPrivateKey(this.plugin.settings.privateKey),
			encryptedAesKey
		);

		const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
		return Buffer.concat([
			decipher.update(encryptedFile),
			decipher.final(),
		]);
	}

	generateHash(data: { filename: string; from: string }): string {
		const hmac = crypto.createHmac(
			"sha256",
			this.plugin.settings.privateKey
		);
		hmac.update(`${data.filename}` + `${data.from}`);
		return hmac.digest("base64");
	}

	async signFile(file: TFile): Promise<string | null> {
		if (!file) {
			new Notice("No file selected");
			return null;
		}

		const fileContent = await this.plugin.app.vault.readBinary(file);

		const sign = crypto.createSign("SHA256");
		sign.update(Buffer.from(fileContent));
		const signature = sign.sign(this.plugin.settings.privateKey, "base64");
		return signature;
	}

	signData(data: string): string {
		const sign = crypto.createHmac(
			"SHA256",
			this.plugin.settings.privateKey
		);
		sign.update(data);
		return sign.digest("base64");
	}

	async encryptFile(
		file: TFile,
		friend: IFriend
	): Promise<IEncryptedFilePayload | null> {
		if (!file) {
			new Notice("No file selected");
			return null;
		}

		const signature = await this.signFile(file);
		const publicKey = this.plugin.secure.serializePublicKey(
			friend.publicKey
		);
		const fileContent = await this.plugin.app.vault.readBinary(file);

		const aesKey = crypto.randomBytes(32);  
		const iv = crypto.randomBytes(16); 

		const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
		const encryptedFile = Buffer.concat([
			cipher.update(Buffer.from(fileContent)),
			cipher.final(),
		]);

		const encryptedAesKey = crypto.publicEncrypt(publicKey, aesKey);

		return {
			file: encryptedFile.toString("base64"),
			aesKey: encryptedAesKey.toString("base64"),
			iv: iv.toString("base64"),
			filename: file.name,
			signature,
		};
	}

	isSocketURLSecure(): boolean {
		return this.plugin.settings.socketUrl.startsWith("wss://");
	}
}
