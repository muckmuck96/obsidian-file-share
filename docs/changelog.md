# Changelog

---
## 1.2.0 (19.10.2025)

### New Features
- **Keyboard shortcuts** - Set up hotkeys to send files instantly
  - General "Send to..." command to open friend selection
  - Per-friend direct send commands (enable via toggle in friend settings)
  - Auto-generated command IDs based on friend usernames
  - Quick access to hotkey settings with pre-filled search
- **Folder sharing** - Send entire folders with all their files at once
  - Right-click any folder to share it
  - Recursive file collection from subfolders
  - Invalid files are automatically skipped
- **Large file support** - Files up to 500MB can now be sent
  - Automatic chunked transfer for large files
  - Configurable chunk size (64KB - 1MB, default: 256KB)
  - Progress indicators for sending/receiving
- **Visual feedback** - Real-time status indicators in file explorer
  - Spinning icon while sending
  - Checkmark on success
  - Error indicators when something goes wrong
- **File validation** - Enhanced security and reliability
  - Whitelisted file types (markdown, images, PDFs, documents, code files)
  - File size limits with clear error messages
  - Pre-send validation to catch issues early
- **Preserve folder structure** - New setting to control how received files are organized
  - Enabled (default): Recreates sender's folder structure
  - Disabled: All files go directly to receive folder
- **Release notes system** - Automatically shows what's new after updates
  - One-time display per version
  - Easy access to documentation

### Improvements
- **Better settings organization** - Advanced options moved to collapsible section
- **Connection validation** - Checks server connection before attempting to send
- **Online status check** - Verifies recipient is online before transfer
- **Auto-accept files** - Moved to advanced settings with confirmation dialog
- **Socket URL validation** - Validates custom server URLs for SSL support

### Testing & Reliability
- Added comprehensive test suite (133 automated tests)
- 100% test coverage on critical security components
- Integration tests for end-to-end workflows

## 1.1.0 (15.09.2024)
- added file queue
- added scan for embedded links setting

## 1.0.0 (09.08.2024)
- initial build 