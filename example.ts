#!/usr/bin/env -S deno run --unstable -A

import { connect, ConnectOptions } from "./mod.ts";
import { Listener, ProxyListener } from "./mod.ts";
import * as socks5 from "./socks5/mod.ts";

// connect({ addr: "wss://example.com" });
// connect({ addr: "wss://example.com/subpath/", from: "/subpath/" });

// const ln = new Listener({ addr: "wss://deno.land" });
// const ln = new Listener({ addr: "ws://127.0.0.1:8000/api/chassis/tmp/", from: "/" });
const ln = new Listener({
  addr: Deno.env.get("HOST") ?? "ws://127.0.0.1:8000/api/chassis/tmp/",
  from: "/",
});
// const ln = new Listener({ addr: "ws://k0s.op.milvzn.com:8000/api/chassis/tmp/", from: "/" });
ln.init();

console.log("1");

/*
// accept once
const conn = await ln.accept();
console.log(conn.localAddr, conn.remoteAddr);

// accept loop
for await (const conn of ln) {
  console.log(conn.localAddr, conn.remoteAddr);
  break;
}
*/

// address already in use
// const ss = socks.Server.create({ hostname: "localhost", port: 8123, });

// curl -v -x socks5://127.0.0.1:8124 http://ip.sb
async function testDenoListen() {
  const denoListener = new ProxyListener(Deno.listen({ port: 8124 }));
  const socks5Server = new socks5.Server(
    { hostname: "localhost", port: 8124 },
    () => denoListener,
  );
  console.log("listening on", 8124);
  await socks5Server.listen();
}

async function testTeleportListen() {
  const socks5Server = new socks5.Server(
    { hostname: "localhost", port: 8123 },
    () => ln,
  );
  console.log("listening on", 8123);
  await socks5Server.listen();
}

// await testDenoListen();
await testTeleportListen();
