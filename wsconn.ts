import {
  readerFromStreamReader,
  writerFromStreamWriter,
} from "https://deno.land/std/streams/mod.ts";
import type { Reader, Writer } from "jsr:@std/io/types";

// https://web.dev/i18n/zh/websocketstream/
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/3cc32b8e73320a5e9e4a17744236180f52c753d9/types/whatwg-streams/whatwg-streams-tests.ts

// https://streams.spec.whatwg.org/#example-rs-push-no-backpressure
function makeReadableWebSocketStream(ws: WebSocket) {
  ws.binaryType = "arraybuffer";

  return new ReadableStream({
    start(controller) {
      ws.onmessage = (event) => controller.enqueue(event.data);
      ws.onclose = () => controller.close();
      ws.onerror = () => controller.error(new Error("The WebSocket errored!"));
    },

    cancel() {
      ws.close();
    },
  });
}

// https://streams.spec.whatwg.org/#example-ws-no-backpressure
function makeWritableWebSocketStream(ws: WebSocket) {
  return new WritableStream({
    start(controller) {
      ws.onerror = () => controller.error(new Error("The WebSocket errored!"));
      return new Promise<void>((resolve) => ws.onopen = () => resolve());
    },

    write(chunk) {
      ws.send(chunk);
      // Return immediately, since the web socket gives us no easy way to tell
      // when the write completes.
    },

    close() {
      return new Promise<void>((resolve, reject) => {
        ws.onclose = () => resolve();
        ws.close();
      });
    },
  });
}

// socks5/lib/mocks/mock-connection.ts
export class Conn implements Deno.Conn {
  public localAddr: Deno.Addr;
  public remoteAddr: Deno.Addr;
  public reader: Reader;
  public writer: Writer;
  constructor(
    public readable: ReadableStream,
    public writable: WritableStream,
  ) {
    this.localAddr = {
      hostname: "localhost",
      port: 47000,
      transport: "tcp",
    };

    this.remoteAddr = {
      hostname: "localhost",
      port: 47000,
      transport: "tcp",
    };

    this.reader = readerFromStreamReader(this.readable.getReader());

    this.writer = writerFromStreamWriter(this.writable.getWriter());
  }
  unref() {
  }
  ref() {
  }
  static async fromWebSocketStream(wst: WebSocketStream): Promise<Conn> {
    const { readable, writable } = await wst.opened;
    return new Conn(readable, writable);
  }
  [Symbol.dispose](): void {
    try {
      this.close();
    } catch (error) {
      console.error("Error disposing listener:", error);
    }
  }
  async read(p: Uint8Array): Promise<number | null> {
    // return await this.reader.read(p);
    const n = await this.reader.read(p);
    console.log(n);
    return n;
  }
  async write(p: Uint8Array): Promise<number> {
    return await this.writer.write(p);
  }
  close(): void {
    this.readable.cancel();
    this.writable.close();
  }
  async closeWrite(): Promise<void> {
    await this.writable.close();
  }
}

export async function WebSocketConn(url: string): Promise<Deno.Conn> {
  let u = new URL(url);
  u.searchParams.set("X-Backend-ID", "b");
  url = u.toString();
  return await Conn.fromWebSocketStream(
    new WebSocketStream(url),
  );
}
