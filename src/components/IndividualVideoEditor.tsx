import React, { useState } from 'react';
import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import { FrameEditor } from './FrameEditor';
import { VideoTrimmerCrop } from './VideoTrimmerCrop';
import { EffectsAudioPanel } from './EffectsAudioPanel';
import { ExportSettingsPanel } from './ExportSettingsPanel';
import { getModifiedSections } from '../utils/projectSettings';
import {
  ArrowLeft,
  Sparkles,
  Scissors,
  Sliders,
  Music,
  Film,
  RotateCcw,
  Copy,
  Layers,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatTime } from '../utils/geometryMath';

interface IndividualVideoEditorProps {
  item: VideoQueueItem;
  itemIndex: number;
  queue: VideoQueueItem[];
  globalSettings: VideoProjectSettings;
  isProcessing: boolean;
  onBackToQueue: () => void;
  onUpdateItemSettings: (
    id: string,
    updater: (prev: VideoProjectSettings) => VideoProjectSettings
  ) => void;
  onUpdateItemHeadline: (id: string, headline: string) => void;
  onUpdateTrim: (id: string, startTime: number, endTime: number) => void;
  onSeekPreview: (id: string, time: number) => void;
  onResetToGlobal: (id: string) => void;
  onCopyFromVideo: (targetId: string, sourceId: string) => void;
  onApplyToAll: (sourceId: string) => void;
  onProcessSingle: (id: string) => void;
  onDownloadSingle: (item: VideoQueueItem) => void;
}

type EditorSubTab = 'frame' | 'crop' | 'effects' | 'audio' | 'export';

