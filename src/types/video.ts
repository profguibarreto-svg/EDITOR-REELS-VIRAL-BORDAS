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
  framePositionY: number; // percentage 0 to 100 (default 10)
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

export interface VideoQueueItem {
  id: string;
  file: File;
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
  crop?: Partial<VideoCropSettings>;
  customHeadline?: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  outputBlob: Blob | null;
  outputUrl: string | null;
  errorMessage: string | null;
  outputSizeMb?: number;
}
