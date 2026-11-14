import {
  FrameStyle,
  ProfileBrand,
  VisualEffects,
  VideoCropSettings,
} from '../types/video';
import { calculateSourceCropRect, calculateDestPlacement } from './geometryMath';

export interface FrameLayoutSlot {
  top: number; // percentage of canvas height
  bottom: number; // percentage of canvas height
  left: number; // percentage of canvas width
  right: number; // percentage of canvas width
}

/**
 * Returns the inner viewport area reserved for the video according to frame style
 */
export function getFrameLayoutSlot(
  style: FrameStyle,
  frameEnabled: boolean = true
): FrameLayoutSlot {
  if (!frameEnabled) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  switch (style) {
    case 'post':
      return { top: 0.17, bottom: 0.08, left: 0.03, right: 0.03 };
    case 'noticia':
      return { top: 0.14, bottom: 0.14, left: 0.02, right: 0.02 };
    case 'meme':
      return { top: 0.18, bottom: 0.06, left: 0.02, right: 0.02 };
    case 'podcast':
      return { top: 0.14, bottom: 0.12, left: 0.03, right: 0.03 };
    case 'neon':
      return { top: 0.12, bottom: 0.08, left: 0.04, right: 0.04 };
    case 'gradiente':
      return { top: 0.12, bottom: 0.09, left: 0.035, right: 0.035 };
    case 'minimal':
      return { top: 0.05, bottom: 0.05, left: 0.03, right: 0.03 };
    case 'custom':
    case 'none':
    default:
      return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

/**
 * Builds CSS filter string for visual effects; returns empty string when default to avoid CPU overhead.
 */
export function buildFilterString(effects: VisualEffects): string {
  const hasCustomFilters =
    effects.brightness !== 1 ||
    effects.contrast !== 1 ||
    effects.saturation !== 1 ||
    effects.sharpen;

  if (!hasCustomFilters) return '';

  let filterStr = `brightness(${effects.brightness}) contrast(${effects.contrast}) saturate(${effects.saturation})`;
  if (effects.sharpen) {
    filterStr += ' contrast(1.15)';
  }
  return filterStr;
}

/**
 * Renders the background (e.g. blurred video or solid color)
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  videoEl: HTMLVideoElement | null,
  effects: VisualEffects,
  fitMode: 'contain-blur' | 'contain-solid' | 'cover',
  backdropColor: string
) {
  ctx.save();

  const hasValidVideo =
    videoEl !== null &&
    videoEl.readyState >= 2 &&
    videoEl.videoWidth > 0 &&
    videoEl.videoHeight > 0;

  if (fitMode === 'contain-blur' && hasValidVideo && videoEl) {
    const blurRadius = Math.min(
      12,
      Math.max(2, Math.round((effects.blurBackground || 25) * 0.4 * (width / 1080)))
    );
    ctx.filter = `blur(${blurRadius}px) brightness(0.65) saturate(1.2)`;
    const scale = Math.max(width / videoEl.videoWidth, height / videoEl.videoHeight) * 1.25;
    const bgW = videoEl.videoWidth * scale;
    const bgH = videoEl.videoHeight * scale;
    ctx.drawImage(videoEl, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
    ctx.filter = 'none';

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, 'rgba(5, 10, 24, 0.55)');
    bgGrad.addColorStop(0.5, 'rgba(5, 10, 24, 0.35)');
    bgGrad.addColorStop(1, 'rgba(5, 10, 24, 0.65)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = backdropColor || '#0a0d18';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Unified composite renderer shared identically by both LiveCanvasPreview and VideoProcessor.
 * Guarantees 100% visual parity between live preview and exported video across all resolutions.
 */
export function renderCompositeFrame(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  videoEl: HTMLVideoElement | null;
  frameEnabled: boolean;
  frameStyle: FrameStyle;
  brand: ProfileBrand;
  crop: VideoCropSettings;
  effects: VisualEffects;
  avatarImg: HTMLImageElement | null;
  customFrameImg: HTMLImageElement | null;
  currentTime: number;
  customHeadline?: string;
  filterStr?: string;
}) {
  const {
    ctx,
    width,
    height,
    videoEl,
    frameEnabled,
    frameStyle,
    brand,
    crop,
    effects,
    avatarImg,
    customFrameImg,
    currentTime,
    customHeadline,
    filterStr: precomputedFilter,
  } = params;

  // 1. Background
  renderBackground(
    ctx,
    width,
    height,
    videoEl,
    effects,
    crop.fitMode,
    crop.backdropColor
  );

  // 2. Video Layer
  if (
    videoEl &&
    videoEl.readyState >= 2 &&
    videoEl.videoWidth > 0 &&
    videoEl.videoHeight > 0
  ) {
    const slot = getFrameLayoutSlot(frameStyle, frameEnabled);
    const srcRect = calculateSourceCropRect(videoEl.videoWidth, videoEl.videoHeight, crop);
    const croppedAspect = srcRect.sw / Math.max(1, srcRect.sh);

    let destRect: { dx: number; dy: number; dw: number; dh: number };
    if (crop.fitMode === 'cover') {
      const slotW = width * (1 - slot.left - slot.right);
      const slotH = height * (1 - slot.top - slot.bottom);
      const slotCenterX = width * slot.left + slotW / 2;
      const slotCenterY = height * slot.top + slotH / 2;
      const coverScale = Math.max(slotW / srcRect.sw, slotH / srcRect.sh) * crop.scale;
      const dw = srcRect.sw * coverScale;
      const dh = srcRect.sh * coverScale;
      const offsetX = ((crop.positionX - 50) / 100) * slotW;
      const offsetY = ((crop.positionY - 50) / 100) * slotH;
      destRect = {
        dx: slotCenterX - dw / 2 + offsetX,
        dy: slotCenterY - dh / 2 + offsetY,
        dw,
        dh,
      };
    } else {
      destRect = calculateDestPlacement(
        width,
        height,
        croppedAspect,
        slot,
        crop.scale,
        crop.positionX,
        crop.positionY
      );
    }

    const filterStr =
      precomputedFilter !== undefined ? precomputedFilter : buildFilterString(effects);

    ctx.save();
    // Clip to frame slot when cover mode or zoomed to avoid overlapping external edges cleanly
    if (crop.fitMode === 'cover' && frameEnabled && frameStyle !== 'none') {
      const clipX = width * slot.left;
      const clipY = height * slot.top;
      const clipW = width * (1 - slot.left - slot.right);
      const clipH = height * (1 - slot.top - slot.bottom);
      ctx.beginPath();
      ctx.rect(clipX, clipY, clipW, clipH);
      ctx.clip();
    }

    if (filterStr) {
      ctx.filter = filterStr;
    }

    ctx.drawImage(
      videoEl,
      srcRect.sx,
      srcRect.sy,
      srcRect.sw,
      srcRect.sh,
      destRect.dx,
      destRect.dy,
      destRect.dw,
      destRect.dh
    );
    ctx.restore();

    if (effects.vignette) {
      ctx.save();
      const vigGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.35,
        width / 2,
        height / 2,
        width * 0.75
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // 3. Branded Overlay Frame
  if (frameEnabled) {
    renderFrameOverlay(
      ctx,
      width,
      height,
      frameStyle,
      brand,
      avatarImg,
      customFrameImg,
      currentTime,
      customHeadline
    );
  }
}

/**
 * Draws the branded overlay frame with resolution-proportional typography, position, scale and color customization
 */
export function renderFrameOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: FrameStyle,
  brand: ProfileBrand,
  avatarImg: HTMLImageElement | null,
  customFrameImg: HTMLImageElement | null,
  currentTime: number,
  customHeadline?: string
) {
  if (style === 'none') return;

  ctx.save();
  const s = width / 1080; // Resolution scale factor so 720p, 1080p and 1440p look identical

  if (style === 'custom' && customFrameImg && customFrameImg.complete && customFrameImg.naturalWidth > 0) {
    ctx.drawImage(customFrameImg, 0, 0, width, height);
    ctx.restore();
    return;
  }

  const fontHeadlineMult = brand.fontSizeHeadline || 1.0;
  const fontNameMult = brand.fontSizeName || 1.0;
  const avScale = brand.avatarScale || 1.0;
  const frameScale = brand.frameScale || 1.0;
  const posY = brand.framePositionY !== undefined ? brand.framePositionY : 2.5;
  const posX = brand.framePositionX !== undefined ? brand.framePositionX : 50;
  const textAlign = brand.textAlign || 'left';
  const cardBg = brand.cardBgColor || 'rgba(12, 18, 38, 0.94)';
  const textColor = brand.textColor || '#ffffff';
  const accentColor = brand.accentColor || '#00f0ff';

  const padX = width * 0.04;
  const headline =
    (customHeadline && customHeadline.trim()) ||
    brand.headline ||
    'Cortes diários da nossa página 🔥';
  const name = brand.pageName || 'Nome da Página';
  const rawHandle = (brand.handle || 'cortes').trim();
  const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;

  if (style === 'post') {
    const cardTop = (posY / 100) * height;
    const baseCardH = height * 0.135;
    const cardH = baseCardH * frameScale;
    const baseCardW = width - padX * 2;
    const cardW = baseCardW * frameScale;
    const offsetX = ((posX - 50) / 100) * (width - cardW);
    const cardX = (width - cardW) / 2 + offsetX;

    ctx.fillStyle = cardBg;
    roundRect(ctx, cardX, cardTop, cardW, cardH, 20 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    const avRadius = cardH * 0.28 * avScale;
    const avX = cardX + avRadius + 18 * s;
    const avY = cardTop + avRadius + 18 * s;
    drawAvatar(ctx, avatarImg, avX, avY, avRadius, name, s);

    const textLeft = avX + avRadius + 16 * s;
    const nameFontSize = Math.round(width * 0.042 * fontNameMult);
    ctx.font = `bold ${nameFontSize}px -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, textLeft, avY - avRadius * 0.35);

    const nameMetrics = ctx.measureText(name);
    const badgeX = textLeft + nameMetrics.width + 8 * s;
    drawBadge(ctx, badgeX, avY - avRadius * 0.35, Math.round(width * 0.038 * fontNameMult), brand.badgeType, s);

    const handleFontSize = Math.round(width * 0.034 * fontNameMult);
    ctx.font = `${handleFontSize}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(180, 195, 225, 0.85)';
    ctx.fillText(handle, textLeft, avY + avRadius * 0.45);

    const headFontSize = Math.round(width * 0.038 * fontHeadlineMult);
    ctx.font = `600 ${headFontSize}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = textAlign;

    const headX =
      textAlign === 'center'
        ? cardX + cardW / 2
        : textAlign === 'right'
        ? cardX + cardW - 20 * s
        : cardX + 20 * s;
    ctx.fillText(headline, headX, cardTop + cardH - 22 * s, cardW - 40 * s);

    const footY = height * 0.95;
    ctx.fillStyle = cardBg;
    roundRect(ctx, padX, footY - 24 * s, baseCardW, 46 * s, 14 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 230, 250, 0.9)';
    ctx.font = `bold ${Math.round(width * 0.032)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('💬 4.8k    🔁 15.2k    ❤️ 94.6k    📌 Siga para mais cortes', width / 2, footY);
  } else if (style === 'noticia') {
    const topBarH = height * 0.065 * frameScale;
    const topY = (posY / 100) * (height * 0.4);
    ctx.fillStyle = cardBg !== 'rgba(12, 18, 38, 0.94)' ? cardBg : '#b91c1c';
    ctx.fillRect(0, topY, width, topBarH);

    const pulseAlpha = 0.8 + 0.2 * Math.sin(currentTime * 6);
    ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    const badgeW = 145 * s;
    const badgeH = Math.min(topBarH * 0.7, 42 * s);
    roundRect(ctx, padX, topY + (topBarH - badgeH) / 2, badgeW, badgeH, 8 * s);
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.font = `900 ${Math.round(width * 0.028 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('● AO VIVO', padX + badgeW / 2, topY + topBarH / 2 + 1 * s);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.038 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase(), padX + badgeW + 20 * s, topY + topBarH / 2 + 1 * s);

    const botH = height * 0.12 * frameScale;
    const botY = height - botH;

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, botY, width * 0.32, botH * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(width * 0.036)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('URGENTE', (width * 0.32) / 2, botY + botH * 0.23);

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(width * 0.32, botY, width * 0.68, botH * 0.42);
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(width * 0.032 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${handle} · ATUALIZAÇÕES`, width * 0.34, botY + botH * 0.23);

    ctx.fillStyle = cardBg;
    ctx.fillRect(0, botY + botH * 0.42, width, botH * 0.58);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.042 * fontHeadlineMult)}px sans-serif`;
    ctx.textAlign = textAlign;
    const headX = textAlign === 'center' ? width / 2 : textAlign === 'right' ? width - padX : padX;
    ctx.fillText(headline, headX, botY + botH * 0.74, width - padX * 2);
  } else if (style === 'meme') {
    const boxH = height * 0.15 * frameScale;
    const boxY = (posY / 100) * (height * 0.4);
    ctx.fillStyle = cardBg !== 'rgba(12, 18, 38, 0.94)' ? cardBg : '#facc15';
    ctx.fillRect(0, boxY, width, boxH);

    ctx.fillStyle = textColor !== '#ffffff' ? textColor : '#000000';
    const memeFontSize = Math.round(width * 0.054 * fontHeadlineMult);
    ctx.font = `900 ${memeFontSize}px Impact, Arial Black, sans-serif`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    const headX = textAlign === 'center' ? width / 2 : textAlign === 'right' ? width * 0.95 : width * 0.05;

    wrapText(ctx, headline.toUpperCase(), headX, boxY + boxH * 0.5, width * 0.9, Math.round(memeFontSize * 1.15));

    const barH = height * 0.05;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height - barH, width, barH);
    ctx.fillStyle = '#facc15';
    ctx.font = `bold ${Math.round(width * 0.035 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`SIGA: ${handle} ⚡ ${name}`, width / 2, height - barH / 2);
  } else if (style === 'neon') {
    // Cyber Neon Glow Frame
    const margin = width * 0.032;
    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5 * s;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 22 * s;
    roundRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 24 * s);
    ctx.stroke();
    ctx.restore();

    // Header pill card
    const cardTop = Math.max(margin + 12 * s, (posY / 100) * height);
    const cardW = (width - padX * 2.4) * frameScale;
    const cardH = height * 0.09 * frameScale;
    const offsetX = ((posX - 50) / 100) * (width - cardW);
    const cardX = (width - cardW) / 2 + offsetX;

    ctx.fillStyle = cardBg !== 'rgba(12, 18, 38, 0.94)' ? cardBg : 'rgba(5, 10, 25, 0.88)';
    roundRect(ctx, cardX, cardTop, cardW, cardH, 16 * s);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    const avR = cardH * 0.33 * avScale;
    drawAvatar(ctx, avatarImg, cardX + avR + 16 * s, cardTop + cardH / 2, avR, name, s);

    ctx.fillStyle = textColor;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    const textX =
      textAlign === 'center'
        ? cardX + cardW / 2 + avR * 0.5
        : textAlign === 'right'
        ? cardX + cardW - 18 * s
        : cardX + avR * 2 + 30 * s;

    ctx.font = `800 ${Math.round(width * 0.038 * fontHeadlineMult)}px sans-serif`;
    ctx.fillText(headline, textX, cardTop + cardH * 0.38, cardW - avR * 2 - 48 * s);

    ctx.fillStyle = accentColor;
    ctx.font = `bold ${Math.round(width * 0.03 * fontNameMult)}px sans-serif`;
    ctx.fillText(`${name} · ${handle}`, textX, cardTop + cardH * 0.72, cardW - avR * 2 - 48 * s);

    // Bottom cyber badge
    ctx.fillStyle = 'rgba(5, 10, 25, 0.85)';
    const botW = width * 0.56;
    const botH = 42 * s;
    roundRect(ctx, (width - botW) / 2, height - margin - botH - 12 * s, botW, botH, 21 * s);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(width * 0.028 * fontNameMult)}px sans-serif`;
    ctx.fillText(`⚡ ${handle} · SIGA PARA MAIS`, width / 2, height - margin - botH / 2 - 12 * s);
  } else if (style === 'gradiente') {
    // Modern Instagram / TikTok Gradient Frame
    const borderGrad = ctx.createLinearGradient(0, 0, width, height);
    borderGrad.addColorStop(0, accentColor);
    borderGrad.addColorStop(0.5, '#a855f7');
    borderGrad.addColorStop(1, '#ec4899');

    const pad = width * 0.025;
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 8 * s;
    roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 26 * s);
    ctx.stroke();

    const cardTop = Math.max(pad + 14 * s, (posY / 100) * height);
    const cardW = (width - padX * 2.2) * frameScale;
    const cardH = height * 0.095 * frameScale;
    const offsetX = ((posX - 50) / 100) * (width - cardW);
    const cardX = (width - cardW) / 2 + offsetX;

    ctx.fillStyle = cardBg;
    roundRect(ctx, cardX, cardTop, cardW, cardH, 20 * s);
    ctx.fill();

    const avR = cardH * 0.34 * avScale;
    drawAvatar(ctx, avatarImg, cardX + avR + 18 * s, cardTop + cardH / 2, avR, name, s);

    const textStart = cardX + avR * 2 + 34 * s;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.036 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(name, textStart, cardTop + cardH * 0.34);

    const nameM = ctx.measureText(name);
    drawBadge(ctx, textStart + nameM.width + 8 * s, cardTop + cardH * 0.34, Math.round(width * 0.032 * fontNameMult), brand.badgeType, s);

    ctx.fillStyle = textColor;
    ctx.font = `600 ${Math.round(width * 0.035 * fontHeadlineMult)}px sans-serif`;
    ctx.textAlign = textAlign;
    const headX = textAlign === 'center' ? cardX + cardW / 2 : textAlign === 'right' ? cardX + cardW - 20 * s : textStart;
    ctx.fillText(headline, headX, cardTop + cardH * 0.7, cardW - avR * 2 - 52 * s);

    // Bottom Gradient Pill
    const pillW = width * 0.52;
    const pillH = 44 * s;
    ctx.fillStyle = borderGrad;
    roundRect(ctx, (width - pillW) / 2, height - pad - pillH - 14 * s, pillW, pillH, 22 * s);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(width * 0.03 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${handle}`, width / 2, height - pad - pillH / 2 - 14 * s);
  } else if (style === 'podcast') {
    const topH = height * 0.11 * frameScale;
    const topY = (posY / 100) * height;
    const cardW = (width - padX * 2) * frameScale;
    const offsetX = ((posX - 50) / 100) * (width - cardW);
    const cardX = (width - cardW) / 2 + offsetX;

    ctx.fillStyle = cardBg;
    roundRect(ctx, cardX, topY, cardW, topH, 18 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    const avR = topH * 0.32 * avScale;
    drawAvatar(ctx, avatarImg, cardX + avR + 16 * s, topY + topH / 2, avR, name, s);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.042 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(name, cardX + avR * 2 + 30 * s, topY + topH * 0.36);
    ctx.fillStyle = accentColor || '#38bdf8';
    ctx.font = `bold ${Math.round(width * 0.034 * fontHeadlineMult)}px sans-serif`;
    ctx.textAlign = textAlign;
    const headX = textAlign === 'center' ? cardX + cardW / 2 : textAlign === 'right' ? cardX + cardW - 20 * s : cardX + avR * 2 + 30 * s;
    ctx.fillText(`🎙️ ${headline}`, headX, topY + topH * 0.72, cardW - avR * 2 - 48 * s);

    const eqH = height * 0.07;
    const eqY = height - eqH - height * 0.03;
    const barCount = 28;
    const barW = (width - padX * 2) / (barCount * 1.5);
    const startX = padX + (width - padX * 2 - barCount * barW * 1.5) / 2;

    for (let i = 0; i < barCount; i++) {
      const freq = 0.5 + 0.5 * Math.sin(currentTime * 8 + i * 0.5);
      const bH = Math.max(6 * s, freq * eqH * 0.75);
      const bX = startX + i * barW * 1.5;
      const bY = eqY + (eqH - bH) / 2;

      ctx.fillStyle = i % 2 === 0 ? accentColor || '#38bdf8' : '#818cf8';
      roundRect(ctx, bX, bY, barW, bH, 4 * s);
      ctx.fill();
    }
  } else if (style === 'minimal') {
    const margin = width * 0.025;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2.5 * s;
    roundRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 16 * s);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.8;
    ctx.font = `600 ${Math.round(width * 0.032 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${handle}`, width - margin - 18 * s, height - margin - 18 * s);
  }

  ctx.restore();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
  name: string,
  scaleFactor: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (name ? name.trim()[0] : 'W').toUpperCase();
    ctx.fillText(initial, cx, cy);
  }

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, 2.5 * scaleFactor);
  ctx.stroke();
  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: 'blue' | 'gold' | 'none',
  scaleFactor: number
) {
  if (type === 'none') return;
  ctx.save();
  ctx.beginPath();
  const r = size / 2;
  ctx.arc(x + r, y, r, 0, Math.PI * 2);
  ctx.fillStyle = type === 'gold' ? '#eab308' : '#1d9bf0';
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, 2.5 * scaleFactor);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y);
  ctx.lineTo(x + r * 0.9, y + r * 0.35);
  ctx.lineTo(x + r * 1.5, y - r * 0.35);
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const totalH = lines.length * lineHeight;
  const startY = y - totalH / 2 + lineHeight / 2;

  for (let k = 0; k < lines.length; k++) {
    ctx.fillText(lines[k], x, startY + k * lineHeight);
  }
}
