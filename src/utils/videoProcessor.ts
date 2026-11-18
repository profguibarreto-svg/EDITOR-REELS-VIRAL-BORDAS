import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  VideoProjectSettings,
  VideoQueueItem,
} from '../types/video';
import {
  buildFilterString,
  buildCachedFrameOverlayCanvas,
  renderCompositeFrame,
} from './frameRenderer';
import { generateSyntheticTrackBuffer } from './audioTracks';

export interface ProcessorProgressCallback {
  (progress: number, statusText: string): void;
}

export interface DetectedExportFormat {
  mimeType: string;
  extension: 'mp4' | 'webm';
  label: string;
  browserSupportsMp4: boolean;
}

export interface ProcessedVideoResult {
  outputBlob: Blob;
  outputUrl: string;
  mimeType: string;
  extension: 'mp4' | 'webm';
  formatLabel: string;
}

function hasWebCodecsSupport(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  );
}

/**
 * Inspects real MP4 export capabilities (WebCodecs + mp4-muxer or native MediaRecorder MP4).
 * Always prioritizes real MP4 output across Windows, Linux, Android and iOS Safari.
 */
export function getSupportedMimeType(withAudio = true): DetectedExportFormat {
  if (hasWebCodecsSupport()) {
    return {
      mimeType: 'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
      extension: 'mp4',
      label: 'MP4 HD',
      browserSupportsMp4: true,
    };
  }

  if (typeof MediaRecorder === 'undefined') {
    return {
      mimeType: 'video/mp4',
      extension: 'mp4',
      label: 'MP4 HD',
      browserSupportsMp4: false,
    };
  }

  const mp4Candidates = withAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=vp9,opus',
        'video/mp4;codecs=av01.0.04M.08,opus',
        'video/mp4',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4d401f',
        'video/mp4;codecs=h264',
        'video/mp4;codecs=vp9',
        'video/mp4',
      ];

  for (const mime of mp4Candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return {
          mimeType: mime,
          extension: 'mp4',
          label: 'MP4 HD',
          browserSupportsMp4: true,
        };
      }
    } catch {
      // continue checking
    }
  }

  const webmCandidates = withAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];

  for (const mime of webmCandidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return {
          mimeType: mime,
          extension: 'webm',
          label: 'WebM HD',
          browserSupportsMp4: false,
        };
      }
    } catch {
      // continue
    }
  }

  return {
    mimeType: 'video/mp4',
    extension: 'mp4',
    label: 'MP4 HD',
    browserSupportsMp4: false,
  };
}

/**
 * Injects or updates exact duration in WebM EBML header (only used if a legacy browser falls back to WebM)
 */
export async function fixWebmDuration(blob: Blob, durationSec: number): Promise<Blob> {
  if (!blob || blob.size === 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    return blob;
  }
  try {
    const buffer = await blob.arrayBuffer();
    const u8 = new Uint8Array(buffer);

    let infoPos = -1;
    for (let i = 0; i < Math.min(u8.length - 4, 4096); i++) {
      if (u8[i] === 0x15 && u8[i + 1] === 0x49 && u8[i + 2] === 0xa9 && u8[i + 3] === 0x66) {
        infoPos = i;
        break;
      }
    }
    if (infoPos === -1) return blob;

    const durationMs = durationSec * 1000;
    let durPos = -1;
    for (let i = infoPos + 4; i < Math.min(u8.length - 2, infoPos + 300); i++) {
      if (u8[i] === 0x44 && u8[i + 1] === 0x89) {
        durPos = i;
        break;
      }
    }

    if (durPos !== -1) {
      const lenByte = u8[durPos + 2];
      const durLen = lenByte & 0x7f;
      if ((durLen === 4 || durLen === 8) && durPos + 3 + durLen <= buffer.byteLength) {
        const dataView = new DataView(buffer, durPos + 3, durLen);
        if (durLen === 4) dataView.setFloat32(0, durationMs);
        else dataView.setFloat64(0, durationMs);
        return new Blob([buffer], { type: blob.type });
      }
    }

    const durBytes = new Uint8Array(11);
    durBytes[0] = 0x44;
    durBytes[1] = 0x89;
    durBytes[2] = 0x88;
    new DataView(durBytes.buffer, 3, 8).setFloat64(0, durationMs);

    const lenByte = u8[infoPos + 4];
    let headerLen = 5;
    let oldInfoDataLen = lenByte & 0x7f;
    if ((lenByte & 0x80) === 0 && (lenByte & 0x40) !== 0) {
      headerLen = 6;
      oldInfoDataLen = ((lenByte & 0x3f) << 8) | u8[infoPos + 5];
    }

    const newInfoDataLen = oldInfoDataLen + 11;
    if (newInfoDataLen > 0x3fff) return blob;

    const newBuffer = new Uint8Array(u8.length + 11);
    const insertPos = infoPos + headerLen;
    newBuffer.set(u8.subarray(0, insertPos), 0);

    if (headerLen === 5 && newInfoDataLen < 0x7f) {
      newBuffer[infoPos + 4] = 0x80 | newInfoDataLen;
    } else if (headerLen === 6) {
      newBuffer[infoPos + 4] = 0x40 | (newInfoDataLen >> 8);
      newBuffer[infoPos + 5] = newInfoDataLen & 0xff;
    } else {
      return blob;
    }

    newBuffer.set(durBytes, insertPos);
    newBuffer.set(u8.subarray(insertPos), insertPos + 11);

    return new Blob([newBuffer.buffer], { type: blob.type });
  } catch {
    return blob;
  }
}

/**
 * Calculates canvas dimensions based on resolution and aspect ratio (always even for H.264/MP4)
 */
