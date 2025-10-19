# Getting started

## Installation

1. 👉 [Click here to install directly in obsidian](https://obsidian.md/plugins?id=file-share)
2. ✅ Enable the plugin by clicking on `Enable` directly after the installation or via the installed plugin list, clicking on the toggle

## Optional:
📖 [Detailed explanation of the settings](settings.md)

## Add a friend and start sharing

### Add a Friend

Before you can share files with a friend, you must add them to your friend list. Your friend must also add you to their list for file exchanges to work. This setup is a one-time configuration for each friend, provided they do not change their key.

::: details How to Add a Friend
1. Open the File Share Settings and copy your key.
2. Share your key with your friend and request their key.
3. Once you receive your friend's key, copy it.
4. Add your friend to your friend list:
   - Go to the File Share settings tab and click `Add`.
   ![add-friend](/addFriend.png)
   - Enter an `username` and paste your friend's `key` from step 3, then click `Save`.
   ![add-friend-detailed](/addFriendDetailed.png)
6. Your friend is now added to your friend list. You can update the username and key by clicking `Edit`. To remove the friend from your list, click `Delete`. **Note: Removing a friend will prevent both you and your friend from exchanging files!**
:::

### Toggle connection

Make sure you are connected to the server. You can view the current connection status in the status bar.

![statusBarConnected](/statusBarConnected.png)

To connect or disconnect from the configured server, use the reload icon in the left sidebar labeled `Toggle connection`.

### Share a file

Once you have at least one friend in your friend list (and they have added you to their list), you can start sharing files with them.

#### Method 1: Using the context menu

1. **Select a File:** Right-click on the specific file you wish to share and choose the `Send to ...` option.
   ::: details Screenshot
   ![sendToContextMenu](/sendToContextMenu.png)
   :::

2. **Choose a Friend:** A modal will open, displaying all your friends. Select the friend you want to send the file to.
   ::: details Screenshot
   ![sendToFriendList](/sendToFriendList.png)
   :::

3. **Check Notifications:** You should receive a response notification. Here's what each response means:

   | Response                        | What to Do                                      |
   |---------------------------------|-------------------------------------------------|
   | XYZ is offline at the moment         | Inform your friend they need to [toggle their connection](#toggle-connection), or they might not be available to receive files right now. |
   | Request sent to xyz for file abc       | Wait for your friend to accept or decline your file request. |
   | File request accepted by xyz    | Your friend has accepted your file request.     |
   | File request declined by xyz    | Your friend has declined your file request.     |
   | File sent to xyz                | Your file has been successfully sent to your friend. |

#### Method 2: Using keyboard shortcuts

You can set up keyboard shortcuts for even faster file sharing:

**General "Send to..." shortcut:**
1. Go to Obsidian Settings → Hotkeys
2. Search for "Send current file to..."
3. Assign your preferred keyboard shortcut
4. Now you can instantly open the friend selection with your shortcut!

**Per-friend shortcuts:**
1. Go to File Share settings
2. Find the friend you want to create a shortcut for
3. Toggle "Enable hotkey" to ON
4. Click the ⚙️ settings icon that appears
5. Assign your preferred keyboard shortcut
6. Now you can send files directly to that friend without any menus!

::: tip
Keyboard shortcuts are perfect for quickly sharing notes during conversations or workflows!
:::

### Share a folder

You can now share entire folders with all their files at once:

1. **Select a Folder:** Right-click on the folder you wish to share and choose the `Send folder to ...` option.
2. **Choose a Friend:** A modal will open, displaying all your friends. Select the friend you want to send the folder to.
3. **Automatic processing:** The plugin will:
   - Collect all files from the folder (including subfolders)
   - Validate each file before sending
   - Skip any invalid files with a notification
   - Send all valid files with their folder structure preserved (if enabled in settings)

::: info
- Invalid files (wrong type or too large) are automatically skipped
- You'll see a notification showing how many files were sent and how many were skipped
- Your friend receives the files with the same folder structure (if [Preserve folder structure](settings.md#preserve-folder-structure) is enabled)
:::

### File queue

The file queue offers the ability to request multiple files for sharing with a friend, or to utilize the [Scan files for first-level embedded links](settings.md#scan-files-for-first-level-embedded-links) feature, which scans your file for first-level embedded links and automatically adds them to the queue, ensuring they are seamlessly sent to your friend alongside the original files.
