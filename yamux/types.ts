export const VERSION = 0;
export const HEADER_SIZE = 12;
export const INITIAL_WINDOW = 256 * 1024;

export enum Type {
  Data = 0,
  WindowUpdate = 1,
  Ping = 2,
  GoAway = 3,
}

export enum Flag {
  NUL = 0,
  SYN = 1,
  ACK = 2,
  FIN = 4,
  RST = 8,
}

export enum StreamState {
  Init = 0,
  SynSent = 1,
  SynReceived = 2,
  Established = 3,
  Closed = 4,
}

export enum GoAwayCode {
  Normal = 0,
  ProtocolError = 1,
  InternalError = 2,
}

export interface YamuxOptions {
  acceptBacklog?: number;
  enableKeepAlive?: boolean;
  keepAliveInterval?: number;
  maxStreamWindow?: number;
  logger?: (msg: string, ...args: unknown[]) => void;
}

export const DEFAULT_OPTIONS: Required<YamuxOptions> = {
  acceptBacklog: 256,
  enableKeepAlive: true,
  keepAliveInterval: 30000,
  maxStreamWindow: INITIAL_WINDOW,
  logger: console.log,
};

export const Errors = {
  InvalidVersion: new Error("invalid protocol version"),
  InvalidMsgType: new Error("invalid msg type"),
  SessionShutdown: new Error("session shutdown"),
  DuplicateStream: new Error("duplicate stream initiated"),
  RecvWindowExceeded: new Error("receive window exceeded"),
  Timeout: new Error("i/o timeout"),
  StreamClosed: new Error("stream closed"),
  UnexpectedFlag: new Error("unexpected flag"),
  RemoteGoAway: new Error("remote end is not accepting connections"),
  ConnectionReset: new Error("connection reset"),
  WriteTimeout: new Error("write timeout"),
  KeepaliveTimeout: new Error("keepalive timeout"),
} as const;
