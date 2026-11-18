import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWebCodecsCandidateSpecs,
  computeCfrFrameTimestampUs,
  computeAdaptivePlaybackRate,
  computeFrameWaitCapMs,
  evaluateFrameSyncAction,
  shouldUseDeterministicSeek,
} from './frameSyncMath';

test('buildWebCodecsCandidateSpecs prioritizes prefer-hardware then Baseline software H.264', () => {
  const specs = buildWebCodecsCandidateSpecs();
  const firstHwIdx = specs.findIndex((s) => s.hardwareAcceleration === 'prefer-hardware');
  const firstSwIdx = specs.findIndex((s) => s.hardwareAcceleration === 'no-preference');
  assert.equal(firstHwIdx, 0);
  assert.ok(firstSwIdx > 0);
  assert.equal(specs[firstSwIdx].muxerCodec, 'avc');
  assert.ok(specs[firstSwIdx].codec.startsWith('avc1.4200'));
});

test('computeCfrFrameTimestampUs produces drift-free microsecond timeline at 30fps', () => {
  const f0 = computeCfrFrameTimestampUs(0, 30);
  assert.equal(f0.timestampUs, 0);
  assert.equal(f0.durationUs, 33333);

  const f30 = computeCfrFrameTimestampUs(30, 30);
  assert.equal(f30.timestampUs, 1_000_000);

  const f1800 = computeCfrFrameTimestampUs(1800, 30);
  assert.equal(f1800.timestampUs, 60_000_000);
});

test('computeAdaptivePlaybackRate scales down cleanly under slow CPU software encoding', () => {
  const slowCpuRate = computeAdaptivePlaybackRate({
    speed: 1.0,
    targetFps: 30,
    avgFrameWorkMs: 130,
    rateScale: 0.9,
  });
  // ~ (33.33 / 130) * 0.9 ≈ 0.231
  assert.ok(slowCpuRate >= 0.2 && slowCpuRate <= 0.26);

  const fastGpuRate = computeAdaptivePlaybackRate({
    speed: 1.0,
    targetFps: 30,
    avgFrameWorkMs: 8,
    rateScale: 1.0,
  });
  assert.ok(fastGpuRate <= 1.05 && fastGpuRate >= 1.0);
});

test('computeFrameWaitCapMs bounds wall-clock waiting reasonably', () => {
  assert.ok(computeFrameWaitCapMs(1 / 30, 1.0) <= 65);
  assert.ok(computeFrameWaitCapMs(1 / 30, 0.25) <= 110);
});

test('evaluateFrameSyncAction detects overshoot, slight lead, lag, and aligned draw', () => {
  const step = 1 / 30;
  assert.equal(
    evaluateFrameSyncAction({ currentTime: 0.5, targetTime: 0.5, sourceStepSec: step, videoEnded: false }),
    'draw'
  );
  assert.equal(
    evaluateFrameSyncAction({ currentTime: 0.45, targetTime: 0.5, sourceStepSec: step, videoEnded: false }),
    'wait-or-seek'
  );
  assert.equal(
    evaluateFrameSyncAction({ currentTime: 0.535, targetTime: 0.5, sourceStepSec: step, videoEnded: false }),
    'pause-near'
  );
  assert.equal(
    evaluateFrameSyncAction({ currentTime: 0.65, targetTime: 0.5, sourceStepSec: step, videoEnded: false }),
    'seek-back'
  );
  assert.equal(
    evaluateFrameSyncAction({ currentTime: 1.5, targetTime: 1.4, sourceStepSec: step, videoEnded: true }),
    'draw'
  );
});

test('shouldUseDeterministicSeek uses deterministic seeking for software or slow encoding and sequential play for fast GPU', () => {
  assert.equal(
    shouldUseDeterministicSeek({ isHardwareAccelerated: false, avgFrameWorkMs: 15, speed: 1, targetFps: 30 }),
    true
  );
  assert.equal(
    shouldUseDeterministicSeek({ isHardwareAccelerated: true, avgFrameWorkMs: 15, speed: 1, targetFps: 30 }),
    false
  );
  assert.equal(
    shouldUseDeterministicSeek({ isHardwareAccelerated: true, avgFrameWorkMs: 80, speed: 1, targetFps: 30 }),
    true
  );
});
