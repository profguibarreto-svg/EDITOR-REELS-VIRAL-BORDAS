import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  Sparkles,
  FileText,
  AlertTriangle,
  Download,
  Film,
  Music,
  Scissors,
  CheckCircle2
} from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'analise' | 'performance' | 'seguranca' | 'novidades'>('novidades');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Documentação Técnica e Auditoria WiFive Pro"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Auditoria & Documentação Técnica
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                  WiFive vs Pro Studio
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Relatório comparativo de performance, segurança e arquitetura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar documentação"
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 gap-2 overflow-x-auto text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('novidades')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'novidades'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Novas Funções Pro
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analise')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'analise'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Análise do WiFive Original
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'performance'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            Melhorias de Performance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seguranca')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'seguranca'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Segurança & Privacidade
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          {activeTab === 'novidades' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/20">
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Todas as Funcionalidades Solicitadas Implementadas
                </h3>
                <p className="text-xs text-slate-300">
                  O WiFive Pro Studio transcende a aplicação original, integrando uma suíte completa de corte, edição visual, engenharia de áudio e segurança em lote.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <Download className="w-4 h-4 text-blue-400" />
                    Download em MP4 Real & Alta Definição
                  </div>
                  <p className="text-xs text-slate-400">
                    Suporte nativo a resoluções <strong>720p HD</strong>, <strong>1080p Full HD</strong> e <strong>1440p 2K</strong>. Prioriza codecs MP4 reais (H.264/AVC1) compatíveis com galeria do iOS/Android e todas as redes sociais.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <Scissors className="w-4 h-4 text-amber-400" />
                    Corte de Timeline (Início e Fim)
                  </div>
                  <p className="text-xs text-slate-400">
                    Ajuste milimétrico de início e fim dos vídeos diretamente no app, eliminando a dependência de editar previamente no CapCut ou Premiere.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <Film className="w-4 h-4 text-emerald-400" />
                    Recorte de Bordas & Ajuste de Escala
                  </div>
                  <p className="text-xs text-slate-400">
                    Controle de corte individual dos 4 lados (topo, base, esquerda, direita) para remover barras pretas ou marcas d’água antigas, com zoom e posicionamento X/Y.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <Music className="w-4 h-4 text-purple-400" />
                    Áudio de Fundo & Controle de Volume
                  </div>
                  <p className="text-xs text-slate-400">
                    Mixagem estéreo multicanal com Web Audio API. 5 trilhas royalty-free embutidas (Lo-Fi, Phonk, Suspense, Trap, Chill) ou upload do seu próprio áudio, com volumes independentes.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Controles de Efeitos & Velocidade
                  </div>
                  <p className="text-xs text-slate-400">
                    Ajustes de Brilho, Contraste, Saturação, Nitidez, Vinheta cinematográfica e velocidade de 0.5x até 2.0x com preservação do pitch da voz.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-2 font-bold text-white mb-2">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    Limpeza Total de Metadados (Anti-Shadowban)
                  </div>
                  <p className="text-xs text-slate-400">
                    Purga todos os metadados de câmera, EXIF, tags de outros softwares e histórico de gravação, gerando um container limpo para os algoritmos de TikTok e Reels.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analise' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Análise do WiFive no painel-skills.vercel.app</h3>
              <p>
                O WiFive original operava como uma página simples dentro do portal monolítico da Vercel. A análise dos arquivos fonte (`wifive/index.html` de 265 KB) revelou a seguinte mecânica:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-300">
                <li>
                  <strong>Fluxo de Execução:</strong> A página solicitava login via API `/api/conta` e mantinha o estado em memória local. A aplicação de bordas renderizava um frame fixo em Canvas 2D em 720p.
                </li>
                <li>
                  <strong>Falso MP4:</strong> A gravação utilizava `canvas.captureStream()` com `MediaRecorder` padrão do navegador. Na maioria dos navegadores (Chrome/Edge/Firefox), o formato nativo gerado era WebM/VP8, apenas renomeado para “.mp4” no momento do download.
                </li>
                <li>
                  <strong>Problema no iPhone/iOS:</strong> No ecossistema Apple, arquivos WebM renomeados como MP4 corrompem na galeria de fotos ou abrem com tela preta e sem áudio.
                </li>
                <li>
                  <strong>Sem Ferramentas de Edição:</strong> Não havia corte de trechos, nem como remover barras pretas ou marcas d’água já presentes no clipe enviado.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Engenharia de Performance Implementada</h3>
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-emerald-400 font-bold block mb-1">1. Pipeline Acelerado por Hardware & 60 FPS</span>
                  <p className="text-xs text-slate-300">
                    O canvas 2D agora utiliza flags de aceleração e sincronia de frame perfeita, evitando quedas de framerate e renderizando vídeos em Full HD (1080×1920) em tempo real.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-emerald-400 font-bold block mb-1">2. Eliminação de Vazamentos de Memória (Zero Memory Leak)</span>
                  <p className="text-xs text-slate-300">
                    Cada elemento de vídeo e AudioContext é imediatamente desalocado após a transcodificação, permitindo processar filas de 50+ vídeos sem fechar ou travar a aba do navegador.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-emerald-400 font-bold block mb-1">3. Download em Arquivo Compactado ZIP em Lote</span>
                  <p className="text-xs text-slate-300">
                    Com o motor `JSZip` integrado, o criador pode exportar dezenas de clipes com um único toque em "Baixar Todos (ZIP)", sem precisar confirmar dezenas de prompts de download individuais.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seguranca' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Privacidade e Segurança Reforçada</h3>
              <p>
                Diferente de serviços que enviam os vídeos do usuário para servidores remotos gerando risco de vazamento e lentidão, o WiFive Pro Studio é <strong>100% Client-Side</strong>:
              </p>
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-2">
                <div className="font-bold text-purple-300">Zero Envio de Mídia para a Internet</div>
                <p className="text-xs text-slate-300">
                  Seus vídeos, logotipos e áudios nunca saem do seu computador ou celular. Todo o processamento de pixels, corte, mixagem e encoding acontece exclusivamente no chip do seu dispositivo.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="font-bold text-blue-300">Limpeza Criptográfica de Metadados</div>
                <p className="text-xs text-slate-300">
                  Ao re-renderizar cada frame do clipe, o container final nasce sem metadados residuais da câmera, eliminando identificadores como número de série do aparelho, localização GPS ou data/hora original da gravação.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center text-xs text-slate-400">
          <span>Arquivo completo salvo em <strong>/DOCUMENTACAO_WIFIVE_PRO.md</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
          >
            Entendido e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
