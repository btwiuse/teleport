import { Flag, HEADER_SIZE, Type, VERSION } from "./types.ts";

export class Header {
  constructor(
    readonly version: number = VERSION,
    readonly type: Type,
    readonly flags: Flag,
    readonly streamID: number,
    readonly length: number,
  ) {}

  static decode(data: Uint8Array, offset = 0): Header {
    const view = new DataView(
      data.buffer,
      data.byteOffset + offset,
      data.byteLength - offset,
    );
    return new Header(
      view.getUint8(0),
      view.getUint8(1) as Type,
      view.getUint16(2) as Flag,
      view.getUint32(4),
      view.getUint32(8),
    );
  }

  encode(): Uint8Array {
    const buf = new Uint8Array(HEADER_SIZE);
    const view = new DataView(buf.buffer);
    view.setUint8(0, this.version);
    view.setUint8(1, this.type);
    view.setUint16(2, this.flags);
    view.setUint32(4, this.streamID);
    view.setUint32(8, this.length);
    return buf;
  }

  toString(): string {
    return `Header[version=${this.version}, type=${
      Type[this.type]
    }, flags=${this.flags}, streamID=${this.streamID}, length=${this.length}]`;
  }

  static isComplete(data: Uint8Array): boolean {
    return data.byteLength >= HEADER_SIZE;
  }

  static frameComplete(data: Uint8Array): boolean {
    if (!this.isComplete(data)) return false;
    const header = this.decode(data);
    return data.byteLength >= HEADER_SIZE + header.length;
  }
}
