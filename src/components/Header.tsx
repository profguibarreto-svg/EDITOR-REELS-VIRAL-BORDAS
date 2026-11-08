import React from 'react';
import {
  Sparkles,
  FileText,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
} from 'lucide-react';
import { ExportSettings } from '../types/video';

interface HeaderProps {
  exportSettings: ExportSettings;
  onUpdateExportSettings: (updated: Partial<ExportSettings>) => void;
  onOpenDocs: () => void;
  queueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  exportSettings,
  onUpdateExportSettings,
  onOpenDocs,
  queueCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-400 font-black text-xl tracking-tighter">
              W5
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                WiFive <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Pro Studio</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                HD MP4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Editor e Gerador de Molduras em Lote para Cortes Virais
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap">
          {/* Resolution Quick Select */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <span className="text-slate-400 px-2 font-medium hidden sm:inline flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Resolução:
            </span>
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ resolution: '720p' })}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                exportSettings.resolution === '720p'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              720p
            </button>
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ resolution: '1080p' })}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                exportSettings.resolution === '1080p'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1080p HD
            </button>
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ resolution: '1440p' })}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                exportSettings.resolution === '1440p'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2K Ultra
            </button>
          </div>

          {/* Aspect Ratio */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ aspectRatio: '9:16' })}
              title="Formato 9:16 Vertical para TikTok, Reels e Shorts"
              className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition ${
                exportSettings.aspectRatio === '9:16'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              9:16
            </button>
            <button
              type="button"
              onClick={() => onUpdateExportSettings({ aspectRatio: '1:1' })}
              title="Formato 1:1 Quadrado para Feed"
              className={`px-2.5 py-1 rounded font-semibold transition ${
                exportSettings.aspectRatio === '1:1'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1:1
            </button>
          </div>

          {/* Documentation Button */}
          <button
            type="button"
            onClick={onOpenDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Auditoria & Docs</span>
            <span className="sm:hidden">Docs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
