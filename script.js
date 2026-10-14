// In Tune — UXD Playground I, Sound Design experiment
// Two voices start apart in pitch, tempo, sound and stereo position,
// and grow towards each other until they play one chord.
// Everything is generated live with Tone.js.

/*  TIMING  */

const BPM = 96;
const BEAT = 60 / BPM; // one beat = 0.625 s
const BAR = BEAT * 4; // one bar = 2.5 s
const S16 = BEAT / 4; // a sixteenth note

// The structure of the piece, in seconds (all multiples of a bar)
const T = {
  bEnters: 4 * BAR, // 0:10  voice B joins
  backing: 8 * BAR, // 0:20  drums and drone come in: full clash
  converge: 16 * BAR, // 0:40  the voices start moving towards each other
  together: 26 * BAR, // 1:05  they meet: harmony section
  outro: 40 * BAR, // 1:40  final chord
  end: 42 * BAR, // 1:45
};
const STOP_AT = T.end + 3; // let the last chord ring out

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, x) => a + (b - a) * x;

// How far the voices have come together: 0 = apart, 1 = together.
// Smoothstep, so the movement starts and ends gently.
const convergence = (t) => {
  const x = clamp((t - T.converge) / (T.together - T.converge), 0, 1);
  return x * x * (3 - 2 * x);
};

/*  WHAT "APART" MEANS  */
// Change these numbers to change how far apart the voices start.

const APART = {
  centsA: -50, // voice A starts 50 cents flat...
  centsB: 50, // ...and voice B 50 cents sharp: a semitone apart
  rushA: 0.82, // voice A's notes come at 82% of the grid: it rushes
  dragB: 1.37, // voice B's notes come at 137% of a beat: it drags
  panA: -1, // voice A only in the left ear
  panB: 1, // voice B only in the right ear (both end up in the middle: both ears)
};

/*  MIX  */
// How loud each voice is, in dB, while clashing and once together.
// 0 = unchanged, +3 is noticeably louder, -3 noticeably softer.

const MIX = {
  clashA: 0, // A is unchanged while clashing
  clashB: -5, // B a bit softer while clashing, so it doesn't drown out A
  togetherA: 4, // A gets more presence once they play together
  togetherB: -2, // B gets a bit softer once they play together
};

/*  SOUND PALETTE  */
// Every sound a voice can have. Each one goes through the same chain:
// synth -> distortion ("drive") -> lowpass filter ("cutoff") -> stereo position.
// "apart" is how it sounds at the start, "together" how it sounds once the voices meet.
// To add a sound: copy one entry, give it a new key, and change the synth settings.

const SOUNDS = {
  buzz: {
    name: "Buzz saw",
    word: "sharp",
    make: () =>
      new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.005, decay: 0.12, sustain: 0.15, release: 0.15 },
        volume: -16,
      }),
    apart: { drive: 0.7, cutoff: 6000 },
    together: { drive: 0, cutoff: 2800 },
  },
  bell: {
    name: "Glass bell",
    word: "glassy",
    make: () =>
      new Tone.FMSynth({
        harmonicity: 3.01,
        modulationIndex: 0.3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 1.2, sustain: 0.25, release: 1.5 },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.01,
          decay: 0.5,
          sustain: 0.3,
          release: 0.5,
        },
        volume: -11,
      }),
    apart: { drive: 0, cutoff: 9000 },
    together: { drive: 0, cutoff: 4000 },
    // The bell also gets warmer and fuller as it comes closer
    blend: (synth, p, time) =>
      synth.modulationIndex.rampTo(lerp(0.3, 2.5, p), 0.25, time),
  },
  chip: {
    name: "8-bit chip",
    word: "bleepy",
    make: () =>
      new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0.3, release: 0.08 },
        volume: -21,
      }),
    apart: { drive: 0.3, cutoff: 7000 },
    together: { drive: 0, cutoff: 2800 },
  },
  reed: {
    name: "Nasal reed",
    word: "nasal",
    make: () =>
      new Tone.Synth({
        oscillator: { type: "pulse", width: 0.6 },
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.3 },
        volume: -19,
      }),
    apart: { drive: 0.5, cutoff: 4500 },
    together: { drive: 0, cutoff: 2800 },
  },
  organ: {
    name: "Hollow organ",
    word: "hollow",
    make: () =>
      new Tone.AMSynth({
        harmonicity: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.03, decay: 0.3, sustain: 0.6, release: 0.8 },
        modulation: { type: "square" },
        volume: -14,
      }),
    apart: { drive: 0.2, cutoff: 5000 },
    together: { drive: 0, cutoff: 3000 },
  },
  wobble: {
    name: "Wobbly duo",
    word: "wobbly",
    make: () =>
      new Tone.DuoSynth({
        harmonicity: 1.5,
        vibratoAmount: 0.5,
        vibratoRate: 5,
        voice0: {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 },
        },
        voice1: {
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 },
        },
        volume: -19,
      }),
    apart: { drive: 0.2, cutoff: 5000 },
    together: { drive: 0, cutoff: 2800 },
    // The wobble calms down as it comes closer
    blend: (synth, p, time) =>
      synth.vibratoAmount.rampTo(lerp(0.5, 0, p), 0.25, time),
  },
};

