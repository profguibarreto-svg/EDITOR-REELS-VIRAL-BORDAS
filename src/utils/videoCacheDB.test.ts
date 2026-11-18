import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeBlobKey,
  serializeQueueItem,
  deserializeQueueRecord,
  computeCacheStatsFromBlobs,
  formatBytesCompact,
} from './videoCacheDB';
import { DEFAULT_PROJECT_SETTINGS, cloneVideoSettings } from './projectSettings';
import { VideoQueueItem } from '../types/video';

function createMockQueueItem(overrides: Partial<VideoQueueItem> = {}): VideoQueueItem {
  const settings = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);
  return {
    id: 'vid_test_1',
    file: new Blob(['orig-bytes'], { type: 'video/mp4' }) as unknown as File,
    fileSize: 1024 * 512,
    url: 'blob:http://localhost/orig-1',
    name: 'corte_teste.mp4',
    duration: 12.5,
    width: 1080,
    height: 1920,
    thumbnailUrl: 'data:image/jpeg;base64,abc',
    trim: { startTime: 1, endTime: 10 },
    settings,
    customHeadline: 'Título exclusivo',
    status: 'done',
    progress: 100,
    statusText: 'Concluído (MP4 HD)',
    outputBlob: new Blob(['out-bytes'], { type: 'video/mp4' }),
    outputUrl: 'blob:http://localhost/out-1',
    outputMimeType: 'video/mp4',
    outputExtension: 'mp4',
    outputSizeMb: 4.2,
    errorMessage: null,
    originalCached: true,
    outputCached: true,
    ...overrides,
  };
}

test('makeBlobKey formats original and output keys deterministically', () => {
  assert.equal(makeBlobKey('abc', 'original'), 'orig:abc');
  assert.equal(makeBlobKey('abc', 'output'), 'out:abc');
});

test('serializeQueueItem and deserializeQueueRecord preserve settings, trim, and output status without leaking Blob objects', () => {
  const item = createMockQueueItem();
  item.settings.frameStyle = 'neon';
  item.settings.exportSettings.resolution = '720p';

  const record = serializeQueueItem(item, 2);
  assert.equal(record.id, 'vid_test_1');
  assert.equal(record.order, 2);
  assert.equal(record.hasOriginalBlob, true);
  assert.equal(record.hasOutputBlob, true);
  assert.equal(record.outputExtension, 'mp4');
  assert.equal(record.settings.frameStyle, 'neon');

  const restored = deserializeQueueRecord(record, {
    hasOriginalInDb: true,
    hasOutputInDb: true,
  });

  assert.equal(restored.file, null);
  assert.equal(restored.url, '');
  assert.equal(restored.outputBlob, null);
  assert.equal(restored.outputUrl, null);
  assert.equal(restored.originalCached, true);
  assert.equal(restored.outputCached, true);
  assert.equal(restored.status, 'done');
  assert.equal(restored.customHeadline, 'Título exclusivo');
  assert.equal(restored.settings.frameStyle, 'neon');
  assert.equal(restored.settings.exportSettings.resolution, '720p');
  assert.deepEqual(restored.trim, { startTime: 1, endTime: 10 });
});

test('deserializeQueueRecord resets interrupted processing status back to idle and clears done if output blob missing', () => {
  const processingItem = createMockQueueItem({ status: 'processing', progress: 55 });
  const recProc = serializeQueueItem(processingItem, 0);
  const restoredProc = deserializeQueueRecord(recProc, {
    hasOriginalInDb: true,
    hasOutputInDb: false,
  });
  assert.equal(restoredProc.status, 'idle');
  assert.equal(restoredProc.progress, 0);

  const doneNoBlob = createMockQueueItem({ status: 'done', outputBlob: null, outputCached: false });
  const recDone = serializeQueueItem(doneNoBlob, 1);
  const restoredNoBlob = deserializeQueueRecord(recDone, {
    hasOriginalInDb: true,
    hasOutputInDb: false,
  });
  assert.equal(restoredNoBlob.status, 'idle');
  assert.equal(restoredNoBlob.outputCached, false);
});

test('computeCacheStatsFromBlobs and formatBytesCompact summarize cache footprint accurately', () => {
  const stats = computeCacheStatsFromBlobs([
    { size: 512 * 1024 },
    { size: 1536 * 1024 },
    { size: 0 },
  ]);
  assert.equal(stats.blobCount, 3);
  assert.equal(stats.totalBytes, 2048 * 1024);
  assert.equal(formatBytesCompact(stats.totalBytes), '2.0 MB');
  assert.equal(formatBytesCompact(500 * 1024), '500 KB');
});
