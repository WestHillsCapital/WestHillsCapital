/**
 * Corporate ambient music generator
 * Style: Modern SaaS explainer — clean piano arp + soft pad + gentle bass
 * Key: A minor (Aeolian) | BPM: 88 | Duration: ~90 seconds
 */
import { writeFileSync } from 'fs';

const SAMPLE_RATE = 44100;
const CHANNELS    = 2;
const BPM         = 88;
const BEAT        = 60 / BPM;           // seconds per beat
const BAR         = BEAT * 4;           // seconds per bar
const EIGHTH      = BEAT / 2;
const DURATION    = BAR * 32;           // 32 bars ≈ 87.3 s
const NUM_SAMPLES = Math.ceil(SAMPLE_RATE * DURATION);

// ---------- Note frequencies ----------
const N = (note, oct) => {
  const semis = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  return 440 * Math.pow(2, (semis[note] + (oct - 4) * 12 - 9) / 12);
};

// Chord blocks: [bass, pad notes, arp notes]
// Progression: Am  –  F  –  C  –  G   (×8)
const CHORDS = [
  { bass: N('A',2), pad: [N('A',3),N('C',4),N('E',4),N('G',4)],  arp: [N('A',4),N('C',5),N('E',5),N('G',4)] },
  { bass: N('F',2), pad: [N('F',3),N('A',3),N('C',4),N('E',4)],  arp: [N('F',4),N('A',4),N('C',5),N('A',4)] },
  { bass: N('C',3), pad: [N('C',4),N('E',4),N('G',4),N('B',4)],  arp: [N('C',5),N('E',4),N('G',4),N('E',4)] },
  { bass: N('G',2), pad: [N('G',3),N('B',3),N('D',4),N('F',4)],  arp: [N('G',4),N('B',4),N('D',5),N('B',4)] },
];

// ---------- ADSR helper ----------
function adsr(t, dur, a, d, s, r) {
  if (t <= 0) return 0;
  if (t >= dur) return 0;
  if (t < a)           return t / a;
  if (t < a + d)       return 1 - (1 - s) * (t - a) / d;
  if (t < dur - r)     return s;
  return Math.max(0, s * (dur - t) / r);
}

// ---------- Oscillators ----------
function sineHarmonics(freq, t, amps) {
  let s = 0, total = 0;
  for (let i = 0; i < amps.length; i++) {
    s += Math.sin(2 * Math.PI * freq * (i + 1) * t) * amps[i];
    total += amps[i];
  }
  return s / total;
}

function piano(freq, t, dur) {
  const env = adsr(t, dur, 0.004, 0.12, 0.45, Math.min(0.4, dur * 0.35));
  const tone = sineHarmonics(freq, t, [1, 0.55, 0.28, 0.12, 0.05, 0.02]);
  // add a tiny click transient
  const click = t < 0.006 ? (1 - t / 0.006) * 0.15 * (Math.random() * 2 - 1) : 0;
  return (tone + click) * env;
}

function pad(freq, t, dur, detune = 0.0025) {
  const env = adsr(t, dur, 1.1, 0.3, 0.80, 1.5);
  const a = Math.sin(2 * Math.PI * freq * (1 + detune) * t);
  const b = Math.sin(2 * Math.PI * freq * (1 - detune) * t);
  const c = Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.25;
  return ((a + b) * 0.5 + c) / 1.25 * env;
}

function bass(freq, t, dur) {
  const env = adsr(t, dur, 0.015, 0.2, 0.35, 0.4);
  const s = sineHarmonics(freq, t, [1, 0.4, 0.15]);
  return s * env;
}

// ---------- Melody (pentatonic over Am) ----------
const MELODY_NOTES = [N('A',5),N('G',5),N('E',5),N('D',5),N('C',5),N('A',4),N('G',4),N('E',4)];
const MELODY_PATTERN = [
  // bar 1          bar 2            bar 3          bar 4
  [0,2, 1,2, 2,1, 3,2], [4,1, 5,2, 4,2, 3,1], [2,2, 1,2, 0,2, 5,2], [6,2, 4,1, 3,2, 2,1],
  [0,2, 1,2, 3,2, 5,2], [4,2, 3,1, 2,2, 1,1], [0,2, 5,2, 6,2, 4,1], [7,2, 5,2, 4,2, 3,2],
];

