export interface WebCodecsCandidateSpec {
  codec: string;
  muxerCodec: 'avc' | 'vp9' | 'av1';
  hardwareAcceleration: 'prefer-hardware' | 'no-preference';
}

/**
 * Builds ordered WebCodecs VideoEncoder candidates.
 * Hardware acceleration is probed first; software ("no-preference") prioritizes
 * Baseline/Constrained-Baseline H.264 first (zero B-frame reorder jitter and widest player support).
 */
export function buildWebCodecsCandidateSpecs(): WebCodecsCandidateSpec[] {
  const hwCodecs: Array<{ codec: string; muxerCodec: 'avc' | 'vp9' | 'av1' }> = [
    { codec: 'avc1.640033', muxerCodec: 'avc' },
    { codec: 'avc1.4d0032', muxerCodec: 'avc' },
    { codec: 'avc1.4d002a', muxerCodec: 'avc' },
    { codec: 'avc1.42002a', muxerCodec: 'avc' },
    { codec: 'avc1.4d0028', muxerCodec: 'avc' },
    { codec: 'avc1.420028', muxerCodec: 'avc' },
    { codec: 'avc1.4d001f', muxerCodec: 'avc' },
    { codec: 'avc1.42001f', muxerCodec: 'avc' },
    { codec: 'avc1.42E01E', muxerCodec: 'avc' },
    { codec: 'vp09.00.41.08', muxerCodec: 'vp9' },
    { codec: 'vp09.00.10.08', muxerCodec: 'vp9' },
    { codec: 'av01.0.08M.08', muxerCodec: 'av1' },
    { codec: 'av01.0.04M.08', muxerCodec: 'av1' },
  ];

  const swCodecs: Array<{ codec: string; muxerCodec: 'avc' | 'vp9' | 'av1' }> = [
    // Baseline profiles first for software encoders: zero B-frame reorder jitter and universal MP4 playback
    { codec: 'avc1.420032', muxerCodec: 'avc' },
    { codec: 'avc1.42002a', muxerCodec: 'avc' },
    { codec: 'avc1.420028', muxerCodec: 'avc' },
    { codec: 'avc1.42001f', muxerCodec: 'avc' },
    { codec: 'avc1.42E01E', muxerCodec: 'avc' },
    { codec: 'avc1.4d002a', muxerCodec: 'avc' },
    { codec: 'avc1.4d0032', muxerCodec: 'avc' },
    { codec: 'avc1.640033', muxerCodec: 'avc' },
    { codec: 'vp09.00.41.08', muxerCodec: 'vp9' },
    { codec: 'vp09.00.10.08', muxerCodec: 'vp9' },
    { codec: 'av01.0.08M.08', muxerCodec: 'av1' },
    { codec: 'av01.0.04M.08', muxerCodec: 'av1' },
  ];

  return [
    ...hwCodecs.map((c) => ({ ...c, hardwareAcceleration: 'prefer-hardware' as const })),
    ...swCodecs.map((c) => ({ ...c, hardwareAcceleration: 'no-preference' as const })),
  ];
}

/**
 * Computes drift-free CFR microsecond timestamp & duration for frameIdx at given fps.
 */
export function computeCfrFrameTimestampUs(
  frameIdx: number,
  fps: number
): { timestampUs: number; durationUs: number } {
  const safeFps = Math.max(1, fps);
  const idx = Math.max(0, Math.floor(frameIdx));
  const timestampUs = Math.round((idx * 1_000_000) / safeFps);
  const nextTimestampUs = Math.round(((idx + 1) * 1_000_000) / safeFps);
  return {
    timestampUs,
    durationUs: Math.max(1, nextTimestampUs - timestampUs),
  };
}

/**
 * Computes playbackRate so HTMLVideoElement decodes in lockstep with actual render+encode work
 * without racing ahead (causing paused frozen duplicates) or falling behind.
 */
export function computeAdaptivePlaybackRate(params: {
  speed: number;
  targetFps: number;
  avgFrameWorkMs: number;
  rateScale: number;
}): number {
  const safeSpeed = Math.max(0.25, Math.min(4.0, params.speed || 1.0));
  const safeFps = Math.max(1, params.targetFps || 30);
  const safeWorkMs = Math.max(10, params.avgFrameWorkMs || 33);
  const safeScale = Math.max(0.7, Math.min(1.05, params.rateScale || 1.0));

  const sourceStepMs = (safeSpeed / safeFps) * 1000;
  const throughputMatchedRate = (sourceStepMs / safeWorkMs) * safeScale;
  const maxRate = Math.min(4.0, safeSpeed * 1.05);

  return Math.max(0.1, Math.min(maxRate, Number(throughputMatchedRate.toFixed(3))));
}

/**
 * Computes bounded wall-clock wait cap before falling back to an explicit seek.
 */
export function computeFrameWaitCapMs(sourceStepSec: number, playbackRate: number): number {
  const safeRate = Math.max(0.1, playbackRate);
  const expectedWallMs = (Math.max(0.01, sourceStepSec) * 1000) / safeRate;
  return Math.max(25, Math.min(110, Math.round(expectedWallMs * 1.2 + 12)));
}

export type FrameSyncAction = 'draw' | 'wait-or-seek' | 'pause-near' | 'seek-back';

/**
 * Decides whether the decoder element is aligned with the target frame timestamp,
 * needs to advance, pause briefly, or seek back to eliminate frame overshoot/freezing.
 */
export function evaluateFrameSyncAction(params: {
  currentTime: number;
  targetTime: number;
  sourceStepSec: number;
  videoEnded: boolean;
}): FrameSyncAction {
  const { currentTime, targetTime, sourceStepSec, videoEnded } = params;
  if (videoEnded) {
    return 'draw';
  }

  const step = Math.max(0.01, sourceStepSec);
  const diff = currentTime - targetTime;

  const hardLeadTolerance = Math.max(0.055, step * 1.65);
  const softLeadTolerance = Math.max(0.025, step * 0.85);
  const lagTolerance = Math.max(0.014, step * 0.48);

  if (diff > hardLeadTolerance) {
    return 'seek-back';
  }
  if (diff > softLeadTolerance) {
    return 'pause-near';
  }
  if (diff < -lagTolerance) {
    return 'wait-or-seek';
  }
  return 'draw';
}

/**
 * Selects deterministic frame-by-frame seeking when encoding is CPU-bound
 * (slower than real-time) so frames never repeat, drop, or stall in play/pause loops.
 */
export function shouldUseDeterministicSeek(params: {
  isHardwareAccelerated: boolean;
  avgFrameWorkMs: number;
  speed: number;
  targetFps: number;
}): boolean {
  if (!params.isHardwareAccelerated) {
    return true;
  }
  const sourceStepMs =
    (Math.max(0.25, params.speed || 1) / Math.max(1, params.targetFps || 30)) * 1000;
  return params.avgFrameWorkMs > sourceStepMs * 1.45;
}