export const IndividualVideoEditor: React.FC<IndividualVideoEditorProps> = ({
  item,
  itemIndex,
  queue,
  globalSettings,
  isProcessing,
  onBackToQueue,
  onUpdateItemSettings,
  onUpdateItemHeadline,
  onUpdateTrim,
  onSeekPreview,
  onResetToGlobal,
  onCopyFromVideo,
  onApplyToAll,
  onProcessSingle,
  onDownloadSingle,
}) => {
  const [subTab, setSubTab] = useState<EditorSubTab>('frame');
  const [copySourceId, setCopySourceId] = useState<string>('');
  const [showApplyAllModal, setShowApplyAllModal] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const otherVideos = queue.filter((v) => v.id !== item.id);
  const modifiedSections = getModifiedSections(item, globalSettings);
  const settings = item.settings;

  const notify = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleCopyConfirm = () => {
    if (!copySourceId) return;
    onCopyFromVideo(item.id, copySourceId);
    const srcIdx = queue.findIndex((q) => q.id === copySourceId);
    notify(`Configurações copiadas do vídeo #${srcIdx + 1} para este projeto.`);
    setCopySourceId('');
  };

  const handleApplyAllConfirmed = () => {
    onApplyToAll(item.id);
    setShowApplyAllModal(false);
    notify('Configurações aplicadas em todos os outros vídeos da fila.');
  };

  const subTabs: Array<{ id: EditorSubTab; label: string; icon: React.ReactNode }> = [
    { id: 'frame', label: 'Moldura e Marca', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> },
    { id: 'crop', label: 'Corte e Bordas', icon: <Scissors className="w-3.5 h-3.5 text-amber-300" /> },
    { id: 'effects', label: 'Efeitos Visuais', icon: <Sliders className="w-3.5 h-3.5 text-blue-300" /> },
    { id: 'audio', label: 'Áudio', icon: <Music className="w-3.5 h-3.5 text-purple-300" /> },
    { id: 'export', label: 'Exportação', icon: <Film className="w-3.5 h-3.5 text-emerald-300" /> },
  ];

  const outputLabel =
    item.outputExtension === 'mp4' || item.outputBlob?.type.includes('mp4')
      ? 'Baixar MP4'
      : 'Baixar WebM';

  return (
    <div className="space-y-4">
      {/* Editor Top Bar */}
      <div className="bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToQueue}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar à Fila
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Editor Individual
                </span>
                <h2 className="text-sm font-extrabold text-white truncate max-w-[240px] sm:max-w-[340px]">
                  #{itemIndex + 1} {item.name}
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {item.width > 0 ? `${item.width}×${item.height}` : 'Dimensão detectada'} · Duração:{' '}
                {formatTime(item.duration)} · Saída: {settings.exportSettings.resolution} (
                {settings.exportSettings.aspectRatio})
              </p>
            </div>
          </div>

          {/* Primary Single Video Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.status === 'done' && item.outputBlob && (
              <button
                type="button"
                onClick={() => onDownloadSingle(item)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                {outputLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => onProcessSingle(item.id)}
              disabled={isProcessing || item.status === 'error' && !item.duration}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-md disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {item.status === 'processing'
                ? `Processando ${item.progress}%`
                : 'Processar Só Este Vídeo'}
            </button>
          </div>
        </div>

        {/* Modified Sections Pills */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold">Status de edição:</span>
            {modifiedSections.length === 0 ? (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Igual ao Padrão Global
              </span>
            ) : (
              modifiedSections.map((sec) => (
                <span
                  key={sec}
                  className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                >
                  {sec}
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onResetToGlobal(item.id);
                notify('Configurações deste vídeo restauradas para o padrão global.');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 font-semibold transition"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurar Padrão
            </button>

            {otherVideos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowApplyAllModal(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 font-semibold transition"
              >
                <Layers className="w-3 h-3" />
                Aplicar em Todos
              </button>
            )}
          </div>
        </div>

        {/* Copy Config From Another Video */}
        {otherVideos.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap text-xs">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              Copiar config de outro vídeo:
            </span>
            <select
              aria-label="Selecionar vídeo de origem para copiar configurações"
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
              className="flex-1 min-w-[180px] px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Escolha um vídeo da fila...</option>
              {queue.map((v, idx) =>
                v.id === item.id ? null : (
                  <option key={v.id} value={v.id}>
                    #{idx + 1} {v.name}
                  </option>
                )
              )}
            </select>
            <button
              type="button"
              disabled={!copySourceId}
              onClick={handleCopyConfirm}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold transition"
            >
              Copiar para Este
            </button>
          </div>
        )}

        {feedbackMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </div>

      {/* 5 Individual Editor Sub-Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto text-xs font-semibold">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
              subTab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Active Sub-Tab Content */}
      <div>
        {subTab === 'frame' && (
          <FrameEditor
            frameEnabled={settings.frameEnabled}
            onToggleFrameEnabled={(enabled) =>
              onUpdateItemSettings(item.id, (prev) => ({ ...prev, frameEnabled: enabled }))
            }
            frameStyle={settings.frameStyle}
            onSelectFrameStyle={(style) =>
              onUpdateItemSettings(item.id, (prev) => ({ ...prev, frameStyle: style }))
            }
            brand={{
              ...settings.brand,
              headline:
                item.customHeadline !== undefined && item.customHeadline !== ''
                  ? item.customHeadline
                  : settings.brand.headline,
            }}
            onUpdateBrand={(updated) => {
              if (updated.headline !== undefined) {
                onUpdateItemHeadline(item.id, updated.headline);
              }
              onUpdateItemSettings(item.id, (prev) => ({
                ...prev,
                brand: { ...prev.brand, ...updated },
              }));
            }}
          />
        )}

        {subTab === 'crop' && (
          <VideoTrimmerCrop
            activeItem={item}
            cropSettings={settings.crop}
            onUpdateCrop={(updated) =>
              onUpdateItemSettings(item.id, (prev) => ({
                ...prev,
                crop: { ...prev.crop, ...updated },
              }))
            }
            onUpdateTrim={(startTime, endTime) => onUpdateTrim(item.id, startTime, endTime)}
            onSeekPreview={(time) => onSeekPreview(item.id, time)}
          />
        )}

        {subTab === 'effects' && (
          <EffectsAudioPanel
            section="effects"
            effects={settings.effects}
            onUpdateEffects={(updated) =>
              onUpdateItemSettings(item.id, (prev) => ({
                ...prev,
                effects: { ...prev.effects, ...updated },
              }))
            }
            audioSettings={settings.audio}
            onUpdateAudio={() => {}}
            exportSettings={settings.exportSettings}
            onUpdateExportSettings={() => {}}
          />
        )}

        {subTab === 'audio' && (
          <EffectsAudioPanel
            section="audio"
            effects={settings.effects}
            onUpdateEffects={() => {}}
            audioSettings={settings.audio}
            onUpdateAudio={(updated) =>
              onUpdateItemSettings(item.id, (prev) => ({
                ...prev,
                audio: { ...prev.audio, ...updated },
              }))
            }
            exportSettings={settings.exportSettings}
            onUpdateExportSettings={() => {}}
          />
        )}

        {subTab === 'export' && (
          <ExportSettingsPanel
            exportSettings={settings.exportSettings}
            onUpdateExportSettings={(updated) =>
              onUpdateItemSettings(item.id, (prev) => ({
                ...prev,
                exportSettings: { ...prev.exportSettings, ...updated },
              }))
            }
          />
        )}
      </div>

      {/* Confirmation Modal for Apply To All (never uses window.confirm) */}
      {showApplyAllModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                Aplicar configurações em todos os vídeos?
              </div>
              <button
                type="button"
                onClick={() => setShowApplyAllModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação copiará moldura, cores, recorte, efeitos, áudio e exportação do vídeo{' '}
              <strong className="text-white">#{itemIndex + 1}</strong> para todos os outros{' '}
              <strong className="text-white">{otherVideos.length}</strong> vídeos da fila. Os títulos individuais exclusivos e os tempos de corte (início/fim) de cada vídeo serão preservados.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowApplyAllModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyAllConfirmed}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition"
              >
                Confirmar e Aplicar em Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
