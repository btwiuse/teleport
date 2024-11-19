#!/usr/bin/env -S deno run -A --unstable-net

// start the server with
// - websocat -s 8080
// - websocat -s 8080 -b

import { WebSocketConn } from "./wsconn.ts";
import { copy } from "jsr:@std/io/copy";

// create wsConn from WebSocketStream
const wsConn = await WebSocketConn("ws://127.0.0.1:8080");

// write to wsConn
copy(Deno.stdin, wsConn);

// read from wsConn
copy(wsConn, Deno.stdout);

//#!/usr/bin/env -S deno run -A

// import { WebSocketStream } from "https://esm.sh/websocketstream-polyfill";
// import { fromStreamReader, fromStreamWriter } from './streams.ts';
// import { WebSocketStream } from "../websocketstream-polyfill/index.ts";
//
// the ws endpoint used here should return binary data only
// const wst = new WebSocketStream("wss://k0s.herokuapp.com/api/agents/watch");
// const wst = new WebSocketStream("ws://127.0.0.1:8000/api/agents/watch");

// const { readable, writable } = await wst.connection;

// const denoConn: Deno.Conn = new Conn(readable, writable);

/* https://docs.deno.com/api/deno/~/Deno.Conn
 *
 * interface Conn extends Reader, Writer, Closer {
 * readonly localAddr: Addr;
 * readonly readable: ReadableStream<Uint8Array>;
 * readonly remoteAddr: Addr;
 * readonly rid: number;
 * readonly writable: WritableStream<Uint8Array>;
 * closeWrite(): Promise<void>;
 * }
 */

/*
const stdoutStream: WritableStream = new WritableStream({
  write(chunk) {
    console.log("writable", typeof chunk, chunk);
  },
});

async function pipeToStdout() {
  await readable.pipeTo(stdoutStream);
}

// await pipeToStdout()

const stdoutWriter: Deno.Writer = writerFromStreamWriter(
  stdoutStream.getWriter(),
);
*/

// copy(src, dst)
// copy(readerFromStreamReader(readable.getReader()), Deno.stdout);

// console.log(denoConn);

// copy(denoConn, Deno.stdout);
// 1.
// Deno console <=> Deno Conn <=> WebSocketStream <=> WebSocket
//
// pros:
//
// 2.
// Deno console <=> Deno Conn <=> WebSocket
//
// pros:
//
// cons: no readable, writable
//
