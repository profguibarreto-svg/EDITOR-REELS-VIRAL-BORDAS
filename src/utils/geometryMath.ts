export interface CropSettings {
  cropTop: number; // percentage 0-50
  cropBottom: number; // percentage 0-50
  cropLeft: number; // percentage 0-50
  cropRight: number; // percentage 0-50
  scale: number; // 0.5 to 2.0
  positionY: number; // percentage 0 to 100 (50 is center)
  positionX: number; // percentage 0 to 100 (50 is center)
}

export interface TrimSettings {
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * Calculates the source rectangle on the original video after crop percentages are applied.
 */
export function calculateSourceCropRect(
  videoWidth: number,
  videoHeight: number,
  crop: CropSettings
): { sx: number; sy: number; sw: number; sh: number } {
  const leftPx = (crop.cropLeft / 100) * videoWidth;
  const rightPx = (crop.cropRight / 100) * videoWidth;
  const topPx = (crop.cropTop / 100) * videoHeight;
  const bottomPx = (crop.cropBottom / 100) * videoHeight;

  const sx = Math.max(0, leftPx);
  const sy = Math.max(0, topPx);
  const sw = Math.max(1, videoWidth - leftPx - rightPx);
  const sh = Math.max(1, videoHeight - topPx - bottomPx);

  return { sx, sy, sw, sh };
}

/**
 * Calculates the destination placement for the video inside target canvas.
 */
export function calculateDestPlacement(
  canvasWidth: number,
  canvasHeight: number,
  croppedAspect: number,
  frameVideoSlot: { top: number; bottom: number; left: number; right: number },
  scale: number,
  positionX: number,
  positionY: number
): { dx: number; dy: number; dw: number; dh: number } {
  // Available slot within canvas
  const slotWidth = canvasWidth * (1 - frameVideoSlot.left - frameVideoSlot.right);
  const slotHeight = canvasHeight * (1 - frameVideoSlot.top - frameVideoSlot.bottom);
  const slotCenterX = canvasWidth * frameVideoSlot.left + slotWidth / 2;
  const slotCenterY = canvasHeight * frameVideoSlot.top + slotHeight / 2;

  let baseWidth = slotWidth;
  let baseHeight = slotWidth / croppedAspect;

  if (baseHeight > slotHeight) {
    baseHeight = slotHeight;
    baseWidth = slotHeight * croppedAspect;
  }

  const dw = baseWidth * scale;
  const dh = baseHeight * scale;

  // Offset based on positionX and positionY (50 is center)
  const offsetX = ((positionX - 50) / 100) * slotWidth;
  const offsetY = ((positionY - 50) / 100) * slotHeight;

  const dx = slotCenterX - dw / 2 + offsetX;
  const dy = slotCenterY - dh / 2 + offsetY;

  return { dx, dy, dw, dh };
}

/**
 * Sanitizes trim values to ensure valid start and end bounds
 */
export function validateTrimBounds(
  startTime: number,
  endTime: number,
  totalDuration: number
): { startTime: number; endTime: number; duration: number } {
  const safeStart = Math.max(0, Math.min(startTime, totalDuration - 0.1));
  const safeEnd = Math.max(safeStart + 0.1, Math.min(endTime, totalDuration));
  return {
    startTime: safeStart,
    endTime: safeEnd,
    duration: Math.max(0.1, safeEnd - safeStart),
  };
}

/**
 * Formats time in seconds to mm:ss.ms
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}