// Which sound each voice uses (changed with the menus on the page)
const chosen = { a: "buzz", b: "bell" };

/*  AUDIO SETUP  */

let ready = false;
let out, recorder;
const V = { a: null, b: null }; // the two voices: { id, sound, synth, drive, filter, space, level, pan }
let pad, bass, kick, hat, snare, riser, riserFilter;
let droneLow, droneHigh, droneGain;

const C3 = 130.81;
const centsToHz = (hz, cents) => hz * Math.pow(2, cents / 1200);
// A note name like "C5", shifted by a number of cents
const hz = (note, cents) =>
  centsToHz(Tone.Frequency(note).toFrequency(), cents);

const setupAudio = async () => {
  const master = new Tone.Limiter(-1).toDestination();
  const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 });
  await reverb.ready;
  reverb.connect(master);
  out = master;

  recorder = new Tone.Recorder();
  master.connect(recorder);

  // Drone: two low tones a semitone apart that "beat" against each other
  droneGain = new Tone.Gain(0).connect(
    new Tone.Filter(900, "lowpass").connect(reverb),
  );
  droneLow = new Tone.Oscillator(
    centsToHz(C3, APART.centsA),
    "triangle",
  ).connect(droneGain);
  droneHigh = new Tone.Oscillator(
    centsToHz(C3, APART.centsB),
    "triangle",
  ).connect(droneGain);
  droneLow.start();
  droneHigh.start();

  // Backing for the harmony section
  pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fattriangle", count: 3, spread: 18 },
    envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 },
    volume: -24,
  }).connect(new Tone.Filter(1400, "lowpass").connect(reverb));

  bass = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3 },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.5,
      baseFrequency: 200,
      octaves: 2,
    },
    volume: -12,
  }).connect(master);

  kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
    volume: -8,
  }).connect(master);

  hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    volume: -26,
  }).connect(new Tone.Filter(7000, "highpass").connect(master));

  snare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -17,
  }).connect(new Tone.Filter(1800, "bandpass").connect(reverb));

  // A noise swell that leads into the moment they meet
  riserFilter = new Tone.Filter(400, "bandpass").connect(reverb);
  riser = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 3.5, decay: 0.1, sustain: 0, release: 0.3 },
    volume: -26,
  }).connect(riserFilter);

  ready = true;
};

