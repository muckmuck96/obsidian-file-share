import { TFile, TFolder, WorkspaceLeaf } from "obsidian";
import FileSharePlugin from "main";
import { FileTransferState } from "interfaces/IFileRequest";

export class FileTreeDecorator {
	private plugin: FileSharePlugin;
	private decorations: Map<string, HTMLElement>;
	private updateInterval: number;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
		this.decorations = new Map();
		this.startUpdateLoop();
	}

	private startUpdateLoop(): void {
		// Update decorations every 500ms
		this.updateInterval = window.setInterval(() => {
			this.updateAllDecorations();
		}, 500);
	}

	public cleanup(): void {
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
		}
		this.clearAllDecorations();
	}

	private updateAllDecorations(): void {
		// Get all files in the vault
		const files = this.plugin.app.vault.getFiles();

		files.forEach((file) => {
			const requests = this.plugin.fileRequestQueue.getRequestsByFile(file);

			if (requests.length > 0) {
				// File has active transfers
				const primaryRequest = requests[0]; // Use first request for display
				this.addOrUpdateDecoration(file.path, primaryRequest.state, primaryRequest.progress || 0);
			} else {
				// No active transfers, remove decoration
				this.removeDecoration(file.path);
			}
		});

		// Update folder decorations
		this.updateFolderDecorations();
	}

	private updateFolderDecorations(): void {
		// Get all folders
		const allFolders = this.plugin.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];

		allFolders.forEach((folder) => {
			const folderStatus = this.getFolderTransferStatus(folder);

			if (folderStatus) {
				this.addOrUpdateDecoration(folder.path, folderStatus.state, folderStatus.progress);
			} else {
				this.removeDecoration(folder.path);
			}
		});
	}

	private getFolderTransferStatus(folder: TFolder): { state: FileTransferState; progress: number } | null {
		// Get all files in this folder recursively
		const filesInFolder: TFile[] = [];
		const getAllFiles = (currentFolder: TFolder) => {
			for (const child of currentFolder.children) {
				if (child instanceof TFile) {
					filesInFolder.push(child);
				} else if (child instanceof TFolder) {
					getAllFiles(child);
				}
			}
		};
		getAllFiles(folder);

		if (filesInFolder.length === 0) {
			return null;
		}

		// Check if any files have active transfers
		let totalFiles = 0;
		let pendingFiles = 0;
		let sendingFiles = 0;
		let completedFiles = 0;
		let failedFiles = 0;
		let totalProgress = 0;

		filesInFolder.forEach((file) => {
			const requests = this.plugin.fileRequestQueue.getRequestsByFile(file);
			if (requests.length > 0) {
				totalFiles++;
				const request = requests[0];

				switch (request.state) {
					case 'pending':
					case 'accepted':
						pendingFiles++;
						break;
					case 'sending':
						sendingFiles++;
						totalProgress += request.progress || 0;
						break;
					case 'completed':
						completedFiles++;
						totalProgress += 100;
						break;
					case 'failed':
					case 'rejected':
						failedFiles++;
						break;
				}
			}
		});

		if (totalFiles === 0) {
			return null;
		}

		// Determine folder status based on file statuses
		if (failedFiles > 0) {
			return { state: 'failed', progress: 0 };
		} else if (completedFiles === totalFiles) {
			return { state: 'completed', progress: 100 };
		} else if (sendingFiles > 0) {
			const avgProgress = Math.round(totalProgress / totalFiles);
			return { state: 'sending', progress: avgProgress };
		} else if (pendingFiles > 0) {
			return { state: 'pending', progress: 0 };
		}

		return null;
	}

	private addOrUpdateDecoration(path: string, state: FileTransferState, progress: number): void {
		const fileExplorer = this.getFileExplorer();
		if (!fileExplorer) return;

		const element = this.findFileOrFolderElement(path);
		if (!element) return;

		const existingDecoration = this.decorations.get(path);

		if (existingDecoration) {
			// Update existing decoration
			this.updateDecorationContent(existingDecoration, state, progress);
		} else {
			// Create new decoration
			const decoration = this.createDecoration(state, progress);

			// Find the title element within the file/folder element
			const titleElement = element.querySelector('.nav-file-title-content, .nav-folder-title-content');
			if (titleElement) {
				titleElement.appendChild(decoration);
				this.decorations.set(path, decoration);
			}
		}
	}

	private createDecoration(state: FileTransferState, progress: number): HTMLElement {
		const container = document.createElement('span');
		container.addClass('file-share-indicator');
		container.style.marginLeft = '5px';
		container.style.fontSize = '0.9em';

		this.updateDecorationContent(container, state, progress);

		return container;
	}

	private updateDecorationContent(element: HTMLElement, state: FileTransferState, progress: number): void {
		let icon = '';
		let color = '';
		let title = '';

		switch (state) {
			case 'pending':
				icon = '⏳';
				color = '#888';
				title = 'Waiting for response...';
				break;
			case 'accepted':
				icon = '✓';
				color = '#4CAF50';
				title = 'Request accepted';
				break;
			case 'sending':
				icon = '📤';
				color = '#2196F3';
				title = `Sending... ${progress}%`;
				break;
			case 'completed':
				icon = '✅';
				color = '#4CAF50';
				title = 'Transfer completed';
				break;
			case 'failed':
				icon = '❌';
				color = '#F44336';
				title = 'Transfer failed';
				break;
			case 'rejected':
				icon = '🚫';
				color = '#FF9800';
				title = 'Request rejected';
				break;
		}

		element.textContent = icon;
		element.style.color = color;
		element.title = title;

		// Add progress percentage for sending state
		if (state === 'sending' && progress > 0) {
			element.textContent = `${icon} ${progress}%`;
		}
	}

	private removeDecoration(path: string): void {
		const decoration = this.decorations.get(path);
		if (decoration) {
			decoration.remove();
			this.decorations.delete(path);
		}
	}

	private clearAllDecorations(): void {
		this.decorations.forEach((decoration) => {
			decoration.remove();
		});
		this.decorations.clear();
	}

	private getFileExplorer(): any {
		const leaves = this.plugin.app.workspace.getLeavesOfType('file-explorer');
		if (leaves.length > 0) {
			return leaves[0].view;
		}
		return null;
	}

	private findFileOrFolderElement(path: string): HTMLElement | null {
		// Find the DOM element for a specific file or folder path
		const fileExplorer = this.getFileExplorer();
		if (!fileExplorer) return null;

		// Search through all file items in the explorer
		const fileItems = document.querySelectorAll('.nav-file');
		for (const item of Array.from(fileItems)) {
			const titleElement = item.querySelector('.nav-file-title');
			if (titleElement) {
				const dataPath = titleElement.getAttribute('data-path');
				if (dataPath === path) {
					return item as HTMLElement;
				}
			}
		}

		// Search through all folder items in the explorer
		const folderItems = document.querySelectorAll('.nav-folder');
		for (const item of Array.from(folderItems)) {
			const titleElement = item.querySelector('.nav-folder-title');
			if (titleElement) {
				const dataPath = titleElement.getAttribute('data-path');
				if (dataPath === path) {
					return item as HTMLElement;
				}
			}
		}

		return null;
	}
}
