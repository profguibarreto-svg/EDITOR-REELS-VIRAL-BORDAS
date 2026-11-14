import {
  VideoProjectSettings,
  VideoQueueItem,
  ProfileBrand,
  VideoCropSettings,
  VisualEffects,
  AudioSettings,
  ExportSettings,
} from '../types/video';

export const DEFAULT_BRAND: ProfileBrand = {
  pageName: 'Cortes da Fofoca',
  handle: '@cortesvirais',
  avatarUrl: null,
  headline: 'VEJA O QUE ELE FALOU NO FINAL 😱',
  badgeType: 'blue',
  accentColor: '#00f0ff',
  customFrameUrl: null,
  fontSizeHeadline: 1.0,
  fontSizeName: 1.0,
  avatarScale: 1.0,
  framePositionY: 2.5,
  framePositionX: 50,
  frameScale: 1.0,
  textAlign: 'left',
  cardBgColor: 'rgba(12, 18, 38, 0.94)',
  textColor: '#ffffff',
};

export const DEFAULT_CROP: VideoCropSettings = {
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
  scale: 1.0,
  positionY: 50,
  positionX: 50,
  fitMode: 'contain-blur',
  backdropColor: '#0a0d18',
};

export const DEFAULT_EFFECTS: VisualEffects = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blurBackground: 25,
  vignette: false,
  sharpen: false,
};

export const DEFAULT_AUDIO: AudioSettings = {
  originalVolume: 1.0,
  bgmVolume: 0.25,
  bgmTrackId: 'lofi',
  customAudioUrl: null,
  customAudioName: null,
};

export const DEFAULT_EXPORT: ExportSettings = {
  resolution: '1080p',
  aspectRatio: '9:16',
  fps: 30,
  bitrateMbps: 8,
  stripMetadata: true,
  speed: 1.0,
};

export const DEFAULT_PROJECT_SETTINGS: VideoProjectSettings = {
  frameEnabled: true,
  frameStyle: 'post',
  brand: DEFAULT_BRAND,
  crop: DEFAULT_CROP,
  effects: DEFAULT_EFFECTS,
  audio: DEFAULT_AUDIO,
  exportSettings: DEFAULT_EXPORT,
};

/**
 * Creates a completely independent deep clone of VideoProjectSettings.
 * Ensures modifying one video never mutates global settings or another video.
 */
export function cloneVideoSettings(source: VideoProjectSettings): VideoProjectSettings {
  return {
    frameEnabled: source.frameEnabled,
    frameStyle: source.frameStyle,
    brand: { ...source.brand },
    crop: { ...source.crop },
    effects: { ...source.effects },
    audio: { ...source.audio },
    exportSettings: { ...source.exportSettings },
  };
}

/**
 * Centralized settings resolver (Level 2 individual settings always take precedence over Level 1 global defaults).
 * Returns a safe, complete, immutable VideoProjectSettings object.
 */
export function resolveVideoSettings(
  item: VideoQueueItem | null | undefined,
  globalSettings: VideoProjectSettings
): VideoProjectSettings {
  const base = cloneVideoSettings(globalSettings);
  if (!item || !item.settings) {
    return base;
  }

  const ind = item.settings;
  const resolvedHeadline =
    item.customHeadline !== undefined && item.customHeadline !== ''
      ? item.customHeadline
      : ind.brand?.headline ?? base.brand.headline;

  return {
    frameEnabled: ind.frameEnabled !== undefined ? ind.frameEnabled : base.frameEnabled,
    frameStyle: ind.frameStyle || base.frameStyle,
    brand: {
      ...base.brand,
      ...(ind.brand || {}),
      headline: resolvedHeadline,
    },
    crop: {
      ...base.crop,
      ...(ind.crop || {}),
      ...(item.crop || {}),
    },
    effects: {
      ...base.effects,
      ...(ind.effects || {}),
    },
    audio: {
      ...base.audio,
      ...(ind.audio || {}),
    },
    exportSettings: {
      ...base.exportSettings,
      ...(ind.exportSettings || {}),
    },
  };
}

function shallowEqualObj(a: object, b: object): boolean {
  const keysA = Object.keys(a) as Array<keyof typeof a>;
  const keysB = Object.keys(b) as Array<keyof typeof b>;
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Returns a list of section names that differ from the global template, plus trim status.
 */
export function getModifiedSections(
  item: VideoQueueItem,
  globalSettings: VideoProjectSettings
): string[] {
  const modified: string[] = [];
  const s = item.settings;
  if (!s) return modified;

  const customHeadlineDiff =
    item.customHeadline !== undefined &&
    item.customHeadline.trim() !== '' &&
    item.customHeadline !== globalSettings.brand.headline;

  if (
    s.frameEnabled !== globalSettings.frameEnabled ||
    s.frameStyle !== globalSettings.frameStyle ||
    !shallowEqualObj(s.brand, globalSettings.brand) ||
    customHeadlineDiff
  ) {
    modified.push('Moldura & Marca');
  }

  const trimModified =
    item.duration > 0 &&
    (item.trim.startTime > 0.05 || Math.abs(item.trim.endTime - item.duration) > 0.05);

  if (trimModified || !shallowEqualObj(s.crop, globalSettings.crop)) {
    modified.push('Corte & Bordas');
  }

  if (!shallowEqualObj(s.effects, globalSettings.effects)) {
    modified.push('Efeitos Visuais');
  }

  if (!shallowEqualObj(s.audio, globalSettings.audio)) {
    modified.push('Áudio');
  }

  if (!shallowEqualObj(s.exportSettings, globalSettings.exportSettings)) {
    modified.push('Exportação');
  }

  return modified;
}

/**
 * Collects all blob: URLs currently referenced across global settings and queue items
 * so we only revoke a blob URL when zero references remain.
 */
export function collectReferencedBlobUrls(
  queue: VideoQueueItem[],
  globalSettings: VideoProjectSettings
): Set<string> {
  const urls = new Set<string>();
  const addIfBlob = (u: string | null | undefined) => {
    if (u && u.startsWith('blob:')) urls.add(u);
  };

  addIfBlob(globalSettings.brand.avatarUrl);
  addIfBlob(globalSettings.brand.customFrameUrl);
  addIfBlob(globalSettings.audio.customAudioUrl);

  for (const item of queue) {
    addIfBlob(item.url);
    addIfBlob(item.outputUrl);
    if (item.settings) {
      addIfBlob(item.settings.brand.avatarUrl);
      addIfBlob(item.settings.brand.customFrameUrl);
      addIfBlob(item.settings.audio.customAudioUrl);
    }
  }
  return urls;
}
