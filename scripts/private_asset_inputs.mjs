import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Intake envelope check only. GLTFLoader and real browser checks follow separately.
export function inspectGlb(raw) {
  if (raw.length < 20 || raw.length > 50_000_000 || raw.readUInt32LE(0) !== 0x46546c67 || raw.readUInt32LE(4) !== 2) {
    throw new Error('Expected GLB v2 within the 50 MB project limit');
  }
  if (raw.readUInt32LE(8) !== raw.length) throw new Error('GLB length mismatch');
  let document;
  for (let offset = 12; offset < raw.length;) {
    if (offset + 8 > raw.length) throw new Error('Truncated GLB chunk');
    const length = raw.readUInt32LE(offset), type = raw.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > raw.length) throw new Error('Invalid GLB chunk length');
    if (offset === 12) {
      if (type !== 0x4e4f534a) throw new Error('First GLB chunk must be JSON');
      document = JSON.parse(raw.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    }
    offset += length + 8;
  }
  if (document?.asset?.version !== '2.0') throw new Error('Expected glTF 2.0');
  if ([...(document.buffers ?? []), ...(document.images ?? [])].some(item => item.uri !== undefined)) {
    throw new Error('Private intake requires self-contained embedded buffers and images');
  }
  if (document.extensionsRequired?.length) throw new Error('Required extension needs separate review');
  return { bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
}

export async function privateOutputPath(root, requested) {
  const path = resolve(root, requested);
  if (!path.startsWith(resolve(root, 'evidence/private') + sep)) {
    throw new Error('Output must be a new directory under evidence/private/');
  }
  for (let current = path;; current = dirname(current)) {
    const info = await lstat(current).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (info?.isSymbolicLink()) throw new Error('Output symlink forbidden');
    if (current === path && info) throw new Error('Output already exists; use a new run directory');
    if (dirname(current) === current) break;
  }
  return path;
}

export function isLoopbackRequest(host, origin, port) {
  return host === `127.0.0.1:${port}` && (!origin || origin === `http://${host}`);
}
