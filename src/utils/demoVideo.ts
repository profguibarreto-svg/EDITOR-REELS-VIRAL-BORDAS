import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import { fixWebmDuration } from './videoProcessor';
import { DEFAULT_PROJECT_SETTINGS, cloneVideoSettings } from './projectSettings';

let demoCounter = 0;

/**
 * Creates a synthetic demo video using HTML Canvas and Web Audio directly in the browser
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
      ? [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ]
      : [
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
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
    const actualMime = recorder.mimeType || selectedMime;

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

    const drawSyntheticFrame = (t: number) => {
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
      ctx.fillText(`${Math.max(0, durationSec - t).toFixed(1)}s`, 360, 695);

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20, 20, 220, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('MARCA D’ÁGUA TOPO', 130, 46);

      ctx.fillStyle = '#eab308';
      ctx.fillRect(20, 1220, 260, 40);
      ctx.fillStyle = '#000000';
      ctx.fillText('LEGENDA ANTIGA BASE', 150, 1246);
    };

    drawSyntheticFrame(0);
    demoVideoTrack?.requestFrame?.();
    recorder.start(150);

    const warmupTimer = setInterval(() => {
      if (demoStarted) {
        clearInterval(warmupTimer);
        return;
      }
      drawSyntheticFrame(0);
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
      drawSyntheticFrame(visualTime);
      demoVideoTrack?.requestFrame?.();
    };

    const rafLoop = () => {
      if (stopped) return;
      tick();
      if (!stopped) {
        rafId = requestAnimationFrame(rafLoop);
      }
    };
    rafId = requestAnimationFrame(rafLoop);
    intervalId = setInterval(tick, 45);

    const rawBlob = await recordingPromise;
    if (!rawBlob || rawBlob.size < 100) {
      throw new Error('O navegador não conseguiu capturar quadros suficientes para o vídeo de exemplo.');
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 180;
    thumbCanvas.height = 320;
    const tCtx = thumbCanvas.getContext('2d');
    const thumbnailUrl = tCtx
      ? (tCtx.drawImage(canvas, 0, 0, 180, 320), thumbCanvas.toDataURL('image/jpeg'))
      : '';

    let finalBlob = rawBlob;
    if (actualMime.includes('webm')) {
      finalBlob = await fixWebmDuration(rawBlob, durationSec);
    }

    const url = URL.createObjectURL(finalBlob);
    const ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
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
