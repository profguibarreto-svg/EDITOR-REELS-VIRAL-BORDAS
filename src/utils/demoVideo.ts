import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import { fixWebmDuration } from './videoProcessor';
import { DEFAULT_PROJECT_SETTINGS, cloneVideoSettings } from './projectSettings';
import { buildWebCodecsCandidateSpecs, computeCfrFrameTimestampUs } from './frameSyncMath';

let demoCounter = 0;

function drawDemoFrame(
  ctx: CanvasRenderingContext2D,
  sampleNumber: number,
  t: number,
  durationSec: number
) {
  const grad = ctx.createLinearGradient(0, 0, 720, 1280);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, sampleNumber % 2 === 1 ? '#1e1b4b' : '#3b0764');
  grad.addColorStop(1, sampleNumber % 2 === 1 ? '#0284c7' : '#0d9488');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 1280);

  for (let i = 0; i < 16; i++) {
    const x = (Math.sin(t * 2 + i + sampleNumber) * 0.4 + 0.5) * 720;
    const y = (Math.cos(t * 1.5 + i * 2) * 0.4 + 0.5) * 1280;
    const r = 20 + Math.sin(t * 4 + i) * 15;
    ctx.fillStyle = `hsla(${(i * 25 + t * 40 + sampleNumber * 45) % 360}, 85%, 65%, 0.6)`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(5, r), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`VÍDEO DE EXEMPLO #${sampleNumber}`, 360, 480);

  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('WiFive Pro Studio · Teste em Tempo Real', 360, 530);

  ctx.beginPath();
  ctx.arc(360, 680, 100, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(360, 680, 100, -Math.PI / 2, -Math.PI / 2 + (t / durationSec) * Math.PI * 2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.font = 'bold 48px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.max(0, durationSec - t).toFixed(2)}s`, 360, 695);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(20, 20, 220, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('MARCA D’ÁGUA TOPO', 130, 46);

  ctx.fillStyle = '#eab308';
  ctx.fillRect(20, 1220, 260, 40);
  ctx.fillStyle = '#000000';
  ctx.fillText('LEGENDA ANTIGA BASE', 150, 1246);
}

async function generateDemoMp4WithWebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  sampleNumber: number,
  fps: number,
  durationSec: number
): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  let selected: { config: VideoEncoderConfig; muxerCodec: 'avc' | 'vp9' | 'av1' } | null = null;
  for (const cand of buildWebCodecsCandidateSpecs()) {
    const cfg: VideoEncoderConfig = {
      codec: cand.codec,
      width: 720,
      height: 1280,
      bitrate: 3_500_000,
      framerate: fps,
      latencyMode: 'realtime',
      hardwareAcceleration: cand.hardwareAcceleration,
      ...(cand.muxerCodec === 'avc' ? { avc: { format: 'avc' as const } } : {}),
    };
    try {
      const sup = await VideoEncoder.isConfigSupported(cfg);
      if (sup.supported) {
        selected = {
          config: {
            ...(sup.config || cfg),
            latencyMode: 'realtime',
            hardwareAcceleration: cand.hardwareAcceleration,
            ...(cand.muxerCodec === 'avc' ? { avc: { format: 'avc' as const } } : {}),
          },
          muxerCodec: cand.muxerCodec,
        };
        break;
      }
    } catch {}
  }

  if (!selected) return null;

  let audioCfg: { config: AudioEncoderConfig; muxerCodec: 'aac' | 'opus' } | null = null;
  if (typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    for (const ac of [
      { codec: 'mp4a.40.2', muxerCodec: 'aac' as const },
      { codec: 'opus', muxerCodec: 'opus' as const },
    ]) {
      const cfg: AudioEncoderConfig = {
        codec: ac.codec,
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 96_000,
      };
      try {
        const sup = await AudioEncoder.isConfigSupported(cfg);
        if (sup.supported) {
          audioCfg = { config: sup.config || cfg, muxerCodec: ac.muxerCodec };
          break;
        }
      } catch {}
    }
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: selected.muxerCodec, width: 720, height: 1280, frameRate: fps },
    ...(audioCfg
      ? { audio: { codec: audioCfg.muxerCodec, numberOfChannels: 2, sampleRate: 48000 } }
      : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encErr: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encErr = e instanceof Error ? e : new Error('Demo VideoEncoder error');
    },
  });
  videoEncoder.configure(selected.config);

  let audioEncoder: AudioEncoder | null = null;
  if (audioCfg) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => {
        encErr = e instanceof Error ? e : new Error('Demo AudioEncoder error');
      },
    });
    audioEncoder.configure(audioCfg.config);
  }

  try {
    if (audioEncoder) {
      const sr = 48000;
      const totalSamples = Math.round(durationSec * sr);
      const chunkSamples = 1024;
      for (let off = 0; off < totalSamples; off += chunkSamples) {
        if (encErr) throw encErr;
        const frames = Math.min(chunkSamples, totalSamples - off);
        const planar = new Float32Array(frames * 2);
        for (let i = 0; i < frames; i++) {
          const t = (off + i) / sr;
          const env = Math.sin(Math.PI * Math.min(1, t / durationSec));
          const val = Math.sin(2 * Math.PI * 330 * t) * 0.04 * env;
          planar[i] = val;
          planar[frames + i] = val;
        }
        const ad = new AudioData({
          format: 'f32-planar',
          sampleRate: sr,
          numberOfFrames: frames,
          numberOfChannels: 2,
          timestamp: Math.round((off / sr) * 1_000_000),
          data: planar,
        });
        audioEncoder.encode(ad);
        ad.close();
      }
      await audioEncoder.flush();
    }

    const totalFrames = Math.round(durationSec * fps);
    for (let i = 0; i < totalFrames; i++) {
      if (encErr) throw encErr;
      const t = i / fps;
      drawDemoFrame(ctx, sampleNumber, t, durationSec);
      const { timestampUs, durationUs } = computeCfrFrameTimestampUs(i, fps);
      const vf = new VideoFrame(canvas, { timestamp: timestampUs, duration: durationUs });
      videoEncoder.encode(vf, { keyFrame: i % 12 === 0 });
      vf.close();
      if (videoEncoder.encodeQueueSize > 8) {
        await new Promise<void>((r) => setTimeout(r, 4));
      }
    }

    await videoEncoder.flush();
    if (encErr) throw encErr;

    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
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
 * Creates a smooth synthetic demo video (CFR MP4 via WebCodecs or MediaRecorder fallback)
 */
export async function createSyntheticDemoVideo(
  baseSettings: VideoProjectSettings = DEFAULT_PROJECT_SETTINGS
): Promise<VideoQueueItem> {
  demoCounter += 1;
  const sampleNumber = demoCounter;

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  canvas.style.position = 'fixed';
  canvas.style.top = '0px';
  canvas.style.left = '0px';
  canvas.style.width = '2px';
  canvas.style.height = '2px';
  canvas.style.opacity = '0.001';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';
  document.body.appendChild(canvas);

  let audioCtx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let watchdogId: ReturnType<typeof setTimeout> | null = null;

  const cleanupDemo = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (watchdogId !== null) {
      clearTimeout(watchdogId);
      watchdogId = null;
    }
    try {
      if (osc) {
        osc.stop();
        osc.disconnect();
      }
    } catch {}
    try {
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    } catch {}
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    }
    if (canvas.parentNode) {
      try {
        canvas.parentNode.removeChild(canvas);
      } catch {}
    }
  };

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao inicializar Canvas 2D para vídeo de demonstração.');
    }
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 720, 1280);

    const fps = 24;
    const durationSec = 1.5;

    // Try fast CFR MP4 generation first so every single frame animates smoothly & seeks cleanly
    let finalBlob: Blob | null = null;
    let ext: 'mp4' | 'webm' = 'mp4';
    let actualMime = 'video/mp4';

    try {
      finalBlob = await generateDemoMp4WithWebCodecs(canvas, ctx, sampleNumber, fps, durationSec);
    } catch {
      finalBlob = null;
    }

    if (!finalBlob || finalBlob.size < 100) {
      stream = canvas.captureStream(fps);
      const demoVideoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;

      let hasDemoAudioTrack = false;
      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          if (audioCtx.state === 'suspended') {
            await Promise.race([
              audioCtx.resume().catch(() => {}),
              new Promise<void>((r) => setTimeout(r, 300)),
            ]);
          }
          if (audioCtx.state === 'running') {
            const dest = audioCtx.createMediaStreamDestination();
            osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, 0);
            gain.gain.setValueAtTime(0.02, 0);
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
              stream.addTrack(audioTrack);
              hasDemoAudioTrack = true;
            }
          }
        }
      } catch {}

      const chunks: Blob[] = [];
      const mimeCandidates = hasDemoAudioTrack
        ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
        : ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const selectedMime =
        mimeCandidates.find((m) => {
          try {
            return MediaRecorder.isTypeSupported(m);
          } catch {
            return false;
          }
        }) || 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(selectedMime) ? selectedMime : undefined,
      });
      actualMime = recorder.mimeType || selectedMime;

      let totalDemoBytes = 0;
      let demoStarted = false;
      let resolveDemoStart: (() => void) | null = null;
      const demoStartedPromise = new Promise<void>((res) => {
        resolveDemoStart = res;
      });

      recorder.onstart = () => {
        demoStarted = true;
        resolveDemoStart?.();
        resolveDemoStart = null;
      };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          totalDemoBytes += e.data.size;
        }
      };

      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        watchdogId = setTimeout(() => {
          resolveDemoStart?.();
          resolveDemoStart = null;
          if (recorder.state === 'recording') {
            try {
              recorder.stop();
            } catch {
              reject(new Error('Tempo limite ao gerar vídeo de exemplo.'));
            }
          } else {
            reject(new Error('Tempo limite ao gerar vídeo de exemplo.'));
          }
        }, 10000);
        recorder.onerror = () => {
          resolveDemoStart?.();
          resolveDemoStart = null;
          if (watchdogId !== null) clearTimeout(watchdogId);
          reject(new Error('Erro no MediaRecorder ao criar vídeo de exemplo.'));
        };
        recorder.onstop = () => {
          resolveDemoStart?.();
          resolveDemoStart = null;
          if (watchdogId !== null) clearTimeout(watchdogId);
          resolve(new Blob(chunks, { type: actualMime }));
        };
      });

      drawDemoFrame(ctx, sampleNumber, 0, durationSec);
      demoVideoTrack?.requestFrame?.();
      recorder.start(150);

      const warmupTimer = setInterval(() => {
        if (demoStarted) {
          clearInterval(warmupTimer);
          return;
        }
        drawDemoFrame(ctx, sampleNumber, 0, durationSec);
        demoVideoTrack?.requestFrame?.();
      }, 60);

      await Promise.race([demoStartedPromise, new Promise<void>((r) => setTimeout(r, 4000))]);
      clearInterval(warmupTimer);

      const startedAt = performance.now();
      let stopped = false;
      let drawnFrames = 1;
      const minFramesRequired = 16;

      const tick = () => {
        if (stopped) return;
        const elapsedSec = (performance.now() - startedAt) / 1000;
        if (
          elapsedSec >= durationSec &&
          drawnFrames >= minFramesRequired &&
          (totalDemoBytes > 0 || elapsedSec >= durationSec + 1.0)
        ) {
          stopped = true;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (recorder.state === 'recording') {
            try {
              recorder.requestData();
            } catch {}
            setTimeout(() => {
              if (recorder.state === 'recording') {
                try {
                  recorder.stop();
                } catch {}
              }
            }, 80);
          }
          return;
        }
        drawnFrames += 1;
        const visualTime = Math.min(durationSec, Math.max(elapsedSec, (drawnFrames / fps) * 0.5));
        drawDemoFrame(ctx, sampleNumber, visualTime, durationSec);
        demoVideoTrack?.requestFrame?.();
      };

      const rafLoop = () => {
        if (stopped) return;
        tick();
        if (!stopped) rafId = requestAnimationFrame(rafLoop);
      };
      rafId = requestAnimationFrame(rafLoop);
      intervalId = setInterval(tick, 45);

      const rawBlob = await recordingPromise;
      if (!rawBlob || rawBlob.size < 100) {
        throw new Error('O navegador não conseguiu capturar quadros suficientes para o vídeo de exemplo.');
      }

      finalBlob = actualMime.includes('webm')
        ? await fixWebmDuration(rawBlob, durationSec)
        : rawBlob;
      ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
    }

    drawDemoFrame(ctx, sampleNumber, 0.35, durationSec);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 180;
    thumbCanvas.height = 320;
    const tCtx = thumbCanvas.getContext('2d');
    const thumbnailUrl = tCtx
      ? (tCtx.drawImage(canvas, 0, 0, 180, 320), thumbCanvas.toDataURL('image/jpeg'))
      : '';

    const url = URL.createObjectURL(finalBlob);
    const fileName = `demo_corte_${sampleNumber}.${ext}`;
    const file = new File([finalBlob], fileName, { type: finalBlob.type || actualMime });

    return {
      id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      url,
      name: fileName,
      duration: durationSec,
      width: 720,
      height: 1280,
      thumbnailUrl,
      trim: {
        startTime: 0,
        endTime: durationSec,
      },
      settings: cloneVideoSettings(baseSettings),
      status: 'idle',
      progress: 0,
      outputBlob: null,
      outputUrl: null,
      errorMessage: null,
    };
  } finally {
    cleanupDemo();
  }
}