// Build one voice from the palette:
// synth -> drive -> filter -> own reverb -> level -> ear (left, right or both) -> output
// Each voice has its own reverb, so even its echo stays in its own ear while they're apart.
const buildVoice = async (id, side) => {
  const sound = SOUNDS[id];
  const pan = new Tone.Panner({
    pan: side === "a" ? APART.panA : APART.panB,
    channelCount: 2,
  }).connect(out);
  const level = new Tone.Volume(side === "a" ? MIX.clashA : MIX.clashB).connect(
    pan,
  );
  const space = new Tone.Reverb({ decay: 4, wet: 0.3 });
  await space.ready;
  space.connect(level);
  const filter = new Tone.Filter(sound.apart.cutoff, "lowpass").connect(space);
  const drive = new Tone.Distortion({
    distortion: 0.5,
    wet: sound.apart.drive,
  }).connect(filter);
  const synth = sound.make().connect(drive);
  return {
    id,
    sound,
    synth,
    drive,
    filter,
    space,
    level,
    pan,
    dispose: () =>
      [synth, drive, filter, space, level, pan].forEach((node) =>
        node.dispose(),
      ),
  };
};

// Make sure both voices use the chosen sounds, and reset them to their "apart" state
const prepareVoices = async () => {
  for (const side of ["a", "b"]) {
    if (!V[side] || V[side].id !== chosen[side]) {
      if (V[side]) V[side].dispose();
      V[side] = await buildVoice(chosen[side], side);
    }
    const v = V[side];
    v.drive.wet.value = v.sound.apart.drive;
    v.filter.frequency.value = v.sound.apart.cutoff;
    v.level.volume.value = side === "a" ? MIX.clashA : MIX.clashB;
    v.pan.pan.value = side === "a" ? APART.panA : APART.panB;
    if (v.sound.blend) v.sound.blend(v.synth, 0, Tone.now());
  }
};

/*  THE SCORE  */

const A_NOTES = ["C5", "D5", "E5", "G5", "A5", "C6", "D6"];
const B_NOTES = ["G4", "A4", "C5", "D5", "E5", "G5"];

// The harmony section: 7 chords of 2 bars each
const PROG = [
  {
    pad: ["C3", "E3", "G3", "B3"],
    bass: "C2",
    arp: ["C4", "E4", "G4", "B4"],
    mel: ["E5", "G5", "E5", "D5"],
  },
  {
    pad: ["A2", "C3", "E3", "G3"],
    bass: "A1",
    arp: ["A3", "C4", "E4", "G4"],
    mel: ["C5", "E5", "C5", "B4"],
  },
  {
    pad: ["F2", "A2", "C3", "E3"],
    bass: "F1",
    arp: ["F3", "A3", "C4", "E4"],
    mel: ["A4", "C5", "A4", "G4"],
  },
  {
    pad: ["G2", "B2", "D3", "A3"],
    bass: "G1",
    arp: ["G3", "B3", "D4", "A4"],
    mel: ["B4", "D5", "B4", "D5"],
  },
  {
    pad: ["C3", "E3", "G3", "B3"],
    bass: "C2",
    arp: ["C4", "E4", "G4", "B4"],
    mel: ["E5", "G5", "A5", "G5"],
  },
  {
    pad: ["A2", "C3", "E3", "G3"],
    bass: "A1",
    arp: ["A3", "C4", "E4", "G4"],
    mel: ["E5", "C5", "E5", "D5"],
  },
  {
    pad: ["F2", "A2", "C3", "E3"],
    bass: "F1",
    arp: ["F3", "A3", "C4", "E4"],
    mel: ["C5", "A4", "C5", "D5"],
  },
];
const ARP_ORDER = [0, 1, 2, 3, 2, 1];

