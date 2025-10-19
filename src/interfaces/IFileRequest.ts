import { TFile } from "obsidian";
import { IFriend } from "./IFriend";

export type FileTransferState = "pending" | "accepted" | "sending" | "completed" | "failed" | "rejected";

export interface IFileRequest {
    id: string;
    file: TFile;
    recipient: IFriend;
    state: FileTransferState;
    fileId?: string;
    progress?: number;
    sourceFolderPath?: string; // Relative path from the sent folder
}