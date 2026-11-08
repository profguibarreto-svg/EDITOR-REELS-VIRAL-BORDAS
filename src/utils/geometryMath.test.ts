import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSourceCropRect,
  calculateDestPlacement,
  validateTrimBounds,
  formatTime,
  CropSettings
} from './geometryMath';

test('calculateSourceCropRect correctly calculates cropped dimensions', () => {
  const crop: CropSettings = {
    cropTop: 10,
    cropBottom: 10,
    cropLeft: 5,
    cropRight: 5,
    scale: 1,
    positionX: 50,
    positionY: 50
  };

  const rect = calculateSourceCropRect(1000, 2000, crop);
  assert.equal(rect.sx, 50); // 5% of 1000
  assert.equal(rect.sy, 200); // 10% of 2000
  assert.equal(rect.sw, 900); // 1000 - 50 - 50
  assert.equal(rect.sh, 1600); // 2000 - 200 - 200
});

test('calculateDestPlacement centers video in designated slot', () => {
  const slot = { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 };
  const placement = calculateDestPlacement(
    1080,
    1920,
    9 / 16,
    slot,
    1,
    50,
    50
  );

  assert.ok(placement.dw > 0);
  assert.ok(placement.dh > 0);
  // Center check
  const centerX = placement.dx + placement.dw / 2;
  assert.ok(Math.abs(centerX - 1080 / 2) < 2);
});

test('validateTrimBounds keeps bounds inside video duration', () => {
  const b1 = validateTrimBounds(-5, 50, 30);
  assert.equal(b1.startTime, 0);
  assert.equal(b1.endTime, 30);
  assert.equal(b1.duration, 30);

  const b2 = validateTrimBounds(15, 10, 30);
  // End should be clamped after start
  assert.ok(b2.endTime > b2.startTime);
});

test('formatTime properly formats seconds to mm:ss.ms', () => {
  assert.equal(formatTime(65.4), '01:05.4');
  assert.equal(formatTime(0), '00:00.0');
});
