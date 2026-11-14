import {
  VideoProjectSettings,
  VideoQueueItem,
} from '../types/video';
import {
  buildFilterString,
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

/**
 * Inspects real MediaRecorder codec support in the current browser.
 * Never claims MP4 if the browser only supports WebM containers.
 */
export function getSupportedMimeType(withAudio = true): DetectedExportFormat {
  if (typeof MediaRecorder === 'undefined') {
    return {
      mimeType: 'video/webm',
      extension: 'webm',
      label: 'WebM',
      browserSupportsMp4: false,
    };
  }

  const mp4Candidates = withAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
      ]
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1.4d401f'];

  const browserSupportsMp4 = mp4Candidates.some((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });

  // Prefer VP8 WebM in Chromium/Linux because it guarantees reliable hardware/software frames & seekable duration;
  // only select Opus-muxed variants when an active running audio track is attached to the MediaStream.
  const webmCandidates = withAudio
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264,opus',
        'video/webm',
      ]
    : [
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm',
      ];

  for (const mime of webmCandidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return {
          mimeType: mime,
          extension: 'webm',
          label: 'WebM HD',
          browserSupportsMp4,
        };
      }
    } catch {
      // continue checking
    }
  }

  for (const mime of [...mp4Candidates, 'video/mp4']) {
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

  return {
    mimeType: 'video/webm',
    extension: 'webm',
    label: 'WebM HD',
    browserSupportsMp4,
  };
}

/**
 * Injects or updates exact duration in WebM EBML header to prevent player freezing/hanging
 */