// flat list of {startBeat, noteIndex, durationBeats} for melody
// build a sparse structure: beat position → {noteIdx, dur}
const melodyEvents = [];
let melodyBeat = 0;
for (const bar of MELODY_PATTERN) {
  for (let i = 0; i < bar.length; i += 2) {
    const noteIdx = bar[i];
    const durBeats = bar[i + 1] * 0.5; // pairs are 8th-note counts
    melodyEvents.push({ beat: melodyBeat, noteIdx, dur: durBeats * BEAT });
    melodyBeat += durBeats;
  }
}

// ---------- Render events ----------
// We'll sample-accurately accumulate events into the buffer

function writeWAV(samples, path) {
  const dataLen = samples.length * 2 * CHANNELS;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);             // PCM
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  buf.writeUInt16LE(CHANNELS * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  let off = 44;
  for (const s of samples) {
    const v = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
    buf.writeInt16LE(v, off); off += 2; // L
    buf.writeInt16LE(v, off); off += 2; // R
  }
  writeFileSync(path, buf);
}

// ---------- Main synthesis ----------
console.log(`Generating ${DURATION.toFixed(1)}s of music (${NUM_SAMPLES} samples)…`);
const out = new Float32Array(NUM_SAMPLES);

// Master fade in/out (2 s each)
const FADE_IN  = 2.0;
const FADE_OUT = 3.0;

// Each chord lasts 2 bars
const CHORD_DUR = BAR * 2;
const PROGRESSION_DUR = CHORD_DUR * CHORDS.length; // 8 bars

for (let si = 0; si < NUM_SAMPLES; si++) {
  const t = si / SAMPLE_RATE;
  if (si % (SAMPLE_RATE * 5) === 0) process.stdout.write('.');

  // Which chord?
  const progPos  = t % PROGRESSION_DUR;
  const chordIdx = Math.floor(progPos / CHORD_DUR) % CHORDS.length;
  const chord    = CHORDS[chordIdx];
  const chordT   = progPos - chordIdx * CHORD_DUR; // time within chord (0..CHORD_DUR)

  let s = 0;

  // ---- Pad: whole-chord sustain (all pad notes) ----
  for (const freq of chord.pad) {
    s += pad(freq, chordT, CHORD_DUR) * 0.08;
  }

  // ---- Bass: beat 1 and beat 3 of the chord ----
  for (const beatOff of [0, BAR]) {
    const bt = chordT - beatOff;
    const noteDur = BEAT * 1.8;
    if (bt >= 0 && bt < noteDur) {
      s += bass(chord.bass, bt, noteDur) * 0.32;
    }
  }

  // ---- Piano arpeggio: 8th-note pattern ----
  // Pattern: [0, 2, 1, 3, 2, 0, 3, 1] (index into arp array) over 2 bars (16 eighths)
  const ARP_PATTERN = [0, 2, 1, 3, 2, 1, 0, 3,  0, 2, 3, 1, 2, 0, 3, 2];
  const arpStep = Math.floor(chordT / EIGHTH);
  const arpT    = chordT - arpStep * EIGHTH;
  if (arpStep < ARP_PATTERN.length) {
    const noteFreq = chord.arp[ARP_PATTERN[arpStep] % chord.arp.length];
    const noteDur  = EIGHTH * 1.25;
    s += piano(noteFreq, arpT, noteDur) * 0.28;
  }

  // ---- Melody: sparse higher voice (starts at bar 4, every other cycle) ----
  const melodyBarStart = BAR * 4; // delay melody by 4 bars
  if (t >= melodyBarStart) {
    const mt = (t - melodyBarStart) % (BAR * MELODY_PATTERN.length);
    const melodyBeatPos = mt / BEAT;
    // Check if any melody event is active
    for (const ev of melodyEvents) {
      const relT = mt - ev.beat * BEAT;
      if (relT >= 0 && relT < ev.dur + 0.05) {
        const freq = MELODY_NOTES[ev.noteIdx % MELODY_NOTES.length];
        s += piano(freq, relT, ev.dur) * 0.14;
      }
    }
  }

  // ---- Subtle shimmer: high-frequency sparkle on beats ----
  const beatPos = (t % BEAT) / BEAT;
  if (beatPos < 0.003) {
    s += (Math.random() * 2 - 1) * 0.008 * (1 - beatPos / 0.003);
  }

  // Master volume + fade
  let gain = 0.72;
  if (t < FADE_IN)           gain *= t / FADE_IN;
  if (t > DURATION - FADE_OUT) gain *= (DURATION - t) / FADE_OUT;
  gain = Math.max(0, gain);

  out[si] = Math.tanh(s * 1.4) * gain; // soft clip
}
console.log();

const outPath = 'artifacts/docuplete-explainer/public/audio/background.wav';
writeWAV(out, outPath);
console.log(`Wrote ${outPath}`);
