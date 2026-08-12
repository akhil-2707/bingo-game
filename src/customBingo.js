/* ==========================================================================
   CUSTOM WORD BINGO BUILDER & PRESETS
   ========================================================================== */

import { sound } from './audio.js';

export const PRESETS = {
  party: [
    "Someone spills a drink", "Awkward silence", "Group selfie", "Loud laugh",
    "Dancing attempt", "Confetti drop", "Someone checks phone", "Toast given",
    "Song request", "Late arrival", "Forgot someone's name", "Double dip",
    "Cheesy joke", "Snack refill", "High five", "Outfit compliment",
    "Story interruption", "Background music changes", "Pet appearance",
    "Photo taken", "Laughter tear", "Group hug", "Dessert served", "Cheers!"
  ],
  office: [
    "Can you hear me?", "You're on mute", "Awkward wave at end", "Screen share fail",
    "Child or pet in background", "Sorry I was double muted", "Let's take this offline",
    "Heavy breathing on mic", "Echoing sound", "Is my screen visible?",
    "Synergy mentioned", "Circle back", "Bandwidth check", "Out of pocket",
    "Deep dive", "Action items", "Hard stop", "Drop off early",
    "Coffee sip", "Typing noises", "Awkward pause", "Frozen video",
    "Tech issues", "Quick question"
  ],
  roadtrip: [
    "Yellow car", "License plate from far away", "Wind turbine", "Cow herd",
    "Tunnel drive", "Bridge crossing", "Bridge construction", "Speed trap cop",
    "Billboard ad", "Rest stop visit", "Song sing-along", "Snack bag opened",
    "Are we there yet?", "Wrong turn", "Gas station stop", "Scenic view point",
    "Train tracks", "Classic car", "Dog in car window", "Water tower",
    "Bumper sticker joke", "Motorcycle gang", "Radio static", "Sunrise or Sunset"
  ],
  movie: [
    "Hero speech", "Plot twist", "Jump scare", "Dramatic slow motion",
    "Explosion in background", "Romantic rain scene", "Traitor reveal", "Car chase",
    "Funny sidekick joke", "Post-credits scene", "Villain monologuing", "Crying scene",
    "Iconic one-liner", "Training montage", "Betrayal reveal", "Happy ending",
    "Cliffhanger", "Cameo appearance", "Flashback sequence", "Epic soundtrack surge",
    "Disguise fail", "Stunt sequence", "Unexpected ally", "Final showdown"
  ],
  birthday: [
    "Blow out candles", "Make a wish", "Off-key Happy Birthday song", "Cake frosting on face",
    "Unwrapping paper ripped", "Card read aloud", "Surprise reaction", "Sparkler or candles lit",
    "Gift receipt asked", "Party hat worn", "Pin the tail / game", "Thank you speech",
    "Ice cream served", "Balloon pops", "Gift idea match", "Custom cake photo",
    "Group toast", "Memory shared", "Age joke made", "Gifts piled high",
    "Party favor handed", "Hug for host", "First slice cut", "Goodie bag"
  ],
  gamer: [
    "Clutch play", "Lag spike blame", "Rage quit", "GG WP in chat",
    "Rare loot drop", "Team wipe", "Final boss defeated", "Easter egg found",
    "AFK player", "Headshot streak", "Friendly fire accident", "Voice comms chaos",
    "Speedrun glitch", "Inventory full", "Respawn delay", "Epic clutch victory",
    "Health low panic", "Skill check failed", "Trophy unlocked", "Overpowered weapon",
    "Level up ding", "Tactical pause", "Sneak fail", "Leaderboard rank"
  ]
};

const STORAGE_CUSTOM_KEY = 'bingo_master_custom_words';

export class CustomBingoBuilder {
  constructor(options = {}) {
    this.titleInput = options.titleInput;
    this.wordsInput = options.wordsInput;
    this.wordCountLabel = options.wordCountLabel;
    this.playArea = options.playArea;
    this.gridContainer = options.gridContainer;
    this.displayTitle = options.displayTitle;
    this.onVictory = options.onVictory || (() => {});

    this.wordsList = [];
    this.gridState = []; // 25 elements
    this.markedIndices = new Set();
  }

  init() {
    if (this.wordsInput) {
      this.wordsInput.addEventListener('input', () => this.updateWordCount());
    }
    this.loadSavedSet();
  }