export function getExportResolution(
  resolution: '720p' | '1080p' | '1440p',
  aspectRatio: '9:16' | '1:1' | '16:9'
): { width: number; height: number } {
  if (aspectRatio === '9:16') {
    switch (resolution) {
      case '1440p':
        return { width: 1440, height: 2560 };
      case '720p':
        return { width: 720, height: 1280 };
      case '1080p':
      default:
        return { width: 1080, height: 1920 };
    }
  } else if (aspectRatio === '1:1') {
    switch (resolution) {
      case '1440p':
        return { width: 1440, height: 1440 };
      case '720p':
        return { width: 720, height: 720 };
      case '1080p':
      default:
        return { width: 1080, height: 1080 };
    }
  } else {
    switch (resolution) {
      case '1440p':
        return { width: 2560, height: 1440 };
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
      default:
        return { width: 1920, height: 1080 };
    }
  }
}

/**
 * Safely extracts video metadata & thumbnail with strict validation and cleanup.
 */
export async function probeVideoMetadata(url: string): Promise<{
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}> {
  const tempVideo = document.createElement('video');
  tempVideo.crossOrigin = 'anonymous';
  tempVideo.preload = 'metadata';
  tempVideo.muted = true;
  tempVideo.playsInline = true;

  const dispose = () => {
    tempVideo.onloadedmetadata = null;
    tempVideo.onseeked = null;
    tempVideo.onerror = null;
    try {
      tempVideo.pause();
      tempVideo.removeAttribute('src');
      tempVideo.load();
    } catch {
      // ignore
    }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Tempo limite ao ler metadados do vídeo.'));
      }, 12000);

      tempVideo.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      tempVideo.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Arquivo inválido, corrompido ou codec não suportado pelo navegador.'));
      };
      tempVideo.src = url;
    });

    const duration = tempVideo.duration;
    const width = tempVideo.videoWidth;
    const height = tempVideo.videoHeight;

    if (!Number.isFinite(duration) || duration <= 0.05 || width <= 0 || height <= 0) {
      throw new Error('O arquivo não contém uma faixa de vídeo válida (dimensões ou duração inválidas).');
    }

    const targetThumbTime = Math.min(1, Math.max(0.05, duration * 0.1));
    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };
      const t = setTimeout(done, 1500);
      tempVideo.onseeked = () => {
        clearTimeout(t);
        done();
      };
      try {
        tempVideo.currentTime = targetThumbTime;
      } catch {
        clearTimeout(t);
        done();
      }
    });

    let thumbnailUrl = '';
    try {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 120;
      thumbCanvas.height = Math.max(60, Math.round((120 / width) * height));
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(tempVideo, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
      }
    } catch {
      // thumbnail optional if video frame is unavailable
    }

    return { duration, width, height, thumbnailUrl };
  } finally {
    dispose();
  }
}

function loadOptionalImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeoutId = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(null);
    };
    img.src = src;
  });
}

function hasNativeMediaRecorderMp4(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  const candidates = [
    'video/mp4;codecs=avc1.42002a,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42002a',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
  ];
  return candidates.some((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
}

async function selectWebCodecsVideoConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number
): Promise<{
  encoderConfig: VideoEncoderConfig;
  muxerCodec: 'avc' | 'vp9' | 'av1';
  isHardwareAccelerated: boolean;
} | null> {
  if (!hasWebCodecsSupport()) return null;

  const candidates: Array<{ codec: string; muxerCodec: 'avc' | 'vp9' | 'av1' }> = [
    // H.264 profiles ordered from high-res capable levels down to 3.1
    { codec: 'avc1.640033', muxerCodec: 'avc' },
    { codec: 'avc1.4d0032', muxerCodec: 'avc' },
    { codec: 'avc1.4d002a', muxerCodec: 'avc' },
    { codec: 'avc1.4d0028', muxerCodec: 'avc' },
    { codec: 'avc1.420028', muxerCodec: 'avc' },
    { codec: 'avc1.4d001f', muxerCodec: 'avc' },
    { codec: 'avc1.42001f', muxerCodec: 'avc' },
    { codec: 'avc1.42E01E', muxerCodec: 'avc' },
    // MP4-compatible fallback codecs
    { codec: 'vp09.00.41.08', muxerCodec: 'vp9' },
    { codec: 'vp09.00.10.08', muxerCodec: 'vp9' },
    { codec: 'av01.0.08M.08', muxerCodec: 'av1' },
    { codec: 'av01.0.04M.08', muxerCodec: 'av1' },
  ];

  // Probe hardware-accelerated encoders first (100-300fps on Windows/Mac/Android/iOS)
  for (const hwMode of ['prefer-hardware', 'no-preference'] as const) {
    for (const cand of candidates) {
      const config: VideoEncoderConfig = {
        codec: cand.codec,
        width,
        height,
        bitrate,
        framerate,
        latencyMode: 'realtime',
        hardwareAcceleration: hwMode,
        ...(cand.muxerCodec === 'avc' ? { avc: { format: 'avc' as const } } : {}),
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          const resolvedConfig: VideoEncoderConfig = {
            ...(support.config || config),
            latencyMode: 'realtime',
            hardwareAcceleration: hwMode,
            ...(cand.muxerCodec === 'avc' ? { avc: { format: 'avc' as const } } : {}),
          };
          return {
            encoderConfig: resolvedConfig,
            muxerCodec: cand.muxerCodec,
            isHardwareAccelerated: hwMode === 'prefer-hardware',
          };
        }
      } catch {
        // try next candidate
      }
    }
  }

  return null;
}

async function selectWebCodecsAudioConfig(): Promise<{
  encoderConfig: AudioEncoderConfig;
  muxerCodec: 'aac' | 'opus';
} | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return null;
  }

  const candidates: Array<{ codec: string; muxerCodec: 'aac' | 'opus' }> = [
    { codec: 'mp4a.40.2', muxerCodec: 'aac' },
    { codec: 'opus', muxerCodec: 'opus' },
  ];

  for (const cand of candidates) {
    const config: AudioEncoderConfig = {
      codec: cand.codec,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    };
    try {
      const support = await AudioEncoder.isConfigSupported(config);
      if (support.supported) {
        return {
          encoderConfig: support.config || config,
          muxerCodec: cand.muxerCodec,
        };
      }
    } catch {
      // try next
    }
  }

  return null;
}

