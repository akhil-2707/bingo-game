/* ==========================================================================
   WEB AUDIO & SPEECH SYNTHESIZER FOR BINGO MOBILE
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    this.speechEnabled = true;
    this.synth = window.speechSynthesis || null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume().catch(() => {});
      } catch (e) {}
    }
  }

  playPop() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.08);
  }

  playDaub() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.12);
  }

  playWhoosh() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, this.audioCtx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.25);
  }

  playTickingBomb() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    for (let i = 0; i < 8; i++) {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600 + i * 100, this.audioCtx.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + i * 0.12 + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime + i * 0.12);
      osc.stop(this.audioCtx.currentTime + i * 0.12 + 0.08);
    }
  }

  playExplosion() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.4);
  }

  playLineChime() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime + idx * 0.08);
      osc.stop(this.audioCtx.currentTime + idx * 0.08 + 0.3);
    });
  }

  playVictoryFanfare() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const sequence = [
      { f: 523.25, d: 0.15, t: 0 },
      { f: 659.25, d: 0.15, t: 0.15 },
      { f: 783.99, d: 0.15, t: 0.30 },
      { f: 1046.50, d: 0.45, t: 0.45 },
      { f: 880.00, d: 0.20, t: 0.95 },
      { f: 1046.50, d: 0.60, t: 1.15 }
    ];

    sequence.forEach(item => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.f, this.audioCtx.currentTime + item.t);

      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime + item.t);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + item.t + item.d);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime + item.t);
      osc.stop(this.audioCtx.currentTime + item.t + item.d);
    });
  }

  speakCall(letter, number) {
    if (!this.speechEnabled || !this.synth) return;
    this.synth.cancel(); // cancel pending speech

    const text = `${letter}, ${number}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    // Pick an English voice if available
    const voices = this.synth.getVoices();
    const engVoice = voices.find(v => v.lang.startsWith('en'));
    if (engVoice) utterance.voice = engVoice;

    this.synth.speak(utterance);
  }

  speakText(text) {
    if (!this.speechEnabled || !this.synth) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    this.synth.speak(utterance);
  }

  triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }
  }
}

export const sound = new SoundEngine();
