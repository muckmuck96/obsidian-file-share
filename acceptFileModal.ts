import { Modal, TFile } from "obsidian";

class AcceptFileModal extends Modal {
	private callback: () => {};
	private filename: string;

	constructor(app: any, filename: string, callback: () => {}) {
		super(app);
		this.filename = filename;
		this.callback = callback;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: `Someone sent you this file: ${this.filename}`,
		});

		const accpetButton = contentEl.createEl("button", { text: "Accept" });
		accpetButton.addEventListener("click", () => {
			this.close();
			this.callback();
		});

		const declineButton = contentEl.createEl("button", { text: "Decline" });
		declineButton.addEventListener("click", () => this.close());
	}
}

export default AcceptFileModal;
