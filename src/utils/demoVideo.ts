import { VideoQueueItem } from '../types/video';

/**
 * Creates a synthetic demo video using HTML Canvas and Web Audio directly in the browser
 */
export async function createSyntheticDemoVideo(): Promise<VideoQueueItem> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  canvas.style.position = 'fixed';
  canvas.style.top = '-9999px';
  canvas.style.left = '-9999px';
  canvas.style.opacity = '0';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // Pre-render frame 0
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 720, 1280);

  const fps = 20;
  const durationSec = 3;
  const totalFrames = fps * durationSec;

  const stream = canvas.captureStream(fps);

  // Add synthesized audio beep track safely
  let audioCtx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const dest = audioCtx.createMediaStreamDestination();
      osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, 0);
      gain.gain.setValueAtTime(0.02, 0);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    }
  } catch (_) {}

  const chunks: Blob[] = [];
  const selectedMime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      try {
        if (osc) osc.stop();
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch (_) {}
      resolve(new Blob(chunks, { type: selectedMime }));
    };
  });

  recorder.start();

  let frame = 0;
  const renderFrame = () => {
    if (frame >= totalFrames) {
      recorder.stop();
      return;
    }

    const t = frame / fps;

    // Draw dynamic background
    const grad = ctx.createLinearGradient(0, 0, 720, 1280);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 1280);

    // Draw moving particles & shapes
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(t * 2 + i) * 0.4 + 0.5) * 720;
      const y = (Math.cos(t * 1.5 + i * 2) * 0.4 + 0.5) * 1280;
      const r = 20 + Math.sin(t * 4 + i) * 15;
      ctx.fillStyle = `hsla(${(i * 25 + t * 40) % 360}, 85%, 65%, 0.6)`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(5, r), 0, Math.PI * 2);
      ctx.fill();
    }

    // Top banner demo label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VÍDEO DE DEMONSTRAÇÃO', 360, 480);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('WiFive Pro Studio · Teste em Tempo Real', 360, 530);

    // Countdown / Timer circle
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
    ctx.fillText(`${(durationSec - t).toFixed(1)}s`, 360, 695);

    // Watermark to test edge cropping
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, 20, 220, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('MARCA D’ÁGUA TOPO', 130, 46);

    ctx.fillStyle = '#eab308';
    ctx.fillRect(20, 1220, 260, 40);
    ctx.fillStyle = '#000000';
    ctx.fillText('LEGENDA ANTIGA BASE', 150, 1246);

    frame++;
    requestAnimationFrame(renderFrame);
  };

  renderFrame();

  const blob = await recordingPromise;
  const url = URL.createObjectURL(blob);

  // Generate thumbnail
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 180;
  thumbCanvas.height = 320;
  const tCtx = thumbCanvas.getContext('2d')!;
  tCtx.drawImage(canvas, 0, 0, 180, 320);
  const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg');

  const file = new File([blob], 'demo_corte_viral.mp4', { type: 'video/mp4' });

  return {
    id: `demo_${Date.now()}`,
    file,
    url,
    name: 'demo_corte_viral.mp4',
    duration: durationSec,
    width: 720,
    height: 1280,
    thumbnailUrl,
    trim: {
      startTime: 0,
      endTime: durationSec,
    },
    status: 'idle',
    progress: 0,
    outputBlob: null,
    outputUrl: null,
    errorMessage: null,
  };
}
