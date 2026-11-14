import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  VideoProjectSettings,
  VideoQueueItem,
} from './types/video';
import { Header } from './components/Header';
import { FrameEditor } from './components/FrameEditor';
import { VideoTrimmerCrop } from './components/VideoTrimmerCrop';
import { EffectsAudioPanel } from './components/EffectsAudioPanel';
import { BatchQueue } from './components/BatchQueue';
import { LiveCanvasPreview } from './components/LiveCanvasPreview';
import { DocumentationModal } from './components/DocumentationModal';
import { IndividualVideoEditor } from './components/IndividualVideoEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  getSupportedMimeType,
  probeVideoMetadata,
  processVideoItem,
} from './utils/videoProcessor';
import { downloadSingleVideo, downloadAllVideosAsZip } from './utils/exportZip';
import { createSyntheticDemoVideo } from './utils/demoVideo';
import {
  DEFAULT_PROJECT_SETTINGS,
  cloneVideoSettings,
  collectReferencedBlobUrls,
  resolveVideoSettings,
} from './utils/projectSettings';
import {
  Sparkles,
  Scissors,
  Sliders,
  Film,
  AlertCircle,
  X,
  Edit3,
  Globe,
  RotateCcw,
} from 'lucide-react';

interface AppErrorBanner {
  title: string;
  message: string;
  retry?: () => void;
}

