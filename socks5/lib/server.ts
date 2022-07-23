import { Client } from "./client.ts";
import { ClientEvents } from "./events/client-events.ts";
import { EventEmitter } from "./events/event-emitter.ts";
import { ServerEvent, ServerEvents } from "./events/server-events.ts";
import { readExact } from "https://deno.land/std/encoding/binary.ts";
import { u8aToString } from "https://deno.land/x/polkadot/util/mod.ts";
import { copy } from "https://deno.land/std/streams/conversion.ts";

export class Server extends EventEmitter<ServerEvent> {
  /**
   * Constructor for creating a server. When consuming the Socks library, the
   * `Server.create` function should be preferred.
   * @param options The options for the server.
   * @param listener The factory function for creating a `Deno.Listener` given
   * some `Deno.ConnectOptions`.
   */
  constructor(
    private options: Deno.ConnectOptions,
    private listener: (
      options: Deno.ConnectOptions & { transport?: "tcp" | undefined },
    ) => Deno.Listener,
  ) {
    super();
  }

  /**
   * Creates a TCP server with the given `Deno.ConnectOptions`.
   * @param options The options for the server.
   * @returns The newly created `Server` object.
   */
  public static create(options: Deno.ConnectOptions): Server {
    return new Server(
      options,
      Deno.listen,
    );
  }

  public async handleCommandRequest(conn: Deno.Conn) {
    // get version and number of client supported auth methods
    let bufSize = 2;
    let buf: Uint8Array = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    console.log(bufSize, buf); // VERSION, COMMAND

    // assume CONNECT

    // skip rsv
    bufSize = 1;
    buf = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    console.log(bufSize, buf); // RSV

    // get ATYP
    bufSize = 1;
    buf = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    console.log(bufSize, buf); // ATYP

    let hostname = "unknown";
    switch (buf[0]) {
      case 0x01:
        bufSize = 4;
        buf = new Uint8Array(Array(bufSize).fill(0));
        await readExact(conn, buf);
        hostname = buf.join(".");
        console.log(bufSize, buf, "IPV4", hostname); // IPV4
        break;
      case 0x03:
        bufSize = 1;
        buf = new Uint8Array(Array(bufSize).fill(0));
        await readExact(conn, buf);
        console.log(bufSize, buf); // domain length
        bufSize = buf[0];
        buf = new Uint8Array(Array(bufSize).fill(0));
        await readExact(conn, buf);
        hostname = u8aToString(buf);
        console.log(bufSize, buf, "DOMAIN", hostname); // domain
        break;
      case 0x04:
        bufSize = 16;
        buf = new Uint8Array(Array(bufSize).fill(0));
        await readExact(conn, buf);
        console.log(bufSize, buf, "IPV6"); // IPV6
        break;
    }
    bufSize = 2;
    buf = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    const port = (buf[0] << 8) + buf[1];
    console.log(bufSize, buf, "PORT", port); // PORT

    try {
      const remote = await Deno.connect({ hostname, port });

      buf = new Uint8Array([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
      await conn.write(buf);

      copy(remote, conn);
      copy(conn, remote);
    } catch (e) {
    }
  }

  public async handleConn(conn: Deno.Conn) {
    // get version and number of client supported auth methods
    let bufSize = 2;
    let buf: Uint8Array = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    console.log(bufSize, buf, 'auth');

    // number of client supported methods
    bufSize = buf[1];
    buf = new Uint8Array(Array(bufSize).fill(0));
    await readExact(conn, buf);
    console.log(bufSize, buf, 'abc', (new TextDecoder()).decode(buf));

    if (buf.includes(0)) {
      await conn.write(new Uint8Array([0x05, 0x00])); // VERSION, NOAUTH
      console.log("noauth");
      while (true) {
        try {
          await this.handleCommandRequest(conn);
        } catch (e) {
          console.log("bye");
          break;
        }
      }
    } else {
      console.log("not supported");
      await conn.write(new Uint8Array([0x05, 0xff])); // VERSION, NOT_ACCEPTABLE
      // conn.close();
    }
  }

  /**
   * Start listening to the provided port for client connections.
   */
  public async listen(): Promise<void> {
    const server = this.listener(this.options);
    const clients: Array<Client> = [];

    this.emit(ServerEvents.listen);

    for await (const conn of server) {
      // let enc = new TextEncoder();
      // conn.write(enc.encode("HTTP/1.1 200 OK\r\nContent-Length: 15\r\n\r\n111.199.80.154\n"));
      // conn.close()
      // await copy(conn, Deno.stdout);
      this.handleConn(conn);
      // copy(conn, conn);
      continue;
      console.log('done');
      continue;
      const client = new Client(conn);
      clients.push(client);

      this.emit(ServerEvents.connect, client);

      // Receive events for this client, but do not block.
      client.receive()
        .catch((err: Error) => this.emit(ServerEvents.error, err));

      // When we get a close event for this client, finalise the client
      // correctly.
      client.on(ClientEvents.close, () => {
        this.closeClient(client);

        const clientIndex = clients.indexOf(client);

        if (clientIndex >= 0) {
          clients.splice(clientIndex, 1);
        }
      });
    }

    return Promise.resolve();
  }

  /**
   * Close the given client's connection to the server from our side.
   * @param client The client to close.
   * @returns Promise of the function eventually finalizing.
   */
  public closeClient(client: Client): Promise<void> {
    if (client.isOpen()) {
      try {
        client.close();
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.resolve();
  }
}
