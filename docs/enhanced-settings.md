# Enhanced settings

> [!IMPORTANT]
> The configurations described in this section should only be modified by developers or those with a thorough understanding of its implications.

## Advanced Options

### Chunk Size Configuration

For large file transfers (files larger than the configured chunk size), the plugin automatically splits files into smaller pieces for reliable transmission.

**Configuration:**
- Located in: File Share Settings → Advanced Settings (collapsible section)
- Range: 64KB - 1024KB (1MB)
- Default: 256KB

**How it works:**
1. Files larger than the chunk size are automatically split
2. Each chunk is encrypted individually
3. Chunks are sent sequentially
4. The recipient reassembles chunks into the original file
5. Progress indicators show transfer status

**Choosing the right size:**
- **64-128KB:** Best for very slow or unstable connections
- **256KB (default):** Good balance for most connections
- **512KB-1MB:** Fastest for stable, high-speed connections

**Technical details:**
- All chunks are encrypted with AES-256-CBC
- Each chunk has its own encryption key and IV
- Metadata tracks chunk order and total count
- Failed chunks can be retried individually (future feature)

### File Validation

The plugin includes comprehensive file validation to ensure security and reliability:

**Supported file types:**
- Markdown files (`.md`, `.markdown`)
- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`)
- Audio (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, `.aac`)
- Videos (`.mp4`, `.webm`, `.ogv`, `.mov`, `.avi`, `.mkv`)
- Documents (`.pdf`, `.txt`, `.rtf`)
- Obsidian plugin files (`.excalidraw`, `.canvas`)
- Data files (`.json`, `.csv`, `.xml`, `.yml`, `.yaml`)

**File size limits:**
- Maximum file size: 500MB
- This limit applies to individual files, not total transfer size
- Folders can contain multiple files up to this limit each

**Validation process:**
1. File type is checked against whitelist
2. File size is validated
3. File exists and is readable
4. Invalid files are rejected with clear error messages

### Visual Feedback System

The FileTreeDecorator provides real-time visual feedback in your file explorer:

**Status indicators:**
- 🔄 **Spinning icon:** File is currently being sent/received
- ✅ **Checkmark:** File was successfully transferred
- ❌ **Error icon:** Transfer failed

**Implementation:**
- Uses Obsidian's file decoration API
- Updates in real-time during transfers
- Automatically cleans up after completion
- Works for both individual files and folders

### Folder Structure Preservation

Control how received files are organized with the "Preserve folder structure" setting:

**Enabled (default):**
```
Sender structure:           Recipient receives:
Projects/                   [Receive Folder]/
  Frontend/                   Projects/
    src/                        Frontend/
      app.js                      src/
      utils.js                      app.js
                                    utils.js
```

**Disabled:**
```
Sender structure:           Recipient receives:
Projects/                   [Receive Folder]/
  Frontend/                   app.js
    src/                      utils.js
      app.js
      utils.js
```

**Technical details:**
- Relative paths are stored with each file request
- Path separators are normalized across platforms
- Empty folders are not created (only folders containing files)
- Conflicts are handled by Obsidian's file creation logic

