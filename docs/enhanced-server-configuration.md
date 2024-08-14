# Configure server

You can replace the default socket server with a custom, self-hosted server. There are two options for doing this:

1. **Host the socket server on your own machine using our Docker image.**
2. **Obtain the server code from our file share socket server repository to build your own Docker image or run it directly on your preferred machine.**

In either case, we strongly recommend using an SSL connection for your socket server to ensure secure communication.

## Use our Docker image

To start the server using Docker, run the following command:

```bash
docker run -dit -p 3000:3000 -e SOCKET_PORT=3000 -e RATE_LIMITER_WINDOW_MS=900000 -e RATE_LIMITER_MAX_REQUESTS=10 -e RATE_LIMITER_MAX_CONNECTIONS=5 -e CERT_PEM_PATH=path-to-your-cert-file -e KEY_PEM_PATH=path-to-your-key-file jloferer96/obsidian-file-share-server:latest
```

| Environment variable | default | description |
| --- | --- | --- |
| SOCKET_PORT | `3000` | Defines the port number on which the socket server operates within the container. |
| USE_PROXY | `true` | Specifies whether a proxy is utilized. This setting determines if the rate limiter is engaged, adapting the application's behavior accordingly. |
| RATE_LIMITER_WINDOW_MS | `900000` | Defines the time window (in milliseconds) during which a specific client can establish a certain number of connections or send a specific number of requests. |
| RATE_LIMITER_MAX_REQUESTS | `100` | Specifies the maximum number of requests a client is permitted to make within the defined time window. Once this limit is reached, the client will be temporarily blocked from making further requests until the window resets. |
| RATE_LIMITER_MAX_CONNECTIONS | `10` | Determines the maximum number of connections that a client can establish within the specified time window. If this threshold is exceeded, the client will be blocked and forcibly disconnected, preventing further connections until the window resets. |
| CERT_PEM_PATH | `(empty)` | Specifies the file path to the SSL certificate in PEM format. This certificate is used to secure the communication between the server and clients, ensuring encrypted data transmission. |
| KEY_PEM_PATH | `(empty)` | Specifies the file path to the SSL key in PEM format. This key works in conjunction with the SSL certificate to enable secure connections by encrypting and decrypting data exchanges. |

## Use our code in your setup

For more details, check out our socket server repository: [obsidian-file-share-server](https://github.com/muckmuck96/obsidian-file-share-server)

## Configure custom socket url

To use a custom socket server, simply click the toggle and paste your own socket server url. Ensure that you use the correct syntax/protocol: `wss://`.

![customSocketURL](/customSocketURL.png)
