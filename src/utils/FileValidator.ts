import { Notice, TFile } from "obsidian";
import FileSharePlugin from "main";

export class FileValidator {
	private plugin: FileSharePlugin;

	private static readonly ALLOWED_EXTENSIONS = {
		markdown: ['.md', '.markdown'],
		images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'],
		videos: ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv'],
		audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'],
		documents: ['.pdf', '.txt', '.rtf'],
		obsidian: ['.excalidraw', '.canvas'],
		data: ['.json', '.csv', '.xml', '.yaml', '.yml']
	};

	private static readonly MAX_VIDEO_DURATION_SECONDS = 60;

	constructor(plugin: FileSharePlugin) {
		this.plugin = plugin;
	}

	async validateFile(file: TFile): Promise<{ valid: boolean; error?: string }> {
		// Check file type
		const typeValidation = this.validateFileType(file);
		if (!typeValidation.valid) {
			return typeValidation;
		}

		// Check file size
		const sizeValidation = await this.validateFileSize(file);
		if (!sizeValidation.valid) {
			return sizeValidation;
		}

		return { valid: true };
	}

	validateFileType(file: TFile): { valid: boolean; error?: string } {
		const extension = file.extension.toLowerCase();
		const allAllowedExtensions = [
			...FileValidator.ALLOWED_EXTENSIONS.markdown,
			...FileValidator.ALLOWED_EXTENSIONS.images,
			...FileValidator.ALLOWED_EXTENSIONS.videos,
			...FileValidator.ALLOWED_EXTENSIONS.audio,
			...FileValidator.ALLOWED_EXTENSIONS.documents,
			...FileValidator.ALLOWED_EXTENSIONS.obsidian,
			...FileValidator.ALLOWED_EXTENSIONS.data
		].map(ext => ext.substring(1)); // Remove the dot

		if (!allAllowedExtensions.includes(extension)) {
			return {
				valid: false,
				error: `File type ".${extension}" is not allowed. Supported types: markdown, images, videos, audio, documents (PDF, TXT), Obsidian files (canvas, excalidraw), and data files (JSON, CSV, etc.).`
			};
		}

		return { valid: true };
	}

	async validateFileSize(file: TFile): Promise<{ valid: boolean; error?: string }> {
		const fileStats = await this.plugin.app.vault.adapter.stat(file.path);
		if (!fileStats) {
			return {
				valid: false,
				error: "Could not read file statistics"
			};
		}

		const fileSizeBytes = fileStats.size;
		const maxSizeBytes = this.plugin.settings.maxFileSize;

		if (fileSizeBytes > maxSizeBytes) {
			const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
			const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
			return {
				valid: false,
				error: `File size (${fileSizeMB} MB) exceeds maximum allowed size (${maxSizeMB} MB)`
			};
		}

		return { valid: true };
	}

	isVideoFile(file: TFile): boolean {
		const extension = `.${file.extension.toLowerCase()}`;
		return FileValidator.ALLOWED_EXTENSIONS.videos.includes(extension);
	}

	isImageFile(file: TFile): boolean {
		const extension = `.${file.extension.toLowerCase()}`;
		return FileValidator.ALLOWED_EXTENSIONS.images.includes(extension);
	}

	isMarkdownFile(file: TFile): boolean {
		const extension = `.${file.extension.toLowerCase()}`;
		return FileValidator.ALLOWED_EXTENSIONS.markdown.includes(extension);
	}

	showValidationError(error: string): void {
		new Notice(error);
	}
}
