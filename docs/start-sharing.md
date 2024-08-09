# Start sharing


## Add a Friend

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

## Toggle connection

Make sure you are connected to the server. You can view the current connection status in the status bar.

![statusBarConnected](/statusBarConnected.png)

To connect or disconnect from the configured server, use the reload icon in the left sidebar labeled `Toggle connection`.

## Share a file

Once you have at least one friend in your friend list (and they have added you to their list), you can start sharing files with them.

1. **Select a File:** Right-click on the specific file you wish to share and choose the `Send to ...` option.
   ::: details Screenshot
   ![sendToContextMenu](/sendToContextMenu.png)
   :::

2. **Choose a Friend:** A modal will open, displaying all your friends. Select the friend you want to send the file to.
   ::: details Screenshot
   ![sendToFriendList](/sendToFriendList.png)
   :::

3. **Check Notifications:** You should receive a response notification. Here’s what each response means:

   | Response                        | What to Do                                      |
   |---------------------------------|-------------------------------------------------|
   | XYZ is offline at the moment         | Inform your friend they need to [toggle their connection](start-sharing.md#toggle-connection), or they might not be available to receive files right now. |
   | Request sent to xyz for file abc       | Wait for your friend to accept or decline your file request. |
   | File request accepted by xyz    | Your friend has accepted your file request.     |
   | File request declined by xyz    | Your friend has declined your file request.     |
   | File sent to xyz                | Your file has been successfully sent to your friend. |
