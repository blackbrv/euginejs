/**
 * A minimal ZIP writer producing "stored" (uncompressed) entries only.
 * Per the ZIP spec this is a fully valid archive any zip tool can open —
 * it just skips deflate compression, which keeps this dependency-free
 * instead of pulling in a zip library for the playground's export button.
 */

interface PreparedEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A fixed DOS date/time stamp — this is a generated export, not a tracked
// file, so a real "last modified" timestamp isn't meaningful here.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;

  writeUint16(value: number): void {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setUint16(0, value, true);
    this.push(buf);
  }

  writeUint32(value: number): void {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value, true);
    this.push(buf);
  }

  writeBytes(bytes: Uint8Array): void {
    this.push(bytes);
  }

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  get size(): number {
    return this.length;
  }

  toBlob(type: string): Blob {
    return new Blob(this.chunks as BlobPart[], { type });
  }
}

export interface ZipFile {
  name: string;
  content: string;
}

/** Builds a minimal, valid, uncompressed ZIP archive as a downloadable Blob. */
export function createZip(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const entries: PreparedEntry[] = files.map((f) => ({ name: f.name, data: encoder.encode(f.content) }));

  const writer = new ByteWriter();
  const central: { entry: PreparedEntry; crc: number; offset: number }[] = [];

  for (const entry of entries) {
    const offset = writer.size;
    const crc = crc32(entry.data);
    const nameBytes = encoder.encode(entry.name);

    writer.writeUint32(0x04034b50); // local file header signature
    writer.writeUint16(20); // version needed
    writer.writeUint16(0); // flags
    writer.writeUint16(0); // compression: stored
    writer.writeUint16(DOS_TIME);
    writer.writeUint16(DOS_DATE);
    writer.writeUint32(crc);
    writer.writeUint32(entry.data.length); // compressed size == raw size (stored)
    writer.writeUint32(entry.data.length);
    writer.writeUint16(nameBytes.length);
    writer.writeUint16(0); // extra field length
    writer.writeBytes(nameBytes);
    writer.writeBytes(entry.data);

    central.push({ entry, crc, offset });
  }

  const centralDirStart = writer.size;
  for (const { entry, crc, offset } of central) {
    const nameBytes = encoder.encode(entry.name);
    writer.writeUint32(0x02014b50); // central directory file header signature
    writer.writeUint16(20); // version made by
    writer.writeUint16(20); // version needed
    writer.writeUint16(0); // flags
    writer.writeUint16(0); // compression: stored
    writer.writeUint16(DOS_TIME);
    writer.writeUint16(DOS_DATE);
    writer.writeUint32(crc);
    writer.writeUint32(entry.data.length);
    writer.writeUint32(entry.data.length);
    writer.writeUint16(nameBytes.length);
    writer.writeUint16(0); // extra field length
    writer.writeUint16(0); // comment length
    writer.writeUint16(0); // disk number start
    writer.writeUint16(0); // internal file attributes
    writer.writeUint32(0); // external file attributes
    writer.writeUint32(offset); // relative offset of local header
    writer.writeBytes(nameBytes);
  }
  const centralDirSize = writer.size - centralDirStart;

  writer.writeUint32(0x06054b50); // end of central directory signature
  writer.writeUint16(0); // this disk number
  writer.writeUint16(0); // disk with central directory start
  writer.writeUint16(central.length); // records on this disk
  writer.writeUint16(central.length); // total records
  writer.writeUint32(centralDirSize);
  writer.writeUint32(centralDirStart);
  writer.writeUint16(0); // comment length

  return writer.toBlob("application/zip");
}

/** Triggers a browser download of `blob` as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
