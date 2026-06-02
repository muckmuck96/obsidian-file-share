import { IFriend } from "interfaces/IFriend";
import { Notice, TFile } from "obsidian";
import FileSharePlugin from "main";
import { IFileRequest } from "interfaces/IFileRequest";

export class FileRequestQueue {
    // Safety net: a request that never reaches a terminal state (e.g. the
    // recipient never responds, or a "response" message is lost on reconnect)
    // would otherwise leave a transfer indicator stuck until Obsidian restarts.
    // Expire such requests after this long so the indicator clears on its own.
    private static readonly STUCK_REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    private queue: Map<string, IFileRequest>;
    private timeouts: Map<string, number>;
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
        this.timeouts = new Map();
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
            createdAt: Date.now(),
        };
        this.queue.set(requestId, request);
        this.scheduleStuckTimeout(requestId);

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
                        this.scheduleRemoval(requestId, 3000);
                    })
                    .catch((error) => {
                        console.error("Error sending the file:", error);
                        this.updateRequestState(requestId, "failed");
                        this.scheduleRemoval(requestId, 5000);
                    });
            } else {
                this.updateRequestState(requestId, "rejected");
                new Notice(`File request declined by ${request.recipient.username}`);
                this.scheduleRemoval(requestId, 3000);
            }
        }
    }

    /**
     * Remove all queued requests and cancel their timers. Used by the
     * "Reset transfer indicators" action to clear indicators that got stuck.
     */
    public clearAll(): void {
        for (const handle of this.timeouts.values()) {
            activeWindow.clearTimeout(handle);
        }
        this.timeouts.clear();
        this.queue.clear();
    }

    public getActiveRequestCount(): number {
        return this.queue.size;
    }

    private scheduleStuckTimeout(requestId: string): void {
        const handle = activeWindow.setTimeout(() => {
            const request = this.queue.get(requestId);
            // Only drop requests that never reached completion; a completed
            // request schedules its own (shorter) removal.
            if (request && request.state !== "completed") {
                this.removeRequest(requestId);
            }
        }, FileRequestQueue.STUCK_REQUEST_TIMEOUT_MS);
        this.timeouts.set(requestId, handle);
    }

    private scheduleRemoval(requestId: string, delayMs: number): void {
        // Replace the long stuck-timeout with the shorter terminal-state delay.
        const existing = this.timeouts.get(requestId);
        if (existing !== undefined) {
            activeWindow.clearTimeout(existing);
        }
        const handle = activeWindow.setTimeout(() => {
            this.removeRequest(requestId);
        }, delayMs);
        this.timeouts.set(requestId, handle);
    }

    private removeRequest(requestId: string): void {
        const handle = this.timeouts.get(requestId);
        if (handle !== undefined) {
            activeWindow.clearTimeout(handle);
            this.timeouts.delete(requestId);
        }
        this.queue.delete(requestId);
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
