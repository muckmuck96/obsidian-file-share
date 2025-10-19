# Settings

Explore a comprehensive list of all available settings, complete with detailed explanations for each option.

## General settings

::: details Screenshot
![file-share-settings-screenshot](/fileShareSettings.png)
:::

### Your key
Upon enabling the plugin for the first time, a unique key will be automatically generated for you. You can easily copy this key by clicking the copy icon (![copy-icon](/copyIcon.png)).

If you wish to reset your key, simply click the reset icon (![reset-icon](/resetIcon.png)). However, please note that doing so will invalidate your old key, meaning you will no longer be able to send or receive files with anyone who has your previous key. To continue sharing files, you'll need to provide your new key to your [configured friends](getting-started.md#add-a-friend).

Default: `your generated key`

### Receive folder
Select the folder where the received files should be saved.

Default: `/`

### Scan files for first-level embedded links
Enhance the ability to automatically scan your outgoing file for first-level embedded links to other documents or images, ensuring they are transmitted alongside the corresponding attachments.

Default: `off`

### Preserve folder structure
When receiving files that were sent from a folder, this setting controls how they are organized:
- **Enabled (default):** Files are saved with the same folder structure they were sent from, recreating the sender's folder hierarchy in your receive folder
- **Disabled:** All files are saved directly to your receive folder, ignoring the original folder structure

Default: `on`

### Add Friend
Add and manage friends with whom you want to exchange files. For more detailed instructions, visit the [start sharing](getting-started.md#add-a-friend-and-start-sharing) section.

#### Enable hotkey
Each friend now has a toggle to enable keyboard shortcuts for direct sending:
- **Toggle ON:** Creates a command that lets you send files directly to this friend with a keyboard shortcut
- The command ID is automatically generated based on the friend's username (e.g., `send-to-alice`)
- Click the ⚙️ settings icon to quickly jump to Obsidian's hotkey settings with the command pre-filtered

Default: ` ` (empty)

## Advanced Settings

Advanced settings are available in a collapsible section for power users. These should only be modified if you understand their implications.

### Chunk size
Configure the size of each chunk when sending large files:
- **Range:** 64KB - 1024KB (1MB)
- **Default:** 256KB
- **Smaller chunks:** More reliable for unstable connections, but slower
- **Larger chunks:** Faster transfer, but may fail on poor connections

Large files are automatically split into chunks and reassembled on the recipient's end.

Default: `256KB`

### Auto-accepting incoming files
::: danger :exclamation: Attention
Enabling this option will disable one of the security mechanisms designed to protect you from receiving unwanted files!
:::

Default: `off`

### Socket URL
This option specifies the socket server used to exchange files with your friends. If you choose to use a custom socket server, ensure that your friends are using the exact same server; otherwise, the connection will not work. For more information, see the [enhanced settings](enhanced-settings.md) section.

The plugin validates that custom socket URLs use SSL (wss://) for security.

Default: `wss://ws-fileshare.asss.ist`