async function loadAndValidateVideoElement(
  url: string,
  signal?: AbortSignal
): Promise<HTMLVideoElement> {
  const videoEl = document.createElement('video');
  videoEl.crossOrigin = 'anonymous';
  videoEl.playsInline = true;
  videoEl.muted = true;
  videoEl.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const metaTimeout = setTimeout(() => {
      reject(new Error('Tempo limite excedido ao abrir o vídeo. O arquivo pode estar corrompido.'));
    }, 15000);

    const onAbort = () => {
      clearTimeout(metaTimeout);
      reject(new Error('Processamento cancelado pelo usuário'));
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    videoEl.onloadedmetadata = () => {
      clearTimeout(metaTimeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    };
    videoEl.onerror = () => {
      clearTimeout(metaTimeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Erro ao abrir o arquivo de vídeo. Formato incompatível ou arquivo corrompido.'));
    };

    videoEl.src = url;
  });

  // Prime decoder (especially important on iOS Safari so first frame is available at readyState >= 2)
  if (videoEl.readyState < 2) {
    await new Promise<void>((resolveReady) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        videoEl.onloadeddata = null;
        videoEl.oncanplay = null;
        resolveReady();
      };
      const t = setTimeout(finish, 2000);
      videoEl.onloadeddata = finish;
      videoEl.oncanplay = finish;
      videoEl.play().then(() => videoEl.pause()).catch(() => {});
    });
  }

  return videoEl;
}

function disposeVideoElement(videoEl: HTMLVideoElement | null) {
  if (!videoEl) return;
  try {
    videoEl.onloadedmetadata = null;
    videoEl.onloadeddata = null;
    videoEl.oncanplay = null;
    videoEl.onseeked = null;
    videoEl.onerror = null;
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
  } catch {
    // ignore
  }
}

async function seekVideoDeterministically(
  videoEl: HTMLVideoElement,
  targetTime: number
): Promise<void> {
  if (Math.abs(videoEl.currentTime - targetTime) <= 0.004 && videoEl.readyState >= 2) {
    return;
  }

  await new Promise<void>((resolveSeek) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      videoEl.onseeked = null;
      resolveSeek();
    };

    const timeoutId = setTimeout(finish, 1500);
    videoEl.onseeked = finish;
    try {
      videoEl.currentTime = targetTime;
    } catch {
      finish();
    }
  });
}

async function buildOfflineMixedAudioBuffer(
  item: VideoQueueItem,
  settings: VideoProjectSettings,
  startTime: number,
  clipDuration: number,
  effectiveOutputDuration: number
): Promise<AudioBuffer | null> {
  const { audio, exportSettings } = settings;
  const speed = Math.max(0.25, Math.min(4.0, exportSettings.speed || 1.0));
  const wantsOriginalAudio = audio.originalVolume > 0;
  const wantsBgm =
    audio.bgmVolume > 0 &&
    (Boolean(audio.customAudioUrl) || (audio.bgmTrackId && audio.bgmTrackId !== 'none'));

  if (!wantsOriginalAudio && !wantsBgm) {
    return null;
  }

  const OfflineCtxClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!OfflineCtxClass) {
    return null;
  }

  const sampleRate = 48000;
  const totalFrames = Math.max(1, Math.ceil(effectiveOutputDuration * sampleRate));
  const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);
  let hasAnySource = false;

  if (wantsOriginalAudio) {
    try {
      const sourceBytes = item.file
        ? await item.file.arrayBuffer()
        : await (await fetch(item.url)).arrayBuffer();
      const decodedOriginal = await offlineCtx.decodeAudioData(sourceBytes.slice(0));
      if (decodedOriginal && decodedOriginal.length > 0) {
        const srcNode = offlineCtx.createBufferSource();
        srcNode.buffer = decodedOriginal;
        srcNode.playbackRate.value = speed;
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = audio.originalVolume;
        srcNode.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        const safeStart = Math.max(0, Math.min(decodedOriginal.duration - 0.02, startTime));
        const sourceAvailableSec = Math.max(
          0.05,
          Math.min(clipDuration, decodedOriginal.duration - safeStart)
        );
        const outputPlayDur = Math.max(
          0.05,
          Math.min(effectiveOutputDuration, sourceAvailableSec / speed)
        );
        srcNode.start(0, safeStart, outputPlayDur);
        hasAnySource = true;
      }
    } catch {
      // Source video has no audio track or uses an audio codec browser cannot decode via WebAudio
    }
  }

  if (wantsBgm) {
    let bgmBuffer: AudioBuffer | null = null;
    if (audio.customAudioUrl) {
      try {
        const res = await fetch(audio.customAudioUrl);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          bgmBuffer = await offlineCtx.decodeAudioData(arr);
        }
      } catch {
        // ignore custom audio decode error
      }
    } else if (audio.bgmTrackId !== 'none') {
      try {
        bgmBuffer = await generateSyntheticTrackBuffer(
          offlineCtx as unknown as AudioContext,
          audio.bgmTrackId,
          Math.min(30, effectiveOutputDuration + 2)
        );
      } catch {
        // ignore synth track error
      }
    }

    if (bgmBuffer) {
      const bgmNode = offlineCtx.createBufferSource();
      bgmNode.buffer = bgmBuffer;
      bgmNode.loop = true;
      const bgmGain = offlineCtx.createGain();
      bgmGain.gain.value = audio.bgmVolume;
      bgmNode.connect(bgmGain);
      bgmGain.connect(offlineCtx.destination);
      bgmNode.start(0, 0, effectiveOutputDuration);
      hasAnySource = true;
    }
  }

  if (!hasAnySource) {
    return null;
  }

  return await offlineCtx.startRendering();
}

