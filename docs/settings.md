# Settings

Explore a comprehensive list of all available settings, complete with detailed explanations for each option.

## General settings

::: details Screenshot
![file-share-settings-screenshot](fileShareSettings.png)
:::

### Your key
Upon enabling the plugin for the first time, a unique key will be automatically generated for you. You can easily copy this key by clicking the copy icon (![copy-icon](copyIcon.png)).

If you wish to reset your key, simply click the reset icon (![reset-icon](resetIcon.png)). However, please note that doing so will invalidate your old key, meaning you will no longer be able to send or receive files with anyone who has your previous key. To continue sharing files, you'll need to provide your new key to your [configured friends](start-sharing.md).

Default: `your generated key`

### Receive folder
Select the folder where the received files should be saved.

Default: `/`

### Auto-acceptiong incoming files
::: danger :exclamation: Attention
Enabling this option will disable one of the security mechanisms designed to protect you from receiving unwanted files!
:::

Default: `off`

### Socket URL
This option specifies the socket server used to exchange files with your friends. If you choose to use a custom socket server, ensure that your friends are using the exact same server; otherwise, the connection will not work. For more information, see the [enhanced settings](enhanced-settings.md) section.

Default: `wss://ws-fileshare.asss.ist`

### Add Friend
Add and manage friends with whom you want to exchange files. For more detailed instructions, visit the [start sharing](start-sharing.md) section.

Default: ` ` (empty)
