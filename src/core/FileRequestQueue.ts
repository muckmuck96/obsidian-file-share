import { IFriend } from "interfaces/IFriend";
import { Notice, TFile } from "obsidian";
import FileSharePlugin from "main";
import { IFileRequest } from "interfaces/IFileRequest";

export class FileRequestQueue {
    private queue: Map<string, IFileRequest>;
    private sendFileMethod: (
		file: TFile | null,
		friend: IFriend,
		hash: string,
		sourceFolderPath?: string
	) => Promise<void>;
    private plugin: FileSharePlugin;

    constructor(sendFileMethod: (
		file: TFile | null,
		friend: IFriend,
		hash: string,
		sourceFolderPath?: string
	) => Promise<void>, plugin: FileSharePlugin) {
        this.queue = new Map();
        this.sendFileMethod = sendFileMethod;
        this.plugin = plugin;
    }

    public addRequest(file: TFile, recipient: IFriend, sourceFolderPath?: string): void {
        const requestId = this.generateRequestId();
        const request: IFileRequest = {
            id: requestId,
            file,
            recipient,
            state: "pending",
            progress: 0,
            sourceFolderPath,
        };
        this.queue.set(requestId, request);

        this.sendIFileRequest(request);
    }

    public updateRequestState(requestId: string, state: "pending" | "accepted" | "sending" | "completed" | "failed" | "rejected", progress?: number): void {
        const request = this.queue.get(requestId);
        if (request) {
            request.state = state;
            if (progress !== undefined) {
                request.progress = progress;
            }
            this.queue.set(requestId, request);
        }
    }

    public getRequestByFileId(fileId: string): IFileRequest | undefined {
        for (const request of this.queue.values()) {
            if (request.fileId === fileId) {
                return request;
            }
        }
        return undefined;
    }

    public getRequestsByFile(file: TFile): IFileRequest[] {
        const requests: IFileRequest[] = [];
        for (const request of this.queue.values()) {
            if (request.file.path === file.path) {
                requests.push(request);
            }
        }
        return requests;
    }

    public handleResponse(requestId: string, accepted: boolean, hash: string): void {
        const request = this.queue.get(requestId);
        if (request) {
            if (accepted) {
                this.updateRequestState(requestId, "accepted");
                new Notice(`File request accepted by ${request.recipient.username}`);
                this.sendFileMethod(request.file, request.recipient, hash, request.sourceFolderPath)
                    .then(() => {
                        this.updateRequestState(requestId, "completed", 100);
                        // Clean up after a delay
                        setTimeout(() => {
                            this.queue.delete(requestId);
                        }, 3000);
                    })
                    .catch((error) => {
                        console.error("Error sending the file:", error);
                        this.updateRequestState(requestId, "failed");
                        setTimeout(() => {
                            this.queue.delete(requestId);
                        }, 5000);
                    });
            } else {
                this.updateRequestState(requestId, "rejected");
                new Notice(`File request declined by ${request.recipient.username}`);
                setTimeout(() => {
                    this.queue.delete(requestId);
                }, 3000);
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
            sourceFolderPath: request.sourceFolderPath,
        });
        const dataSign = this.plugin.secure.signData(requestData);
        this.plugin.socket.send("request", {
            target: request.recipient.publicKey,
            filename: request.file?.name,
            signature: dataSign,
            id: request.id,
            sourceFolderPath: request.sourceFolderPath,
        });
        new Notice(
            `Request sent to ${request.recipient.username} for file ${request.file?.name}`
        );
    }
}
