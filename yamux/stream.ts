import { Closer, Reader, Writer } from "jsr:@std/io";
import {
  Errors,
  Flag,
  INITIAL_WINDOW,
  StreamState,
  Type,
  VERSION,
} from "./types.ts";
import { Header } from "./header.ts";

export class YamuxStream implements Reader, Writer, Closer {
  public state: StreamState;
  private readQueue: Uint8Array[] = [];
  private readBuffer = new Uint8Array(0);
  private readPromises: Array<
    [(data: Uint8Array) => void, (err: Error) => void]
  > = [];
  private recvWindow: number;
  private sendWindow: number;
  private destroyed = false;
  private readReady = new Promise<void>((resolve) => {
    this.readResolver = resolve;
  });
  private readResolver?: () => void;

  constructor(
    private session: {
      removeStream(id: number): void;
      sendFrame(header: Header, payload?: Uint8Array): Promise<void>;
      logger: (msg: string, ...args: unknown[]) => void;
    },
    readonly id: number,
    initialWindow = INITIAL_WINDOW,
    initialState = StreamState.Init,
  ) {
    this.state = initialState;
    this.recvWindow = initialWindow;
    this.sendWindow = initialWindow;
  }

  async read(p: Uint8Array): Promise<number | null> {
    while (this.readQueue.length === 0) {
      if (this.state === StreamState.Closed) return null;
      await this.readReady;
      this.readReady = new Promise<void>((resolve) => {
        this.readResolver = resolve;
      });
    }

    if (this.state === StreamState.Closed) return null;
  
    const chunk = this.readQueue.shift()!;
    const n = Math.min(p.length, chunk.length);
    p.set(chunk.subarray(0, n));
    
    if (n < chunk.length) {
      this.readQueue.unshift(chunk.subarray(n));
    }
    
    return n;
  }

  async write(p: Uint8Array): Promise<number> {
    if (this.state === StreamState.Closed) {
      throw Errors.StreamClosed;
    }

    const flags = this.state === StreamState.Init ? Flag.SYN : Flag.NUL; // Don't send ACK unless necessary
    const header = new Header(VERSION, Type.Data, flags, this.id, p.length);
    await this.session.sendFrame(header, p);

    if (this.state === StreamState.Init) {
      this.state = StreamState.SynSent;
    }

    return p.length;
  }

  close(): void {
    if (this.state === StreamState.Closed) return;
    this.state = StreamState.Closed;

    const header = new Header(VERSION, Type.WindowUpdate, Flag.FIN, this.id, 0);
    this.session.sendFrame(header).catch((err) => {
      this.session.logger("Failed to send close frame:", err);
    });

    this.readPromises.forEach(([, reject]) => {
      reject(Errors.StreamClosed);
    });
    this.readPromises = [];
    this.session.removeStream(this.id);
  }

  processFlags(flags: Flag): void {
    if (flags & Flag.ACK && this.state === StreamState.SynSent) {
      this.state = StreamState.Established;
    }
    if (flags & Flag.FIN || flags & Flag.RST) {
      this.close();
    }
  }

  pushData(data: Uint8Array): void {
    this.readQueue.push(data);
    this.readResolver?.();  // Signal new data available
  }

  updateSendWindow(delta: number): void {
    this.sendWindow = Math.min(this.sendWindow + delta, INITIAL_WINDOW);
  }

  async sendWindowUpdate(): Promise<void> {
    if (this.state === StreamState.Closed) return;
    
    // Only send if window is significantly reduced
    const windowUsed = INITIAL_WINDOW - this.recvWindow;
    if (windowUsed < INITIAL_WINDOW / 2) return;

    const header = new Header(
      VERSION,
      Type.WindowUpdate,
      this.state === StreamState.Init ? Flag.SYN : Flag.ACK,
      this.id,
      this.recvWindow
    );
    await this.session.sendFrame(header);
  }
}
