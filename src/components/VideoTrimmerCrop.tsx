import React from 'react';
import {
  VideoCropSettings,
  VideoQueueItem,
} from '../types/video';
import {
  Scissors,
  Crop,
  Maximize2,
  Move,
  RotateCcw,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '../utils/geometryMath';

interface VideoTrimmerCropProps {
  activeItem: VideoQueueItem | null;
  cropSettings: VideoCropSettings;
  onUpdateCrop: (updated: Partial<VideoCropSettings>) => void;
  onUpdateTrim: (startTime: number, endTime: number) => void;
  onSeekPreview?: (time: number) => void;
}

export const VideoTrimmerCrop: React.FC<VideoTrimmerCropProps> = ({
  activeItem,
  cropSettings,
  onUpdateCrop,
  onUpdateTrim,
  onSeekPreview,
}) => {
  if (!activeItem) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
          <Scissors className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Nenhum Vídeo Selecionado no Momento</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Envie seus cortes na aba "Fila em Lote" ou clique no botão abaixo para carregar um vídeo de demonstração instantâneo.
          </p>
        </div>
      </div>
    );
  }

  const duration = activeItem.duration || 10;
  const startTime = activeItem.trim.startTime || 0;
  const endTime = activeItem.trim.endTime || duration;
  const trimmedDuration = Math.max(0.1, endTime - startTime);

  const resetCrop = () => {
    onUpdateCrop({
      cropTop: 0,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
      scale: 1,
      positionY: 50,
      positionX: 50,
      fitMode: 'contain-blur',
    });
  };

  const resetTrim = () => {
    onUpdateTrim(0, duration);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-6">
      {/* 1. TIMELINE TRIMMER */}
      <div className="space-y-3 pb-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Corte de Timeline (Início & Fim)</h3>
              <p className="text-[11px] text-slate-400">
                Duração: <strong className="text-amber-400">{trimmedDuration.toFixed(1)}s</strong>{' '}
                <span className="text-slate-500">(original: {duration.toFixed(1)}s)</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetTrim}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar
          </button>
        </div>

        {/* Start & End Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Início do corte:</span>
              <span className="text-amber-400 font-mono font-bold">{formatTime(startTime)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, endTime - 0.5)}
              step={0.1}
              value={startTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateTrim(val, endTime);
                onSeekPreview?.(val);
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Fim do corte:</span>
              <span className="text-amber-400 font-mono font-bold">{formatTime(endTime)}</span>
            </div>
            <input
              type="range"
              min={Math.min(duration, startTime + 0.5)}
              max={duration}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateTrim(startTime, val);
                onSeekPreview?.(val);
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Trim Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const newStart = Math.min(startTime + 3, endTime - 1);
              onUpdateTrim(newStart, endTime);
              onSeekPreview?.(newStart);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
          >
            + Cortar 3s no Início
          </button>
          <button
            type="button"
            onClick={() => {
              const newEnd = Math.max(startTime + 1, endTime - 3);
              onUpdateTrim(startTime, newEnd);
              onSeekPreview?.(newEnd);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
          >
            - Cortar 3s no Final
          </button>
          <button
            type="button"
            onClick={() => {
              // First 15 seconds (ideal for high-retention hook)
              onUpdateTrim(0, Math.min(15, duration));
              onSeekPreview?.(0);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
          >
            Primeiros 15s (Shorts)
          </button>
        </div>
      </div>

      {/* 2. EDGE CROPPING (REMOÇÃO DE BORDAS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Recorte de Bordas do Vídeo</h3>
              <p className="text-[11px] text-slate-400">
                Elimine barras pretas e marcas d'água nos 4 lados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetCrop}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar Recortes
          </button>
        </div>

        {/* 4-way Crop Sliders */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Cortar Topo:</span>
              <span className="font-mono font-bold text-emerald-400">{cropSettings.cropTop}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={cropSettings.cropTop}
              onChange={(e) => onUpdateCrop({ cropTop: parseInt(e.target.value, 10) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Cortar Base:</span>
              <span className="font-mono font-bold text-emerald-400">{cropSettings.cropBottom}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={cropSettings.cropBottom}
              onChange={(e) => onUpdateCrop({ cropBottom: parseInt(e.target.value, 10) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Cortar Esquerda:</span>
              <span className="font-mono font-bold text-emerald-400">{cropSettings.cropLeft}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={cropSettings.cropLeft}
              onChange={(e) => onUpdateCrop({ cropLeft: parseInt(e.target.value, 10) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Cortar Direita:</span>
              <span className="font-mono font-bold text-emerald-400">{cropSettings.cropRight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={cropSettings.cropRight}
              onChange={(e) => onUpdateCrop({ cropRight: parseInt(e.target.value, 10) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 3. SIZE & POSITIONING IN NEW VIDEO */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
            Tamanho e Posicionamento do Vídeo na Moldura:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
            {/* Scale / Zoom */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Zoom / Escala:</span>
                <span className="font-mono font-bold text-blue-400">{cropSettings.scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={cropSettings.scale}
                onChange={(e) => onUpdateCrop({ scale: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Position Y (Vertical alignment) */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Posição Vertical (Y):</span>
                <span className="font-mono font-bold text-blue-400">{cropSettings.positionY}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={cropSettings.positionY}
                onChange={(e) => onUpdateCrop({ positionY: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Position X (Horizontal alignment) */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Posição Horiz. (X):</span>
                <span className="font-mono font-bold text-blue-400">{cropSettings.positionX}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={cropSettings.positionX}
                onChange={(e) => onUpdateCrop({ positionX: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Fit Mode */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Preenchimento de Fundo (Para Vídeos 16:9 Deitados):
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onUpdateCrop({ fitMode: 'contain-blur' })}
                className={`p-2 rounded-lg border text-center transition ${
                  cropSettings.fitMode === 'contain-blur'
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Fundo Desfocado (Viral)
              </button>
              <button
                type="button"
                onClick={() => onUpdateCrop({ fitMode: 'contain-solid' })}
                className={`p-2 rounded-lg border text-center transition ${
                  cropSettings.fitMode === 'contain-solid'
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Fundo Sólido
              </button>
              <button
                type="button"
                onClick={() => onUpdateCrop({ fitMode: 'cover' })}
                className={`p-2 rounded-lg border text-center transition ${
                  cropSettings.fitMode === 'cover'
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Preencher 100%
              </button>
            </div>

            {/* Custom Color Picker for Solid Background */}
            {cropSettings.fitMode === 'contain-solid' && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-semibold">Cor do Fundo Sólido:</span>
                  <input
                    type="color"
                    value={cropSettings.backdropColor || '#0a0d18'}
                    onChange={(e) => onUpdateCrop({ backdropColor: e.target.value })}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[11px] font-mono text-slate-400 font-bold">
                    {cropSettings.backdropColor || '#0a0d18'}
                  </span>
                </div>

                {/* Popular Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { name: 'Preto Puro', color: '#000000' },
                    { name: 'Azul Escuro', color: '#0a1128' },
                    { name: 'Cinza Ônix', color: '#18181b' },
                    { name: 'Vinho Dark', color: '#450a0a' },
                    { name: 'Roxo Deep', color: '#2e1065' },
                    { name: 'Verde Petróleo', color: '#064e3b' },
                    { name: 'Branco', color: '#ffffff' },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      title={preset.name}
                      onClick={() => onUpdateCrop({ backdropColor: preset.color })}
                      style={{ backgroundColor: preset.color }}
                      className={`w-5 h-5 rounded-full border transition ${
                        cropSettings.backdropColor === preset.color
                          ? 'border-blue-400 scale-110 shadow-md ring-2 ring-blue-500/30'
                          : 'border-slate-600 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
