import React, { useRef, useState } from 'react';
import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import {
  Upload,
  Play,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  FileArchive,
  Film,
  Sparkles,
  Type,
  ListOrdered,
  X,
  Edit3,
  RotateCcw,
  Database,
} from 'lucide-react';
import { formatTime } from '../utils/geometryMath';
import { downloadLinuxPackage, isVideoOutputReady } from '../utils/exportZip';
import { getModifiedSections } from '../utils/projectSettings';
import { VideoCacheStats, formatBytesCompact } from '../utils/videoCacheDB';

interface BatchQueueProps {
  queue: VideoQueueItem[];
  activeId: string | null;
  globalSettings: VideoProjectSettings;
  onSelectVideo: (id: string) => void;
  onEditVideo: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveVideo: (id: string) => void;
  onProcessAll: () => void;
  onProcessSingle: (id: string) => void;
  onCancelProcess: () => void;
  isProcessing: boolean;
  batchProgress: { current: number; total: number; currentName: string } | null;
  onDownloadSingle: (item: VideoQueueItem) => void;
  onDownloadZip: () => void;
  onLoadDemoSample: () => void;
  onUpdateItemHeadline?: (id: string, headline: string) => void;
  onBatchSetHeadlines?: (headlines: string[]) => void;
  onClearCache?: () => void;
  cacheStats?: VideoCacheStats | null;
  detectedFormatLabel: string;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({
  queue,
  activeId,
  globalSettings,
  onSelectVideo,
  onEditVideo,
  onAddFiles,
  onRemoveVideo,
  onProcessAll,
  onProcessSingle,
  onCancelProcess,
  isProcessing,
  batchProgress,
  onDownloadSingle,
  onDownloadZip,
  onLoadDemoSample,
  onUpdateItemHeadline,
  onBatchSetHeadlines,
  onClearCache,
  cacheStats,
  detectedFormatLabel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBatchTitlesModal, setShowBatchTitlesModal] = useState<boolean>(false);
  const [linesText, setLinesText] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleApplyLines = () => {
    const lines = linesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (onBatchSetHeadlines) {
      onBatchSetHeadlines(lines);
    }
    setShowBatchTitlesModal(false);
  };

  const completedCount = queue.filter(isVideoOutputReady).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Fila de Vídeos em Lote
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                {queue.length} {queue.length === 1 ? 'vídeo' : 'vídeos'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Clique em "EDITAR VÍDEO" para personalizar cada corte de forma independente
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const existing = queue
                  .map((v) => v.customHeadline || v.settings?.brand.headline || '')
                  .join('\n');
                setLinesText(existing);
                setShowBatchTitlesModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
              Títulos por Linha
            </button>
          )}

          <button
            type="button"
            onClick={onLoadDemoSample}
            disabled={isProcessing}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            {queue.length === 0 ? 'Carregar Vídeo de Exemplo' : '+ Vídeo Exemplo'}
          </button>

          {queue.length > 0 && onClearCache && (
            <button
              type="button"
              onClick={onClearCache}
              disabled={isProcessing}
              title="Limpar todos os vídeos da fila e liberar o cache IndexedDB"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Fila
            </button>
          )}
        </div>
      </div>

