import { App, Modal, Notice } from "obsidian";

export class ReleaseNotesModal extends Modal {
	private version: string;
	private releaseNotes: string;
	private releaseTitle: string;

	constructor(app: App, version: string, releaseTitle: string, releaseNotes: string) {
		super(app);
		this.version = version;
		this.releaseTitle = releaseTitle;
		this.releaseNotes = releaseNotes;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: `FileShare - Update Notes` });

		if (this.releaseTitle) {
			contentEl.createEl("h3", { text: this.releaseTitle });
		}

		const notesContainer = contentEl.createDiv();
		notesContainer.className = "release-notes-content";

		// Use MarkdownRenderer if available, otherwise display as text
		if (this.releaseNotes) {
			// Convert markdown to HTML for better display
			const lines = this.releaseNotes.split('\n');
			lines.forEach(line => {
				if (line.startsWith('## ')) {
					notesContainer.createEl("h2", { text: line.substring(3) });
				} else if (line.startsWith('### ')) {
					notesContainer.createEl("h3", { text: line.substring(4) });
				} else if (line.startsWith('#### ')) {
					notesContainer.createEl("h4", { text: line.substring(5) });
				} else if (line.startsWith('- ')) {
					const ul = notesContainer.querySelector('ul:last-of-type') || notesContainer.createEl("ul");
					ul.createEl("li", { text: line.substring(2) });
				} else if (line.startsWith('* ')) {
					const ul = notesContainer.querySelector('ul:last-of-type') || notesContainer.createEl("ul");
					ul.createEl("li", { text: line.substring(2) });
				} else if (line.trim() !== '') {
					notesContainer.createEl("p", { text: line });
				} else {
					notesContainer.createEl("br");
				}
			});
		} else {
			notesContainer.createEl("p", { text: "No release notes available." });
		}

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.marginTop = "20px";
		buttonContainer.style.textAlign = "right";

		const closeButton = buttonContainer.createEl("button", { text: "Close" });
		closeButton.addEventListener("click", () => {
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
