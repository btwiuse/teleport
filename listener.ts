import { connect, ConnectOptions } from "./dialer.ts";
import { EventEmitter } from "https://deno.land/x/event/mod.ts";
import { TextLineStream } from "jsr:@std/streams";

export class ProxyListener implements Deno.Listener {
  constructor(private inner: Deno.Listener) {
  }
  unref() {
    this.inner.unref();
  }
  ref() {
    this.inner.ref();
  }
  close() {
    this.inner.close();
  }
  get addr() {
    return this.inner.addr;
  }
  async accept() {
    const conn: Deno.Conn = await this.inner.accept();
    console.log(conn.localAddr, conn.remoteAddr);
    return conn;
  }
  [Symbol.asyncIterator](): AsyncIterableIterator<Deno.Conn> {
    return this;
  }
  [Symbol.dispose](): void {
    try {
      this.close();
    } catch (error) {
      console.error("Error disposing listener:", error);
    }
  }
  async next(): Promise<IteratorResult<Deno.Conn>> {
    console.log("this.next");
    const conn: Deno.Conn = await this.accept();
    const result: IteratorResult<Deno.Conn> = {
      done: false,
      value: conn,
    };
    return result;
  }
}

type Events = {
  accept: [Deno.Conn];
};

class Emitter extends EventEmitter<Events> {}

async function sleep(n: number) {
  await new Promise((resolve) => setTimeout(resolve, n));
}

// Modelled after Deno.Listener
// * https://docs.deno.com/api/deno/~/Deno.Listener
export class Listener implements Deno.Listener {
  public options: ConnectOptions;
  private conn0?: Deno.Conn;
  private eventEmitter: Emitter;
  private connq: Deno.Conn[];
  constructor({ addr, from = "/" }: ConnectOptions) {
    this.options = {
      addr,
      from,
    };
    this.eventEmitter = new Emitter();
    this.connq = [];
  }
  async connect(): Promise<Deno.Conn> {
    console.log("this.connect ");
    return await connect(this.options);
  }
  async init(): Promise<void> {
    try {
      this.conn0 = await this.connect();
      // buf read from wsConn
      this.serve();
    } catch (e) {
      console.log(e);
    }
  }
  async serve(): Promise<void> {
    if (!this.conn0) throw new Error("conn0 uninitialized");
    const reader = this.conn0.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
      .getReader();
    const listener = (conn: Deno.Conn) => {
      // this.connq.push(conn);
    };
    this.eventEmitter.on("accept", listener);
    try {
      for (;;) {
        const { done, value: line } = await reader.read();
        if (done) {
          console.log("disconnected: read: EOF");
          break;
        }
        console.log(line);
        if (line === "ACCEPT") {
          const conn = await this.connect();
          console.log("connq.push(conn)");
          this.connq.push(conn);
          // this.eventEmitter.emit("accept", conn);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  unref(): void {}
  ref(): void {}
  close(): void {}
  async accept(): Promise<Deno.Conn> {
    console.log("accept", new Date());
    return await new Promise(async (resolve) => {
      // waiting conn
      console.log(this.connq.length, "this connq len");
      while (this.connq.length == 0) {
        console.log("wait");
        await sleep(300);
      }
      resolve(this.connq.shift()!);
    });
    // const conn = await this.connect();
    // return conn;
  }
  [Symbol.asyncIterator](): AsyncIterableIterator<Deno.Conn> {
    return this;
  }
  [Symbol.dispose](): void {
    try {
      this.close();
    } catch (error) {
      console.error("Error disposing listener:", error);
    }
  }
  // required method of [Symbol.asyncIterator]()
  async next(): Promise<IteratorResult<Deno.Conn>> {
    console.log("async next");
    const conn: Deno.Conn = await this.accept();
    console.log("local remote", conn.localAddr, conn.remoteAddr);
    const result: IteratorResult<Deno.Conn> = {
      done: false,
      value: conn,
    };
    return result;
  }
  get addr(): Deno.Addr {
    return {
      hostname: "localhost",
      port: 80,
      transport: "tcp",
    };
  }
}
