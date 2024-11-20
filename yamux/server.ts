import { YamuxOptions } from "./types.ts";
import { YamuxStream } from "./stream.ts";
import { YamuxSession } from "./session.ts";

export class YamuxServer extends YamuxSession {
  private acceptQueue: Array<(stream: YamuxStream) => void> = [];

  constructor(ws: WebSocketStream, options?: YamuxOptions) {
    super(ws, options, false);
  }

  async accept(): Promise<YamuxStream> {
    return new Promise<YamuxStream>((resolve) => {
      this.acceptQueue.push(resolve);
    });
  }

  protected override onNewStream(stream: YamuxStream): void {
    const accept = this.acceptQueue.shift();
    if (accept) {
      accept(stream);
    } else {
      this.logger("No accept handler for new stream:", stream.id);
    }
  }
}

export class YamuxClient extends YamuxSession {
  constructor(ws: WebSocketStream, options?: YamuxOptions) {
    super(ws, options, true);
  }
}