/**
 * Primary Deterministic CFR MP4 Export Engine (WebCodecs + mp4-muxer + OfflineAudioContext).
 * Guarantees constant frame rate, zero stutter/freezing, and instant fast-start MP4 playback.
 */
async function encodeMp4WithWebCodecs(params: {
  item: VideoQueueItem;
  settings: VideoProjectSettings;
  videoEl: HTMLVideoElement;
  videoDur: number;
  startTime: number;
  endTime: number;
  clipDuration: number;
  speed: number;
  effectiveOutputDuration: number;
  targetW: number;
  targetH: number;
  avatarImg: HTMLImageElement | null;
  customFrameImg: HTMLImageElement | null;
  onProgress: ProcessorProgressCallback;
  signal?: AbortSignal;
  preselectedCodec?: {
    encoderConfig: VideoEncoderConfig;
    muxerCodec: 'avc' | 'vp9' | 'av1';
    isHardwareAccelerated: boolean;
  };
}): Promise<ProcessedVideoResult> {
  const {
    item,
    settings,
    videoEl,
    videoDur,
    startTime,
    endTime,
    clipDuration,
    speed,
    effectiveOutputDuration,
    targetW,
    targetH,
    avatarImg,
    customFrameImg,
    onProgress,
    signal,
    preselectedCodec,
  } = params;

  const { frameEnabled, frameStyle, brand, crop, effects, exportSettings } = settings;
  const targetFps = exportSettings.fps || 30;
  const evenW = targetW & ~1;
  const evenH = targetH & ~1;
  const bps = (exportSettings.bitrateMbps || 8) * 1_000_000;

  const videoCodecSelection =
    preselectedCodec || (await selectWebCodecsVideoConfig(evenW, evenH, bps, targetFps));
  if (!videoCodecSelection) {
    throw new Error('WEBCODECS_UNAVAILABLE');
  }

  onProgress(18, 'Mixando faixa de áudio em alta precisão...');
  const mixedAudioBuffer = await buildOfflineMixedAudioBuffer(
    item,
    settings,
    startTime,
    clipDuration,
    effectiveOutputDuration
  );

  let audioCodecSelection: Awaited<ReturnType<typeof selectWebCodecsAudioConfig>> = null;
  if (mixedAudioBuffer) {
    audioCodecSelection = await selectWebCodecsAudioConfig();
  }

  if (signal?.aborted) {
    throw new Error('Processamento cancelado pelo usuário');
  }

  const canvas = document.createElement('canvas');
  canvas.width = evenW;
  canvas.height = evenH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Falha ao inicializar contexto Canvas 2D');
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: videoCodecSelection.muxerCodec,
      width: evenW,
      height: evenH,
      frameRate: targetFps,
    },
    ...(mixedAudioBuffer && audioCodecSelection
      ? {
          audio: {
            codec: audioCodecSelection.muxerCodec,
            numberOfChannels: 2,
            sampleRate: mixedAudioBuffer.sampleRate,
          },
        }
      : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error('Erro no codificador de vídeo MP4');
    },
  });
  videoEncoder.configure(videoCodecSelection.encoderConfig);

  let audioEncoder: AudioEncoder | null = null;
  if (mixedAudioBuffer && audioCodecSelection) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: (err) => {
        encoderError = err instanceof Error ? err : new Error('Erro no codificador de áudio MP4');
      },
    });
    audioEncoder.configure(audioCodecSelection.encoderConfig);
  }

  try {
    // Encode full mixed audio deterministically first
    if (audioEncoder && mixedAudioBuffer) {
      onProgress(24, 'Codificando áudio MP4...');
      const sampleRate = mixedAudioBuffer.sampleRate;
      const ch0 = mixedAudioBuffer.getChannelData(0);
      const ch1 =
        mixedAudioBuffer.numberOfChannels > 1 ? mixedAudioBuffer.getChannelData(1) : ch0;
      const totalSamples = mixedAudioBuffer.length;
      const chunkSamples = 1024;

      for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
        if (signal?.aborted) throw new Error('Processamento cancelado pelo usuário');
        if (encoderError) throw encoderError;

        const frames = Math.min(chunkSamples, totalSamples - offset);
        const planar = new Float32Array(frames * 2);
        planar.set(ch0.subarray(offset, offset + frames), 0);
        planar.set(ch1.subarray(offset, offset + frames), frames);

        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: frames,
          numberOfChannels: 2,
          timestamp: Math.round((offset / sampleRate) * 1_000_000),
          data: planar,
        });
        audioEncoder.encode(audioData);
        audioData.close();

        if (audioEncoder.encodeQueueSize > 16) {
          await new Promise<void>((r) => setTimeout(r, 4));
        }
      }

      await audioEncoder.flush();
    }

    // Encode video frames at exact constant frame rate (CFR) using sequential playback (no per-frame seeking!)
    const totalFrames = Math.max(2, Math.round(effectiveOutputDuration * targetFps));
    const frameDurationUs = Math.round(1_000_000 / targetFps);
    const keyframeInterval = Math.max(targetFps, targetFps * 2);
    const filterStr = buildFilterString(effects);
    const cachedOverlayCanvas = buildCachedFrameOverlayCanvas({
      width: evenW,
      height: evenH,
      frameEnabled,
      frameStyle,
      brand,
      avatarImg,
      customFrameImg,
      customHeadline: item.customHeadline,
    });

    await seekVideoDeterministically(videoEl, Math.max(0, Math.min(videoDur - 0.03, startTime)));
    videoEl.muted = true;
    videoEl.loop = false;
    // Play slightly faster when hardware-accelerated so sequential decode never bottlenecks
    const decodePlaybackRate = Math.max(
      0.25,
      Math.min(4.0, videoCodecSelection.isHardwareAccelerated ? speed * 1.5 : speed)
    );
    videoEl.playbackRate = decodePlaybackRate;
    await videoEl.play().catch(() => {});

    let lastProgressReport = 0;

    try {
      for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        if (signal?.aborted) {
          throw new Error('Processamento cancelado pelo usuário');
        }
        if (encoderError) {
          throw encoderError;
        }

        const outputTimeSec = frameIdx / targetFps;
        const desiredSourceTime = Math.min(endTime, startTime + outputTimeSec * speed);
        const safeTargetTime = Math.max(0, Math.min(videoDur - 0.03, desiredSourceTime));

        // Let sequential playback advance smoothly to safeTargetTime without decoder-flushing seeks
        if (videoEl.currentTime < safeTargetTime - 0.015 && !videoEl.ended) {
          if (videoEl.paused) {
            await videoEl.play().catch(() => {});
          }
          const waitStart = performance.now();
          while (
            videoEl.currentTime < safeTargetTime - 0.015 &&
            !videoEl.ended &&
            !signal?.aborted &&
            performance.now() - waitStart < 450
          ) {
            await new Promise<void>((r) => setTimeout(r, 8));
          }
          // Recovery seek only if decoder genuinely stalled far behind
          if (videoEl.currentTime < safeTargetTime - 0.25 && !videoEl.ended) {
            await seekVideoDeterministically(videoEl, safeTargetTime);
          }
        } else if (videoEl.currentTime > safeTargetTime + 0.08 && !videoEl.paused) {
          // Pause momentarily if playback outpaced encoding so frames aren't skipped
          videoEl.pause();
        }

        renderCompositeFrame({
          ctx,
          width: evenW,
          height: evenH,
          videoEl,
          frameEnabled,
          frameStyle,
          brand,
          crop,
          effects,
          avatarImg,
          customFrameImg,
          currentTime: outputTimeSec,
          customHeadline: item.customHeadline,
          filterStr,
          cachedOverlayCanvas,
        });

        const vf = new VideoFrame(canvas, {
          timestamp: frameIdx * frameDurationUs,
          duration: frameDurationUs,
        });
        videoEncoder.encode(vf, { keyFrame: frameIdx % keyframeInterval === 0 });
        vf.close();

        while (videoEncoder.encodeQueueSize > 10) {
          await new Promise<void>((r) => setTimeout(r, 6));
        }

        const now = performance.now();
        if (now - lastProgressReport >= 140 || frameIdx === totalFrames - 1) {
          lastProgressReport = now;
          const pct = Math.min(93, 28 + Math.round(((frameIdx + 1) / totalFrames) * 65));
          onProgress(
            pct,
            `Gerando MP4 HD (${exportSettings.resolution}): quadro ${frameIdx + 1}/${totalFrames} (${pct}%)`
          );
        }

        if (frameIdx % 4 === 3) {
          await new Promise<void>((r) => setTimeout(r, 0));
        }
      }
    } finally {
      try {
        videoEl.pause();
      } catch {}
    }

    onProgress(95, 'Finalizando índice e cabeçalho MP4 (Fast-Start)...');
    await videoEncoder.flush();
    if (encoderError) throw encoderError;

    muxer.finalize();
    const { buffer } = muxer.target;
    const finalBlob = new Blob([buffer], { type: 'video/mp4' });

    if (finalBlob.size < 100) {
      throw new Error('O arquivo MP4 gerado ficou vazio.');
    }

    const finalUrl = URL.createObjectURL(finalBlob);
    return {
      outputBlob: finalBlob,
      outputUrl: finalUrl,
      mimeType: 'video/mp4',
      extension: 'mp4',
      formatLabel: 'MP4 HD',
    };
  } finally {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {}
    try {
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {}
  }
}

