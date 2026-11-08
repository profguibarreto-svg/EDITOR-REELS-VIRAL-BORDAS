import React, { useState, useEffect, useRef } from 'react';
import {
  FrameStyle,
  ProfileBrand,
  VisualEffects,
  AudioSettings,
  VideoCropSettings,
  ExportSettings,
  VideoQueueItem,
} from './types/video';
import { Header } from './components/Header';
import { FrameEditor } from './components/FrameEditor';
import { VideoTrimmerCrop } from './components/VideoTrimmerCrop';
import { EffectsAudioPanel } from './components/EffectsAudioPanel';
import { BatchQueue } from './components/BatchQueue';
import { LiveCanvasPreview } from './components/LiveCanvasPreview';
import { DocumentationModal } from './components/DocumentationModal';
import { processVideoItem } from './utils/videoProcessor';
import { downloadSingleVideo, downloadAllVideosAsZip } from './utils/exportZip';
import { createSyntheticDemoVideo } from './utils/demoVideo';
import {
  Sparkles,
  Scissors,
  Sliders,
  Film,
  FileText,
  AlertCircle,
  CheckCircle2,
  Share2,
  Tv,
  Layers,
} from 'lucide-react';

export default function App() {
  // Navigation tabs for mobile / small screens
  const [activeTab, setActiveTab] = useState<'frame' | 'crop' | 'effects' | 'queue'>('frame');
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Studio State
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('post');
  const [brand, setBrand] = useState<ProfileBrand>({
    pageName: 'Cortes da Fofoca',
    handle: '@cortesvirais',
    avatarUrl: null,
    headline: 'VEJA O QUE ELE FALOU NO FINAL 😱',
    badgeType: 'blue',
    accentColor: '#00f0ff',
    customFrameUrl: null,
    fontSizeHeadline: 1.0,
    fontSizeName: 1.0,
    avatarScale: 1.0,
    framePositionY: 2.5,
    framePositionX: 50,
    frameScale: 1.0,
    textAlign: 'left',
    cardBgColor: 'rgba(12, 18, 38, 0.94)',
    textColor: '#ffffff',
  });

  const [effects, setEffects] = useState<VisualEffects>({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blurBackground: 25,
    vignette: false,
    sharpen: false,
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    originalVolume: 1.0,
    bgmVolume: 0.25,
    bgmTrackId: 'lofi',
    customAudioUrl: null,
    customAudioName: null,
  });

  const [cropSettings, setCropSettings] = useState<VideoCropSettings>({
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    scale: 1.0,
    positionY: 50,
    positionX: 50,
    fitMode: 'contain-blur',
    backdropColor: '#0a0d18',
  });

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: '1080p',
    aspectRatio: '9:16',
    fps: 30,
    bitrateMbps: 8,
    stripMetadata: true,
    speed: 1.0,
  });

  // Video Queue
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved brand from localStorage on mount
  useEffect(() => {
    let isMounted = true;
    try {
      const saved = localStorage.getItem('wifive_pro_brand');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBrand((prev) => ({ ...prev, ...parsed }));
      }
    } catch (_) {}

    // Auto load a demo video on first mount if empty
    createSyntheticDemoVideo().then((demo) => {
      if (isMounted) {
        setQueue((prev) => (prev.length === 0 ? [demo] : prev));
        setActiveVideoId((prev) => prev || demo.id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save brand to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'wifive_pro_brand',
        JSON.stringify({
          pageName: brand.pageName,
          handle: brand.handle,
          badgeType: brand.badgeType,
          accentColor: brand.accentColor,
        })
      );
    } catch (_) {}
  }, [brand.pageName, brand.handle, brand.badgeType, brand.accentColor]);

  // Selected Active Video Item (memoized to keep reference stable)
  const activeItem = React.useMemo(() => {
    return queue.find((item) => item.id === activeVideoId) || queue[0] || null;
  }, [queue, activeVideoId]);

  // Add Files to Queue
  const handleAddFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: VideoQueueItem[] = fileArray.map((file) => {
      const url = URL.createObjectURL(file);
      return {
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        url,
        name: file.name,
        duration: 0,
        width: 0,
        height: 0,
        thumbnailUrl: '',
        trim: { startTime: 0, endTime: 0 },
        status: 'idle',
        progress: 0,
        outputBlob: null,
        outputUrl: null,
        errorMessage: null,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    if (!activeVideoId && newItems.length > 0) {
      setActiveVideoId(newItems[0].id);
    }

    // Load metadata and thumbnails in background
    newItems.forEach((item) => {
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.preload = 'metadata';
      tempVideo.src = item.url;
      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration || 10;
        const width = tempVideo.videoWidth || 720;
        const height = tempVideo.videoHeight || 1280;

        // capture quick thumbnail at 1s or 0s
        tempVideo.currentTime = Math.min(1, duration * 0.1);
        tempVideo.onseeked = () => {
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 120;
          thumbCanvas.height = Math.round((120 / width) * height);
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(tempVideo, 0, 0, thumbCanvas.width, thumbCanvas.height);
            const thumbUrl = thumbCanvas.toDataURL('image/jpeg');
            setQueue((q) =>
              q.map((v) =>
                v.id === item.id
                  ? {
                      ...v,
                      duration,
                      width,
                      height,
                      thumbnailUrl: thumbUrl,
                      trim: { startTime: 0, endTime: duration },
                    }
                  : v
              )
            );
          }
        };
      };
    });
  };

  const handleRemoveVideo = (id: string) => {
    setQueue((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (activeVideoId === id) {
        setActiveVideoId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleLoadDemoSample = async () => {
    const demo = await createSyntheticDemoVideo();
    setQueue((prev) => [...prev, demo]);
    setActiveVideoId(demo.id);
  };

  // Trimming update for active video
  const handleUpdateTrim = (startTime: number, endTime: number) => {
    if (!activeItem) return;
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id ? { ...item, trim: { startTime, endTime } } : item
      )
    );
  };

  // Individual headline update per video
  const handleUpdateItemHeadline = (id: string, headline: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, customHeadline: headline } : item))
    );
  };

  // Batch headlines by lines
  const handleBatchSetHeadlines = (headlines: string[]) => {
    setQueue((prev) =>
      prev.map((item, idx) => {
        if (idx < headlines.length) {
          return { ...item, customHeadline: headlines[idx] };
        }
        return item;
      })
    );
  };

  // Batch Processing
  const handleProcessAll = async () => {
    if (queue.length === 0 || isProcessing) return;

    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (abortControllerRef.current?.signal.aborted) break;

        // Set active for preview
        setActiveVideoId(item.id);

        // Update item status
        setQueue((q) =>
          q.map((v) => (v.id === item.id ? { ...v, status: 'processing', progress: 5 } : v))
        );

        try {
          const result = await processVideoItem(
            item,
            frameStyle,
            brand,
            effects,
            audioSettings,
            cropSettings,
            exportSettings,
            (progress, statusText) => {
              setQueue((q) =>
                q.map((v) => (v.id === item.id ? { ...v, progress } : v))
              );
            },
            abortControllerRef.current?.signal
          );

          setQueue((q) =>
            q.map((v) =>
              v.id === item.id
                ? {
                    ...v,
                    status: 'done',
                    progress: 100,
                    outputBlob: result.outputBlob,
                    outputUrl: result.outputUrl,
                    errorMessage: null,
                  }
                : v
            )
          );
        } catch (err: any) {
          if (abortControllerRef.current?.signal.aborted) break;
          setQueue((q) =>
            q.map((v) =>
              v.id === item.id
                ? {
                    ...v,
                    status: 'error',
                    progress: 0,
                    errorMessage: err.message || 'Erro no processamento',
                  }
                : v
            )
          );
        }
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
  };

  const handleDownloadSingle = (item: VideoQueueItem) => {
    downloadSingleVideo(item);
  };

  const handleDownloadZip = () => {
    downloadAllVideosAsZip(queue);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* App Header */}
      <Header
        exportSettings={exportSettings}
        onUpdateExportSettings={(updated) => setExportSettings((prev) => ({ ...prev, ...updated }))}
        onOpenDocs={() => setIsDocsOpen(true)}
        queueCount={queue.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Studio Controls (Tabs / Panels) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Studio Navigation Tabs */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('frame')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'frame'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              Moldura & Marca
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('crop')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'crop'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-300" />
              Corte & Bordas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('effects')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'effects'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-fuchsia-300" />
              Efeitos & Áudio
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-emerald-300" />
              Fila em Lote ({queue.length})
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="space-y-4">
            {activeTab === 'frame' && (
              <FrameEditor
                frameStyle={frameStyle}
                onSelectFrameStyle={setFrameStyle}
                brand={brand}
                onUpdateBrand={(up) => setBrand((prev) => ({ ...prev, ...up }))}
              />
            )}

            {activeTab === 'crop' && (
              <VideoTrimmerCrop
                activeItem={activeItem}
                cropSettings={cropSettings}
                onUpdateCrop={(up) => setCropSettings((prev) => ({ ...prev, ...up }))}
                onUpdateTrim={handleUpdateTrim}
              />
            )}

            {activeTab === 'effects' && (
              <EffectsAudioPanel
                effects={effects}
                onUpdateEffects={(up) => setEffects((prev) => ({ ...prev, ...up }))}
                audioSettings={audioSettings}
                onUpdateAudio={(up) => setAudioSettings((prev) => ({ ...prev, ...up }))}
                exportSettings={exportSettings}
                onUpdateExportSettings={(up) => setExportSettings((prev) => ({ ...prev, ...up }))}
              />
            )}

            {activeTab === 'queue' && (
              <BatchQueue
                queue={queue}
                activeId={activeVideoId}
                onSelectVideo={setActiveVideoId}
                onAddFiles={handleAddFiles}
                onRemoveVideo={handleRemoveVideo}
                onProcessAll={handleProcessAll}
                onCancelProcess={handleCancelProcess}
                isProcessing={isProcessing}
                onDownloadSingle={handleDownloadSingle}
                onDownloadZip={handleDownloadZip}
                onLoadDemoSample={handleLoadDemoSample}
                onUpdateItemHeadline={handleUpdateItemHeadline}
                onBatchSetHeadlines={handleBatchSetHeadlines}
              />
            )}
          </div>

          {/* Bottom helper card if not on queue tab */}
          {activeTab !== 'queue' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-slate-300">
                  {queue.length} {queue.length === 1 ? 'vídeo na fila' : 'vídeos na fila de processamento'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1"
              >
                Gerenciar Fila & Baixar ›
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live 60 FPS Preview & Batch Action */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20 space-y-4">
            <LiveCanvasPreview
              activeItem={activeItem}
              frameStyle={frameStyle}
              brand={brand}
              effects={effects}
              cropSettings={cropSettings}
              exportSettings={exportSettings}
              onDownloadActive={() => activeItem && handleDownloadSingle(activeItem)}
            />

            {/* Quick Process CTA directly below preview */}
            {queue.length > 0 && activeTab !== 'queue' && (
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {queue.length === 1
                  ? 'Processar & Gerar MP4 HD'
                  : `Processar Fila Inteira (${queue.length} vídeos)`}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Technical Documentation Modal */}
      <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}
