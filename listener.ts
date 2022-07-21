import { ConnectOptions } from "./dialer.ts";

// Modelled after Deno.Listener
// * https://doc.deno.land/deno/stable/~/Deno.Listener
class Listener implements Deno.Listener {
  public options: ConnectOptions;
  private conn0?: Deno.Conn;
  constructor({ addr, from = "/" }: ConnectOptions) {
    this.options = {
      addr,
      from,
    };
  }
  async init(): Promise<void> {
    this.conn0 = await Deno.connect({ hostname: this.options.addr, port: 80 });
  }
  close(): void {}
  async accept(): Promise<Deno.Conn> {
    return await Deno.connect({ hostname: this.options.addr, port: 80 });
  }
  [Symbol.asyncIterator](): AsyncIterableIterator<Deno.Conn> {
    return this;
  }
  // required method of [Symbol.asyncIterator]()
  async next(): Promise<IteratorResult<Deno.Conn>> {
    const opts = { hostname: this.options.addr, port: 80 };
    const conn: Deno.Conn = await Deno.connect(opts);
    const result: IteratorResult<Deno.Conn> = { done: true, value: conn };
    return result;
  }
  get addr(): Deno.Addr {
    return {
      hostname: "localhost",
      port: 80,
      transport: "tcp",
    };
  }
  get rid(): number {
    return 0;
  }
}
