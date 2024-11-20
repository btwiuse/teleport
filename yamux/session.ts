import { concat } from "jsr:@std/bytes/concat";
import {
  DEFAULT_OPTIONS,
  Errors,
  Flag,
  GoAwayCode,
  HEADER_SIZE,
  StreamState,
  Type,
  YamuxOptions,
} from "./types.ts";
import { Header } from "./header.ts";
import { YamuxStream } from "./stream.ts";

export class YamuxSession {
  protected streams = new Map<number, YamuxStream>();
  protected nextStreamID: number;
  protected options: Required<YamuxOptions>;
  protected closed = false;
  protected buffer = new Uint8Array(0);
  protected pingInterval?: number;
  protected writer?: WritableStreamDefaultWriter<Uint8Array>;
  protected reader?: ReadableStreamDefaultReader<Uint8Array>;
  // Add ready promise and resolver
  private readyResolver!: () => void;
  private readyRejecter!: (err: Error) => void;
  readonly ready: Promise<void>;
  // Add ping tracking
  private pings = new Map<number, number>();  // Map of pingID to timestamp
  private pingID = 0;
  private pingTimeout = 30000; // 30 seconds timeout for pings

  constructor(
    protected ws: WebSocketStream,
    options?: YamuxOptions,
    protected isClient = false,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.nextStreamID = isClient ? 1 : 2;
    // Initialize ready promise
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolver = resolve;
      this.readyRejecter = reject;
    });

    this.init().catch(this.readyRejecter);
  }

  private async init() {
    // console.log("before init");
    try {
      const connection = await this.ws.opened;
      this.writer = connection.writable.getWriter();

      const reader = connection.readable.getReader();
      this.reader = reader as ReadableStreamDefaultReader<Uint8Array>;

      this.startReceiveLoop();
      if (this.options.enableKeepAlive) {
        this.startKeepAlive();
      }

      // Signal ready
      this.readyResolver();
    } catch (err) {
      this.readyRejecter(err as Error);
      throw err;
    }
    // console.log("after init");
  }

  get logger() {
    return this.options.logger;
  }

  async open(): Promise<YamuxStream> {
    await this.ready;
    // console.log("open");
    if (this.closed) throw Errors.SessionShutdown;

    const id = this.nextStreamID;
    this.nextStreamID += 2;

    const stream = new YamuxStream(this, id);
    this.streams.set(id, stream);

    await stream.sendWindowUpdate();
    return stream;
  }

  protected async startReceiveLoop() {
    if (!this.reader) return;

    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value instanceof Uint8Array) {
          await this.handleData(value);
        }
      }
    } catch (err) {
      this.logger("Receive error:", err);
      await this.close();
    }
  }

  protected async handleData(chunk: Uint8Array) {
    this.buffer = concat([this.buffer, chunk]);

    while (Header.isComplete(this.buffer)) {
      const header = Header.decode(this.buffer);

      if (header.version !== 0) {
        throw Errors.InvalidVersion;
      }

      const total = HEADER_SIZE + header.length;
      if (this.buffer.length < total) break;

      const payload = this.buffer.subarray(HEADER_SIZE, total);
      await this.handleFrame(header, payload);
      this.buffer = this.buffer.subarray(total);
    }
  }

  protected async handleFrame(header: Header, payload: Uint8Array) {
    switch (header.type) {
      case Type.Data:
        await this.handleStreamData(header, payload);
        break;
      case Type.WindowUpdate:
        await this.handleWindowUpdate(header);
        break;
      case Type.Ping:
        await this.handlePing(header);
        break;
      case Type.GoAway:
        await this.handleGoAway(header);
        break;
      default:
        throw Errors.InvalidMsgType;
    }
  }

  protected async handleStreamData(header: Header, payload: Uint8Array) {
    let stream = this.streams.get(header.streamID);

    if (!stream && (header.flags & Flag.SYN)) {
      if (this.streams.size >= this.options.acceptBacklog) {
        await this.sendReset(header.streamID);
        return;
      }

      stream = new YamuxStream(this, header.streamID);
      this.streams.set(header.streamID, stream);
      this.onNewStream(stream);
    }

    if (!stream) {
      this.logger(`Ignoring data for unknown stream: ${header.streamID}`);
      return;
    }

    stream.processFlags(header.flags);
    if (payload.length > 0) {
      stream.pushData(payload);
    }
  }

  protected async handleWindowUpdate(header: Header) {
    const stream = this.streams.get(header.streamID);
    if (!stream || stream.state === StreamState.Closed) return;
    
    stream.processFlags(header.flags);
    stream.updateSendWindow(header.length);
  }

  protected async handlePing(header: Header) {
    this.logger(`Handling ping - flags: ${header.flags}, length: ${header.length}`);
    if (header.flags & Flag.SYN) {
      // Respond to server ping
      console.log("server ping")
      const response = new Header(0, Type.Ping, Flag.ACK, 0, header.length);
      try {
        await this.sendFrame(response);
      } catch (err) {
        this.logger("Failed to respond to ping:", err);
        await this.close();
      }
    } else if (header.flags & Flag.ACK) {
      // Handle ping response
      console.log("ping response")
      const pingID = header.length;
      const startTime = this.pings.get(pingID);
      if (startTime) {
        const rtt = Date.now() - startTime;
        this.logger(`Ping RTT: ${rtt}ms`);
        this.pings.delete(pingID);
      }
    }
  }

  protected async handleGoAway(header: Header) {
    await this.close();
  }

  async sendFrame(header: Header, payload?: Uint8Array): Promise<void> {
    // console.log("sendFrame", this.closed, !this.writer);
    if (this.closed || !this.writer) throw Errors.SessionShutdown;

    const data = payload ? concat([header.encode(), payload]) : header.encode();
    this.logger(`Sending frame: ${header.toString()}`);
    await this.writer.write(data);
    this.logger(`Sent frame: ${header.toString()}`);
  }

  protected async sendReset(streamID: number) {
    const header = new Header(0, Type.WindowUpdate, Flag.RST, streamID, 0);
    await this.sendFrame(header);
  }

  protected startKeepAlive() {
    this.pingInterval = setInterval(async () => {
      if (this.closed) return;
  
      // Clean up old pings and check for timeout
      const now = Date.now();
      let timedOutPings = 0;
      for (const [id, timestamp] of this.pings.entries()) {
        if (now - timestamp > this.pingTimeout) {
          this.pings.delete(id);
          timedOutPings++;
        }
      }
  
      // Close session if too many pings time out
      if (timedOutPings > 2) {
        this.logger("Multiple ping timeouts, closing session");
        await this.close();
        return;
      }
  
      // Send new ping...
    }, this.options.keepAliveInterval);
  }

  removeStream(id: number): void {
    this.streams.delete(id);
  }

  protected onNewStream(_stream: YamuxStream): void {
    // Implemented by YamuxServer
  }

  async close(): Promise<void> {
    if (this.closed) return;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Send GoAway first
    const header = new Header(0, Type.GoAway, Flag.FIN, 0, GoAwayCode.Normal);
    await this.sendFrame(header).catch((err) => {
      this.logger("GoAway Error", err)
    });

    // Close all streams
    for (const stream of this.streams.values()) {
      stream.close();
    }
    this.streams.clear();
    
    this.closed = true;

    // Properly close resources
    await this.writer?.close();
    await this.reader?.cancel();
    
    // Close WebSocket with proper code
    this.ws.close({
      code: 1000, // Normal closure
      reason: "Session closed"
    });
  }
}
