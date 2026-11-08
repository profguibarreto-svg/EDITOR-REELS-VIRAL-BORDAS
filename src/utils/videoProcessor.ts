import {
  FrameStyle,
  ProfileBrand,
  VisualEffects,
  AudioSettings,
  VideoCropSettings,
  ExportSettings,
  VideoQueueItem,
} from '../types/video';
import { calculateSourceCropRect, calculateDestPlacement } from './geometryMath';
import { getFrameLayoutSlot, renderBackground, renderFrameOverlay } from './frameRenderer';
import { generateSyntheticTrackBuffer } from './audioTracks';

export interface ProcessorProgressCallback {
  (progress: number, statusText: string): void;
}

/**
 * Returns supported MIME type for MediaRecorder, preferring standard formats
 */
export function getSupportedMimeType(): { mimeType: string; extension: string } {
  const candidateMimes = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=h264,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  if (typeof MediaRecorder !== 'undefined') {
    for (const item of candidateMimes) {
      if (MediaRecorder.isTypeSupported(item.mime)) {
        return { mimeType: item.mime, extension: item.ext };
      }
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Injects or updates exact duration in WebM EBML header to prevent player freezing/hanging
 */
export async function fixWebmDuration(blob: Blob, durationSec: number): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const u8 = new Uint8Array(buffer);

        // Find Segment Info element: 0x15, 0x49, 0xA9, 0x66
        let infoPos = -1;
        for (let i = 0; i < Math.min(u8.length - 4, 4096); i++) {
          if (u8[i] === 0x15 && u8[i + 1] === 0x49 && u8[i + 2] === 0xa9 && u8[i + 3] === 0x66) {
            infoPos = i;
            break;
          }
        }

        if (infoPos === -1) {
          return resolve(blob);
        }

        const durationMs = durationSec * 1000;

        // Check if Duration element (0x44, 0x89) already exists inside Info
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
          if (durLen === 4 || durLen === 8) {
            const dataView = new DataView(buffer, durPos + 3, durLen);
            if (durLen === 4) {
              dataView.setFloat32(0, durationMs);
            } else {
              dataView.setFloat64(0, durationMs);
            }
            return resolve(new Blob([buffer], { type: blob.type }));
          }
        }

        // Duration element: ID [0x44, 0x89], length 8 [0x88], float64 value
        const durBytes = new Uint8Array(11);
        durBytes[0] = 0x44;
        durBytes[1] = 0x89;
        durBytes[2] = 0x88;
        const dv = new DataView(durBytes.buffer, 3, 8);
        dv.setFloat64(0, durationMs);

        // Determine Info length header size
        const lenByte = u8[infoPos + 4];
        let headerLen = 5;
        let oldInfoDataLen = lenByte & 0x7f;
        if ((lenByte & 0x80) === 0 && (lenByte & 0x40) !== 0) {
          headerLen = 6;
          oldInfoDataLen = ((lenByte & 0x3f) << 8) | u8[infoPos + 5];
        }

        const newInfoDataLen = oldInfoDataLen + 11;
        const newBuffer = new Uint8Array(u8.length + 11);

        const insertPos = infoPos + headerLen;
        newBuffer.set(u8.subarray(0, insertPos), 0);

        if (headerLen === 5) {
          newBuffer[infoPos + 4] = 0x80 | newInfoDataLen;
        } else {
          newBuffer[infoPos + 4] = 0x40 | (newInfoDataLen >> 8);
          newBuffer[infoPos + 5] = newInfoDataLen & 0xff;
        }

        newBuffer.set(durBytes, insertPos);
        newBuffer.set(u8.subarray(insertPos), insertPos + 11);

        resolve(new Blob([newBuffer.buffer], { type: blob.type }));
      } catch (_) {
        resolve(blob);
      }
    };
    reader.onerror = () => resolve(blob);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Calculates canvas dimensions based on resolution and aspect ratio
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
    // 16:9 landscape
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
 * Processes a single video with all trimming, cropping, frame overlay, effects, speed & audio mixing
 */
