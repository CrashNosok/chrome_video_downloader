// Verifies the chunked range-assembly loop reconstructs the full byte count,
// including a final partial chunk. Run: node test_telegram.js
const assert = require('assert');
const { fetchRanges } = require('./telegram.js');

const TOTAL = 2_621_440; // 2.5 MiB
const CHUNK = 1_048_576; // SW serves ~1 MiB per 206

function mockFetch(_url, opts) {
  const start = +opts.headers.Range.match(/bytes=(\d+)-/)[1];
  const end = Math.min(start + CHUNK, TOTAL); // exclusive
  const len = end - start;
  return Promise.resolve({
    headers: { get: h => (h === 'content-range' ? `bytes ${start}-${end - 1}/${TOTAL}` : null) },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(len)),
  });
}

(async () => {
  const chunks = await fetchRanges('x', mockFetch);
  const got = chunks.reduce((s, c) => s + c.byteLength, 0);
  assert.strictEqual(got, TOTAL, `assembled ${got} != ${TOTAL}`);
  assert.strictEqual(chunks.length, 3, `expected 3 chunks, got ${chunks.length}`);
  console.log('ok: assembled', chunks.length, 'chunks =', got, 'bytes');
})();
