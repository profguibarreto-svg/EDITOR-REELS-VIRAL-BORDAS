import { FrameStyle, ProfileBrand, VisualEffects } from '../types/video';

export interface FrameLayoutSlot {
  top: number; // percentage of canvas height
  bottom: number; // percentage of canvas height
  left: number; // percentage of canvas width
  right: number; // percentage of canvas width
}

/**
 * Returns the inner viewport area reserved for the video according to frame style
 */
export function getFrameLayoutSlot(style: FrameStyle): FrameLayoutSlot {
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
      return { top: 0.06, bottom: 0.06, left: 0.04, right: 0.04 };
    case 'gradiente':
      return { top: 0.09, bottom: 0.09, left: 0.03, right: 0.03 };
    case 'minimal':
      return { top: 0.05, bottom: 0.05, left: 0.03, right: 0.03 };
    case 'custom':
    case 'none':
    default:
      return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

/**
 * Renders the background (e.g. blurred video or solid dark color)
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

  if (fitMode === 'contain-blur' && videoEl && videoEl.readyState >= 2) {
    // Fill with blurred video
    ctx.filter = `blur(${Math.max(5, effects.blurBackground)}px) brightness(0.65) saturate(1.2)`;
    // Draw enlarged to cover canvas
    const scale = Math.max(width / videoEl.videoWidth, height / videoEl.videoHeight) * 1.25;
    const bgW = videoEl.videoWidth * scale;
    const bgH = videoEl.videoHeight * scale;
    ctx.drawImage(videoEl, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
    ctx.filter = 'none';

    // Dark gradient overlay for readability
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, 'rgba(5, 10, 24, 0.55)');
    bgGrad.addColorStop(0.5, 'rgba(5, 10, 24, 0.35)');
    bgGrad.addColorStop(1, 'rgba(5, 10, 24, 0.65)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Solid backdrop
    ctx.fillStyle = backdropColor || '#0a0d18';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Draws the branded overlay frame with full typography, position, scale and color customization
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

  if (style === 'custom' && customFrameImg && customFrameImg.complete) {
    ctx.drawImage(customFrameImg, 0, 0, width, height);
    ctx.restore();
    return;
  }

  // Safe defaults for newly added customization properties
  const fontHeadlineMult = brand.fontSizeHeadline || 1.0;
  const fontNameMult = brand.fontSizeName || 1.0;
  const avScale = brand.avatarScale || 1.0;
  const frameScale = brand.frameScale || 1.0;
  const posY = brand.framePositionY !== undefined ? brand.framePositionY : 2.5; // percentage
  const posX = brand.framePositionX !== undefined ? brand.framePositionX : 50; // percentage
  const textAlign = brand.textAlign || 'left';
  const cardBg = brand.cardBgColor || 'rgba(12, 18, 38, 0.94)';
  const textColor = brand.textColor || '#ffffff';

  const padX = width * 0.04;
  const headline = (customHeadline && customHeadline.trim()) || brand.headline || 'Cortes diários da nossa página 🔥';
  const name = brand.pageName || 'Nome da Página';
  const handle = brand.handle.startsWith('@') ? brand.handle : `@${brand.handle || 'cortes'}`;

  if (style === 'post') {
    // X / Twitter Card Header
    const cardTop = (posY / 100) * height;
    const baseCardH = height * 0.135;
    const cardH = baseCardH * frameScale;
    const baseCardW = width - padX * 2;
    const cardW = baseCardW * frameScale;
    const offsetX = ((posX - 50) / 100) * (width - cardW);
    const cardX = (width - cardW) / 2 + offsetX;

    // Card background
    ctx.fillStyle = cardBg;
    roundRect(ctx, cardX, cardTop, cardW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Avatar
    const avRadius = cardH * 0.28 * avScale;
    const avX = cardX + avRadius + 18;
    const avY = cardTop + avRadius + 18;
    drawAvatar(ctx, avatarImg, avX, avY, avRadius, brand.pageName);

    // Page Name + Badge
    const textLeft = avX + avRadius + 16;
    const nameFontSize = Math.round(width * 0.042 * fontNameMult);
    ctx.font = `bold ${nameFontSize}px -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, textLeft, avY - avRadius * 0.35);

    const nameMetrics = ctx.measureText(name);
    const badgeX = textLeft + nameMetrics.width + 8;
    drawBadge(ctx, badgeX, avY - avRadius * 0.35, Math.round(width * 0.038 * fontNameMult), brand.badgeType);

    // Handle
    const handleFontSize = Math.round(width * 0.034 * fontNameMult);
    ctx.font = `${handleFontSize}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(180, 195, 225, 0.85)';
    ctx.fillText(handle, textLeft, avY + avRadius * 0.45);

    // Headline / Post text
    const headFontSize = Math.round(width * 0.038 * fontHeadlineMult);
    ctx.font = `600 ${headFontSize}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = textAlign;

    const headX = textAlign === 'center' ? cardX + cardW / 2 : textAlign === 'right' ? cardX + cardW - 20 : cardX + 20;
    ctx.fillText(headline, headX, cardTop + cardH - 22, cardW - 40);

    // Footer engagement bar
    const footY = height * 0.95;
    ctx.fillStyle = cardBg;
    roundRect(ctx, padX, footY - 24, baseCardW, 46, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 230, 250, 0.9)';
    ctx.font = `bold ${Math.round(width * 0.032)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('💬 4.8k    🔁 15.2k    ❤️ 94.6k    📌 Siga para mais cortes', width / 2, footY);
  } else if (style === 'noticia') {
    // Breaking News / Plantão Urgente
    const topBarH = height * 0.065 * frameScale;
    const topY = (posY / 100) * (height * 0.4);
    // Top Urgent Bar
    ctx.fillStyle = cardBg !== 'rgba(12, 18, 38, 0.94)' ? cardBg : '#b91c1c';
    ctx.fillRect(0, topY, width, topBarH);

    // "AO VIVO" pulse badge
    const pulseAlpha = 0.8 + 0.2 * Math.sin(currentTime * 6);
    ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    roundRect(ctx, padX, topY + (topBarH - 34) / 2, 110, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.font = `900 ${Math.round(width * 0.032 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('● AO VIVO', padX + 55, topY + topBarH / 2 + 1);

    // Channel title in top bar
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.038 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase(), padX + 130, topY + topBarH / 2 + 1);

    // Bottom News Ticker (Ticker Plantão)
    const botH = height * 0.12 * frameScale;
    const botY = height - botH;

    // Red plantão header
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, botY, width * 0.32, botH * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(width * 0.036)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('URGENTE', (width * 0.32) / 2, botY + botH * 0.23);

    // Yellow ticker strip
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(width * 0.32, botY, width * 0.68, botH * 0.42);
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(width * 0.032 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${handle} · ATUALIZAÇÕES`, width * 0.34, botY + botH * 0.23);

    // Lower headline container
    ctx.fillStyle = cardBg;
    ctx.fillRect(0, botY + botH * 0.42, width, botH * 0.58);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.042 * fontHeadlineMult)}px sans-serif`;
    ctx.textAlign = textAlign;
    const headX = textAlign === 'center' ? width / 2 : textAlign === 'right' ? width - padX : padX;
    ctx.fillText(headline, headX, botY + botH * 0.76, width - padX * 2);
  } else if (style === 'meme') {
    // Impact Meme Style (Big Yellow or White top box)
    const boxH = height * 0.15 * frameScale;
    const boxY = (posY / 100) * (height * 0.4);
    ctx.fillStyle = cardBg !== 'rgba(12, 18, 38, 0.94)' ? cardBg : '#facc15';
    ctx.fillRect(0, boxY, width, boxH);

    ctx.fillStyle = textColor !== '#ffffff' ? textColor : '#000000';
    const memeFontSize = Math.round(width * 0.054 * fontHeadlineMult);
    ctx.font = `900 ${memeFontSize}px Impact, Arial Black, sans-serif`;
    ctx.textAlign = textAlign;
    const headX = textAlign === 'center' ? width / 2 : textAlign === 'right' ? width * 0.95 : width * 0.05;

    // Wrap headline into lines
    wrapText(ctx, headline.toUpperCase(), headX, boxY + boxH * 0.48, width * 0.9, Math.round(memeFontSize * 1.15));

    // Bottom Handle Banner
    const barH = height * 0.05;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height - barH, width, barH);
    ctx.fillStyle = '#facc15';
    ctx.font = `bold ${Math.round(width * 0.035 * fontNameMult)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`SIGA: ${handle} ⚡ ${name}`, width / 2, height - barH / 2 + 1);
  } else if (style === 'podcast') {
    // Podcast Studio Frame with dynamic equalizer bars
    const topH = height * 0.11;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    roundRect(ctx, padX, height * 0.02, width - padX * 2, topH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const avR = topH * 0.32;
    drawAvatar(ctx, avatarImg, padX + avR + 14, height * 0.02 + topH / 2, avR, brand.pageName);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(width * 0.042)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(name, padX + avR * 2 + 28, height * 0.02 + topH * 0.42);
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(width * 0.034)}px sans-serif`;
    ctx.fillText(`🎙️ ${headline}`, padX + avR * 2 + 28, height * 0.02 + topH * 0.72, width - padX * 3 - avR * 2);

    // Bottom Animated Equalizer Waveform
    const eqH = height * 0.07;
    const eqY = height - eqH - height * 0.03;
    const barCount = 28;
    const barW = (width - padX * 2) / (barCount * 1.5);
    const startX = padX + (width - padX * 2 - barCount * barW * 1.5) / 2;

    for (let i = 0; i < barCount; i++) {
      const freq = 0.5 + 0.5 * Math.sin(currentTime * 8 + i * 0.5);
      const bH = Math.max(6, freq * eqH * 0.75);
      const bX = startX + i * barW * 1.5;
      const bY = eqY + (eqH - bH) / 2;

      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#818cf8';
      roundRect(ctx, bX, bY, barW, bH, 4);
      ctx.fill();
    }
  } else if (style === 'minimal') {
    // Minimalist framing
    const margin = width * 0.025;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    roundRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 16);
    ctx.stroke();

    // Subtle corner brand watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `600 ${Math.round(width * 0.032)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${handle}`, width - margin - 16, height - margin - 16);
  }

  ctx.restore();
}

/**
 * Draws avatar in circle, falling back to clean initials
 */
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
  name: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    // Initials fallback
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

  // Avatar border
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Verified check badge
 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: 'blue' | 'gold' | 'none'
) {
  if (type === 'none') return;
  ctx.save();
  ctx.beginPath();
  const r = size / 2;
  ctx.arc(x + r, y, r, 0, Math.PI * 2);
  ctx.fillStyle = type === 'gold' ? '#eab308' : '#1d9bf0';
  ctx.fill();

  // White checkmark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y);
  ctx.lineTo(x + r * 0.9, y + r * 0.35);
  ctx.lineTo(x + r * 1.5, y - r * 0.35);
  ctx.stroke();
  ctx.restore();
}

/**
 * Canvas rounded rectangle helper
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Text wrapper for meme and title boxes
 */
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
