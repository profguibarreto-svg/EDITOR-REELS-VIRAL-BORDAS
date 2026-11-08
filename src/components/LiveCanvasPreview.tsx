import React, { useEffect, useRef, useState } from 'react';
import {
  FrameStyle,
  ProfileBrand,
  VisualEffects,
  VideoCropSettings,
  ExportSettings,
  VideoQueueItem,
} from '../types/video';
import { calculateSourceCropRect, calculateDestPlacement, formatTime } from '../utils/geometryMath';
import { getFrameLayoutSlot, renderBackground, renderFrameOverlay } from '../utils/frameRenderer';
import {
  Play,
  Pause,
  Maximize2,
  Download,
  RotateCcw,
  Sparkles,
  Smartphone,
  Sliders,
} from 'lucide-react';

interface LiveCanvasPreviewProps {
  activeItem: VideoQueueItem | null;
  frameStyle: FrameStyle;
  brand: ProfileBrand;
  effects: VisualEffects;
  cropSettings: VideoCropSettings;
  exportSettings: ExportSettings;
  onDownloadActive?: () => void;
}

export const LiveCanvasPreview: React.FC<LiveCanvasPreviewProps> = ({
  activeItem,
  frameStyle,
  brand,
  effects,
  cropSettings,
  exportSettings,
  onDownloadActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeDisplayRef = useRef<HTMLElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Hidden image elements for avatar and custom frame
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const customFrameImgRef = useRef<HTMLImageElement | null>(null);

  // Extract stable primitives from activeItem to avoid effect re-runs when progress/status updates
  const activeItemId = activeItem?.id;
  const activeItemUrl = activeItem?.url;
  const trimStart = activeItem?.trim.startTime || 0;
  const trimEnd = activeItem?.trim.endTime || (activeItem?.duration ?? 10);
  const customHeadline = activeItem?.customHeadline;

  useEffect(() => {
    if (brand.avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = brand.avatarUrl;
      avatarImgRef.current = img;
    } else {
      avatarImgRef.current = null;
    }
  }, [brand.avatarUrl]);

  useEffect(() => {
    if (brand.customFrameUrl && frameStyle === 'custom') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = brand.customFrameUrl;
      customFrameImgRef.current = img;
    } else {
      customFrameImgRef.current = null;
    }
  }, [brand.customFrameUrl, frameStyle]);

  // Handle video element setup only when video source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeItemUrl) return;

    video.src = activeItemUrl;
    video.currentTime = trimStart;
    video.playbackRate = exportSettings.speed || 1.0;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [activeItemId, activeItemUrl]);

  // Adjust playback rate when speed setting changes without reloading video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = exportSettings.speed || 1.0;
    }
  }, [exportSettings.speed]);

  // Main rendering loop - zero setState calls inside requestAnimationFrame
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Handle video loop inside trim bounds and update time DOM ref directly
      if (video && activeItemUrl) {
        const start = trimStart;
        const end = trimEnd > start ? trimEnd : video.duration || 10;

        if (video.currentTime >= end || video.currentTime < start) {
          video.currentTime = start;
        }
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = formatTime(video.currentTime);
        }
      }

      // 1. Render Background
      renderBackground(
        ctx,
        w,
        h,
        video,
        effects,
        cropSettings.fitMode,
        cropSettings.backdropColor
      );

      // 2. Render Video
      if (video && video.readyState >= 2) {
        const slot = getFrameLayoutSlot(frameStyle);
        const srcRect = calculateSourceCropRect(video.videoWidth, video.videoHeight, cropSettings);
        const croppedAspect = srcRect.sw / srcRect.sh;
        const destRect = calculateDestPlacement(
          w,
          h,
          croppedAspect,
          slot,
          cropSettings.scale,
          cropSettings.positionX,
          cropSettings.positionY
        );

        ctx.save();
        let filterStr = `brightness(${effects.brightness}) contrast(${effects.contrast}) saturate(${effects.saturation})`;
        if (effects.sharpen) {
          filterStr += ' contrast(1.15)';
        }
        ctx.filter = filterStr;

        ctx.drawImage(
          video,
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
            w / 2,
            h / 2,
            w * 0.35,
            w / 2,
            h / 2,
            w * 0.75
          );
          vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
          ctx.fillStyle = vigGrad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }

      // 3. Render Frame Overlay
      renderFrameOverlay(
        ctx,
        w,
        h,
        frameStyle,
        brand,
        avatarImgRef.current,
        customFrameImgRef.current,
        video ? video.currentTime : 0,
        customHeadline
      );

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    activeItemId,
    activeItemUrl,
    trimStart,
    trimEnd,
    customHeadline,
    frameStyle,
    brand,
    effects,
    cropSettings,
    exportSettings.aspectRatio,
  ]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const restartClip = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = trimStart;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = formatTime(video.currentTime);
    }
    video.play();
    setIsPlaying(true);
  };

  const aspectClass =
    exportSettings.aspectRatio === '9:16'
      ? 'aspect-[9/16] max-h-[580px]'
      : exportSettings.aspectRatio === '1:1'
      ? 'aspect-square max-h-[520px]'
      : 'aspect-video max-h-[380px]';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-bold text-white">Prévia em Tempo Real (60 FPS)</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold border border-slate-700">
            {exportSettings.resolution} · {exportSettings.aspectRatio}
          </span>
        </div>
      </div>

      {/* Hidden Native Video for Canvas playback */}
      <video
        ref={videoRef}
        playsInline
        muted
        loop
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Canvas Display Container (Phone Mockup Styling) */}
      <div className="relative group w-full flex items-center justify-center p-2 bg-slate-950/80 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className={`relative ${aspectClass} w-auto shadow-2xl rounded-xl overflow-hidden border border-slate-800 bg-black`}>
          <canvas
            ref={canvasRef}
            width={720}
            height={exportSettings.aspectRatio === '9:16' ? 1280 : exportSettings.aspectRatio === '1:1' ? 720 : 405}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Quick Play/Pause Center Overlay on Hover */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar prévia' : 'Reproduzir prévia'}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-12 h-12 rounded-full bg-slate-900/90 border border-slate-600 text-white flex items-center justify-center shadow-lg">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </div>
          </button>
        </div>
      </div>

      {/* Video Transport Controls */}
      {activeItem && (
        <div className="w-full mt-4 flex items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={restartClip}
              title="Reiniciar prévia do início"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-400 font-mono">
              <strong ref={timeDisplayRef} className="text-white">
                {formatTime(trimStart)}
              </strong>{' '}
              / {formatTime(activeItem.duration)}
            </span>
          </div>

          {activeItem.status === 'done' && (
            <button
              type="button"
              onClick={onDownloadActive}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {activeItem.outputBlob?.type.includes('mp4') ? 'Baixar MP4' : 'Baixar Vídeo HD'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
