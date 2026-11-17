import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import { formatTime } from '../utils/geometryMath';
import { buildFilterString, renderCompositeFrame } from '../utils/frameRenderer';
import { getSupportedMimeType } from '../utils/videoProcessor';
import {
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  Smartphone,
  Film,
} from 'lucide-react';

interface LiveCanvasPreviewProps {
  activeItem: VideoQueueItem | null;
  activeIndex?: number;
  resolvedSettings: VideoProjectSettings;
  seekSignal?: { id: string; time: number; seq: number } | null;
  onDownloadActive?: () => void;
  isProcessing?: boolean;
  editingContextLabel?: string;
}

export const LiveCanvasPreview: React.FC<LiveCanvasPreviewProps> = ({
  activeItem,
  activeIndex = 0,
  resolvedSettings,
  seekSignal,
  onDownloadActive,
  isProcessing = false,
  editingContextLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeDisplayRef = useRef<HTMLElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [assetTick, setAssetTick] = useState<number>(0);

  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const customFrameImgRef = useRef<HTMLImageElement | null>(null);

  const { frameEnabled, frameStyle, brand, crop, effects, exportSettings } = resolvedSettings;

  const activeItemId = activeItem?.id;
  const activeItemUrl = activeItem?.url;
  const trimStart = activeItem?.trim.startTime || 0;
  const trimEnd = activeItem?.trim.endTime || (activeItem?.duration ?? 10);
  const customHeadline = activeItem?.customHeadline;

  // Load avatar image cleanly
  useEffect(() => {
    let cancelled = false;
    if (brand.avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled) {
          avatarImgRef.current = img;
          setAssetTick((t) => t + 1);
        }
      };
      img.onerror = () => {
        if (!cancelled) avatarImgRef.current = null;
      };
      img.src = brand.avatarUrl;
      avatarImgRef.current = img;
    } else {
      avatarImgRef.current = null;
      setAssetTick((t) => t + 1);
    }
    return () => {
      cancelled = true;
    };
  }, [brand.avatarUrl]);

  // Load custom PNG overlay cleanly
  useEffect(() => {
    let cancelled = false;
    if (brand.customFrameUrl && frameStyle === 'custom') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled) {
          customFrameImgRef.current = img;
          setAssetTick((t) => t + 1);
        }
      };
      img.onerror = () => {
        if (!cancelled) customFrameImgRef.current = null;
      };
      img.src = brand.customFrameUrl;
      customFrameImgRef.current = img;
    } else {
      customFrameImgRef.current = null;
      setAssetTick((t) => t + 1);
    }
    return () => {
      cancelled = true;
    };
  }, [brand.customFrameUrl, frameStyle]);

  // Setup video element when active video changes + clean disposal
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!activeItemUrl || activeItem?.status === 'error') {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
      setIsPlaying(false);
      return;
    }

    video.src = activeItemUrl;
    video.currentTime = trimStart;
    video.playbackRate = exportSettings.speed || 1.0;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      try {
        video.pause();
      } catch {
        // ignore
      }
    };
  }, [activeItemId, activeItemUrl, activeItem?.status]);

  // Apply seek signal from trim sliders immediately
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !seekSignal || seekSignal.id !== activeItemId || !activeItemUrl) return;
    try {
      video.currentTime = seekSignal.time;
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatTime(seekSignal.time);
      }
    } catch {
      // ignore invalid seek range
    }
  }, [seekSignal, activeItemId, activeItemUrl]);

  // Adjust playback rate without reloading
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = exportSettings.speed || 1.0;
    }
  }, [exportSettings.speed]);

  const drawSingleFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    if (video && activeItemUrl && activeItem?.status !== 'error') {
      const start = trimStart;
      const end = trimEnd > start ? trimEnd : video.duration || 10;

      if (video.currentTime >= end || video.currentTime < start - 0.05) {
        try {
          video.currentTime = start;
        } catch {
          // ignore
        }
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatTime(video.currentTime);
      }
    }

    const filterStr = buildFilterString(effects);

    renderCompositeFrame({
      ctx,
      width: w,
      height: h,
      videoEl: activeItem && activeItem.status !== 'error' ? video : null,
      frameEnabled,
      frameStyle,
      brand,
      crop,
      effects,
      avatarImg: avatarImgRef.current,
      customFrameImg: customFrameImgRef.current,
      currentTime: video ? video.currentTime : 0,
      customHeadline,
      filterStr,
    });
  }, [
    activeItem,
    activeItemUrl,
    trimStart,
    trimEnd,
    frameEnabled,
    frameStyle,
    brand,
    crop,
    effects,
    customHeadline,
    assetTick,
  ]);

  // Main render loop (only schedules RAF while actively playing)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (isProcessing) {
      if (videoEl && !videoEl.paused) {
        videoEl.pause();
      }
      return;
    }

    if (isPlaying && videoEl && activeItemUrl && activeItem?.status !== 'error' && videoEl.paused) {
      videoEl.play().catch(() => setIsPlaying(false));
    }

    let animId: number | null = null;
    let cancelled = false;

    const renderLoop = () => {
      if (cancelled) return;
      drawSingleFrame();
      const video = videoRef.current;
      if (isPlaying && video && !video.paused && !video.ended) {
        animId = requestAnimationFrame(renderLoop);
      }
    };

    renderLoop();

    return () => {
      cancelled = true;
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [isProcessing, isPlaying, activeItemUrl, activeItem?.status, drawSingleFrame, exportSettings.aspectRatio]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !activeItemUrl) return;
    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const restartClip = () => {
    const video = videoRef.current;
    if (!video || !activeItemUrl) return;
    video.currentTime = trimStart;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = formatTime(video.currentTime);
    }
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const aspectClass =
    exportSettings.aspectRatio === '9:16'
      ? 'aspect-[9/16] max-h-[560px]'
      : exportSettings.aspectRatio === '1:1'
      ? 'aspect-square max-h-[500px]'
      : 'aspect-video max-h-[360px]';

  const canvasW = 720;
  const canvasH =
    exportSettings.aspectRatio === '9:16'
      ? 1280
      : exportSettings.aspectRatio === '1:1'
      ? 720
      : 405;

  const detectedFormat = getSupportedMimeType();
  const outputLabel =
    activeItem?.outputExtension === 'mp4' || activeItem?.outputBlob?.type.includes('mp4')
      ? 'Baixar MP4 HD'
      : 'Baixar WebM HD';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <h3 className="text-sm font-bold text-white truncate">
            Prévia em Tempo Real
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
          {editingContextLabel && (
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30">
              {editingContextLabel}
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold border border-slate-700">
            {exportSettings.resolution} · {exportSettings.aspectRatio} · {exportSettings.fps}fps
          </span>
        </div>
      </div>

      {/* Currently Previewing Banner */}
      {activeItem && (
        <div className="w-full mb-3 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-300 flex items-center gap-1.5 min-w-0">
            <Film className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-slate-400">Visualizando:</span>
            <strong className="text-white truncate">
              #{activeIndex + 1} {activeItem.name}
            </strong>
          </span>
          <span className="text-slate-400 font-mono flex-shrink-0">
            Saída: .{detectedFormat.extension.toUpperCase()}
          </span>
        </div>
      )}

      {/* Hidden Native Video for Canvas playback */}
      <video
        ref={videoRef}
        playsInline
        muted
        loop
        crossOrigin="anonymous"
        onLoadedData={drawSingleFrame}
        onCanPlay={drawSingleFrame}
        onSeeked={drawSingleFrame}
        className="hidden"
      />

      {/* Canvas Display Container */}
      <div className="relative group w-full flex items-center justify-center p-2 bg-slate-950/80 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div
          className={`relative ${aspectClass} w-auto shadow-2xl rounded-xl overflow-hidden border border-slate-800 bg-black`}
        >
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Quick Play/Pause Center Overlay on Hover */}
          {!isProcessing && activeItem && activeItem.status !== 'error' && (
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
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center z-20">
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <span className="text-xs font-bold text-white mb-1">
                Renderizando {exportSettings.resolution} ({detectedFormat.label})
              </span>
              <span className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">
                Prévia pausada para dedicar máxima performance ao exportador sem travamentos.
              </span>
            </div>
          )}

          {/* Empty State */}
          {!activeItem && !isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/80 pointer-events-none z-10">
              <Smartphone className="w-10 h-10 text-slate-600 mb-2 stroke-1" />
              <span className="text-xs font-semibold text-slate-300">Nenhum vídeo selecionado</span>
              <span className="text-[10px] text-slate-500 mt-1 max-w-[210px] leading-relaxed">
                Adicione vídeos na aba "Fila em Lote" ou carregue um exemplo para ver a prévia ao vivo.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Video Transport Controls */}
      {activeItem && (
        <div className="w-full mt-4 flex items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar prévia' : 'Reproduzir prévia'}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={restartClip}
              aria-label="Reiniciar prévia do início"
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

          {activeItem.status === 'done' && activeItem.outputBlob && (
            <button
              type="button"
              onClick={onDownloadActive}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {outputLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