const buildScore = (tr) => {
  const A = V.a.synth;
  const B = V.b.synth;

  // --- Part 1 and 2: the two voices on their own clocks ---
  // Each voice schedules its own next note, so its tempo can drift.
  let aIndex = 2,
    aCount = 0;
  const nextA = (t) => {
    tr.schedule((time) => {
      const p = convergence(t);
      if (Math.random() > 0.22 * (1 - p)) {
        // fewer rests as they come together
        aIndex = clamp(
          aIndex + Math.floor(Math.random() * 5) - 2,
          0,
          A_NOTES.length - 1,
        );
        const accent = aCount % 5 === 0; // accents in groups of 5 against the 4-beat grid
        A.triggerAttackRelease(
          hz(A_NOTES[aIndex], APART.centsA * (1 - p)),
          S16 * 0.8,
          time,
          accent ? 0.9 : 0.45,
        );
        pulse("a", time, accent ? 1 : 0.5);
      }
      aCount++;
      const next = t + S16 * lerp(APART.rushA, 1, p);
      if (next < T.together) nextA(next);
    }, t);
  };
  nextA(0);

  let bIndex = 2;
  const nextB = (t) => {
    tr.schedule((time) => {
      const p = convergence(t);
      const interval = BEAT * lerp(APART.dragB, 1, p);
      bIndex = clamp(
        bIndex + Math.floor(Math.random() * 3) - 1,
        0,
        B_NOTES.length - 1,
      );
      B.triggerAttackRelease(
        hz(B_NOTES[bIndex], APART.centsB * (1 - p)),
        interval * 0.9,
        time,
        0.7,
      );
      pulse("b", time, 0.9);
      if (t + interval < T.together) nextB(t + interval);
    }, t);
  };
  nextB(T.bEnters);

  // --- Slow changes: sound and stereo position, every quarter second ---
  let k = 0;
  tr.scheduleRepeat(
    (time) => {
      const p = convergence(k * 0.25);
      k++;
      ["a", "b"].forEach((side) => {
        const v = V[side];
        v.drive.wet.rampTo(
          lerp(v.sound.apart.drive, v.sound.together.drive, p),
          0.25,
          time,
        );
        v.filter.frequency.rampTo(
          lerp(v.sound.apart.cutoff, v.sound.together.cutoff, p),
          0.25,
          time,
        );
        if (v.sound.blend) v.sound.blend(v.synth, p, time);
      });
      // From one ear each to both ears
      V.a.pan.pan.rampTo(lerp(APART.panA, 0, p), 0.25, time);
      V.b.pan.pan.rampTo(lerp(APART.panB, 0, p), 0.25, time);
      // From the clash mix to the together mix
      V.a.level.volume.rampTo(lerp(MIX.clashA, MIX.togetherA, p), 0.25, time);
      V.b.level.volume.rampTo(lerp(MIX.clashB, MIX.togetherB, p), 0.25, time);
    },
    0.25,
    0,
    T.together + BAR,
  );

  // --- The clash backing: drums in 3 against 4, beating drone ---
  tr.schedule((time) => {
    droneLow.frequency.setValueAtTime(centsToHz(C3, APART.centsA), time);
    droneHigh.frequency.setValueAtTime(centsToHz(C3, APART.centsB), time);
    droneGain.gain.rampTo(0.12, 4, time);
  }, T.backing);
  tr.scheduleRepeat(
    (time) => kick.triggerAttackRelease("C1", "8n", time, 0.7),
    BEAT,
    T.backing,
    T.together - T.backing,
  );
  tr.scheduleRepeat(
    (time) => hat.triggerAttackRelease(0.03, time, 0.6),
    S16 * 3,
    T.backing,
    T.together - T.backing,
  );

  // The drone's two tones slide to the same note, so the beating slows down and stops
  tr.schedule((time) => {
    const dur = T.together - T.converge;
    droneLow.frequency.setValueAtTime(centsToHz(C3, APART.centsA), time);
    droneLow.frequency.linearRampToValueAtTime(C3, time + dur);
    droneHigh.frequency.setValueAtTime(centsToHz(C3, APART.centsB), time);
    droneHigh.frequency.linearRampToValueAtTime(C3, time + dur);
  }, T.converge);

  // Swell into the meeting point
  tr.schedule((time) => {
    riserFilter.frequency.setValueAtTime(400, time);
    riserFilter.frequency.exponentialRampToValueAtTime(5000, time + 3.7);
    riser.triggerAttackRelease(3.75, time);
  }, T.together - 3.75);

  // --- Part 3: together, on one shared grid ---
  tr.schedule((time) => droneGain.gain.rampTo(0, 4, time), T.together);

  PROG.forEach((ch, c) => {
    const start = T.together + c * 2 * BAR;
    tr.schedule(
      (time) => pad.triggerAttackRelease(ch.pad, 2 * BAR * 0.95, time, 0.6),
      start,
    );

    for (let bar = 0; bar < 2; bar++) {
      const b0 = start + bar * BAR;
      const oct = Tone.Frequency(ch.bass).transpose(12).toNote();
      [
        [0, ch.bass, 1.4],
        [1.5, ch.bass, 0.4],
        [2, oct, 0.9],
        [3, ch.bass, 0.9],
      ].forEach(([beat, note, len]) => {
        tr.schedule(
          (time) =>
            bass.triggerAttackRelease(note, len * BEAT * 0.9, time, 0.8),
          b0 + beat * BEAT,
        );
      });
      [0, 2, 2.5].forEach((beat) =>
        tr.schedule(
          (time) => kick.triggerAttackRelease("C1", "8n", time, 0.8),
          b0 + beat * BEAT,
        ),
      );
      [1, 3].forEach((beat) =>
        tr.schedule(
          (time) => snare.triggerAttackRelease(0.15, time, 0.8),
          b0 + beat * BEAT,
        ),
      );
      for (let e = 0; e < 8; e++) {
        tr.schedule(
          (time) => hat.triggerAttackRelease(0.03, time, e % 2 ? 0.4 : 0.7),
          b0 + (e * BEAT) / 2,
        );
      }
    }

    // Voice A becomes the arpeggio, voice B the melody: two roles in one song
    for (let i = 0; i < 16; i++) {
      tr.schedule(
        (time) => {
          A.triggerAttackRelease(
            ch.arp[ARP_ORDER[i % ARP_ORDER.length]],
            S16 * 1.6,
            time,
            0.55,
          );
          pulse("a", time, 0.45);
        },
        start + (i * BEAT) / 2,
      );
    }
    for (let i = 0; i < 4; i++) {
      tr.schedule(
        (time) => {
          B.triggerAttackRelease(ch.mel[i], BEAT * 1.9, time, 0.6);
          pulse("b", time, 0.8);
        },
        start + i * 2 * BEAT,
      );
    }
  });

  // --- Outro: both voices on the same note over the final chord ---
  tr.schedule((time) => {
    pad.triggerAttackRelease(["C3", "G3", "D4", "E4"], 2 * BAR, time, 0.7);
    bass.triggerAttackRelease("C2", 2 * BAR, time, 0.8);
    kick.triggerAttackRelease("C1", "4n", time, 0.8);
    A.triggerAttackRelease("C5", 2 * BAR, time, 0.4);
    B.triggerAttackRelease("C5", 2 * BAR, time, 0.6);
    pulse("a", time, 1);
    pulse("b", time, 1);
  }, T.outro);

  tr.schedule(
    (time) => Tone.getDraw().schedule(() => stop(true), time),
    STOP_AT,
  );
};

