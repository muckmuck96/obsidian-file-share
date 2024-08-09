# Configure server

You can replace the default socket server with a custom, self-hosted server. There are two options for doing this:

1. **Host the socket server on your own machine using our Docker image.**
2. **Obtain the server code from our file share socket server repository to build your own Docker image or run it directly on your preferred machine.**

In either case, we strongly recommend using an SSL connection for your socket server to ensure secure communication.

## Use our Docker image

To start the server using Docker, run the following command:

```bash
docker run -dit -p 3000:3000 jloferer96/obsidian-file-share-server:latest
```

Feel free to use any port. In this example, we use port `3000`.

## Use our code in your setup

For more details, check out our socket server repository: [obsidian-file-share-server](https://github.com/muckmuck96/obsidian-file-share-server)

## Configure custom socket url

To use a custom socket server, simply click the toggle and paste your own socket server url. Ensure that you use the correct syntax/protocol: `wss://`.

![customSocketURL](/customSocketURL.png)
