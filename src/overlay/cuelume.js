/* Cuelume, vendored.
 *
 * Source: cuelume 0.2.2 — https://github.com/Danilaa1/cuelume
 * Copied rather than depended on because Tailr ships with no dependencies and
 * the overlay bundle is a plain concatenation of files, with no bundler and no
 * module resolution to hand an import to. Cuelume synthesizes every sound live
 * through the Web Audio API, so there is nothing here but code — no assets, and
 * nothing of its own to fetch.
 *
 * Changed from upstream:
 *   · ESM turned into one classic script, since the overlay is a classic script.
 *   · Nothing trimmed: the recipe table is upstream's, so a version bump is a
 *     copy rather than a merge. Tailr plays nine of the seventeen.
 *   · `bind()` dropped. It delegates capture-phase listeners on the host app's
 *     document and reads data-cuelume-* attributes off it; Tailr is a guest on
 *     someone else's page and does not put listeners or attributes on it for
 *     anything but its own gestures. The overlay calls play() directly instead.
 *   · Exposed as window.__tailrCue, not a cuelume-shaped global — an app being
 *     reviewed may be using Cuelume itself, and Tailr must not collide with it.
 *
 * ── LICENSE ─────────────────────────────────────────────────────────────────
 * MIT License
 *
 * Copyright (c) 2026 Daniel Belyi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';
  if (window.__tailrCue) return;

  /* ── the palette ───────────────────────────────────────────
     Upstream's table, verbatim. Each sound has its own shape — a tick, a hush,
     a falling drop, a warm swell — rather than being a volume tweak on the same
     click. Tailr plays nine of the seventeen; chime, sparkle, droplet, whisper,
     loading, ready, pulse and arrival are here because keeping the palette
     whole is what makes updating from upstream a copy rather than a merge. */
  var RECIPES = {
    /** A soft two-note ascending bell, like an iOS/macOS confirmation tink. */
    chime: {
      masterGain: 0.5,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 1046.5, attack: 0.006, decay: 0.22, peak: 0.09 },
        { kind: "tone", waveform: "sine", frequency: 1568, offset: 0.09, attack: 0.006, decay: 0.26, peak: 0.08 },
      ],
      shimmer: { delay: 0.12, feedback: 0.25, wet: 0.18, lowpass: 4000 },
    },
    /** A quick ascending twinkle of four notes — bright and playful. */
    sparkle: {
      masterGain: 0.5,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 1760, offset: 0, attack: 0.003, decay: 0.09, peak: 0.045 },
        { kind: "tone", waveform: "sine", frequency: 2217, offset: 0.045, attack: 0.003, decay: 0.09, peak: 0.04 },
        { kind: "tone", waveform: "sine", frequency: 2637, offset: 0.09, attack: 0.003, decay: 0.1, peak: 0.038 },
        { kind: "tone", waveform: "sine", frequency: 3520, offset: 0.135, attack: 0.003, decay: 0.12, peak: 0.032 },
      ],
      shimmer: { delay: 0.07, feedback: 0.35, wet: 0.22, lowpass: 6000 },
    },
    /** A single note gliding smoothly downward, like a drop of water. */
    droplet: {
      masterGain: 0.55,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 1200, glideTo: 550, glideTime: 0.14, attack: 0.004, decay: 0.2, peak: 0.075 },
      ],
      shimmer: { delay: 0.09, feedback: 0.2, wet: 0.15, lowpass: 3000 },
    },
    /** A warm, slow-swelling pad from two gently detuned sines. */
    bloom: {
      masterGain: 0.5,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 528, attack: 0.06, decay: 0.32, peak: 0.06 },
        { kind: "tone", waveform: "sine", frequency: 528, detune: 12, attack: 0.06, decay: 0.34, peak: 0.05 },
      ],
      shimmer: { delay: 0.15, feedback: 0.2, wet: 0.12, lowpass: 2500 },
    },
    /** A soft hush with a falling tone — for tooltips and low-priority previews. */
    whisper: {
      masterGain: 0.48,
      layers: [
        { kind: "noise", filterType: "lowpass", filterFrequency: 1600, filterQ: 0.7, attack: 0.025, decay: 0.13, peak: 0.04 },
        { kind: "tone", waveform: "sine", frequency: 880, glideTo: 660, glideTime: 0.14, offset: 0.01, attack: 0.012, decay: 0.14, peak: 0.025 },
      ],
    },
    /** A focused, bandpass-filtered tick with a bright sine ping on top — crisp and instant. */
    tick: {
      masterGain: 0.4,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 5400, filterQ: 1.8, attack: 0.001, decay: 0.018, peak: 0.14 },
        { kind: "tone", waveform: "sine", frequency: 2600, attack: 0.001, decay: 0.012, peak: 0.018 },
      ],
    },
    /** A dull, muted knock — the "down" half of a press/release pair, like a key bottoming out. */
    press: {
      masterGain: 0.4,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 1700, filterQ: 1.4, attack: 0.001, decay: 0.02, peak: 0.13 },
      ],
    },
    /** A brighter, springier tick — the "up" half of a press/release pair, like a key returning. */
    release: {
      masterGain: 0.4,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 4600, filterQ: 1.8, attack: 0.001, decay: 0.016, peak: 0.12 },
        { kind: "tone", waveform: "sine", frequency: 3200, offset: 0.006, attack: 0.001, decay: 0.05, peak: 0.02 },
      ],
    },
    /** A two-part click-clack, like a mechanical switch flipping between states. */
    toggle: {
      masterGain: 0.4,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 2200, filterQ: 1.6, attack: 0.001, decay: 0.016, peak: 0.12 },
        { kind: "noise", filterType: "bandpass", filterFrequency: 3800, filterQ: 1.6, offset: 0.024, attack: 0.001, decay: 0.02, peak: 0.1 },
      ],
    },
    /** A short, warm three-note ascending confirmation — "done", not a fanfare. */
    success: {
      masterGain: 0.5,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 880, attack: 0.004, decay: 0.09, peak: 0.06 },
        { kind: "tone", waveform: "sine", frequency: 1108.73, offset: 0.06, attack: 0.004, decay: 0.1, peak: 0.06 },
        { kind: "tone", waveform: "sine", frequency: 1318.51, offset: 0.12, attack: 0.004, decay: 0.18, peak: 0.07 },
      ],
      shimmer: { delay: 0.1, feedback: 0.22, wet: 0.16, lowpass: 4500 },
    },
    /** A muted knock followed by two descending tones — a calm, recoverable refusal. */
    error: {
      masterGain: 0.42,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 850, filterQ: 1.1, attack: 0.001, decay: 0.035, peak: 0.13 },
        { kind: "tone", waveform: "triangle", frequency: 440, offset: 0.025, attack: 0.004, decay: 0.09, peak: 0.045 },
        { kind: "tone", waveform: "triangle", frequency: 349.23, offset: 0.1, attack: 0.004, decay: 0.14, peak: 0.04 },
      ],
    },
    /** A papery filtered flick with a tiny glass tick — for pages, galleries, and carousels. */
    page: {
      masterGain: 0.38,
      layers: [
        { kind: "noise", filterType: "lowpass", filterFrequency: 1800, filterQ: 0.7, attack: 0.006, decay: 0.08, peak: 0.11 },
        { kind: "noise", filterType: "bandpass", filterFrequency: 4200, filterQ: 1.2, offset: 0.04, attack: 0.004, decay: 0.065, peak: 0.08 },
        { kind: "tone", waveform: "sine", frequency: 2400, offset: 0.075, attack: 0.002, decay: 0.045, peak: 0.02 },
      ],
    },
    /** A brief unresolved lift — signals that user-initiated work has started. */
    loading: {
      masterGain: 0.42,
      layers: [
        { kind: "noise", filterType: "lowpass", filterFrequency: 1400, filterQ: 0.6, attack: 0.035, decay: 0.14, peak: 0.035 },
        { kind: "tone", waveform: "sine", frequency: 420, glideTo: 630, glideTime: 0.18, attack: 0.025, decay: 0.18, peak: 0.05 },
      ],
      shimmer: { delay: 0.11, feedback: 0.18, wet: 0.12, lowpass: 2800 },
    },
    /** A quick lock-on sweep resolving to a clear tone — the system is ready. */
    ready: {
      masterGain: 0.48,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 3600, filterQ: 1.8, attack: 0.001, decay: 0.02, peak: 0.11 },
        { kind: "tone", waveform: "triangle", frequency: 330, glideTo: 660, glideTime: 0.12, offset: 0.012, attack: 0.004, decay: 0.16, peak: 0.055 },
        { kind: "tone", waveform: "sine", frequency: 990, offset: 0.13, attack: 0.004, decay: 0.22, peak: 0.06 },
      ],
      shimmer: { delay: 0.1, feedback: 0.16, wet: 0.1, lowpass: 4200 },
    },
    /** A compact synthetic chirp — crisp feedback for primary buttons and controls. */
    pulse: {
      masterGain: 0.42,
      layers: [
        { kind: "noise", filterType: "bandpass", filterFrequency: 2600, filterQ: 2.4, attack: 0.001, decay: 0.022, peak: 0.08 },
        { kind: "tone", waveform: "triangle", frequency: 620, glideTo: 1240, glideTime: 0.07, attack: 0.002, decay: 0.085, peak: 0.055 },
      ],
    },
    /** A fast three-step locator signal — playful feedback for menus and secondary buttons. */
    scan: {
      masterGain: 0.4,
      layers: [
        { kind: "tone", waveform: "sine", frequency: 740, attack: 0.002, decay: 0.055, peak: 0.05 },
        { kind: "tone", waveform: "sine", frequency: 1110, offset: 0.045, attack: 0.002, decay: 0.055, peak: 0.045 },
        { kind: "tone", waveform: "sine", frequency: 1665, offset: 0.09, attack: 0.002, decay: 0.07, peak: 0.04 },
      ],
      shimmer: { delay: 0.065, feedback: 0.16, wet: 0.1, lowpass: 4200 },
    },
    /** A rising harmonic portal with a soft tail — for client-side page arrivals. */
    arrival: {
      masterGain: 0.44,
      layers: [
        { kind: "noise", filterType: "lowpass", filterFrequency: 900, filterQ: 0.8, attack: 0.05, decay: 0.24, peak: 0.035 },
        { kind: "tone", waveform: "sine", frequency: 220, glideTo: 440, glideTime: 0.32, attack: 0.04, decay: 0.34, peak: 0.055 },
        { kind: "tone", waveform: "sine", frequency: 659.25, offset: 0.12, attack: 0.045, decay: 0.32, peak: 0.04 },
        { kind: "tone", waveform: "sine", frequency: 987.77, offset: 0.19, attack: 0.045, decay: 0.34, peak: 0.032 },
      ],
      shimmer: { delay: 0.16, feedback: 0.28, wet: 0.18, lowpass: 3200 },
    },
  };

  function isSoundName(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RECIPES, value);
  }

  /* ── the audio graph ───────────────────────────────────────
     One shared, lazily created AudioContext. Every sound carries a gentle
     envelope (and often a soft shimmer tail) instead of a hard transient, so
     nothing feels harsh. */
  var SOURCE_STOP_PADDING = 0.05;
  var CLEANUP_MARGIN = 0.05;
  var INAUDIBLE_GAIN = 0.001;
  var OUTPUT_GAIN = 4;

  function renderTone(context, destination, layer, startTime) {
    var oscillator = context.createOscillator();
    oscillator.type = layer.waveform;
    oscillator.frequency.setValueAtTime(layer.frequency, startTime);
    if (layer.detune) oscillator.detune.value = layer.detune;
    if (layer.glideTo !== undefined) {
      var glideTime = layer.glideTime !== undefined ? layer.glideTime : layer.attack + layer.decay;
      oscillator.frequency.exponentialRampToValueAtTime(layer.glideTo, startTime + glideTime);
    }
    var gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + layer.attack + layer.decay);
    oscillator.connect(gain).connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + layer.attack + layer.decay + SOURCE_STOP_PADDING);
  }

  function renderNoise(context, destination, layer, startTime) {
    var duration = layer.attack + layer.decay + SOURCE_STOP_PADDING;
    var length = Math.max(1, Math.floor(duration * context.sampleRate));
    var buffer = context.createBuffer(1, length, context.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = 2 * Math.random() - 1;
    var source = context.createBufferSource();
    source.buffer = buffer;
    var filter = context.createBiquadFilter();
    filter.type = layer.filterType;
    filter.frequency.value = layer.filterFrequency;
    if (layer.filterQ !== undefined) filter.Q.value = layer.filterQ;
    var gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + layer.attack + layer.decay);
    source.connect(filter).connect(gain).connect(destination);
    source.start(startTime);
    source.stop(startTime + duration);
  }

  /** A soft echo/shimmer send off `source`, feeding back into `destination`. */
  function attachShimmer(context, source, destination, shimmer) {
    var delay = context.createDelay(1);
    delay.delayTime.value = shimmer.delay;
    var feedbackFilter = context.createBiquadFilter();
    feedbackFilter.type = 'lowpass';
    feedbackFilter.frequency.value = shimmer.lowpass;
    var feedbackGain = context.createGain();
    feedbackGain.gain.value = shimmer.feedback;
    var wetGain = context.createGain();
    wetGain.gain.value = shimmer.wet;
    source.connect(delay);
    delay.connect(feedbackFilter);
    feedbackFilter.connect(feedbackGain);
    feedbackGain.connect(delay);
    feedbackFilter.connect(wetGain);
    wetGain.connect(destination);
    return [delay, feedbackFilter, feedbackGain, wetGain];
  }

  function sourceEnd(recipe) {
    return Math.max.apply(null, recipe.layers.map(function (layer) {
      return (layer.offset || 0) + layer.attack + layer.decay + SOURCE_STOP_PADDING;
    }));
  }

  function shimmerTail(shimmer) {
    if (!shimmer || shimmer.feedback <= 0) return 0;
    if (shimmer.feedback >= 1) return shimmer.delay;
    return shimmer.delay * (1 + Math.ceil(Math.log(INAUDIBLE_GAIN) / Math.log(shimmer.feedback)));
  }

  var sharedOutput = null;
  function getOutput(context) {
    if (sharedOutput) return sharedOutput;
    var output = context.createGain();
    output.gain.value = OUTPUT_GAIN;
    var limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;
    output.connect(limiter).connect(context.destination);
    sharedOutput = output;
    return output;
  }

  function renderRecipe(context, recipe, volume) {
    var now = context.currentTime;
    var output = getOutput(context);
    var master = context.createGain();
    master.gain.value = recipe.masterGain * volume;
    master.connect(output);
    var shimmerNodes = recipe.shimmer
      ? attachShimmer(context, master, output, recipe.shimmer)
      : [];
    recipe.layers.forEach(function (layer) {
      var startTime = now + (layer.offset || 0);
      if (layer.kind === 'tone') renderTone(context, master, layer, startTime);
      else renderNoise(context, master, layer, startTime);
    });
    var cleanupAfterMs = (sourceEnd(recipe) + shimmerTail(recipe.shimmer) + CLEANUP_MARGIN) * 1000;
    setTimeout(function () {
      master.disconnect();
      shimmerNodes.forEach(function (node) { node.disconnect(); });
    }, cleanupAfterMs);
  }

  var sharedContext = null;
  var enabled = true;
  var globalVolume = 1;

  function normalizeVolume(value, fallback) {
    return typeof value === 'number' && isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : fallback;
  }

  /** Enables or disables future playback. Preference storage stays with Tailr. */
  function setEnabled(value) {
    if (typeof value === 'boolean') enabled = value;
  }

  /** Sets the volume multiplier for future playback. */
  function setVolume(value) {
    globalVolume = normalizeVolume(value, globalVolume);
  }

  function getAudioContext() {
    if (sharedContext) return sharedContext;
    if (typeof window === 'undefined') return null;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { sharedContext = new Ctor(); } catch (e) { return null; }
    return sharedContext;
  }

  /**
   * Plays a sound immediately. Safe to call from anywhere — lazily creates the
   * shared AudioContext on first use, resumes it if the browser started it
   * suspended (before any user gesture), and is a no-op when Web Audio is
   * unavailable.
   */
  function play(sound, options) {
    if (!enabled || !isSoundName(sound)) return;
    if (typeof navigator !== 'undefined' && navigator.userActivation &&
        navigator.userActivation.hasBeenActive === false) return;
    var playVolume = globalVolume * normalizeVolume(options && options.volume, 1);
    if (playVolume === 0) return;
    var context = getAudioContext();
    if (!context) return;
    var recipe = RECIPES[sound];
    if (context.state === 'running') {
      renderRecipe(context, recipe, playVolume);
      return;
    }
    try {
      context.resume().then(function () {
        if (enabled && context.state === 'running') renderRecipe(context, recipe, playVolume);
      }, function () {});
    } catch (e) {
      // Some browsers throw synchronously when audio is blocked.
    }
  }

  window.__tailrCue = {
    play: play,
    setEnabled: setEnabled,
    setVolume: setVolume,
    sounds: Object.keys(RECIPES)
  };
})();
