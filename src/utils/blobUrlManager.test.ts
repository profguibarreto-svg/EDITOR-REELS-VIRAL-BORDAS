import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BlobUrlManager,
  makeOriginalUrlKey,
  makeOutputUrlKey,
} from './blobUrlManager';

test('BlobUrlManager reuses existing URL without calling createObjectURL twice', () => {
  let createCalls = 0;
  const revoked: string[] = [];
  const manager = new BlobUrlManager({
    maxIdleUrls: 2,
    createObjectURL: () => `blob:mock-${++createCalls}`,
    revokeObjectURL: (u) => revoked.push(u),
  });

  const fakeBlob = new Blob(['abc'], { type: 'video/mp4' });
  const key = makeOriginalUrlKey('v1');

  const url1 = manager.acquire(key, fakeBlob);
  const url2 = manager.acquire(key, fakeBlob);

  assert.equal(url1, 'blob:mock-1');
  assert.equal(url2, 'blob:mock-1');
  assert.equal(createCalls, 1);
  assert.equal(revoked.length, 0);
});

test('BlobUrlManager evicts oldest unpinned URLs beyond maxIdleUrls while preserving pinned URLs', () => {
  let createCalls = 0;
  const revoked: string[] = [];
  const manager = new BlobUrlManager({
    maxIdleUrls: 2,
    createObjectURL: () => `blob:mock-${++createCalls}`,
    revokeObjectURL: (u) => revoked.push(u),
  });

  const b = new Blob(['x'], { type: 'video/mp4' });
  const k1 = makeOriginalUrlKey('v1');
  const k2 = makeOriginalUrlKey('v2');
  const k3 = makeOriginalUrlKey('v3');
  const k4 = makeOriginalUrlKey('v4');
  const kOut1 = makeOutputUrlKey('v1');

  manager.acquire(k1, b);
  manager.acquire(k2, b);
  manager.acquire(k3, b);
  manager.acquire(k4, b);
  manager.acquire(kOut1, b);

  // Touch k1 so k2 and k3 are oldest
  manager.markUsed(k1);

  // Pin k4 -> remaining unpinned are [k2, k3, kOut1, k1]; oldest 2 (k2, k3) should be evicted
  const evicted = manager.evictUnpinned([k4]);

  assert.equal(evicted.length, 2);
  assert.deepEqual(
    evicted.map((e) => e.key),
    [k2, k3]
  );
  assert.equal(manager.has(k4), true);
  assert.equal(manager.has(k1), true);
  assert.equal(manager.has(kOut1), true);
  assert.equal(manager.has(k2), false);
  assert.equal(manager.has(k3), false);
  assert.equal(revoked.length, 2);
});

test('BlobUrlManager register and release manage explicit URL replacement cleanly', () => {
  const revoked: string[] = [];
  const manager = new BlobUrlManager({
    maxIdleUrls: 2,
    createObjectURL: () => 'blob:unused',
    revokeObjectURL: (u) => revoked.push(u),
  });

  const key = makeOriginalUrlKey('v99');
  manager.register(key, 'blob:first');
  manager.register(key, 'blob:first'); // same URL: should not revoke
  assert.equal(revoked.length, 0);

  manager.register(key, 'blob:second'); // replaced: should revoke first
  assert.deepEqual(revoked, ['blob:first']);

  assert.equal(manager.release(key), true);
  assert.deepEqual(revoked, ['blob:first', 'blob:second']);
  assert.equal(manager.size(), 0);
});
