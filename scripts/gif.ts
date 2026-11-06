// A small animated GIF encoder for the build scripts: frames of RGBA pixels with at most 256 colours in
// all (pixel art has few), looping forever. GIF uses LZW compression with growing code sizes.
import type { Canvas } from './png.ts';

/** LZW-compresses palette indices into GIF data sub-blocks. */
function lzw(indices: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let table = new Map<number, number>();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  const emit = (code: number) => {
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      bytes.push(buffer & 0xff);
      buffer >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const known = table.get(key);
    if (known !== undefined) {
      prefix = known;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) bytes.push(buffer & 0xff);
  // Data sub-blocks of at most 255 bytes, then a zero-length block.
  const out = [minCodeSize];
  for (let i = 0; i < bytes.length; i += 255) {
    const n = Math.min(255, bytes.length - i);
    out.push(n);
    for (let j = 0; j < n; j++) out.push(bytes[i + j]);
  }
  out.push(0);
  return out;
}

/** Encodes the frames (all the same size) as a looping GIF; `delay` is per frame, in milliseconds. */
export function encodeGif(frames: Canvas[], delay: number): Buffer {
  const { width, height } = frames[0];
  const colours = new Map<number, number>();
  const indexed = frames.map((f) => {
    const idx = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p++) {
      const rgb = (f.data[p * 4] << 16) | (f.data[p * 4 + 1] << 8) | f.data[p * 4 + 2];
      let i = colours.get(rgb);
      if (i === undefined) {
        i = colours.size;
        if (i >= 256) throw new Error('A GIF can only have 256 colours.');
        colours.set(rgb, i);
      }
      idx[p] = i;
    }
    return idx;
  });
  const depth = Math.max(1, Math.ceil(Math.log2(Math.max(2, colours.size))));
  const table = new Array(3 * (1 << depth)).fill(0);
  for (const [rgb, i] of colours) table.splice(i * 3, 3, (rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff);
  const le = (n: number) => [n & 0xff, (n >> 8) & 0xff];

  const out: number[] = [...Buffer.from('GIF89a'), ...le(width), ...le(height), 0x80 | ((depth - 1) << 4) | (depth - 1), 0, 0, ...table];
  // Loop forever.
  out.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0, 0, 0);
  for (const idx of indexed) {
    out.push(0x21, 0xf9, 0x04, 0x04, ...le(Math.round(delay / 10)), 0, 0);
    out.push(0x2c, 0, 0, 0, 0, ...le(width), ...le(height), 0);
    for (const b of lzw(idx, Math.max(2, depth))) out.push(b); // too many to spread
  }
  out.push(0x3b);
  return Buffer.from(out);
}
