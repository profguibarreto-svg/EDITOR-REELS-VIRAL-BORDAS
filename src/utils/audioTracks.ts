/**
 * Royalty-free procedural audio generators and track definitions
 * Uses Web Audio API to generate high quality seamless audio loops offline without external network dependencies.
 */

export interface PresetTrack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  description: string;
}

export const PRESET_TRACKS: PresetTrack[] = [
  { id: 'none', name: 'Sem Som de Fundo', genre: 'Mudo', bpm: 0, description: 'Mantém apenas o áudio original do clipe' },
  { id: 'lofi', name: '☕ Lo-Fi Chill Beats', genre: 'Lo-Fi', bpm: 82, description: 'Acordes quentes, grave aveludado e ambiência vintage relaxante' },
  { id: 'phonk', name: '🏎️ Brazilian Phonk Drift', genre: 'Phonk', bpm: 125, description: 'Batida pesada, graves marcantes de drift viral e energia alta' },
  { id: 'suspense', name: '🚨 Plantão & Suspense', genre: 'Cinematic', bpm: 90, description: 'Pulso dramático estilo notícia urgente e revelação chocante' },
  { id: 'trap', name: '🔥 Trap Viral Shorts', genre: 'Trap', bpm: 130, description: 'Hi-hats rápidos e sub-grave 808 para prender a retenção' },
  { id: 'chill', name: '🎙️ Podcast Atmosphere', genre: 'Ambient', bpm: 75, description: 'Pads suaves e piano elétrico que não disputam com a voz' },
];

/**
 * Synthesizes an AudioBuffer of specified duration for a given preset track
 */
export async function generateSyntheticTrackBuffer(
  audioCtx: AudioContext | OfflineAudioContext,
  trackId: string,
  targetDuration: number
): Promise<AudioBuffer | null> {
  if (trackId === 'none') return null;

  const sampleRate = audioCtx.sampleRate || 44100;
  const totalSamples = Math.ceil(targetDuration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const selectedTrack = PRESET_TRACKS.find(t => t.id === trackId) || PRESET_TRACKS[1];
  const bpm = selectedTrack.bpm || 80;
  const beatSec = 60 / bpm;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    if (trackId === 'lofi') {
      // Warm chords + soft vinyl crackle
      const chordTime = t % (beatSec * 4);
      const chordIndex = Math.floor(t / (beatSec * 4)) % 4;
      const chords = [
        [220, 261.6, 329.6, 392.0], // Am7
        [174.6, 220, 261.6, 329.6], // Fmaj7
        [261.6, 329.6, 392.0, 523.2], // Cmaj7
        [196.0, 246.9, 293.6, 392.0], // G7
      ];
      const activeChord = chords[chordIndex];
      const chordEnv = Math.exp(-chordTime * 0.8) * 0.12;

      for (let c = 0; c < activeChord.length; c++) {
        const freq = activeChord[c];
        const osc = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
        sampleL += osc * chordEnv;
        sampleR += (osc * 0.9) * chordEnv;
      }

      // Soft bass
      const bassFreq = activeChord[0] / 2;
      const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.15;
      sampleL += bass;
      sampleR += bass;

      // Vinyl noise
      const crackle = (Math.random() - 0.5) * 0.008;
      sampleL += crackle;
      sampleR += crackle;
    } else if (trackId === 'phonk') {
      // Punchy 808 kick + cowbell synth
      const beatProgress = t % beatSec;
      const kickEnv = Math.exp(-beatProgress * 9) * 0.25;
      const kickFreq = 55 + Math.exp(-beatProgress * 25) * 110;
      const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv;

      // Cowbell melody on 16th notes
      const sixteenth = t % (beatSec / 2);
      const bellStep = Math.floor(t / (beatSec / 2)) % 8;
      const bellFreqs = [587.3, 659.2, 587.3, 783.9, 880.0, 783.9, 659.2, 523.2];
      const bellEnv = Math.exp(-sixteenth * 12) * 0.1;
      const bell = (Math.sin(2 * Math.PI * bellFreqs[bellStep] * t) + 0.5 * Math.sin(2 * Math.PI * bellFreqs[bellStep] * 2.5 * t)) * bellEnv;

      sampleL += kick + bell * 0.8;
      sampleR += kick + bell * 0.9;
    } else if (trackId === 'suspense') {
      // Dramatic sub pulse + high tension violin drone
      const pulseTime = t % (beatSec * 2);
      const pulseEnv = Math.exp(-pulseTime * 3) * 0.22;
      const sub = Math.sin(2 * Math.PI * 48 * t) * pulseEnv;
      const tension = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 445 * t)) * 0.04;
      const riser = Math.sin(2 * Math.PI * (200 + (t % 8) * 40) * t) * 0.03;

      sampleL += sub + tension + riser;
      sampleR += sub + tension - riser;
    } else if (trackId === 'trap') {
      // 808 Trap bounce & fast hi-hats
      const beatProgress = t % beatSec;
      const sub808 = Math.sin(2 * Math.PI * 42 * t) * Math.exp(-beatProgress * 2.5) * 0.25;
      const hatProgress = t % (beatSec / 4);
      const hat = (Math.random() - 0.5) * Math.exp(-hatProgress * 30) * 0.08;
      const snare = (Math.floor(t / beatSec) % 2 === 1) ? (Math.random() - 0.5) * Math.exp(-beatProgress * 10) * 0.15 : 0;

      sampleL += sub808 + hat + snare;
      sampleR += sub808 + hat * 0.9 + snare;
    } else {
      // Chill podcast atmosphere
      const padTime = t % 12;
      const pad = (Math.sin(2 * Math.PI * 130.81 * t) + Math.sin(2 * Math.PI * 196 * t) + Math.sin(2 * Math.PI * 246.94 * t)) * 0.06;
      const chime = Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-(t % 4) * 2) * 0.04;

      sampleL += pad + chime;
      sampleR += pad + chime * 0.8;
    }

    // Gentle master clamp
    left[i] = Math.max(-1, Math.min(1, sampleL));
    right[i] = Math.max(-1, Math.min(1, sampleR));
  }

  return buffer;
}