/* ================= VOICE PICKERS ================= */

const soundA = document.getElementById("soundA");
const soundB = document.getElementById("soundB");
const shuffleBtn = document.getElementById("shuffleBtn");
const legendA = document.getElementById("legendA");
const legendB = document.getElementById("legendB");
const rTone = document.getElementById("rTone");

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

Object.entries(SOUNDS).forEach(([id, sound]) => {
  [soundA, soundB].forEach((select) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = sound.name;
    select.appendChild(opt);
  });
});

const showChoices = () => {
  soundA.value = chosen.a;
  soundB.value = chosen.b;
  legendA.textContent = "Voice A: " + SOUNDS[chosen.a].name;
  legendB.textContent = "Voice B: " + SOUNDS[chosen.b].name;
  rTone.textContent = startingSound();
};
const startingSound = () => {
  return capitalise(SOUNDS[chosen.a].word) + " vs " + SOUNDS[chosen.b].word;
};

soundA.addEventListener("change", () => {
  chosen.a = soundA.value;
  showChoices();
});
soundB.addEventListener("change", () => {
  chosen.b = soundB.value;
  showChoices();
});

// Pick two different random sounds
shuffleBtn.addEventListener("click", () => {
  const ids = Object.keys(SOUNDS);
  const a = ids[Math.floor(Math.random() * ids.length)];
  let b = a;
  while (b === a) b = ids[Math.floor(Math.random() * ids.length)];
  chosen.a = a;
  chosen.b = b;
  showChoices();
});

