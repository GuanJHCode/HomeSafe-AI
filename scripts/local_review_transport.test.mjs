import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { checkLocalReviewTransport } from './local_review_transport.mjs';

test('review transport rejects origin switches and URL/path escapes before any secondary request', async () => {
  let secondary = 0;
  const other = http.createServer((_req,res) => { secondary++;res.end('must not request'); });
  await new Promise(done => other.listen(0,'127.0.0.1',done));
  let malicious;
  const server = http.createServer((_req,res) => {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({kind:'LOCAL_ASSET_REVIEW',license_status:'NOT_VERIFIED',
      publication_approved:false,formal_catalog_changed:false,models:[{},{}],
      files:[{path:malicious,bytes:16,sha256:'a'.repeat(64)}]}));
  });
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  try {
    const port=other.address().port;
    for(const path of [`http://127.0.0.1:${port}/outside.bin`,`//127.0.0.1:${port}/outside.bin`,
      '\\outside.bin','%2e%2e/outside.bin','x/../outside.bin','/outside.bin','x//outside.bin',
      'outside.bin#fragment','outside.bin?query','user:pass@127.0.0.1/outside.bin']){
      malicious=path;
      await assert.rejects(checkLocalReviewTransport(`http://127.0.0.1:${server.address().port}/preview/`),/relative path|application origin/);
    }
    assert.equal(secondary,0);
  } finally {
    await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>other.close(done))]);
  }
});
