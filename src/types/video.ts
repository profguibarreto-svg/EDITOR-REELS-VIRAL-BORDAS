export type FrameStyle =
  | 'post'
  | 'neon'
  | 'noticia'
  | 'gradiente'
  | 'meme'
  | 'podcast'
  | 'minimal'
  | 'custom'
  | 'none';

export type ResolutionOption = '720p' | '1080p' | '1440p';
export type AspectRatioOption = '9:16' | '1:1' | '16:9';

export interface ProfileBrand {
  pageName: string;
  handle: string;
  avatarUrl: string | null;
  headline: string;
  badgeType: 'blue' | 'gold' | 'none';
  accentColor: string;
  customFrameUrl: string | null;
  // Advanced typography, element sizing & positioning
  fontSizeHeadline: number; // multiplier 0.6 to 1.8 (default 1.0)
  fontSizeName: number; // multiplier 0.6 to 1.8 (default 1.0)
  avatarScale: number; // multiplier 0.6 to 1.8 (default 1.0)
  framePositionY: number; // percentage 0 to 100 (default 2.5)
  framePositionX: number; // percentage 0 to 100 (default 50)
  frameScale: number; // multiplier 0.7 to 1.3 (default 1.0)
  textAlign: 'left' | 'center' | 'right';
  cardBgColor: string; // custom background color for card/frame
  textColor: string; // custom headline/title color
}

export interface VisualEffects {
  brightness: number; // 0.5 to 1.5
  contrast: number; // 0.5 to 1.5
  saturation: number; // 0 to 2
  blurBackground: number; // 0 to 40
  vignette: boolean;
  sharpen: boolean;
}

export interface AudioSettings {
  originalVolume: number; // 0 to 2
  bgmVolume: number; // 0 to 1
  bgmTrackId: string;
  customAudioUrl: string | null;
  customAudioName: string | null;
}

export interface VideoCropSettings {
  cropTop: number; // 0 - 50 %
  cropBottom: number; // 0 - 50 %
  cropLeft: number; // 0 - 50 %
  cropRight: number; // 0 - 50 %
  scale: number; // 0.5 to 2.0
  positionY: number; // 0 to 100 % (50 is center)
  positionX: number; // 0 to 100 % (50 is center)
  fitMode: 'contain-blur' | 'contain-solid' | 'cover';
  backdropColor: string;
}

export interface ExportSettings {
  resolution: ResolutionOption;
  aspectRatio: AspectRatioOption;
  fps: number;
  bitrateMbps: number;
  stripMetadata: boolean;
  speed: number;
}

export interface VideoProjectSettings {
  frameEnabled: boolean;
  frameStyle: FrameStyle;
  brand: ProfileBrand;
  crop: VideoCropSettings;
  effects: VisualEffects;
  audio: AudioSettings;
  exportSettings: ExportSettings;
}

export interface VideoQueueItem {
  id: string;
  /** Original File reference in memory (released to null once cached safely in IndexedDB) */
  file: File | null;
  fileSize?: number;
  url: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  trim: {
    startTime: number;
    endTime: number;
  };
  /** Independent per-video project configuration (Level 2) */
  settings: VideoProjectSettings;
  /** Quick per-video headline override (synced with settings.brand.headline) */
  customHeadline?: string;
  /** Legacy compatibility alias if needed */
  crop?: Partial<VideoCropSettings>;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  statusText?: string;
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputMimeType?: string;
  outputExtension?: 'mp4' | 'webm';
  errorMessage: string | null;
  outputSizeMb?: number;
  /** True when the original video Blob is persisted in IndexedDB */
  originalCached?: boolean;
  /** True when the processed output MP4 Blob is persisted in IndexedDB */
  outputCached?: boolean;
}