export async function fixWebmDuration(blob: Blob, durationSec: number): Promise<Blob> {
  if (!blob || blob.size === 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    return blob;
  }
  try {
    const buffer = await blob.arrayBuffer();
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
      return blob;
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
      if ((durLen === 4 || durLen === 8) && durPos + 3 + durLen <= buffer.byteLength) {
        const dataView = new DataView(buffer, durPos + 3, durLen);
        if (durLen === 4) {
          dataView.setFloat32(0, durationMs);
        } else {
          dataView.setFloat64(0, durationMs);
        }
        return new Blob([buffer], { type: blob.type });
      }
    }

    // Duration element: ID [0x44, 0x89], length 8 [0x88], float64 value
    const durBytes = new Uint8Array(11);
    durBytes[0] = 0x44;
    durBytes[1] = 0x89;
    durBytes[2] = 0x88;
    const dv = new DataView(durBytes.buffer, 3, 8);
    dv.setFloat64(0, durationMs);

    const lenByte = u8[infoPos + 4];
    let headerLen = 5;
    let oldInfoDataLen = lenByte & 0x7f;
    if ((lenByte & 0x80) === 0 && (lenByte & 0x40) !== 0) {
      headerLen = 6;
      oldInfoDataLen = ((lenByte & 0x3f) << 8) | u8[infoPos + 5];
    }

    const newInfoDataLen = oldInfoDataLen + 11;
    if (newInfoDataLen > 0x3fff) {
      return blob;
    }

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

    // Seek gently to capture thumbnail
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

/**
 * Processes a single video sequentially using strictly its own resolved VideoProjectSettings.
 * Guarantees safe cleanup of all MediaRecorder, Canvas, AudioContext, MediaStream, Timers and Video resources.
 */
export async function processVideoItem(
  item: VideoQueueItem,
  settings: VideoProjectSettings,
  onProgress: ProcessorProgressCallback,
  signal?: AbortSignal
): Promise<ProcessedVideoResult> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Seu navegador não suporta gravação de mídia (MediaRecorder indisponível).');
  }

  if (!item || !item.url) {
    throw new Error('Arquivo de vídeo inválido ou ausente.');
  }

  // Declare all mutable resources upfront to eliminate TDZ ReferenceErrors during early cleanup/abort
  let cleanupRun = false;
  let animFrameId: number | null = null;
  let backgroundIntervalId: ReturnType<typeof setInterval> | null = null;
  let hardTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let audioCtx: AudioContext | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let canvasStream: MediaStream | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let videoAudioSource: MediaElementAudioSourceNode | null = null;
  let bgmSource: AudioBufferSourceNode | null = null;
  let silentOsc: OscillatorNode | null = null;
  let abortListener: (() => void) | null = null;

  const cleanup = () => {
    if (cleanupRun) return;
    cleanupRun = true;

    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (backgroundIntervalId !== null) {
      clearInterval(backgroundIntervalId);
      backgroundIntervalId = null;
    }
    if (hardTimeoutId !== null) {
      clearTimeout(hardTimeoutId);
      hardTimeoutId = null;
    }
    if (abortListener && signal) {
      signal.removeEventListener('abort', abortListener);
      abortListener = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onerror = null;
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
      } catch {
        // ignore
      }
    }

    if (canvasStream) {
      canvasStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      canvasStream = null;
    }

    if (dest) {
      try {
        dest.stream.getTracks().forEach((t) => t.stop());
        dest.disconnect();
      } catch {
        // ignore
      }
      dest = null;
    }

    if (bgmSource) {
      try {
        bgmSource.stop();
        bgmSource.disconnect();
      } catch {
        // ignore
      }
      bgmSource = null;
    }

    if (silentOsc) {
      try {
        silentOsc.stop();
        silentOsc.disconnect();
      } catch {
        // ignore
      }
      silentOsc = null;
    }

    if (videoAudioSource) {
      try {
        videoAudioSource.disconnect();
      } catch {
        // ignore
      }
      videoAudioSource = null;
    }

    if (audioCtx && audioCtx.state !== 'closed') {
      try {
        audioCtx.close().catch(() => {});
      } catch {
        // ignore
      }
      audioCtx = null;
    }

    if (videoEl) {
      try {
        videoEl.onloadedmetadata = null;
        videoEl.onerror = null;
        videoEl.onseeked = null;
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {
        // ignore
      }
      videoEl = null;
    }

    if (canvas && canvas.parentNode) {
      try {
        canvas.parentNode.removeChild(canvas);
      } catch {
        // ignore
      }
    }
    canvas = null;
  };

  try {
    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    const { frameEnabled, frameStyle, brand, crop, effects, audio, exportSettings } = settings;

    onProgress(5, 'Validando arquivo e preparando decodificador...');

    // 1. Prepare and validate video element
    videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.playsInline = true;
    videoEl.muted = true; // Required initially for reliable load/play
    videoEl.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      if (!videoEl) return reject(new Error('Elemento de vídeo não inicializado'));

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

      videoEl.src = item.url;
    });

    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    const videoDur = videoEl.duration;
    if (!Number.isFinite(videoDur) || videoDur < 0.05 || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
      throw new Error('Vídeo sem metadados válidos ou dimensões de quadro inválidas (0×0).');
    }

    const startTime = Math.max(0, Math.min(item.trim.startTime, videoDur - 0.1));
    const endTime = Math.min(item.trim.endTime > startTime ? item.trim.endTime : videoDur, videoDur);
    const clipDuration = Math.max(0.2, endTime - startTime);
    const speed = Math.max(0.25, Math.min(4.0, exportSettings.speed || 1.0));
    const effectiveOutputDuration = clipDuration / speed;

    onProgress(12, `Configurando ${exportSettings.resolution} (${exportSettings.aspectRatio})...`);

    // 2. Prepare offscreen compositor Canvas
    const { width: targetW, height: targetH } = getExportResolution(
      exportSettings.resolution,
      exportSettings.aspectRatio
    );

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
    if (!ctx) {
      throw new Error('Falha ao inicializar contexto Canvas 2D');
    }

    ctx.fillStyle = crop.backdropColor || '#0a0d18';
    ctx.fillRect(0, 0, targetW, targetH);

    // Pre-load images with timeout safety
    const avatarImg = frameEnabled ? await loadOptionalImage(brand.avatarUrl) : null;
    const customFrameImg =
      frameEnabled && frameStyle === 'custom'
        ? await loadOptionalImage(brand.customFrameUrl)
        : null;

    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    onProgress(20, 'Preparando mixagem de áudio...');

    // 3. Audio Setup
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let hasAudioTrack = false;

    const wantsOriginalAudio = audio.originalVolume > 0;
    const wantsBgm =
      audio.bgmVolume > 0 &&
      (Boolean(audio.customAudioUrl) || (audio.bgmTrackId && audio.bgmTrackId !== 'none'));

    if (AudioContextClass && (wantsOriginalAudio || wantsBgm)) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        try {
          await Promise.race([
            audioCtx.resume(),
            new Promise<void>((resolve) => setTimeout(resolve, 400)),
          ]);
        } catch {
          // ignore autoplay block
        }
      }

      if (audioCtx.state === 'running') {
        dest = audioCtx.createMediaStreamDestination();

        // Silent clock keepalive prevents MediaRecorder stalls when video lacks an audio track
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
          } catch (e) {
            console.warn('MediaElementAudioSource fallback (vídeo sem áudio ou bloqueado):', e);
          }
        }

        if (wantsBgm) {
          let bgmBuffer: AudioBuffer | null = null;
          if (audio.customAudioUrl) {
            try {
              const audioFetch = await fetch(audio.customAudioUrl);
              if (!audioFetch.ok) throw new Error('Falha ao ler áudio personalizado');
              const arrayBuf = await audioFetch.arrayBuffer();
              bgmBuffer = await audioCtx.decodeAudioData(arrayBuf);
            } catch (err) {
              console.warn('Falha ao decodificar áudio personalizado:', err);
            }
          } else if (audio.bgmTrackId !== 'none') {
            try {
              bgmBuffer = await generateSyntheticTrackBuffer(
                audioCtx,
                audio.bgmTrackId,
                Math.min(30, effectiveOutputDuration + 2)
              );
            } catch (err) {
              console.warn('Falha ao sintetizar trilha de fundo:', err);
            }
          }

          if (bgmBuffer && audioCtx) {
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
        try {
          audioCtx.close().catch(() => {});
        } catch {}
        audioCtx = null;
      }
    }

    // 4. Validate codec & start captureStream
    const detectedFormat = getSupportedMimeType(hasAudioTrack);
    onProgress(28, `Iniciando codificador (${detectedFormat.label})...`);

    const targetFps = exportSettings.fps || 30;
    canvasStream = canvas.captureStream(targetFps);
    const capturedVideoTrack = canvasStream.getVideoTracks()[0] as
      | (MediaStreamTrack & { requestFrame?: () => void })
      | undefined;

    if (dest && hasAudioTrack) {
      const audioTracks = dest.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }

    const bps = (exportSettings.bitrateMbps || 8) * 1_000_000;
    const chunks: Blob[] = [];

    try {
      mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: MediaRecorder.isTypeSupported(detectedFormat.mimeType)
          ? detectedFormat.mimeType
          : undefined,
        videoBitsPerSecond: bps,
      });
    } catch {
      mediaRecorder = new MediaRecorder(canvasStream);
    }

    const actualMime = mediaRecorder.mimeType || detectedFormat.mimeType;
    const actualExt: 'mp4' | 'webm' = actualMime.includes('mp4') ? 'mp4' : 'webm';
    const actualLabel = actualExt === 'mp4' ? 'MP4 HD' : 'WebM HD';

    const recorderFinishedPromise = new Promise<ProcessedVideoResult>((resolveRec, rejectRec) => {
      if (!mediaRecorder) return rejectRec(new Error('MediaRecorder não inicializado'));

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        const msg = (e as unknown as { error?: { message?: string } })?.error?.message;
        rejectRec(new Error(`Erro durante a gravação (${actualLabel}): ${msg || 'falha de codificação'}`));
      };

      mediaRecorder.onstop = async () => {
        try {
          if (signal?.aborted) {
            return rejectRec(new Error('Processamento cancelado pelo usuário'));
          }
          onProgress(
            95,
            exportSettings.stripMetadata
              ? 'Limpando metadados e finalizando arquivo...'
              : 'Finalizando container de vídeo...'
          );

          const rawBlob = new Blob(chunks, { type: actualMime });
          chunks.length = 0; // Free chunk references promptly

          if (rawBlob.size < 100) {
            return rejectRec(
              new Error('O arquivo gerado ficou vazio. Verifique se o vídeo de origem não está corrompido.')
            );
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
        } catch (stopErr) {
          rejectRec(stopErr instanceof Error ? stopErr : new Error('Erro ao finalizar vídeo'));
        }
      };

      abortListener = () => {
        rejectRec(new Error('Processamento cancelado pelo usuário'));
      };
      if (signal) {
        signal.addEventListener('abort', abortListener, { once: true });
      }
    });

    // 5. Seek safely to clip start
    if (Math.abs(videoEl.currentTime - startTime) > 0.05) {
      await new Promise<void>((resolveSeek) => {
        if (!videoEl) return resolveSeek();
        let done = false;
        const onDone = () => {
          if (!done) {
            done = true;
            if (videoEl) videoEl.onseeked = null;
            resolveSeek();
          }
        };
        const t = setTimeout(onDone, 800);
        videoEl.onseeked = () => {
          clearTimeout(t);
          onDone();
        };
        videoEl.currentTime = startTime;
      });
    } else {
      videoEl.currentTime = startTime;
    }

    if (signal?.aborted) {
      throw new Error('Processamento cancelado pelo usuário');
    }

    // Apply speed & pitch preservation
    videoEl.playbackRate = speed;
    if ('preservesPitch' in videoEl) {
      (videoEl as unknown as { preservesPitch: boolean }).preservesPitch = true;
    }
    videoEl.loop = false;

    const filterStr = buildFilterString(effects);

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
    });
    capturedVideoTrack?.requestFrame?.();

    // Start recording with 250ms timeslice
    mediaRecorder.start(250);

    if (bgmSource) {
      bgmSource.start(0);
    }

    try {
      videoEl.muted = !wantsOriginalAudio;
      await videoEl.play();
    } catch {
      if (videoEl) {
        videoEl.muted = true;
        await videoEl.play().catch(() => {});
      }
    }

    // Throttled progress reporting (avoid React re-render flooding)
    let lastProgressTime = 0;
    let lastProgressPct = -1;
    const sendThrottledProgress = (pct: number, statusText: string) => {
      const now = performance.now();
      if (pct !== lastProgressPct && (pct - lastProgressPct >= 2 || now - lastProgressTime >= 180)) {
        lastProgressTime = now;
        lastProgressPct = pct;
        onProgress(pct, statusText);
      }
    };

    const stopRecorderSafely = () => {
      if (hardTimeoutId !== null) {
        clearTimeout(hardTimeoutId);
        hardTimeoutId = null;
      }
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (backgroundIntervalId !== null) {
        clearInterval(backgroundIntervalId);
        backgroundIntervalId = null;
      }
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try {
          mediaRecorder.stop();
        } catch {
          // ignore
        }
      }
    };

    // Hard watchdog ceiling so processing can NEVER hang indefinitely
    const maxProcessingMs = Math.max(30000, effectiveOutputDuration * 4 * 1000);
    hardTimeoutId = setTimeout(() => {
      console.warn('Watchdog: Finalizando gravação por tempo limite de segurança.');
      stopRecorderSafely();
    }, maxProcessingMs);

    let isDrawing = false;
    let hasStopped = false;
    let drawnFrames = 1;
    const drawFrame = () => {
      if (cleanupRun || hasStopped || signal?.aborted || isDrawing || !videoEl || !ctx) {
        return;
      }
      isDrawing = true;

      try {
        const curr = videoEl.currentTime;
        const elapsed = Math.max(0, curr - startTime);
        const pct = Math.min(94, 30 + Math.round((elapsed / clipDuration) * 64));
        sendThrottledProgress(
          pct,
          `Renderizando ${exportSettings.resolution}: ${elapsed.toFixed(1)}s / ${clipDuration.toFixed(1)}s (${pct}%)`
        );

        const isCompleted =
          drawnFrames >= 4 &&
          (curr >= endTime - 0.04 ||
            videoEl.ended ||
            elapsed >= clipDuration - 0.04);

        if (isCompleted) {
          hasStopped = true;
          stopRecorderSafely();
          return;
        }

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
        });
        drawnFrames += 1;
        capturedVideoTrack?.requestFrame?.();
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

    // Background-tab resilience clock when browser throttles requestAnimationFrame
    backgroundIntervalId = setInterval(() => {
      if (cleanupRun || hasStopped) {
        if (backgroundIntervalId !== null) {
          clearInterval(backgroundIntervalId);
          backgroundIntervalId = null;
        }
        return;
      }
      const now = performance.now();
      if (now - lastRenderTimestamp >= Math.max(45, targetIntervalMs * 1.4)) {
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