/**
 * Fallback Engine using MediaRecorder (strictly prefers video/mp4 when browser lacks WebCodecs)
 */
async function encodeWithMediaRecorderFallback(params: {
  item: VideoQueueItem;
  settings: VideoProjectSettings;
  videoEl: HTMLVideoElement;
  startTime: number;
  endTime: number;
  clipDuration: number;
  speed: number;
  effectiveOutputDuration: number;
  targetW: number;
  targetH: number;
  avatarImg: HTMLImageElement | null;
  customFrameImg: HTMLImageElement | null;
  onProgress: ProcessorProgressCallback;
  signal?: AbortSignal;
}): Promise<ProcessedVideoResult> {
  const {
    item,
    settings,
    videoEl,
    startTime,
    endTime,
    clipDuration,
    speed,
    effectiveOutputDuration,
    targetW,
    targetH,
    avatarImg,
    customFrameImg,
    onProgress,
    signal,
  } = params;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Seu navegador não suporta codificação de vídeo (WebCodecs e MediaRecorder indisponíveis).');
  }

  let cleanupRun = false;
  let animFrameId: number | null = null;
  let backgroundIntervalId: ReturnType<typeof setInterval> | null = null;
  let hardTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let audioCtx: AudioContext | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let canvasStream: MediaStream | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let videoAudioSource: MediaElementAudioSourceNode | null = null;
  let bgmSource: AudioBufferSourceNode | null = null;
  let silentOsc: OscillatorNode | null = null;
  let abortListener: (() => void) | null = null;

  const cleanup = () => {
    if (cleanupRun) return;
    cleanupRun = true;

    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    if (backgroundIntervalId !== null) clearInterval(backgroundIntervalId);
    if (hardTimeoutId !== null) clearTimeout(hardTimeoutId);
    if (pendingStopTimeoutId !== null) clearTimeout(pendingStopTimeoutId);
    if (abortListener && signal) signal.removeEventListener('abort', abortListener);

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onerror = null;
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
      } catch {}
    }

    canvasStream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });

    if (dest) {
      try {
        dest.stream.getTracks().forEach((t) => t.stop());
        dest.disconnect();
      } catch {}
    }
    if (bgmSource) {
      try {
        bgmSource.stop();
        bgmSource.disconnect();
      } catch {}
    }
    if (silentOsc) {
      try {
        silentOsc.stop();
        silentOsc.disconnect();
      } catch {}
    }
    if (videoAudioSource) {
      try {
        videoAudioSource.disconnect();
      } catch {}
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
    if (canvas && canvas.parentNode) {
      try {
        canvas.parentNode.removeChild(canvas);
      } catch {}
    }
  };

  try {
    const { frameEnabled, frameStyle, brand, crop, effects, audio, exportSettings } = settings;

    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.position = 'fixed';
    canvas.style.top = '0px';
    canvas.style.left = '0px';
    canvas.style.width = '2px';
    canvas.style.height = '2px';
    canvas.style.opacity = '0.001';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '-1';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Falha ao inicializar contexto Canvas 2D');

    ctx.fillStyle = crop.backdropColor || '#0a0d18';
    ctx.fillRect(0, 0, targetW, targetH);

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let hasAudioTrack = false;
    const wantsOriginalAudio = audio.originalVolume > 0;
    const wantsBgm =
      audio.bgmVolume > 0 &&
      (Boolean(audio.customAudioUrl) || (audio.bgmTrackId && audio.bgmTrackId !== 'none'));

    if (AudioContextClass && (wantsOriginalAudio || wantsBgm)) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        await Promise.race([
          audioCtx.resume().catch(() => {}),
          new Promise<void>((r) => setTimeout(r, 400)),
        ]);
      }

      if (audioCtx.state === 'running') {
        dest = audioCtx.createMediaStreamDestination();
        silentOsc = audioCtx.createOscillator();
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        silentOsc.connect(silentGain);
        silentGain.connect(dest);
        silentOsc.start();
        hasAudioTrack = true;

        if (wantsOriginalAudio) {
          try {
            videoAudioSource = audioCtx.createMediaElementSource(videoEl);
            const originalGain = audioCtx.createGain();
            originalGain.gain.value = audio.originalVolume;
            videoAudioSource.connect(originalGain);
            originalGain.connect(dest);
          } catch {}
        }

        if (wantsBgm) {
          let bgmBuffer: AudioBuffer | null = null;
          if (audio.customAudioUrl) {
            try {
              const audioFetch = await fetch(audio.customAudioUrl);
              if (audioFetch.ok) {
                bgmBuffer = await audioCtx.decodeAudioData(await audioFetch.arrayBuffer());
              }
            } catch {}
          } else if (audio.bgmTrackId !== 'none') {
            try {
              bgmBuffer = await generateSyntheticTrackBuffer(
                audioCtx,
                audio.bgmTrackId,
                Math.min(30, effectiveOutputDuration + 2)
              );
            } catch {}
          }
          if (bgmBuffer) {
            bgmSource = audioCtx.createBufferSource();
            bgmSource.buffer = bgmBuffer;
            bgmSource.loop = true;
            const bgmGain = audioCtx.createGain();
            bgmGain.gain.value = audio.bgmVolume;
            bgmSource.connect(bgmGain);
            bgmGain.connect(dest);
          }
        }
      } else {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    }

    const mp4Prefs = hasAudioTrack
      ? [
          'video/mp4;codecs=avc1.42002a,mp4a.40.2',
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
          'video/mp4;codecs=avc1.42002a,opus',
          'video/mp4;codecs=avc1.42E01E,opus',
          'video/mp4',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ]
      : [
          'video/mp4;codecs=avc1.42002a',
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4;codecs=avc1.4d401f',
          'video/mp4',
          'video/webm;codecs=vp8',
          'video/webm',
        ];

    const chosenMime =
      mp4Prefs.find((m) => {
        try {
          return MediaRecorder.isTypeSupported(m);
        } catch {
          return false;
        }
      }) || 'video/mp4';

    const targetFps = exportSettings.fps || 30;
    // Use manual requestFrame() (captureStream(0)) when supported to eliminate warmup duration bloat
    canvasStream = canvas.captureStream(0);
    let capturedVideoTrack = canvasStream.getVideoTracks()[0] as
      | (MediaStreamTrack & { requestFrame?: () => void })
      | undefined;
    if (!capturedVideoTrack || typeof capturedVideoTrack.requestFrame !== 'function') {
      canvasStream.getTracks().forEach((t) => t.stop());
      canvasStream = canvas.captureStream(targetFps);
      capturedVideoTrack = canvasStream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
    }

    if (dest && hasAudioTrack) {
      const audioTracks = dest.stream.getAudioTracks();
      if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);
    }

    const bps = (exportSettings.bitrateMbps || 8) * 1_000_000;
    const chunks: Blob[] = [];
    let totalBytesRecorded = 0;
    let recorderActuallyStarted = false;
    let resolveRecorderStarted: (() => void) | null = null;

    try {
      mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: MediaRecorder.isTypeSupported(chosenMime) ? chosenMime : undefined,
        videoBitsPerSecond: bps,
      });
    } catch {
      mediaRecorder = new MediaRecorder(canvasStream);
    }

    const actualMime = mediaRecorder.mimeType || chosenMime;
    const actualExt: 'mp4' | 'webm' = actualMime.includes('webm') ? 'webm' : 'mp4';
    const actualLabel = actualExt === 'mp4' ? 'MP4 HD' : 'WebM HD';

    const recorderStartedPromise = new Promise<void>((r) => {
      resolveRecorderStarted = r;
    });

    const recorderFinishedPromise = new Promise<ProcessedVideoResult>((resolveRec, rejectRec) => {
      if (!mediaRecorder) return rejectRec(new Error('MediaRecorder não inicializado'));

      mediaRecorder.onstart = () => {
        recorderActuallyStarted = true;
        resolveRecorderStarted?.();
        resolveRecorderStarted = null;
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          totalBytesRecorded += e.data.size;
        }
      };

      mediaRecorder.onerror = (e) => {
        resolveRecorderStarted?.();
        resolveRecorderStarted = null;
        const msg = (e as unknown as { error?: { message?: string } })?.error?.message;
        rejectRec(new Error(`Erro durante a gravação (${actualLabel}): ${msg || 'falha de codificação'}`));
      };

      mediaRecorder.onstop = async () => {
        resolveRecorderStarted?.();
        resolveRecorderStarted = null;
        try {
          if (signal?.aborted) return rejectRec(new Error('Processamento cancelado pelo usuário'));
          const rawBlob = new Blob(chunks, { type: actualMime });
          chunks.length = 0;

          if (rawBlob.size < 100) {
            return rejectRec(new Error('O arquivo gerado ficou vazio.'));
          }

          let finalBlob = rawBlob;
          if (actualExt === 'webm') {
            finalBlob = await fixWebmDuration(rawBlob, effectiveOutputDuration);
          }

          const finalUrl = URL.createObjectURL(finalBlob);
          resolveRec({
            outputBlob: finalBlob,
            outputUrl: finalUrl,
            mimeType: finalBlob.type || actualMime,
            extension: actualExt,
            formatLabel: actualLabel,
          });
        } catch (err) {
          rejectRec(err instanceof Error ? err : new Error('Erro ao finalizar vídeo'));
        }
      };

      abortListener = () => {
        resolveRecorderStarted?.();
        resolveRecorderStarted = null;
        rejectRec(new Error('Processamento cancelado pelo usuário'));
      };
      if (signal) signal.addEventListener('abort', abortListener, { once: true });
    });

    await seekVideoDeterministically(videoEl, startTime);
    videoEl.playbackRate = speed;
    if ('preservesPitch' in videoEl) {
      (videoEl as unknown as { preservesPitch: boolean }).preservesPitch = true;
    }
    videoEl.loop = false;

    const filterStr = buildFilterString(effects);
    const cachedOverlayCanvas = buildCachedFrameOverlayCanvas({
      width: targetW,
      height: targetH,
      frameEnabled,
      frameStyle,
      brand,
      avatarImg,
      customFrameImg,
      customHeadline: item.customHeadline,
    });

    const drawInitialFrame = () => {
      if (!ctx) return;
      renderCompositeFrame({
        ctx,
        width: targetW,
        height: targetH,
        videoEl,
        frameEnabled,
        frameStyle,
        brand,
        crop,
        effects,
        avatarImg,
        customFrameImg,
        currentTime: 0,
        customHeadline: item.customHeadline,
        filterStr,
        cachedOverlayCanvas,
      });
      capturedVideoTrack?.requestFrame?.();
    };

    drawInitialFrame();
    mediaRecorder.start(200);
    capturedVideoTrack?.requestFrame?.();

    await Promise.race([recorderStartedPromise, new Promise<void>((r) => setTimeout(r, 1500))]);

    const recordingStartedAt = performance.now();
    if (bgmSource) bgmSource.start(0);

    try {
      videoEl.muted = !wantsOriginalAudio;
      await videoEl.play();
    } catch {
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
    }

    const stopRecorderSafely = (graceful = true) => {
      if (hardTimeoutId !== null) clearTimeout(hardTimeoutId);
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      if (backgroundIntervalId !== null) clearInterval(backgroundIntervalId);
      if (pendingStopTimeoutId !== null) clearTimeout(pendingStopTimeoutId);

      if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
      if (graceful) {
        capturedVideoTrack?.requestFrame?.();
        try {
          mediaRecorder.requestData();
        } catch {}
        pendingStopTimeoutId = setTimeout(() => {
          pendingStopTimeoutId = null;
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
              mediaRecorder.stop();
            } catch {}
          }
        }, 100);
      } else {
        try {
          mediaRecorder.stop();
        } catch {}
      }
    };

    const maxProcessingMs = Math.max(30000, effectiveOutputDuration * 4 * 1000);
    hardTimeoutId = setTimeout(() => stopRecorderSafely(false), maxProcessingMs);

    let isDrawing = false;
    let hasStopped = false;
    let drawnFrames = 1;
    const minWallRecordMs = Math.max(200, Math.min(400, Math.round(effectiveOutputDuration * 250)));

    const drawFrame = () => {
      if (cleanupRun || hasStopped || signal?.aborted || isDrawing || !ctx) return;
      isDrawing = true;
      try {
        const curr = videoEl.currentTime;
        const elapsed = Math.max(0, curr - startTime);
        const wallElapsedMs = performance.now() - recordingStartedAt;
        const pct = Math.min(94, 30 + Math.round((elapsed / clipDuration) * 64));
        onProgress(pct, `Renderizando ${actualLabel}: ${elapsed.toFixed(1)}s / ${clipDuration.toFixed(1)}s (${pct}%)`);

        renderCompositeFrame({
          ctx,
          width: targetW,
          height: targetH,
          videoEl,
          frameEnabled,
          frameStyle,
          brand,
          crop,
          effects,
          avatarImg,
          customFrameImg,
          currentTime: elapsed,
          customHeadline: item.customHeadline,
          filterStr,
          cachedOverlayCanvas,
        });
        drawnFrames += 1;
        capturedVideoTrack?.requestFrame?.();

        const reachedVideoEnd =
          curr >= endTime - 0.04 || videoEl.ended || elapsed >= clipDuration - 0.04;
        const encoderReadyToStop =
          recorderActuallyStarted ||
          wallElapsedMs >= Math.max(800, effectiveOutputDuration * 1000);
        const enoughFramesOrTime =
          (drawnFrames >= 8 && wallElapsedMs >= minWallRecordMs && encoderReadyToStop) ||
          wallElapsedMs >= effectiveOutputDuration * 1000 + 1500;

        if (reachedVideoEnd && enoughFramesOrTime) {
          hasStopped = true;
          stopRecorderSafely(true);
        }
      } finally {
        isDrawing = false;
      }
    };

    const targetIntervalMs = 1000 / targetFps;
    let lastRenderTimestamp = 0;

    const onAnimFrame = (timestamp: number) => {
      if (cleanupRun || hasStopped) return;
      if (timestamp - lastRenderTimestamp >= targetIntervalMs - 4) {
        lastRenderTimestamp = timestamp;
        drawFrame();
      }
      if (!cleanupRun && !hasStopped) {
        animFrameId = requestAnimationFrame(onAnimFrame);
      }
    };
    animFrameId = requestAnimationFrame(onAnimFrame);

    backgroundIntervalId = setInterval(() => {
      if (cleanupRun || hasStopped) {
        if (backgroundIntervalId !== null) clearInterval(backgroundIntervalId);
        return;
      }
      const now = performance.now();
      if (now - lastRenderTimestamp >= Math.max(40, targetIntervalMs * 1.3)) {
        lastRenderTimestamp = now;
        drawFrame();
      }
    }, Math.max(20, Math.round(targetIntervalMs)));

    const result = await recorderFinishedPromise;
    cleanup();
    return result;
  } catch (err) {
    cleanup();
    throw err instanceof Error ? err : new Error('Erro inesperado no processamento do vídeo');
  }
}

