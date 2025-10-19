import { Notice, requestUrl } from "obsidian";

interface GitHubRelease {
	tag_name: string;
	name: string;
	body: string;
	published_at: string;
}

export class ReleaseNotesManager {
	private static readonly GITHUB_API_URL = "https://api.github.com/repos/muckmuck96/obsidian-file-share/releases/latest";

	static async fetchLatestRelease(): Promise<GitHubRelease | null> {
		try {
			const response = await requestUrl({
				url: this.GITHUB_API_URL,
				method: "GET",
				headers: {
					"Accept": "application/vnd.github.v3+json"
				}
			});

			if (response.status === 200) {
				return response.json as GitHubRelease;
			} else {
				console.error("Failed to fetch release notes:", response.status);
				return null;
			}
		} catch (error) {
			console.error("Error fetching release notes:", error);
			new Notice("Failed to fetch release notes from GitHub.");
			return null;
		}
	}

	static compareVersions(currentVersion: string, latestVersion: string): boolean {
		// Remove 'v' prefix if present
		const current = currentVersion.replace(/^v/, '');
		const latest = latestVersion.replace(/^v/, '');

		// Split versions into parts
		const currentParts = current.split('.').map(Number);
		const latestParts = latest.split('.').map(Number);

		// Compare each part
		for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
			const currentPart = currentParts[i] || 0;
			const latestPart = latestParts[i] || 0;

			if (latestPart > currentPart) {
				return true; // Latest is newer
			} else if (latestPart < currentPart) {
				return false; // Current is newer (shouldn't happen in normal updates)
			}
		}

		return false; // Versions are equal
	}
}
