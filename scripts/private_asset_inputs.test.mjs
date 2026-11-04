import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectGlb, privateOutputPath, isLoopbackRequest } from './private_asset_inputs.mjs';

function fixture(changes = {}) {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, ...changes }));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(padded);
  const buffer = Buffer.alloc(20 + padded.length);
  [0x46546c67, 2, buffer.length, padded.length, 0x4e4f534a].forEach((v, i) => buffer.writeUInt32LE(v, i * 4));
  padded.copy(buffer, 20);
  return buffer;
}

test('private intake rejects corrupt headers and external resources', () => {
  assert.equal(inspectGlb(fixture()).bytes, fixture().length);
  const broken = fixture(); broken.writeUInt32LE(1, 8);
  assert.throws(() => inspectGlb(broken), /length/);
  assert.throws(() => inspectGlb(fixture({ images: [{ uri: 'https://example.com/private.png' }] })), /self-contained/);
  assert.throws(() => inspectGlb(fixture({ buffers: [{ uri: 'file:///etc/passwd' }] })), /self-contained/);
  assert.throws(() => inspectGlb(fixture({ extensionsRequired: ['UNKNOWN'] })), /extension/);
});

test('private output cannot enter public trees, overwrite files, or follow symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'homesafe-private-test-'));
  try {
    assert.equal(await privateOutputPath(root, 'evidence/private/run-1'), join(root, 'evidence/private/run-1'));
    await assert.rejects(privateOutputPath(root, 'assets/public/run'), /private/);
    await assert.rejects(privateOutputPath(root, 'evidence/private/../../public'), /private/);
    await mkdir(join(root, 'evidence/private'), { recursive: true });
    await mkdir(join(root, 'evidence/private/exists'));
    await assert.rejects(privateOutputPath(root, 'evidence/private/exists'), /exists/);
    await symlink(tmpdir(), join(root, 'evidence/private/link'));
    await assert.rejects(privateOutputPath(root, 'evidence/private/link/new'), /symlink/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('local server rejects foreign hosts and origins', () => {
  assert.equal(isLoopbackRequest('127.0.0.1:1234', undefined, 1234), true);
  assert.equal(isLoopbackRequest('127.0.0.1:1234', 'http://127.0.0.1:1234', 1234), true);
  assert.equal(isLoopbackRequest('attacker.test:1234', undefined, 1234), false);
  assert.equal(isLoopbackRequest('127.0.0.1:1234', 'https://attacker.test', 1234), false);
});
