import React, { useRef } from 'react';
import {
  VisualEffects,
  AudioSettings,
  ExportSettings,
} from '../types/video';
import {
  Sliders,
  Music,
  Gauge,
  ShieldCheck,
  Sun,
  Contrast,
  Droplet,
  Volume2,
  Volume1,
  Upload,
  Play,
  RotateCcw,
} from 'lucide-react';
import { PRESET_TRACKS } from '../utils/audioTracks';

interface EffectsAudioPanelProps {
  effects: VisualEffects;
  onUpdateEffects: (updated: Partial<VisualEffects>) => void;
  audioSettings: AudioSettings;
  onUpdateAudio: (updated: Partial<AudioSettings>) => void;
  exportSettings: ExportSettings;
  onUpdateExportSettings: (updated: Partial<ExportSettings>) => void;
}

export const EffectsAudioPanel: React.FC<EffectsAudioPanelProps> = ({
  effects,
  onUpdateEffects,
  audioSettings,
  onUpdateAudio,
  exportSettings,
  onUpdateExportSettings,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateAudio({
        customAudioUrl: url,
        customAudioName: file.name,
        bgmTrackId: 'custom',
      });
    }
  };

  const resetEffects = () => {
    onUpdateEffects({
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blurBackground: 25,
      vignette: false,
      sharpen: false,
    });
  };

  const speeds = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1.0x (Padrão)', value: 1.0 },
    { label: '1.1x (Viral)', value: 1.1, tag: 'Recomendado' },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2.0x', value: 2.0 },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-6">
      {/* 1. VISUAL EFFECTS */}
      <div className="space-y-4 pb-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Efeitos Visuais & Correção de Cor</h3>
              <p className="text-[11px] text-slate-400">Ajuste nitidez, brilho e atmosfera do vídeo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetEffects}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar Efeitos
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
          {/* Brightness */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Brilho:
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {Math.round(effects.brightness * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={effects.brightness}
              onChange={(e) => onUpdateEffects({ brightness: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Contrast className="w-3.5 h-3.5 text-blue-400" /> Contraste:
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {Math.round(effects.contrast * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.4}
              step={0.05}
              value={effects.contrast}
              onChange={(e) => onUpdateEffects({ contrast: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-fuchsia-400" /> Saturação:
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {Math.round(effects.saturation * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.8}
              step={0.05}
              value={effects.saturation}
              onChange={(e) => onUpdateEffects({ saturation: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Toggles: Vignette, Blur intensity, Sharpen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <span className="text-slate-300 font-medium">Vinheta Cinematográfica</span>
            <input
              type="checkbox"
              checked={effects.vignette}
              onChange={(e) => onUpdateEffects({ vignette: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <span className="text-slate-300 font-medium">Filtro de Nitidez / Realce</span>
            <input
              type="checkbox"
              checked={effects.sharpen}
              onChange={(e) => onUpdateEffects({ sharpen: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded"
            />
          </label>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-slate-300 font-medium whitespace-nowrap">Desfoque Fundo:</span>
            <div className="flex items-center gap-2 flex-1 max-w-[120px]">
              <input
                type="range"
                min={5}
                max={40}
                value={effects.blurBackground}
                onChange={(e) => onUpdateEffects({ blurBackground: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-blue-400 font-bold">{effects.blurBackground}px</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SPEED CONTROL */}
      <div className="space-y-3 pb-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Velocidade de Reprodução</h3>
              <p className="text-[11px] text-slate-400">
                Preserva o tom da voz sem distorcer (Pitch Correction ativo)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {speeds.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onUpdateExportSettings({ speed: s.value })}
              className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition ${
                exportSettings.speed === s.value
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {s.label}
              {s.tag && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {s.tag}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. BACKGROUND MUSIC & AUDIO MIXING */}
      <div className="space-y-4 pb-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Som de Fundo & Mixagem de Áudio</h3>
              <p className="text-[11px] text-slate-400">
                Adicione trilhas sonoras virais e equilibre os volumes
              </p>
            </div>
          </div>
        </div>

        {/* Volume Sliders (Original Voice vs BGM Track) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
          {/* Video Voice Volume */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Volume2 className="w-4 h-4 text-blue-400" /> Volume da Voz / Vídeo Original:
              </span>
              <span className="font-mono font-bold text-blue-400">
                {Math.round(audioSettings.originalVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={audioSettings.originalVolume}
              onChange={(e) => onUpdateAudio({ originalVolume: parseFloat(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Background Music Volume */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Volume1 className="w-4 h-4 text-purple-400" /> Volume do Som de Fundo (BGM):
              </span>
              <span className="font-mono font-bold text-purple-400">
                {Math.round(audioSettings.bgmVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audioSettings.bgmVolume}
              onChange={(e) => onUpdateAudio({ bgmVolume: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Soundtrack Selection Grid */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Escolha uma Trilha Sonora ou Envie o seu Áudio:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_TRACKS.map((track) => (
              <button
                key={track.id}
                type="button"
                onClick={() => onUpdateAudio({ bgmTrackId: track.id, customAudioUrl: null })}
                className={`p-2.5 rounded-xl border text-left transition ${
                  audioSettings.bgmTrackId === track.id && !audioSettings.customAudioUrl
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-2 ring-purple-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-purple-300">{track.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{track.description}</div>
              </button>
            ))}

            {/* Custom Audio Upload Button */}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleCustomAudioUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-center ${
                audioSettings.customAudioUrl
                  ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                <Upload className="w-3.5 h-3.5" />
                {audioSettings.customAudioName ? 'Áudio Enviado' : 'Enviar Meu Áudio'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {audioSettings.customAudioName || 'MP3, WAV ou M4A da sua pasta'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 4. METADATA STRIPPING (ANTI-SHADOWBAN) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              Limpeza de Metadados Ativa (Anti-Shadowban)
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ativo
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Elimina tags EXIF, identificador do dispositivo e histórico do CapCut/Premiere para proteção em algoritmos.
            </p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={exportSettings.stripMetadata}
          onChange={(e) => onUpdateExportSettings({ stripMetadata: e.target.checked })}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
        />
      </div>
    </div>
  );
};