  loadSavedSet() {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_KEY);
      if (saved && this.wordsInput) {
        const parsed = JSON.parse(saved);
        if (parsed.title && this.titleInput) this.titleInput.value = parsed.title;
        if (parsed.words) this.wordsInput.value = parsed.words;
        this.updateWordCount();
      }
    } catch (e) {
      console.warn('Could not load custom bingo set', e);
    }
  }

  saveCurrentSet() {
    if (!this.wordsInput) return false;
    try {
      const payload = {
        title: this.titleInput ? this.titleInput.value : 'Custom Bingo',
        words: this.wordsInput.value
      };
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(payload));
      sound.playPop();
      return true;
    } catch (e) {
      console.warn('Could not save custom set', e);
      return false;
    }
  }

  loadPreset(presetKey) {
    if (PRESETS[presetKey] && this.wordsInput) {
      this.wordsInput.value = PRESETS[presetKey].join('\n');
      if (this.titleInput) {
        this.titleInput.value = presetKey.charAt(0).toUpperCase() + presetKey.slice(1) + ' Bingo';
      }
      this.updateWordCount();
      sound.playPop();
    }
  }

  updateWordCount() {
    if (!this.wordsInput || !this.wordCountLabel) return;
    const text = this.wordsInput.value.trim();
    if (!text) {
      this.wordCountLabel.textContent = '0 words added';
      this.wordsList = [];
      return;
    }

    this.wordsList = text.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0);
    this.wordCountLabel.textContent = `${this.wordsList.length} words added (min 24 recommended)`;
  }

  generateCustomCard() {
    this.updateWordCount();
    if (this.wordsList.length < 24) {
      alert('Please enter at least 24 words or phrases to generate a 5x5 Bingo card!');
      return false;
    }

    const title = this.titleInput ? this.titleInput.value || 'Custom Bingo' : 'Custom Bingo';
    if (this.displayTitle) this.displayTitle.textContent = title;

    // Pick 24 random words + 1 FREE space in center
    const shuffled = [...this.wordsList].sort(() => 0.5 - Math.random());
    const selected24 = shuffled.slice(0, 24);

    this.gridState = [];
    let wordIdx = 0;
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        this.gridState.push('★ FREE');
      } else {
        this.gridState.push(selected24[wordIdx++]);
      }
    }

    this.markedIndices.clear();
    this.markedIndices.add(12); // Free space marked
    this.hasWon = false;

    this.renderCustomGrid();
    return true;
  }

  renderCustomGrid() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = '';

    this.gridState.forEach((text, index) => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell custom-cell-word';
      if (index === 12) cell.classList.add('free-space');
      if (this.markedIndices.has(index)) cell.classList.add('marked');

      cell.textContent = text;
      cell.addEventListener('click', () => {
        if (index === 12) return;
        if (this.markedIndices.has(index)) {
          this.markedIndices.delete(index);
          cell.classList.remove('marked');
        } else {
          this.markedIndices.add(index);
          cell.classList.add('marked');
          sound.playDaub();
          sound.triggerHaptic();
        }
        this.checkCustomWin();
      });

      this.gridContainer.appendChild(cell);
    });
  }

  checkCustomWin() {
    if (this.hasWon) return;

    let completedLines = 0;

    // Rows
    for (let r = 0; r < 5; r++) {
      let rFull = true;
      for (let c = 0; c < 5; c++) {
        if (!this.markedIndices.has(r * 5 + c)) rFull = false;
      }
      if (rFull) completedLines++;
    }

    // Cols
    for (let c = 0; c < 5; c++) {
      let cFull = true;
      for (let r = 0; r < 5; r++) {
        if (!this.markedIndices.has(r * 5 + c)) cFull = false;
      }
      if (cFull) completedLines++;
    }

    // Diagonals
    if ([0, 6, 12, 18, 24].every(i => this.markedIndices.has(i))) completedLines++;
    if ([4, 8, 12, 16, 20].every(i => this.markedIndices.has(i))) completedLines++;

    if (completedLines >= 1) {
      this.hasWon = true;
      sound.playVictoryFanfare();
      this.onVictory({
        gameType: 'Custom Word Bingo',
        lines: completedLines
      });
    }
  }
}

