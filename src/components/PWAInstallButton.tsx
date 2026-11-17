import React, { useState } from 'react';
import { MonitorDown, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Instalar WiFive Pro Studio como aplicativo no Windows, Android ou Chrome"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-900/30 border border-indigo-400/40 active:scale-95 cursor-pointer"
      >
        <MonitorDown className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Instruções para instalar o aplicativo no iPhone ou iPad"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-400/30 text-xs font-bold transition cursor-pointer"
        >
          <MonitorDown className="w-3.5 h-3.5" />
          <span>Instalar App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 id="ios-install-title" className="text-sm font-extrabold text-white">
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar guia de instalação"
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Toque no botão <strong className="inline-flex items-center gap-1 text-cyan-300"><Share className="w-3.5 h-3.5" /> Compartilhar</strong> na barra do Safari.
                </li>
                <li>
                  Role as opções e toque em <strong className="text-white">Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Toque em <strong className="text-white">Adicionar</strong> no canto superior direito.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
