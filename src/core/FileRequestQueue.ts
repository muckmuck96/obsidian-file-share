import { IFriend } from "interfaces/IFriend";
import { Notice, TFile } from "obsidian";
import FileSharePlugin from "main";
import { IFileRequest } from "interfaces/IFileRequest";

export class FileRequestQueue {
    private queue: Map<string, IFileRequest>;
    private sendFileMethod: (
		file: TFile | null,
		friend: IFriend,
		hash: string
	) => Promise<void>;
    private plugin: FileSharePlugin;

    constructor(sendFileMethod: (
		file: TFile | null,
		friend: IFriend,
		hash: string
	) => Promise<void>, plugin: FileSharePlugin) {
        this.queue = new Map();
        this.sendFileMethod = sendFileMethod;
        this.plugin = plugin;
    }

    public addRequest(file: TFile, recipient: IFriend): void {
        const requestId = this.generateRequestId();
        const request: IFileRequest = {
            id: requestId,
            file,
            recipient,
        };
        this.queue.set(requestId, request);

        this.sendIFileRequest(request);
    }

    public handleResponse(requestId: string, accepted: boolean, hash: string): void {
        const request = this.queue.get(requestId);
        if (request) {
            if (accepted) {
                new Notice(`File request accepted by ${request.recipient.username}`);
                this.sendFileMethod(request.file, request.recipient, hash)
                    .then(() => {
                        this.queue.delete(requestId);
                    })
                    .catch((error) => {
                        console.error("Error sending the file:", error);
                    });
            } else {
                new Notice(`File request declined by ${request.recipient.username}`);
                this.queue.delete(requestId);
            }
        }
    }

    private generateRequestId(): string {
        return crypto.randomUUID();
    }

    private sendIFileRequest(request: IFileRequest): void {
        
        const requestData = JSON.stringify({
            type: "request",
            target: request.recipient.publicKey,
            filename: request.file?.name,
        });
        const dataSign = this.plugin.secure.signData(requestData);
        this.plugin.socket.send("request", {
            target: request.recipient.publicKey,
            filename: request.file?.name,
            signature: dataSign,
            id: request.id,
        });
        new Notice(
            `Request sent to ${request.recipient.username} for file ${request.file?.name}`
        );
    }
}