      {/* Overall Batch Progress Bar */}
      {isProcessing && batchProgress && (
        <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Processando lote ({batchProgress.current} de {batchProgress.total}):{' '}
              <span className="text-white truncate max-w-[180px] sm:max-w-[260px]">
                {batchProgress.currentName}
              </span>
            </span>
            <span className="font-mono text-blue-300 font-bold">
              {Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((batchProgress.current - 1) / Math.max(1, batchProgress.total)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Linux Mint Download Banner */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              Programa para Linux Mint
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                .zip
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Execute no seu PC com o script <code className="text-emerald-400 font-mono">./iniciar.sh</code>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => downloadLinuxPackage()}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer ml-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar Arquivo Linux (.zip)
        </button>
      </div>

      {/* Upload Dropzone */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/80 bg-slate-950/50 hover:bg-slate-950/80 rounded-xl p-5 text-center cursor-pointer transition group"
      >
        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-2 group-hover:scale-110 transition">
          <Upload className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-white">
          Toque para escolher os vídeos ou arraste vários arquivos aqui
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Suporta MP4, MOV, WebM em lote · Edição 100% independente por vídeo
        </p>
      </div>

      {/* Video List */}
      {queue.length > 0 && (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {queue.map((item, idx) => {
            const isSelected = item.id === activeId;
            const modifiedSections = getModifiedSections(item, globalSettings);
            const itemRes = item.settings?.exportSettings?.resolution || globalSettings.exportSettings.resolution;
            const itemRatio = item.settings?.exportSettings?.aspectRatio || globalSettings.exportSettings.aspectRatio;
            const itemExt =
              item.outputExtension ||
              (item.outputMimeType?.includes('mp4') || item.outputBlob?.type.includes('mp4')
                ? 'mp4'
                : 'webm');

            return (
              <div
                key={item.id}
                onClick={() => onSelectVideo(item.id)}
                className={`p-3 rounded-xl border flex flex-col gap-2.5 cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/70 ring-1 ring-blue-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Thumbnail & Info */}
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                    <div className="relative w-12 h-14 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={`Prévia ${item.name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-5 h-5 text-slate-600" />
                      )}
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/80 px-1 rounded text-slate-300 font-mono">
                        {formatTime(item.duration)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <h4 className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                          {item.name}
                        </h4>
                        {modifiedSections.length > 0 && (
                          <span
                            title={`Personalizado: ${modifiedSections.join(', ')}`}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                          >
                            {modifiedSections.length}{' '}
                            {modifiedSections.length === 1 ? 'ajuste individual' : 'ajustes individuais'}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>
                          Corte: {item.trim.startTime.toFixed(1)}s - {item.trim.endTime.toFixed(1)}s
                        </span>
                        {item.width > 0 && (
                          <span>
                            ({item.width}×{item.height})
                          </span>
                        )}
                        <span className="text-cyan-400 font-mono">
                          → {itemRes} {itemRatio}
                        </span>
                      </div>

                      {/* Progress bar if processing */}
                      {item.status === 'processing' && (
                        <div className="mt-1.5 space-y-1">
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full transition-all duration-200"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          {item.statusText && (
                            <p className="text-[10px] text-blue-300 truncate">{item.statusText}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div
                    className="flex items-center gap-1.5 flex-shrink-0 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onEditVideo(item.id)}
                      aria-label={`Editar vídeo ${idx + 1}: ${item.name}`}
                      className="px-2.5 py-1 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      EDITAR VÍDEO
                    </button>

                    {item.status !== 'processing' && !isProcessing && (
                      <button
                        type="button"
                        onClick={() => onProcessSingle(item.id)}
                        title="Processar apenas este vídeo"
                        aria-label={`Processar só o vídeo ${idx + 1}`}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Play className="w-3 h-3 text-cyan-400" />
                      </button>
                    )}

                    {item.status === 'processing' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {item.progress}%
                      </span>
                    )}

                    {isVideoOutputReady(item) && (
                      <button
                        type="button"
                        onClick={() => onDownloadSingle(item)}
                        title={`Baixar vídeo gerado (.${itemExt})`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition shadow-sm"
                      >
                        <Download className="w-3 h-3" />
                        {itemExt.toUpperCase()}
                      </button>
                    )}

                    {item.status === 'error' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Erro
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveVideo(item.id)}
                      disabled={isProcessing && item.status === 'processing'}
                      title="Remover vídeo da fila"
                      aria-label={`Remover vídeo ${idx + 1} da fila`}
                      className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 text-slate-400 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-Video Error Details + Retry */}
                {item.status === 'error' && item.errorMessage && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-2 flex-wrap"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{item.errorMessage}</span>
                    </span>
                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={() => onProcessSingle(item.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Tentar Novamente
                      </button>
                    )}
                  </div>
                )}

                {/* Individual Title input line */}
                <div
                  className="pt-1.5 border-t border-slate-800/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 flex-shrink-0">
                      <Type className="w-3 h-3 text-cyan-400" /> Título:
                    </span>
                    <input
                      type="text"
                      value={item.customHeadline !== undefined ? item.customHeadline : ''}
                      onChange={(e) => onUpdateItemHeadline?.(item.id, e.target.value)}
                      placeholder="Título exclusivo deste corte (ou deixe vazio para usar o padrão)"
                      className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Batch Titles by Line */}
      {showBatchTitlesModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <ListOrdered className="w-4 h-4 text-blue-400" />
                Definir Títulos Diferentes por Linha
              </div>
              <button
                type="button"
                onClick={() => setShowBatchTitlesModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Digite ou cole sua lista de títulos abaixo (1 título por linha). O sistema aplicará a{' '}
              <strong>Linha 1 no Vídeo 1</strong>, a <strong>Linha 2 no Vídeo 2</strong>, e assim por diante.
            </p>

            <textarea
              rows={6}
              value={linesText}
              onChange={(e) => setLinesText(e.target.value)}
              placeholder={`Exemplo:\nVEJA O QUE ELE DISSE NO FINAL 😱\nO SEGREDO QUE NINGUÉM CONTA!\nREVELAÇÃO CHOCANTE AO VIVO 🔥`}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>
                Linhas digitadas:{' '}
                <strong className="text-blue-400">
                  {linesText.split('\n').filter((l) => l.trim().length > 0).length}
                </strong>{' '}
                / Vídeos na fila: <strong className="text-white">{queue.length}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchTitlesModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyLines}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                >
                  Aplicar na Fila
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing Bottom Bar */}
      {queue.length > 0 && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
          <div className="text-xs text-slate-400 w-full sm:w-auto text-center sm:text-left flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span>
              Concluídos: <strong className="text-emerald-400">{completedCount}</strong> de {queue.length}
            </span>
            {cacheStats && cacheStats.totalBytes > 0 && (
              <span
                title="Vídeos armazenados em cache persistente no IndexedDB (libera memória RAM)"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono"
              >
                <Database className="w-3 h-3 text-cyan-400" />
                Cache: {formatBytesCompact(cacheStats.totalBytes)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {completedCount > 1 && (
              <button
                type="button"
                onClick={onDownloadZip}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
              >
                <FileArchive className="w-4 h-4 text-amber-400" />
                Baixar Todos (ZIP)
              </button>
            )}

            {isProcessing ? (
              <button
                type="button"
                onClick={onCancelProcess}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-red-500/20"
              >
                Cancelar Processamento
              </button>
            ) : (
              <button
                type="button"
                onClick={onProcessAll}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/25 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                {queue.length === 1
                  ? `Gerar Vídeo (${detectedFormatLabel})`
                  : `Processar Todos (${queue.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