const lockPickers = (locked) => {
  soundA.disabled = locked;
  soundB.disabled = locked;
  shuffleBtn.disabled = locked;
};

showChoices();

/*  PLAYBACK  */

const playBtn = document.getElementById("playBtn");
const recBox = document.getElementById("recBox");
const recWrap = document.getElementById("recWrap");
const download = document.getElementById("download");
let playing = false;
let recording = false;

// Recording downloads a file, which only works when the page runs on its own (VS Code, GitHub Pages)
let embedded = true;
try {
  embedded = window.self !== window.top;
} catch (e) {
  embedded = true;
}
if (embedded) recWrap.hidden = true;

playBtn.addEventListener("click", async () => {
  if (playing) {
    stop(false);
    return;
  }
  playBtn.disabled = true;
  try {
    await Tone.start();
    if (!ready) await setupAudio();
  } catch (e) {
    playBtn.disabled = false;
    playBtn.textContent = "Play";
    return;
  }
  const tr = Tone.getTransport();
  tr.stop();
  tr.cancel(0);
  tr.bpm.value = BPM;
  await prepareVoices();
  energy.a = energy.b = 0;
  buildScore(tr);

  download.hidden = true;
  recording = !embedded && recBox.checked;
  if (recording) recorder.start();

  tr.start("+0.1");
  playing = true;
  lockPickers(true);
  playBtn.disabled = false;
  playBtn.textContent = "Stop";
  playBtn.setAttribute("aria-pressed", "true");
});

const stop = async (finished) => {
  if (!playing) return;
  playing = false;
  const tr = Tone.getTransport();
  tr.stop();
  tr.cancel(0);
  if (ready) {
    pad.releaseAll();
    droneGain.gain.cancelScheduledValues(Tone.now());
    droneGain.gain.rampTo(0, 0.3);
    V.a.synth.triggerRelease();
    V.b.synth.triggerRelease();
  }
  lockPickers(false);
  showChoices();
  lastShown = -1;
  playBtn.textContent = finished ? "Play again" : "Play";
  playBtn.setAttribute("aria-pressed", "false");
  if (recording) {
    recording = false;
    const blob = await recorder.stop();
    download.href = URL.createObjectURL(blob);
    download.download = "in-tune-" + chosen.a + "-" + chosen.b + ".webm";
    download.hidden = false;
  }
};

/*  LIGHT / DARK MODE  */

const themeBtn = document.getElementById("themeBtn");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

// The theme you actually see: the button's choice, or else the computer's setting
const currentTheme = () => {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return darkQuery.matches ? "dark" : "light";
};
const updateThemeBtn = () => {
  themeBtn.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode";
};
themeBtn.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("in-tune:theme", next);
  } catch (e) {}
  updateThemeBtn();
});
darkQuery.addEventListener("change", updateThemeBtn);
updateThemeBtn();

/*  VISUALS  */

const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");
const energy = { a: 0, b: 0 };
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const pulse = (voice, time, amount) => {
  Tone.getDraw().schedule(() => {
    energy[voice] = Math.max(energy[voice], amount);
  }, time);
};

// The canvas can't use CSS variables directly, so read the current colours from the page
let colors = {};
const readColors = () => {
  const s = getComputedStyle(document.documentElement);
  const bg = s.getPropertyValue("--surface").trim();
  colors = {
    a: s.getPropertyValue("--voice-a").trim(),
    b: s.getPropertyValue("--voice-b").trim(),
    line: s.getPropertyValue("--line").trim(),
    dark: isDark(bg),
  };
};
const isDark = (hex) => {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16),
    g = parseInt(m.slice(2, 4), 16),
    b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};
