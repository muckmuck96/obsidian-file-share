import { TFile } from "obsidian";
import { IFriend } from "./IFriend";

export interface IFileRequest {
    id: string;
    file: TFile; 
    recipient: IFriend; 
}