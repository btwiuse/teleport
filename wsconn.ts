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
  }
  unref() {
  }
  ref() {
  }
  static async fromWebSocketStream(wst: WebSocketStream): Promise<Conn> {
    const { readable, writable } = await wst.opened;
    return new Conn(
      readable,
      writable,
    );
  }
  [Symbol.dispose](): void {
    try {
      this.close();
    } catch (error) {
      console.error("Error disposing listener:", error);
    }
  }
  async read(p: Uint8Array): Promise<number | null> {
    // console.log("read");
    let reader = this.readable.getReader();

    try {
      const { done, value } = await reader.read();
      if (done) {
        return null; // Signal end of stream
      }

      if (value) {
        // console.log(value, typeof value, value.length);
        if (typeof value === "string") {
          let v = new TextEncoder().encode(value);
          p.set(v);
          return v.length;
        }
        p.set(value); // Copy the read bytes into the provided buffer
        return value.length;
      } else {
        return 0; // No data read in this chunk
      }
    } catch (error) {
      console.error("Error reading from stream:", error);
      return null; // Or throw the error, depending on your error handling strategy
    } finally {
      reader.releaseLock();
    }
  }
  async write(p: Uint8Array): Promise<number> {
    let writer = this.writable.getWriter();

    try {
      await writer.write(p);
      return p.length; // Number of bytes written
    } catch (error) {
      console.error("Error writing to stream:", error);
      // Handle the error appropriately (e.g., re-throw, return 0, etc.)
      throw error; // Or choose another error handling strategy
    } finally {
      writer.releaseLock();
    }
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
