import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
	private message: string;
	private onResult: (confirmed: boolean) => void;
	private resolved = false;
	private confirmText: string;
	private cancelText: string;

	constructor(
		app: App,
		message: string,
		onResult: (confirmed: boolean) => void,
		confirmText = "Confirm",
		cancelText = "Cancel"
	) {
		super(app);
		this.message = message;
		this.onResult = onResult;
		this.confirmText = confirmText;
		this.cancelText = cancelText;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(this.cancelText)
					.onClick(() => this.resolve(false))
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.confirmText)
					.setCta()
					.onClick(() => this.resolve(true))
			);
	}

	onClose(): void {
		this.contentEl.empty();
		// If the modal was dismissed without a choice, treat it as a cancel.
		this.resolve(false);
	}

	private resolve(confirmed: boolean): void {
		if (this.resolved) {
			return;
		}
		this.resolved = true;
		this.onResult(confirmed);
		this.close();
	}
}