/**
 * Processes a single video sequentially using strictly its own resolved VideoProjectSettings.
 * Uses deterministic CFR MP4 encoding (WebCodecs + mp4-muxer) so videos always export in MP4 and never stutter.
 */
export async function processVideoItem(
  item: VideoQueueItem,
  settings: VideoProjectSettings,
  onProgress: ProcessorProgressCallback,
  signal?: AbortSignal
): Promise<ProcessedVideoResult> {
  if (!item || !item.url) {
    throw new Error('Arquivo de vídeo inválido ou ausente.');
  }

  let videoEl: HTMLVideoElement | null = null;

  try {
    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    onProgress(5, 'Validando vídeo e preparando codificador MP4...');
    videoEl = await loadAndValidateVideoElement(item.url, signal);

    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    const videoDur = videoEl.duration;
    if (
      !Number.isFinite(videoDur) ||
      videoDur < 0.05 ||
      videoEl.videoWidth <= 0 ||
      videoEl.videoHeight <= 0
    ) {
      throw new Error('Vídeo sem metadados válidos ou dimensões de quadro inválidas (0×0).');
    }

    const { frameEnabled, frameStyle, brand, exportSettings } = settings;
    const startTime = Math.max(0, Math.min(item.trim.startTime, videoDur - 0.1));
    const endTime = Math.min(
      item.trim.endTime > startTime ? item.trim.endTime : videoDur,
      videoDur
    );
    const clipDuration = Math.max(0.2, endTime - startTime);
    const speed = Math.max(0.25, Math.min(4.0, exportSettings.speed || 1.0));
    const effectiveOutputDuration = clipDuration / speed;

    onProgress(12, `Configurando MP4 ${exportSettings.resolution} (${exportSettings.aspectRatio})...`);
    const { width: targetW, height: targetH } = getExportResolution(
      exportSettings.resolution,
      exportSettings.aspectRatio
    );

    const avatarImg = frameEnabled ? await loadOptionalImage(brand.avatarUrl) : null;
    const customFrameImg =
      frameEnabled && frameStyle === 'custom'
        ? await loadOptionalImage(brand.customFrameUrl)
        : null;

    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    const evenW = targetW & ~1;
    const evenH = targetH & ~1;
    const bps = (exportSettings.bitrateMbps || 8) * 1_000_000;
    const targetFps = exportSettings.fps || 30;
    const webCodecsSelection = hasWebCodecsSupport()
      ? await selectWebCodecsVideoConfig(evenW, evenH, bps, targetFps)
      : null;

    const nativeMp4Available = hasNativeMediaRecorderMp4();
    // Prefer Hardware WebCodecs first (fastest on GPU); if GPU WebCodecs isn't available and browser
    // natively supports fast MediaRecorder MP4, use MediaRecorder MP4 (~5-10x faster than CPU software WebCodecs).
    const preferHardwareWebCodecs = Boolean(webCodecsSelection?.isHardwareAccelerated);

    if (webCodecsSelection && (preferHardwareWebCodecs || !nativeMp4Available)) {
      try {
        return await encodeMp4WithWebCodecs({
          item,
          settings,
          videoEl,
          videoDur,
          startTime,
          endTime,
          clipDuration,
          speed,
          effectiveOutputDuration,
          targetW,
          targetH,
          avatarImg,
          customFrameImg,
          onProgress,
          signal,
          preselectedCodec: webCodecsSelection,
        });
      } catch (wcErr) {
        if (signal?.aborted) {
          throw wcErr;
        }
        const msg = wcErr instanceof Error ? wcErr.message : '';
        if (msg !== 'WEBCODECS_UNAVAILABLE') {
          console.warn('WebCodecs MP4 fallback para MediaRecorder MP4:', msg);
        }
      }
    }

    // Native fast MediaRecorder MP4 (or last-resort fallback to software WebCodecs MP4 if MediaRecorder is not MP4)
    try {
      return await encodeWithMediaRecorderFallback({
        item,
        settings,
        videoEl,
        startTime,
        endTime,
        clipDuration,
        speed,
        effectiveOutputDuration,
        targetW,
        targetH,
        avatarImg,
        customFrameImg,
        onProgress,
        signal,
      });
    } catch (mrErr) {
      if (!signal?.aborted && webCodecsSelection) {
        return await encodeMp4WithWebCodecs({
          item,
          settings,
          videoEl,
          videoDur,
          startTime,
          endTime,
          clipDuration,
          speed,
          effectiveOutputDuration,
          targetW,
          targetH,
          avatarImg,
          customFrameImg,
          onProgress,
          signal,
          preselectedCodec: webCodecsSelection,
        });
      }
      throw mrErr;
    }
  } finally {
    disposeVideoElement(videoEl);
  }
}
