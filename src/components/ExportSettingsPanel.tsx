import React from 'react';
import { ExportSettings } from '../types/video';
import {
  SlidersHorizontal,
  Smartphone,
  Gauge,
  ShieldCheck,
  Film,
  Info,
} from 'lucide-react';
import { getSupportedMimeType } from '../utils/videoProcessor';

interface ExportSettingsPanelProps {
  exportSettings: ExportSettings;
  onUpdateExportSettings: (updated: Partial<ExportSettings>) => void;
}

export const ExportSettingsPanel: React.FC<ExportSettingsPanelProps> = ({
  exportSettings,
  onUpdateExportSettings,
}) => {
  const detected = getSupportedMimeType();

  const resolutions: Array<{ id: ExportSettings['resolution']; label: string; desc: string }> = [
    { id: '720p', label: '720p Rápido', desc: 'Renderização mais leve' },
    { id: '1080p', label: '1080p Full HD', desc: 'Recomendado (Redes)' },
    { id: '1440p', label: '2K Ultra HD', desc: 'Máxima definição' },
  ];

  const ratios: Array<{ id: ExportSettings['aspectRatio']; label: string; desc: string }> = [
    { id: '9:16', label: '9:16 Vertical', desc: 'TikTok, Reels, Shorts' },
    { id: '1:1', label: '1:1 Quadrado', desc: 'Feed Instagram / X' },
    { id: '16:9', label: '16:9 Horizontal', desc: 'YouTube / Widescreen' },
  ];

  const fpsOptions = [24, 30, 60];
  const bitrateOptions = [4, 8, 12, 16, 20];
  const speeds = [0.5, 0.75, 1.0, 1.1, 1.25, 1.5, 2.0];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Configurações de Exportação</h3>
            <p className="text-[11px] text-slate-400">
              Resolução, proporção, taxa de quadros, bitrate e velocidade
            </p>
          </div>
        </div>
      </div>

      {/* Real Codec Detection Banner */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 text-xs">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-slate-300 leading-relaxed">
          <div>
            Formato real gerado pelo seu navegador:{' '}
            <strong className="text-cyan-300 uppercase">.{detected.extension}</strong>{' '}
            <span className="text-slate-500 font-mono text-[11px]">({detected.mimeType})</span>
          </div>
          {detected.extension === 'webm' && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              O container WebM (VP8/Opus) é o formato nativo mais estável do navegador, com suporte total a reprodução e edição sem corromper o arquivo.
            </p>
          )}
        </div>
      </div>

      {/* Resolution */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          Resolução de Saída:
        </label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {resolutions.map((res) => (
            <button
              key={res.id}
              type="button"
              onClick={() => onUpdateExportSettings({ resolution: res.id })}
              className={`p-2.5 rounded-xl border text-left transition ${
                exportSettings.resolution === res.id
                  ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/40'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-bold">{res.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{res.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
          Proporção da Tela:
        </label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {ratios.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onUpdateExportSettings({ aspectRatio: r.id })}
              className={`p-2.5 rounded-xl border text-left transition ${
                exportSettings.aspectRatio === r.id
                  ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-bold">{r.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* FPS & Bitrate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
        <div>
          <span className="text-slate-300 font-semibold block mb-2">Taxa de Quadros (FPS):</span>
          <div className="flex gap-2">
            {fpsOptions.map((fps) => (
              <button
                key={fps}
                type="button"
                onClick={() => onUpdateExportSettings({ fps })}
                className={`flex-1 py-1.5 rounded-lg font-bold border transition ${
                  exportSettings.fps === fps
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {fps} FPS
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-slate-300 font-semibold block mb-2">
            Bitrate de Vídeo ({exportSettings.bitrateMbps} Mbps):
          </span>
          <div className="flex gap-1.5">
            {bitrateOptions.map((mbps) => (
              <button
                key={mbps}
                type="button"
                onClick={() => onUpdateExportSettings({ bitrateMbps: mbps })}
                className={`flex-1 py-1.5 rounded-lg font-bold border transition ${
                  exportSettings.bitrateMbps === mbps
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {mbps}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          Velocidade de Reprodução:
        </label>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {speeds.map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onUpdateExportSettings({ speed: spd })}
              className={`px-3 py-1.5 rounded-lg border font-bold transition ${
                exportSettings.speed === spd
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Strip Metadata */}
      <label className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Remoção de Metadados (Anti-Shadowban)</div>
            <p className="text-[10px] text-slate-400">
              Gera novo stream sem tags de câmera ou histórico de editores externos.
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={exportSettings.stripMetadata}
          onChange={(e) => onUpdateExportSettings({ stripMetadata: e.target.checked })}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
        />
      </label>
    </div>
  );
};
