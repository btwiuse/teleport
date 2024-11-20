#!/usr/bin/env -S deno run -A --unstable-net

import { DEFAULT_OPTIONS, YamuxClient } from "../mod.ts";
import { delay } from "jsr:@std/async";

async function main() {
  // Connect to Go yamux server
  const wss = new WebSocketStream("ws://localhost:8088");
  const client = new YamuxClient(wss, {
    ...DEFAULT_OPTIONS,
    enableKeepAlive: false,
  });

  await Promise.all([
    openStream(client, "Hello from Deno!"),
    openStream(client, "Hello from Deno, again!"),
    openStream(client, "Hello from Deno, again and again!"),
  ]);

  // await client.close();
  // await delay(1000);
}

async function openStream(client, msg) {
  // Open stream
  const stream = await client.open();
  console.log("Stream opened:", stream.id);

  for (let i = 0; i < 100; i++) {
    // Send data
    const message = new TextEncoder().encode(msg);
    await stream.write(message);

    // Read response
    const buf = new Uint8Array(1024);
    const n = await stream.read(buf);
    if (n !== null) {
      const response = new TextDecoder().decode(buf.subarray(0, n));
      console.log("Received:", response);
    }

    await delay(100);
  }

  // Cleanup
  await stream.close();
}

main().catch(console.error);
