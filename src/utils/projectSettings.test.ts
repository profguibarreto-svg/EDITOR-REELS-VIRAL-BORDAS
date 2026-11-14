import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROJECT_SETTINGS,
  cloneVideoSettings,
  resolveVideoSettings,
  getModifiedSections,
  collectReferencedBlobUrls,
} from './projectSettings';
import { VideoQueueItem } from '../types/video';

function makeMockItem(overrides: Partial<VideoQueueItem> = {}): VideoQueueItem {
  return {
    id: 'vid_1',
    file: { name: 'clip1.mp4' } as File,
    url: 'blob:http://localhost:3000/clip1',
    name: 'clip1.mp4',
    duration: 15,
    width: 1080,
    height: 1920,
    thumbnailUrl: '',
    trim: { startTime: 0, endTime: 15 },
    settings: cloneVideoSettings(DEFAULT_PROJECT_SETTINGS),
    status: 'idle',
    progress: 0,
    outputBlob: null,
    outputUrl: null,
    errorMessage: null,
    ...overrides,
  };
}

test('cloneVideoSettings produces completely independent nested objects', () => {
  const copy1 = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);
  const copy2 = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);

  copy1.brand.headline = 'VIDEO 1 EXCLUSIVE';
  copy1.crop.cropTop = 22;
  copy1.effects.brightness = 1.3;
  copy1.audio.bgmTrackId = 'none';
  copy1.exportSettings.resolution = '720p';

  assert.notEqual(copy2.brand.headline, 'VIDEO 1 EXCLUSIVE');
  assert.equal(copy2.crop.cropTop, 0);
  assert.equal(copy2.effects.brightness, 1);
  assert.equal(copy2.audio.bgmTrackId, 'lofi');
  assert.equal(copy2.exportSettings.resolution, '1080p');
});

test('resolveVideoSettings prioritizes individual video settings and customHeadline over global defaults', () => {
  const global = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);
  global.brand.headline = 'GLOBAL HEADLINE';
  global.exportSettings.resolution = '1080p';

  const item = makeMockItem({
    customHeadline: 'CUSTOM LINE HEADLINE',
    settings: {
      ...cloneVideoSettings(DEFAULT_PROJECT_SETTINGS),
      frameEnabled: false,
      frameStyle: 'neon',
      exportSettings: {
        ...DEFAULT_PROJECT_SETTINGS.exportSettings,
        resolution: '720p',
        aspectRatio: '1:1',
        fps: 60,
      },
    },
  });

  const resolved = resolveVideoSettings(item, global);
  assert.equal(resolved.frameEnabled, false);
  assert.equal(resolved.frameStyle, 'neon');
  assert.equal(resolved.brand.headline, 'CUSTOM LINE HEADLINE');
  assert.equal(resolved.exportSettings.resolution, '720p');
  assert.equal(resolved.exportSettings.aspectRatio, '1:1');
  assert.equal(resolved.exportSettings.fps, 60);
});

test('getModifiedSections accurately identifies which categories changed per video', () => {
  const item = makeMockItem();
  assert.deepEqual(getModifiedSections(item, DEFAULT_PROJECT_SETTINGS), []);

  item.settings.effects.brightness = 1.25;
  item.settings.audio.bgmVolume = 0;
  item.trim.startTime = 2.0;

  const mods = getModifiedSections(item, DEFAULT_PROJECT_SETTINGS);
  assert.ok(mods.includes('Corte & Bordas'));
  assert.ok(mods.includes('Efeitos Visuais'));
  assert.ok(mods.includes('Áudio'));
  assert.equal(mods.includes('Moldura & Marca'), false);
  assert.equal(mods.includes('Exportação'), false);
});

test('collectReferencedBlobUrls tracks all active blob URLs across global and queue items', () => {
  const global = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);
  global.brand.avatarUrl = 'blob:http://localhost:3000/avatar1';

  const item1 = makeMockItem({
    url: 'blob:http://localhost:3000/vid1',
    outputUrl: 'blob:http://localhost:3000/out1',
  });
  item1.settings.audio.customAudioUrl = 'blob:http://localhost:3000/bgm1';

  const refs = collectReferencedBlobUrls([item1], global);
  assert.ok(refs.has('blob:http://localhost:3000/avatar1'));
  assert.ok(refs.has('blob:http://localhost:3000/vid1'));
  assert.ok(refs.has('blob:http://localhost:3000/out1'));
  assert.ok(refs.has('blob:http://localhost:3000/bgm1'));
  assert.equal(refs.size, 4);
});
