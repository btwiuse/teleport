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
  console.log({ addr, from });
  return Deno.connect({
    hostname: "deno.land",
    port: 80,
  });
}
