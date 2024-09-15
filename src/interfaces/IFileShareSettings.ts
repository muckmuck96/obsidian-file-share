import { IFriend } from "./IFriend";

export interface IFileShareSettings {
	useCustomSocketUrl: boolean;
	socketUrl: string;
	friends: IFriend[];
	receiveFolder: string;
	privateKey: string;
	publicKey: string;
	autoAcceptFiles: boolean;
	scanSendingFiles: boolean;
}