export async function processVideoItem(
  item: VideoQueueItem,
  frameStyle: FrameStyle,
  brand: ProfileBrand,
  effects: VisualEffects,
  audioSettings: AudioSettings,
  cropSettings: VideoCropSettings,
  exportSettings: ExportSettings,
  onProgress: ProcessorProgressCallback,
  signal?: AbortSignal
): Promise<{ outputBlob: Blob; outputUrl: string }> {
  return new Promise(async (resolve, reject) => {
    let cleanupRun = false;
    let animFrameId: number | null = null;
    let backgroundIntervalId: any = null;
    let audioCtx: AudioContext | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const cleanup = () => {
      if (cleanupRun) return;
      cleanupRun = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (backgroundIntervalId) clearInterval(backgroundIntervalId);
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close();
        } catch (_) {}
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      }
      if (canvas && canvas.parentNode) {
        try {
          canvas.parentNode.removeChild(canvas);
        } catch (_) {}
      }
    };

    if (signal?.aborted) {
      cleanup();
      return reject(new Error('Processamento cancelado pelo usuário'));
    }

    signal?.addEventListener('abort', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      cleanup();
      reject(new Error('Processamento cancelado pelo usuário'));
    });

    onProgress(5, 'Carregando vídeo e preparando decodificador...');

    // 1. Prepare video element
    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.playsInline = true;
    videoEl.muted = true; // Muted to avoid browser autoplay restrictions
    videoEl.preload = 'auto';
    videoEl.src = item.url;

    try {
      await new Promise<void>((res, rej) => {
        videoEl.onloadedmetadata = () => res();
        videoEl.onerror = () => rej(new Error('Erro ao carregar o arquivo de vídeo. Formato incompatível.'));
      });
    } catch (err: any) {
      cleanup();
      return reject(err);
    }

    const videoDur = videoEl.duration || 10;
    const startTime = Math.max(0, Math.min(item.trim.startTime, videoDur - 0.2));
    const endTime = Math.min(item.trim.endTime > startTime ? item.trim.endTime : videoDur, videoDur);
    const clipDuration = Math.max(0.5, endTime - startTime);

    onProgress(12, 'Configurando resolução e efeitos...');

    // 2. Prepare Canvas - Must be attached to DOM for active Chromium compositor capture
    const { width: targetW, height: targetH } = getExportResolution(
      exportSettings.resolution,
      exportSettings.aspectRatio
    );

    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.position = 'fixed';
    canvas.style.top = '-9999px';
    canvas.style.left = '-9999px';
    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      cleanup();
      return reject(new Error('Falha ao inicializar o contexto Canvas 2D'));
    }

    // Pre-draw initial frame to ensure captureStream initializes with valid dimensions
    ctx.fillStyle = cropSettings.backdropColor || '#0a0d18';
    ctx.fillRect(0, 0, targetW, targetH);

    // Pre-load images if any
    let avatarImg: HTMLImageElement | null = null;
    if (brand.avatarUrl) {
      avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      avatarImg.src = brand.avatarUrl;
      await new Promise((r) => {
        avatarImg!.onload = r;
        avatarImg!.onerror = r;
      });
    }

    let customFrameImg: HTMLImageElement | null = null;
    if (frameStyle === 'custom' && brand.customFrameUrl) {
      customFrameImg = new Image();
      customFrameImg.crossOrigin = 'anonymous';
      customFrameImg.src = brand.customFrameUrl;
      await new Promise((r) => {
        customFrameImg!.onload = r;
        customFrameImg!.onerror = r;
      });
    }

    onProgress(20, 'Sintetizando e mixando áudio...');

    // 3. Audio Setup via Web Audio
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (_) {}
    }
    const dest = audioCtx.createMediaStreamDestination();

    // Decode original video audio buffer for sample-accurate playback without autoplay locks
    let videoAudioBuffer: AudioBuffer | null = null;
    let videoAudioSource: AudioBufferSourceNode | null = null;
    try {
      const resp = await fetch(item.url);
      const arrayBuf = await resp.arrayBuffer();
      videoAudioBuffer = await audioCtx.decodeAudioData(arrayBuf);
    } catch (_) {
      // Fallback: hook MediaElementSource if decode fails
      try {
        const elemSource = audioCtx.createMediaElementSource(videoEl);
        const gain = audioCtx.createGain();
        gain.gain.value = audioSettings.originalVolume;
        elemSource.connect(gain);
        gain.connect(dest);
      } catch (e) {
        console.warn('Audio hook unavailable, continuing with BGM only', e);
      }
    }

    if (videoAudioBuffer) {
      videoAudioSource = audioCtx.createBufferSource();
      videoAudioSource.buffer = videoAudioBuffer;
      const originalGain = audioCtx.createGain();
      originalGain.gain.value = audioSettings.originalVolume;
      videoAudioSource.connect(originalGain);
      originalGain.connect(dest);
    }

    // Background Music Track
    let bgmBuffer: AudioBuffer | null = null;
    if (audioSettings.customAudioUrl) {
      try {
        const audioFetch = await fetch(audioSettings.customAudioUrl);
        const arrayBuf = await audioFetch.arrayBuffer();
        bgmBuffer = await audioCtx.decodeAudioData(arrayBuf);
      } catch (err) {
        console.warn('Failed to decode custom audio file, falling back', err);
      }
    } else if (audioSettings.bgmTrackId !== 'none') {
      try {
        bgmBuffer = await generateSyntheticTrackBuffer(audioCtx, audioSettings.bgmTrackId, clipDuration + 2);
      } catch (err) {
        console.warn('Failed to generate synthetic background audio', err);
      }
    }

    let bgmSource: AudioBufferSourceNode | null = null;
    if (bgmBuffer) {
      bgmSource = audioCtx.createBufferSource();
      bgmSource.buffer = bgmBuffer;
      bgmSource.loop = true;
      const bgmGain = audioCtx.createGain();
      bgmGain.gain.value = audioSettings.bgmVolume;
      bgmSource.connect(bgmGain);
      bgmGain.connect(dest);
    }

    // 4. Stream and MediaRecorder
    onProgress(28, 'Iniciando captura em alta definição...');
    const canvasStream = canvas.captureStream(exportSettings.fps || 30);

    // Merge audio tracks into stream
    const audioTracks = dest.stream.getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }

    const { mimeType } = getSupportedMimeType();
    const bps = (exportSettings.bitrateMbps || 8) * 1000 * 1000;

    const chunks: Blob[] = [];
    try {
      mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: bps,
      });
    } catch (e) {
      mediaRecorder = new MediaRecorder(canvasStream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      cleanup();
      reject(new Error(`Erro no gravador de mídia: ${(e as any).error?.message || 'Falha de encoding'}`));
    };

    const completionPromise = new Promise<{ outputBlob: Blob; outputUrl: string }>((res) => {
      mediaRecorder!.onstop = async () => {
        onProgress(95, 'Limpando metadados e finalizando com taxa estável...');
        const rawBlob = new Blob(chunks, { type: mediaRecorder?.mimeType || mimeType });
        
        // Inject accurate duration if WebM to prevent player freezing/hanging on PC
        let finalBlob = rawBlob;
        if (rawBlob.type.includes('webm')) {
          finalBlob = await fixWebmDuration(rawBlob, clipDuration);
        }

        const finalUrl = URL.createObjectURL(finalBlob);
        cleanup();
        res({ outputBlob: finalBlob, outputUrl: finalUrl });
      };
    });

    // 5. Seek video to start
    videoEl.currentTime = startTime;
    await new Promise((r) => (videoEl.onseeked = r));

    // Apply speed
    videoEl.playbackRate = exportSettings.speed || 1.0;
    if ('preservesPitch' in videoEl) {
      (videoEl as any).preservesPitch = true;
    }

    // Start recording and start audio playback
    mediaRecorder.start(100);

    if (videoAudioSource) {
      videoAudioSource.start(0, startTime, clipDuration);
    }
    if (bgmSource) {
      bgmSource.start(0);
    }

    try {
      await videoEl.play();
    } catch (_) {
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
    }

    const slot = getFrameLayoutSlot(frameStyle);
    const activeCrop = {
      cropTop: cropSettings.cropTop,
      cropBottom: cropSettings.cropBottom,
      cropLeft: cropSettings.cropLeft,
      cropRight: cropSettings.cropRight,
      scale: cropSettings.scale,
      positionX: cropSettings.positionX,
      positionY: cropSettings.positionY,
    };

    // Hard ceiling watchdog so processing NEVER hangs
    const maxProcessingMs = Math.max(25000, ((clipDuration / (exportSettings.speed || 1)) * 3.5) * 1000);
    const hardTimeoutId = setTimeout(() => {
      console.warn('Watchdog: Finalizando stream com segurança.');
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, maxProcessingMs);

    let isDrawing = false;
    const drawFrame = () => {
      if (cleanupRun || signal?.aborted || isDrawing) {
        return;
      }
      isDrawing = true;

      try {
        const curr = videoEl.currentTime;
        const elapsed = Math.max(0, curr - startTime);
        const pct = Math.min(94, 30 + Math.round((elapsed / clipDuration) * 64));
        onProgress(pct, `Renderizando: ${elapsed.toFixed(1)}s / ${clipDuration.toFixed(1)}s (${pct}%)`);

        if (curr >= endTime || videoEl.ended) {
          clearTimeout(hardTimeoutId);
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
              mediaRecorder.requestData();
            } catch (_) {}
            mediaRecorder.stop();
          }
          return;
        }

        // 1. Draw dynamic background
        renderBackground(
          ctx,
          targetW,
          targetH,
          videoEl,
          effects,
          cropSettings.fitMode,
          cropSettings.backdropColor
        );

        // 2. Compute cropped video source and destination
        const srcRect = calculateSourceCropRect(videoEl.videoWidth || targetW, videoEl.videoHeight || targetH, activeCrop);
        const croppedAspect = srcRect.sw / srcRect.sh;
        const destRect = calculateDestPlacement(
          targetW,
          targetH,
          croppedAspect,
          slot,
          activeCrop.scale,
          activeCrop.positionX,
          activeCrop.positionY
        );

        // 3. Draw video with effects
        ctx.save();
        let filterStr = `brightness(${effects.brightness}) contrast(${effects.contrast}) saturate(${effects.saturation})`;
        if (effects.sharpen) {
          filterStr += ' contrast(1.15)';
        }
        ctx.filter = filterStr;

        ctx.drawImage(
          videoEl,
          srcRect.sx,
          srcRect.sy,
          srcRect.sw,
          srcRect.sh,
          destRect.dx,
          destRect.dy,
          destRect.dw,
          destRect.dh
        );
        ctx.restore();

        // Optional vignette
        if (effects.vignette) {
          ctx.save();
          const vigGrad = ctx.createRadialGradient(
            targetW / 2,
            targetH / 2,
            targetW * 0.35,
            targetW / 2,
            targetH / 2,
            targetW * 0.75
          );
          vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
          ctx.fillStyle = vigGrad;
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.restore();
        }

        // 4. Draw branded frame overlay
        renderFrameOverlay(
          ctx,
          targetW,
          targetH,
          frameStyle,
          brand,
          avatarImg,
          customFrameImg,
          elapsed,
          item.customHeadline
        );
      } finally {
        isDrawing = false;
      }
    };

    // Active animation frame loop
    const onAnimFrame = () => {
      if (cleanupRun) return;
      drawFrame();
      if (!cleanupRun) {
        animFrameId = requestAnimationFrame(onAnimFrame);
      }
    };
    animFrameId = requestAnimationFrame(onAnimFrame);

    // Fallback background interval to prevent tab-throttle freezes when user minimizes or changes tabs
    backgroundIntervalId = setInterval(() => {
      if (cleanupRun) {
        clearInterval(backgroundIntervalId);
        return;
      }
      drawFrame();
    }, 33);

    try {
      const result = await completionPromise;
      resolve(result);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
