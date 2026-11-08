import React, { useRef } from 'react';
import {
  FrameStyle,
  ProfileBrand,
} from '../types/video';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  Tv,
  Flame,
  Radio,
  Share2,
  Palette,
  MinusCircle,
  HelpCircle,
  Image as ImageIcon,
  Sliders,
} from 'lucide-react';

interface FrameEditorProps {
  frameStyle: FrameStyle;
  onSelectFrameStyle: (style: FrameStyle) => void;
  brand: ProfileBrand;
  onUpdateBrand: (updated: Partial<ProfileBrand>) => void;
}

export const FrameEditor: React.FC<FrameEditorProps> = ({
  frameStyle,
  onSelectFrameStyle,
  brand,
  onUpdateBrand,
}) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const customFrameInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateBrand({ avatarUrl: url });
    }
  };

  const handleCustomFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateBrand({ customFrameUrl: url });
      onSelectFrameStyle('custom');
    }
  };

  const framePresets: { id: FrameStyle; label: string; icon: React.ReactNode; desc: string; tag?: string }[] = [
    {
      id: 'post',
      label: 'Post estilo X',
      icon: <Share2 className="w-4 h-4 text-sky-400" />,
      desc: 'Logo, @, selo azul de verificado e manchete no formato de tweet.',
      tag: 'Mais Popular',
    },
    {
      id: 'noticia',
      label: 'Notícia Urgente',
      icon: <Tv className="w-4 h-4 text-red-400" />,
      desc: 'Tarja "AO VIVO" pulsante, letreiro de plantão e rodapé de breaking news.',
      tag: 'Alta Retenção',
    },
    {
      id: 'neon',
      label: 'Neon Glow',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      desc: 'Bordas cibernéticas com brilho neon elétrico e badge futurista.',
    },
    {
      id: 'meme',
      label: 'Meme / Impacto',
      icon: <Flame className="w-4 h-4 text-yellow-400" />,
      desc: 'Caixa amarela chamativa com título Impact e tarja inferior de seguir.',
    },
    {
      id: 'gradiente',
      label: 'Gradiente Moderno',
      icon: <Palette className="w-4 h-4 text-fuchsia-400" />,
      desc: 'Degradê suave e minimalista estilo Instagram e TikTok.',
    },
    {
      id: 'podcast',
      label: 'Podcast Studio',
      icon: <Radio className="w-4 h-4 text-emerald-400" />,
      desc: 'Equalizador de áudio animado com microfone e identificador de episódio.',
    },
    {
      id: 'custom',
      label: 'Sua Moldura PNG',
      icon: <Upload className="w-4 h-4 text-purple-400" />,
      desc: 'Envie qualquer arte PNG transparente desenvolvida no Photoshop/Canva.',
    },
    {
      id: 'none',
      label: 'Sem Moldura (Clean)',
      icon: <MinusCircle className="w-4 h-4 text-slate-400" />,
      desc: 'Apenas os cortes de borda, efeitos visuais, áudio e limpeza de metadados.',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Moldura & Identidade da Página</h2>
            <p className="text-[11px] text-slate-400">Personalize o visual que aparecerá nos cortes</p>
          </div>
        </div>
      </div>

      {/* Frame Style Selector Grid */}
      <div>
        <label className="text-xs font-semibold text-slate-300 block mb-2.5">
          Estilo da Moldura:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {framePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectFrameStyle(preset.id)}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                frameStyle === preset.id
                  ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 text-white shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    {preset.icon}
                    <span className="text-xs font-bold">{preset.label}</span>
                  </div>
                  {preset.tag && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 whitespace-nowrap">
                      {preset.tag}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                  {preset.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom PNG upload if selected */}
      {frameStyle === 'custom' && (
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-200">Arte PNG Personalizada</span>
            </div>
            {brand.customFrameUrl && (
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PNG Carregado
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Envie uma imagem PNG com o mesmo formato (ex.: 1080×1920) e o centro transparente onde o clipe será posicionado.
          </p>
          <input
            ref={customFrameInputRef}
            type="file"
            accept="image/png,image/webp"
            onChange={handleCustomFrameUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => customFrameInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {brand.customFrameUrl ? 'Trocar Arte PNG' : 'Selecionar Imagem PNG'}
          </button>
        </div>
      )}

      {/* Brand Inputs (Only when not 'none') */}
      {frameStyle !== 'none' && (
        <div className="space-y-4 pt-2">
          {/* Logo & Basic Inputs */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Logo circle button */}
            <div className="flex items-center gap-3">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Alterar Logo da Página"
                className="relative group w-14 h-14 rounded-full border-2 border-blue-500/40 bg-slate-950 flex items-center justify-center overflow-hidden hover:border-blue-400 transition shadow-inner"
              >
                {brand.avatarUrl ? (
                  <img
                    src={brand.avatarUrl}
                    alt="Logo da página"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-5 h-5 text-blue-400 mx-auto" />
                    <span className="text-[9px] text-slate-400 font-bold block">Logo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-[10px] text-white font-bold">
                  Trocar
                </div>
              </button>
              <div>
                <span className="text-xs font-bold text-white block">Logo da Página</span>
                <span className="text-[11px] text-slate-400">PNG ou JPG (redonda)</span>
              </div>
            </div>

            {/* Verification Badge */}
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Selo de Verificado:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateBrand({ badgeType: 'blue' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    brand.badgeType === 'blue'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  Azul (X)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBrand({ badgeType: 'gold' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    brand.badgeType === 'gold'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                  Dourado VIP
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBrand({ badgeType: 'none' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    brand.badgeType === 'none'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Nenhum
                </button>
              </div>
            </div>
          </div>

          {/* Page Name and @ Handle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nome da Página:
              </label>
              <input
                type="text"
                value={brand.pageName}
                onChange={(e) => onUpdateBrand({ pageName: e.target.value })}
                placeholder="Ex.: Cortes da Fofoca"
                maxLength={30}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                @ de Usuário (Rede Social):
              </label>
              <input
                type="text"
                value={brand.handle}
                onChange={(e) => onUpdateBrand({ handle: e.target.value })}
                placeholder="Ex.: @cortesvirais"
                maxLength={25}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Headline / Chamada no topo */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Chamada no Topo / Título do Corte:
            </label>
            <input
              type="text"
              value={brand.headline}
              onChange={(e) => onUpdateBrand({ headline: e.target.value })}
              placeholder="Ex.: VEJA O QUE ELE FALOU NO FINAL 😱"
              maxLength={70}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Accent Color (For Neon and Custom accents) */}
          {(frameStyle === 'neon' || frameStyle === 'gradiente') && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Cor de Brilho Neon / Destaque:
              </label>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Ciano Elétrico', color: '#00f0ff' },
                  { name: 'Azul Real', color: '#2563eb' },
                  { name: 'Rosa Neon', color: '#ff007f' },
                  { name: 'Verde Lime', color: '#10b981' },
                  { name: 'Ouro Puro', color: '#eab308' },
                  { name: 'Roxo Vaporwave', color: '#a855f7' },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    title={c.name}
                    onClick={() => onUpdateBrand({ accentColor: c.color })}
                    style={{ backgroundColor: c.color }}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      brand.accentColor === c.color
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ADVANCED POSITION, FONT SIZE & ELEMENT SIZE CONTROLS */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                Controle Total de Fontes, Posição & Tamanho:
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateBrand({
                    fontSizeHeadline: 1.0,
                    fontSizeName: 1.0,
                    avatarScale: 1.0,
                    framePositionY: 2.5,
                    framePositionX: 50,
                    frameScale: 1.0,
                    textAlign: 'left',
                    cardBgColor: 'rgba(12, 18, 38, 0.94)',
                    textColor: '#ffffff',
                  })
                }
                className="text-[10px] text-slate-400 hover:text-slate-200 transition"
              >
                Resetar Ajustes
              </button>
            </div>

            {/* Typography Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tamanho da Fonte do Título:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {Math.round((brand.fontSizeHeadline || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.8}
                  step={0.05}
                  value={brand.fontSizeHeadline || 1.0}
                  onChange={(e) => onUpdateBrand({ fontSizeHeadline: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tamanho da Fonte Nome & @:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {Math.round((brand.fontSizeName || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.05}
                  value={brand.fontSizeName || 1.0}
                  onChange={(e) => onUpdateBrand({ fontSizeName: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Position & Scale Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Posição Vertical (Y):</span>
                  <span className="font-mono font-bold text-blue-400">
                    {Math.round(brand.framePositionY !== undefined ? brand.framePositionY : 2.5)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={1}
                  value={brand.framePositionY !== undefined ? brand.framePositionY : 2.5}
                  onChange={(e) => onUpdateBrand({ framePositionY: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tamanho da Logo/Avatar:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {Math.round((brand.avatarScale || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.8}
                  step={0.05}
                  value={brand.avatarScale || 1.0}
                  onChange={(e) => onUpdateBrand({ avatarScale: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Escala / Largura do Card:</span>
                  <span className="font-mono font-bold text-blue-400">
                    {Math.round((brand.frameScale || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={brand.frameScale || 1.0}
                  onChange={(e) => onUpdateBrand({ frameScale: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Text Alignment and Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              {/* Text Align */}
              <div>
                <span className="text-slate-300 font-medium block mb-1.5">Alinhamento do Título:</span>
                <div className="flex gap-1">
                  {[
                    { id: 'left', label: 'Esquerda' },
                    { id: 'center', label: 'Centro' },
                    { id: 'right', label: 'Direita' },
                  ].map((align) => (
                    <button
                      key={align.id}
                      type="button"
                      onClick={() => onUpdateBrand({ textAlign: align.id as any })}
                      className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition text-[11px] ${
                        (brand.textAlign || 'left') === align.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {align.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Background Color */}
              <div>
                <span className="text-slate-300 font-medium block mb-1.5">Cor de Fundo do Card:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.cardBgColor && brand.cardBgColor.startsWith('#') ? brand.cardBgColor : '#0c1226'}
                    onChange={(e) => onUpdateBrand({ cardBgColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex gap-1">
                    {[
                      { name: 'Padrão', color: 'rgba(12, 18, 38, 0.94)' },
                      { name: 'Preto', color: '#000000' },
                      { name: 'Vermelho', color: '#7f1d1d' },
                      { name: 'Amarelo', color: '#eab308' },
                    ].map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        onClick={() => onUpdateBrand({ cardBgColor: c.color })}
                        style={{ backgroundColor: c.color }}
                        className="w-5 h-5 rounded-full border border-slate-600 hover:scale-110 transition"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Text Color */}
              <div>
                <span className="text-slate-300 font-medium block mb-1.5">Cor do Texto do Título:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.textColor && brand.textColor.startsWith('#') ? brand.textColor : '#ffffff'}
                    onChange={(e) => onUpdateBrand({ textColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex gap-1">
                    {[
                      { name: 'Branco', color: '#ffffff' },
                      { name: 'Amarelo', color: '#facc15' },
                      { name: 'Ciano', color: '#22d3ee' },
                      { name: 'Preto', color: '#000000' },
                    ].map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        onClick={() => onUpdateBrand({ textColor: c.color })}
                        style={{ backgroundColor: c.color }}
                        className="w-5 h-5 rounded-full border border-slate-600 hover:scale-110 transition"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
