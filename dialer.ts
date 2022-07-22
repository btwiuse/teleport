import { WebSocketConn } from "./wsconn.ts";

// Modelled after Deno.ConnectOptions
// * https://doc.deno.land/deno/stable/~/Deno.ConnectOptions
export type ConnectOptions = {
  addr: string;
  from?: string;
};

// Modelled after Deno.connect
// * https://doc.deno.land/deno/stable/~/Deno.connect
export async function connect(
  { addr, from = "/" }: ConnectOptions,
): Promise<Deno.Conn> {
  console.log("conNect", { addr, from });
  return await WebSocketConn(addr);
}
