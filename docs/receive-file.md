# Receive a file

If you have enabled the [`Auto-accept incoming files`](settings.md#auto-acceptiong-incoming-files) option (which is not recommended and is done at your own risk), you do not need to take any action. Your incoming files will be automatically saved to your configured [`Receive folder`](settings.md#receive-folder).

However, if the above option is not enabled, you will receive a popup notification when someone wants to send you a file. You will need to either accept or decline the request. The popup will display the name of the friend who wants to send you the file, along with the filename.

![fileSendRequest](/fileSendRequest.png)

The file itself is not sent until you give your approval. If you decline, the file transfer will be blocked by your client. Once you approve, the file will automatically be placed in the configured `Receive folder`, and you will receive a notification.

Several notifications may appear:

| Notification                             | Meaning                                                                                                                                                                                                                          |
|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| File received and saved to XYZ           | You have accepted (or auto-accepted) the file, and it has been placed in the specified path.                                                                                                                                     |
| Failed to save the received file         | This generic message indicates that the file could not be saved due to reasons such as a name conflict or insufficient write permissions in the configured `Receive folder`.                                                      |
| Signature verification failed. File not saved. | This message appears if someone tries to send you a file you have not accepted, or if the original file was tampered with by a malicious party. In such cases, the file will not be saved in your vault. |
