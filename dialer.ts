import { WebSocketConn } from "./wsconn.ts";

// Modelled after Deno.ConnectOptions
// * https://docs.deno.com/api/deno/~/Deno.ConnectOptions
export type ConnectOptions = {
  addr: string;
  from?: string;
};

// Modelled after Deno.connect
// * https://docs.deno.com/api/deno/~/Deno.connect
export async function connect(
  { addr, from = "/" }: ConnectOptions,
): Promise<Deno.Conn> {
  console.log("conNect", { addr, from });
  return await WebSocketConn(addr);
}