export default function App() {
  // Navigation tabs in Studio mode
  const [activeTab, setActiveTab] = useState<'frame' | 'crop' | 'effects' | 'queue'>('frame');
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [appError, setAppError] = useState<AppErrorBanner | null>(null);

  // Level 1: Global Settings (default template for new videos)
  const [globalSettings, setGlobalSettings] = useState<VideoProjectSettings>(() => {
    const initial = cloneVideoSettings(DEFAULT_PROJECT_SETTINGS);
    try {
      const saved = localStorage.getItem('wifive_pro_brand');
      if (saved) {
        const parsed = JSON.parse(saved);
        initial.brand = { ...initial.brand, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return initial;
  });

  // Level 2: Independent per-video queue
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<'active' | 'global'>('active');

  // Processing state & concurrency lock
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [seekSignal, setSeekSignal] = useState<{
    id: string;
    time: number;
    seq: number;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const processingLockRef = useRef<boolean>(false);
  const queueRef = useRef<VideoQueueItem[]>(queue);
  const globalSettingsRef = useRef<VideoProjectSettings>(globalSettings);
  const knownBlobUrlsRef = useRef<Set<string>>(new Set());

  queueRef.current = queue;
  globalSettingsRef.current = globalSettings;

  // Persist core brand identity safely
  useEffect(() => {
    try {
      localStorage.setItem(
        'wifive_pro_brand',
        JSON.stringify({
          pageName: globalSettings.brand.pageName,
          handle: globalSettings.brand.handle,
          badgeType: globalSettings.brand.badgeType,
          accentColor: globalSettings.brand.accentColor,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    globalSettings.brand.pageName,
    globalSettings.brand.handle,
    globalSettings.brand.badgeType,
    globalSettings.brand.accentColor,
  ]);

  // Reference-counted blob URL garbage collector
  useEffect(() => {
    const referenced = collectReferencedBlobUrls(queue, globalSettings);
    for (const u of referenced) {
      knownBlobUrlsRef.current.add(u);
    }
    for (const tracked of Array.from(knownBlobUrlsRef.current)) {
      if (!referenced.has(tracked)) {
        try {
          URL.revokeObjectURL(tracked);
        } catch {
          // ignore
        }
        knownBlobUrlsRef.current.delete(tracked);
      }
    }
  }, [queue, globalSettings]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      for (const u of knownBlobUrlsRef.current) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
      knownBlobUrlsRef.current.clear();
    };
  }, []);

  // Selected Active Video Item & Index
  const activeIndex = useMemo(() => {
    if (queue.length === 0) return -1;
    const idx = queue.findIndex((item) => item.id === activeVideoId);
    return idx >= 0 ? idx : 0;
  }, [queue, activeVideoId]);

  const activeItem = activeIndex >= 0 ? queue[activeIndex] : null;

  const editingItemIndex = useMemo(() => {
    if (!editingVideoId) return -1;
    return queue.findIndex((item) => item.id === editingVideoId);
  }, [queue, editingVideoId]);

  const editingItem = editingItemIndex >= 0 ? queue[editingItemIndex] : null;

  // Target item being previewed (if in Individual Editor, always preview editingItem)
  const previewItem = editingItem || activeItem;
  const previewIndex = editingItem ? editingItemIndex : Math.max(0, activeIndex);

  // Resolved settings for preview
  const previewResolvedSettings = useMemo(() => {
    if (previewItem) {
      return resolveVideoSettings(previewItem, globalSettings);
    }
    return cloneVideoSettings(globalSettings);
  }, [previewItem, globalSettings]);

  // Which settings Studio tabs currently edit
  const isEditingActiveVideo =
    editingItem === null && editScope === 'active' && activeItem !== null;

  const studioSettings = useMemo(() => {
    if (isEditingActiveVideo && activeItem) {
      return resolveVideoSettings(activeItem, globalSettings);
    }
    return globalSettings;
  }, [isEditingActiveVideo, activeItem, globalSettings]);

  const detectedFormat = useMemo(() => getSupportedMimeType(), []);

  // Helper to update either active video's independent settings OR global settings
  const updateStudioSettings = useCallback(
    (updater: (prev: VideoProjectSettings) => VideoProjectSettings) => {
      if (isEditingActiveVideo && activeItem) {
        setQueue((prevQueue) =>
          prevQueue.map((item) => {
            if (item.id !== activeItem.id) return item;
            const nextSettings = updater(cloneVideoSettings(item.settings));
            return {
              ...item,
              settings: nextSettings,
              customHeadline: nextSettings.brand.headline,
            };
          })
        );
      } else {
        setGlobalSettings((prevGlobal) => updater(cloneVideoSettings(prevGlobal)));
      }
    },
    [isEditingActiveVideo, activeItem]
  );

  // Helper to update a specific video's independent settings directly
  const updateVideoSettingsById = useCallback(
    (id: string, updater: (prev: VideoProjectSettings) => VideoProjectSettings) => {
      setQueue((prevQueue) =>
        prevQueue.map((item) => {
          if (item.id !== id) return item;
          const nextSettings = updater(cloneVideoSettings(item.settings));
          return {
            ...item,
            settings: nextSettings,
          };
        })
      );
    },
    []
  );

  // Add Files to Queue with safe metadata probing
  const handleAddFiles = async (files: FileList | File[]) => {
    setAppError(null);
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const templateSnapshot = cloneVideoSettings(globalSettingsRef.current);

    const newItems: VideoQueueItem[] = fileArray.map((file) => {
      const url = URL.createObjectURL(file);
      return {
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        url,
        name: file.name,
        duration: 0,
        width: 0,
        height: 0,
        thumbnailUrl: '',
        trim: { startTime: 0, endTime: 0 },
        settings: cloneVideoSettings(templateSnapshot),
        status: file.size === 0 ? 'error' : 'idle',
        progress: 0,
        statusText: file.size === 0 ? 'Arquivo vazio' : 'Lendo metadados...',
        outputBlob: null,
        outputUrl: null,
        errorMessage:
          file.size === 0
            ? 'Arquivo com 0 bytes. Verifique se o vídeo não está vazio ou corrompido.'
            : null,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    if (!activeVideoId && newItems.length > 0) {
      setActiveVideoId(newItems[0].id);
      setEditScope('active');
    }

    // Probe each video cleanly and isolate corrupted/unsupported files per item
    await Promise.all(
      newItems.map(async (item) => {
        if (item.status === 'error') return;
        try {
          const meta = await probeVideoMetadata(item.url);
          setQueue((prev) =>
            prev.map((v) =>
              v.id === item.id
                ? {
                    ...v,
                    duration: meta.duration,
                    width: meta.width,
                    height: meta.height,
                    thumbnailUrl: meta.thumbnailUrl,
                    trim: { startTime: 0, endTime: meta.duration },
                    statusText: undefined,
                    errorMessage: null,
                  }
                : v
            )
          );
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Arquivo de vídeo corrompido ou formato não suportado.';
          setQueue((prev) =>
            prev.map((v) =>
              v.id === item.id
                ? {
                    ...v,
                    status: 'error',
                    statusText: undefined,
                    errorMessage: msg,
                  }
                : v
            )
          );
        }
      })
    );
  };

  const handleRemoveVideo = (id: string) => {
    if (isProcessing && queue.find((v) => v.id === id)?.status === 'processing') {
      return;
    }
    setQueue((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (activeVideoId === id) {
        setActiveVideoId(filtered.length > 0 ? filtered[0].id : null);
      }
      if (editingVideoId === id) {
        setEditingVideoId(null);
      }
      return filtered;
    });
  };

  const handleLoadDemoSample = async () => {
    setAppError(null);
    try {
      const demo = await createSyntheticDemoVideo(globalSettingsRef.current);
      setQueue((prev) => [...prev, demo]);
      setActiveVideoId(demo.id);
      setEditScope('active');
    } catch (err) {
      setAppError({
        title: 'Falha ao gerar vídeo de demonstração',
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível criar o vídeo de exemplo no navegador.',
        retry: handleLoadDemoSample,
      });
    }
  };

  const handleUpdateTrimById = (id: string, startTime: number, endTime: number) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, trim: { startTime, endTime } } : item
      )
    );
  };

  const handleSeekPreview = useCallback((id: string, time: number) => {
    setSeekSignal((prev) => ({
      id,
      time,
      seq: (prev?.seq || 0) + 1,
    }));
  }, []);

  const handleUpdateItemHeadline = (id: string, headline: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const effectiveHeadline =
          headline !== '' ? headline : globalSettingsRef.current.brand.headline;
        return {
          ...item,
          customHeadline: headline,
          settings: {
            ...item.settings,
            brand: {
              ...item.settings.brand,
              headline: effectiveHeadline,
            },
          },
        };
      })
    );
  };

  const handleBatchSetHeadlines = (headlines: string[]) => {
    setQueue((prev) =>
      prev.map((item, idx) => {
        if (idx < headlines.length) {
          const line = headlines[idx];
          return {
            ...item,
            customHeadline: line,
            settings: {
              ...item.settings,
              brand: {
                ...item.settings.brand,
                headline: line,
              },
            },
          };
        }
        return item;
      })
    );
  };

  const handleResetItemToGlobal = (id: string) => {
    const fresh = cloneVideoSettings(globalSettingsRef.current);
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              settings: fresh,
              customHeadline: fresh.brand.headline,
            }
          : item
      )
    );
  };

  const handleCopyConfigFromVideo = (targetId: string, sourceId: string) => {
    const source = queueRef.current.find((v) => v.id === sourceId);
    if (!source) return;
    const copied = cloneVideoSettings(resolveVideoSettings(source, globalSettingsRef.current));
    setQueue((prev) =>
      prev.map((item) =>
        item.id === targetId
          ? {
              ...item,
              settings: copied,
              customHeadline: copied.brand.headline,
            }
          : item
      )
    );
  };

  const handleApplyConfigToAll = (sourceId: string) => {
    const source = queueRef.current.find((v) => v.id === sourceId);
    if (!source) return;
    const template = cloneVideoSettings(resolveVideoSettings(source, globalSettingsRef.current));

    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === sourceId) return item;
        const cloned = cloneVideoSettings(template);
        // Preserve each video's own custom headline if it already had one distinct from source
        const preservedHeadline =
          item.customHeadline && item.customHeadline.trim() !== ''
            ? item.customHeadline
            : cloned.brand.headline;
        cloned.brand.headline = preservedHeadline;
        return {
          ...item,
          settings: cloned,
        };
      })
    );
  };

  // Unified sequential runner supporting full queue or targeted single-video processing
  const runProcessQueue = async (targetIds?: string[]) => {
    if (processingLockRef.current || isProcessing) return;

    const currentQueue = queueRef.current;
    const itemsToRun = targetIds
      ? currentQueue.filter((item) => targetIds.includes(item.id))
      : currentQueue.filter((item) => item.file && item.url);

    if (itemsToRun.length === 0) return;

    processingLockRef.current = true;
    setIsProcessing(true);
    setAppError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let failedCount = 0;

    try {
      for (let i = 0; i < itemsToRun.length; i++) {
        if (controller.signal.aborted) break;

        // Re-read freshest item snapshot right before processing
        const latestItem = queueRef.current.find((v) => v.id === itemsToRun[i].id);
        if (!latestItem) continue;

        setActiveVideoId(latestItem.id);
        setBatchProgress({
          current: i + 1,
          total: itemsToRun.length,
          currentName: latestItem.name,
        });

        // Clear any stale output reference on this item and mark processing
        setQueue((q) =>
          q.map((v) =>
            v.id === latestItem.id
              ? {
                  ...v,
                  status: 'processing',
                  progress: 5,
                  statusText: 'Iniciando processamento...',
                  errorMessage: null,
                  outputBlob: null,
                  outputUrl: null,
                }
              : v
          )
        );

        try {
          const resolved = resolveVideoSettings(latestItem, globalSettingsRef.current);

          const result = await processVideoItem(
            latestItem,
            resolved,
            (progress, statusText) => {
              setQueue((q) =>
                q.map((v) =>
                  v.id === latestItem.id ? { ...v, progress, statusText } : v
                )
              );
            },
            controller.signal
          );

          setQueue((q) =>
            q.map((v) =>
              v.id === latestItem.id
                ? {
                    ...v,
                    status: 'done',
                    progress: 100,
                    statusText: `Concluído (${result.formatLabel})`,
                    outputBlob: result.outputBlob,
                    outputUrl: result.outputUrl,
                    outputMimeType: result.mimeType,
                    outputExtension: result.extension,
                    outputSizeMb: +(result.outputBlob.size / (1024 * 1024)).toFixed(2),
                    errorMessage: null,
                  }
                : v
            )
          );
        } catch (err) {
          if (controller.signal.aborted) {
            setQueue((q) =>
              q.map((v) =>
                v.id === latestItem.id
                  ? {
                      ...v,
                      status: 'idle',
                      progress: 0,
                      statusText: 'Cancelado pelo usuário',
                    }
                  : v
              )
            );
            break;
          }

          failedCount++;
          const msg =
            err instanceof Error ? err.message : 'Erro inesperado durante o processamento';

          setQueue((q) =>
            q.map((v) =>
              v.id === latestItem.id
                ? {
                    ...v,
                    status: 'error',
                    progress: 0,
                    statusText: undefined,
                    errorMessage: msg,
                  }
                : v
            )
          );
          // Continue processing remaining videos in the batch!
        }
      }

      if (failedCount > 0 && !controller.signal.aborted) {
        setAppError({
          title: 'Alguns vídeos apresentaram erro no processamento',
          message: `${failedCount} ${
            failedCount === 1 ? 'vídeo falhou' : 'vídeos falharam'
          }, mas o restante da fila continuou normalmente. Verifique os detalhes no card de cada vídeo com erro.`,
        });
      }
    } finally {
      processingLockRef.current = false;
      abortControllerRef.current = null;
      setIsProcessing(false);
      setBatchProgress(null);
    }
  };

  const handleProcessAll = () => runProcessQueue();
  const handleProcessSingle = (id: string) => runProcessQueue([id]);

  const handleCancelProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDownloadSingle = (item: VideoQueueItem) => {
    try {
      downloadSingleVideo(item);
    } catch (err) {
      setAppError({
        title: 'Falha ao baixar vídeo',
        message: err instanceof Error ? err.message : 'Arquivo de saída indisponível.',
      });
    }
  };

  const handleDownloadZip = async () => {
    try {
      await downloadAllVideosAsZip(queueRef.current);
    } catch (err) {
      setAppError({
        title: 'Erro ao compactar arquivos ZIP',
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível gerar o arquivo ZIP dos vídeos concluídos.',
        retry: handleDownloadZip,
      });
    }
  };

  const headerContextLabel = editingItem
    ? `Editando Vídeo #${editingItemIndex + 1}`
    : isEditingActiveVideo && activeItem
    ? `Vídeo #${activeIndex + 1}`
    : 'Padrão Global';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* App Header */}
      <Header
        exportSettings={
          editingItem
            ? editingItem.settings.exportSettings
            : studioSettings.exportSettings
        }
        onUpdateExportSettings={(updated) => {
          if (editingItem) {
            updateVideoSettingsById(editingItem.id, (prev) => ({
              ...prev,
              exportSettings: { ...prev.exportSettings, ...updated },
            }));
          } else {
            updateStudioSettings((prev) => ({
              ...prev,
              exportSettings: { ...prev.exportSettings, ...updated },
            }));
          }
        }}
        onOpenDocs={() => setIsDocsOpen(true)}
        queueCount={queue.length}
        editingContextLabel={headerContextLabel}
        formatBadge={detectedFormat.label}
      />

      {/* Non-blocking App Error Banner */}
      {appError && (
        <div
          role="alert"
          className="max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 pt-4"
        >
          <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-100 flex items-center justify-between gap-3 flex-wrap shadow-lg">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">{appError.title}</div>
                <div className="text-red-200 mt-0.5">{appError.message}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {appError.retry && (
                <button
                  type="button"
                  onClick={appError.retry}
                  className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Tentar Novamente
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppError(null)}
                aria-label="Fechar aviso de erro"
                className="p-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Individual Editor OR Studio Tabs */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <ErrorBoundary onReset={() => setEditingVideoId(null)}>
            {editingItem ? (
              <IndividualVideoEditor
                item={editingItem}
                itemIndex={editingItemIndex}
                queue={queue}
                globalSettings={globalSettings}
                isProcessing={isProcessing}
                onBackToQueue={() => {
                  setEditingVideoId(null);
                  setActiveTab('queue');
                }}
                onUpdateItemSettings={updateVideoSettingsById}
                onUpdateItemHeadline={handleUpdateItemHeadline}
                onUpdateTrim={handleUpdateTrimById}
                onSeekPreview={handleSeekPreview}
                onResetToGlobal={handleResetItemToGlobal}
                onCopyFromVideo={handleCopyConfigFromVideo}
                onApplyToAll={handleApplyConfigToAll}
                onProcessSingle={handleProcessSingle}
                onDownloadSingle={handleDownloadSingle}
              />
            ) : (
              <>
                {/* Studio Navigation Tabs */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('frame')}
                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      activeTab === 'frame'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-emerald-300" />
                    Fila em Lote ({queue.length})
                  </button>
                </div>

                {/* Context Target Banner (Level 1 Global vs Level 2 Individual) */}
                {activeTab !== 'queue' && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
                    {isEditingActiveVideo && activeItem ? (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[10px] flex-shrink-0">
                            EXCLUSIVO DO VÍDEO #{activeIndex + 1}
                          </span>
                          <span className="text-slate-300 truncate max-w-[220px]">
                            Alterações afetam apenas <strong className="text-white">{activeItem.name}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingVideoId(activeItem.id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 transition"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editor Completo
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditScope('global')}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <Globe className="w-3 h-3 text-slate-400" />
                            Padrão Global
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                            PADRÃO GLOBAL (NÍVEL 1)
                          </span>
                          <span className="text-slate-400">
                            Novos vídeos adicionados à fila herdam estas configurações.
                          </span>
                        </div>
                        {activeItem && (
                          <button
                            type="button"
                            onClick={() => setEditScope('active')}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/30 text-[11px] font-bold transition"
                          >
                            Editar Vídeo #{activeIndex + 1}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Active Tab Panel */}
                <div className="space-y-4">
                  {activeTab === 'frame' && (
                    <FrameEditor
                      frameEnabled={studioSettings.frameEnabled}
                      onToggleFrameEnabled={(enabled) =>
                        updateStudioSettings((prev) => ({ ...prev, frameEnabled: enabled }))
                      }
                      frameStyle={studioSettings.frameStyle}
                      onSelectFrameStyle={(style) =>
                        updateStudioSettings((prev) => ({ ...prev, frameStyle: style }))
                      }
                      brand={studioSettings.brand}
                      onUpdateBrand={(up) =>
                        updateStudioSettings((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, ...up },
                        }))
                      }
                    />
                  )}

                  {activeTab === 'crop' && (
                    <VideoTrimmerCrop
                      activeItem={activeItem}
                      cropSettings={studioSettings.crop}
                      onUpdateCrop={(up) =>
                        updateStudioSettings((prev) => ({
                          ...prev,
                          crop: { ...prev.crop, ...up },
                        }))
                      }
                      onUpdateTrim={(startTime, endTime) => {
                        if (activeItem) {
                          handleUpdateTrimById(activeItem.id, startTime, endTime);
                        }
                      }}
                      onSeekPreview={(time) => {
                        if (activeItem) {
                          handleSeekPreview(activeItem.id, time);
                        }
                      }}
                    />
                  )}

                  {activeTab === 'effects' && (
                    <EffectsAudioPanel
                      section="all"
                      effects={studioSettings.effects}
                      onUpdateEffects={(up) =>
                        updateStudioSettings((prev) => ({
                          ...prev,
                          effects: { ...prev.effects, ...up },
                        }))
                      }
                      audioSettings={studioSettings.audio}
                      onUpdateAudio={(up) =>
                        updateStudioSettings((prev) => ({
                          ...prev,
                          audio: { ...prev.audio, ...up },
                        }))
                      }
                      exportSettings={studioSettings.exportSettings}
                      onUpdateExportSettings={(up) =>
                        updateStudioSettings((prev) => ({
                          ...prev,
                          exportSettings: { ...prev.exportSettings, ...up },
                        }))
                      }
                    />
                  )}

                  {activeTab === 'queue' && (
                    <BatchQueue
                      queue={queue}
                      activeId={activeItem?.id || null}
                      globalSettings={globalSettings}
                      onSelectVideo={(id) => {
                        setActiveVideoId(id);
                        setEditScope('active');
                      }}
                      onEditVideo={(id) => {
                        setActiveVideoId(id);
                        setEditScope('active');
                        setEditingVideoId(id);
                      }}
                      onAddFiles={handleAddFiles}
                      onRemoveVideo={handleRemoveVideo}
                      onProcessAll={handleProcessAll}
                      onProcessSingle={handleProcessSingle}
                      onCancelProcess={handleCancelProcess}
                      isProcessing={isProcessing}
                      batchProgress={batchProgress}
                      onDownloadSingle={handleDownloadSingle}
                      onDownloadZip={handleDownloadZip}
                      onLoadDemoSample={handleLoadDemoSample}
                      onUpdateItemHeadline={handleUpdateItemHeadline}
                      onBatchSetHeadlines={handleBatchSetHeadlines}
                      detectedFormatLabel={detectedFormat.label}
                    />
                  )}
                </div>

                {/* Bottom helper card if not on queue tab */}
                {activeTab !== 'queue' && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-slate-300">
                        {queue.length}{' '}
                        {queue.length === 1
                          ? 'vídeo na fila'
                          : 'vídeos na fila de processamento'}
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
              </>
            )}
          </ErrorBoundary>
        </div>

        {/* Right Column: Live Preview & Process CTA */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20 space-y-4">
            <ErrorBoundary>
              <LiveCanvasPreview
                activeItem={previewItem}
                activeIndex={previewIndex}
                resolvedSettings={previewResolvedSettings}
                seekSignal={seekSignal}
                onDownloadActive={() => previewItem && handleDownloadSingle(previewItem)}
                isProcessing={isProcessing}
                editingContextLabel={headerContextLabel}
              />
            </ErrorBoundary>

            {/* Quick Process CTA below preview */}
            {queue.length > 0 && activeTab !== 'queue' && !editingItem && (
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {queue.length === 1
                  ? `Processar & Gerar (${detectedFormat.label})`
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