readColors();
darkQuery.addEventListener("change", readColors);
new MutationObserver(readColors).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

const resize = () => {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
window.addEventListener("resize", resize);
resize();

// A voice as a blob: spiky when apart, round when together
const drawBlob = (x, y, r, spikes, color, seed, t) => {
  ctx.beginPath();
  const points = 48;
  for (let i = 0; i <= points; i++) {
    const ang = (i / points) * Math.PI * 2;
    const wobble = reduceMotion
      ? 0
      : Math.sin(ang * 7 + t * 3 + seed) * 0.5 +
        Math.sin(ang * 13 - t * 5 + seed * 2) * 0.5;
    const rr = r * (1 + wobble * spikes);
    const px = x + Math.cos(ang) * rr,
      py = y + Math.sin(ang) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

const frame = () => {
  const W = canvas.clientWidth,
    H = canvas.clientHeight;
  const t = playing ? Tone.getTransport().seconds : 0;
  const p = convergence(t);
  const merge = clamp((t - T.outro) / BAR, 0, 1); // the final merge into one shape
  const clock = performance.now() / 1000;

  ctx.clearRect(0, 0, W, H);

  // Guide line through the middle
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, 16);
  ctx.lineTo(W / 2, H - 36);
  ctx.stroke();

  // Distance between the voices, and a slow dance around each other once together
  const apart = lerp(W * 0.3, W * 0.07, p) * (1 - merge);
  const spin = t > T.together && !reduceMotion ? (t - T.together) * 0.6 : 0;
  const cx = W / 2,
    cy = H / 2 - 8;
  const ax = cx - Math.cos(spin) * apart,
    ay = cy - Math.sin(spin) * apart * 0.5;
  const bx = cx + Math.cos(spin) * apart,
    by = cy + Math.sin(spin) * apart * 0.5;

  // Voice A shakes while it rushes
  const shake = reduceMotion ? 0 : (1 - p) * 4;
  const base = Math.min(W, H) * 0.13;
  const ra = base * (1 + energy.a * 0.25);
  const rb = base * (1 + energy.b * 0.25);

  ctx.globalCompositeOperation = colors.dark ? "screen" : "multiply";
  ctx.globalAlpha = 0.9;
  drawBlob(
    ax + (Math.random() - 0.5) * shake,
    ay + (Math.random() - 0.5) * shake,
    ra,
    lerp(0.22, 0.03, p),
    colors.a,
    1,
    clock,
  );
  drawBlob(bx, by, rb, lerp(0.05, 0.03, p), colors.b, 4, clock);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  energy.a *= 0.88;
  energy.b *= 0.9;

  if (playing) updateReadout(t, p);
  requestAnimationFrame(frame);
};

/*  READOUT  */

const clockEl = document.getElementById("clock");
const fill = document.getElementById("fill");
const rPitch = document.getElementById("rPitch");
const rTempo = document.getElementById("rTempo");
let lastShown = -1;

const fmt = (s) => {
  const m = Math.floor(s / 60),
    r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
};
const updateReadout = (t, p) => {
  const shown = Math.min(t, T.end);
  const key = Math.floor(shown * 4);
  if (key === lastShown) return;
  lastShown = key;
  clockEl.firstChild.textContent = fmt(shown) + " ";
  fill.style.width = (shown / T.end) * 100 + "%";
  rPitch.textContent =
    Math.round((APART.centsB - APART.centsA) * (1 - p)) + " cents";
  const tempoA = Math.round(BPM / lerp(APART.rushA, 1, p));
  const tempoB = Math.round(BPM / lerp(APART.dragB, 1, p));
  rTempo.textContent = tempoA + " / " + tempoB + " bpm";
  rTone.textContent =
    p < 0.05 ? startingSound() : p < 0.95 ? "Softening" : "Blended";
};

requestAnimationFrame(frame);
