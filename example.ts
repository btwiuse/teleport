#!/usr/bin/env -S deno run -A

import { connect, ConnectOptions } from "./mod.ts";

connect({ addr: "https://example.com" });
connect({ addr: "https://example.com/subpath/", from: "/subpath/" });
