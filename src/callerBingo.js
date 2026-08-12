/* ==========================================================================
   75-BALL BINGO CALLER ENGINE & MULTI-CARD GENERATOR
   ========================================================================== */

import { sound } from './audio.js';
import { multiplayerManager } from './multiplayer.js';

export class Caller75Game {
  constructor(options = {}) {
    this.cardsContainer = options.cardsContainer;
    this.masterGridContainer = options.masterGridContainer;
    this.ballDisplay = options.ballDisplay;
    this.recentBallsContainer = options.recentBallsContainer;
    this.callCountDisplay = options.callCountDisplay;
    this.patternNameDisplay = options.patternNameDisplay;
    this.onVictory = options.onVictory || (() => {});

    this.drawnBalls = [];
    this.drawnSet = new Set();
    
    this.numCards = 1; // 1, 2, or 4
    this.cards = []; // Array of card objects: { id, grid, daubedSet }
    
    this.patternType = 'any-line'; // 'any-line', 'double-line', 'four-corners', 'x-pattern', 'postage-stamp', 'outer-frame', 'full-house'
    this.autoDaub = false;
    this.autoCallTimer = null;
    this.autoCallSpeed = 3500;
    this.activeDauberStyle = 'neon-purple';

    this.initMasterBoard();
  }

  initMasterBoard() {
    if (!this.masterGridContainer) return;
    this.masterGridContainer.innerHTML = '';

    const letters = ['B', 'I', 'N', 'G', 'O'];
    const ranges = [
      { start: 1, end: 15 },
      { start: 16, end: 30 },
      { start: 31, end: 45 },
      { start: 46, end: 60 },
      { start: 61, end: 75 }
    ];

    letters.forEach((l, idx) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'mb-letter-row';

      const label = document.createElement('div');
      label.className = 'mb-letter-label';
      label.textContent = l;
      rowDiv.appendChild(label);

      const numsGroup = document.createElement('div');
      numsGroup.className = 'mb-nums-group';

      for (let i = ranges[idx].start; i <= ranges[idx].end; i++) {
        const div = document.createElement('div');
        div.className = 'mb-cell';
        div.id = `mb-cell-${i}`;
        div.textContent = i;
        numsGroup.appendChild(div);
      }

      rowDiv.appendChild(numsGroup);
      this.masterGridContainer.appendChild(rowDiv);
    });
  }

  startNewGame() {
    this.stopAutoCall();
    this.drawnBalls = [];
    this.drawnSet.clear();

    if (this.callCountDisplay) this.callCountDisplay.textContent = '0/75';
    if (this.ballDisplay) {
      this.ballDisplay.querySelector('.ball-letter').textContent = 'READY';
      this.ballDisplay.querySelector('.ball-number').textContent = '--';
    }
    if (this.recentBallsContainer) {
      this.recentBallsContainer.innerHTML = '<span class="placeholder-text">Draw balls to start</span>';
    }

    // Reset Master Grid
    if (this.masterGridContainer) {
      const cells = this.masterGridContainer.querySelectorAll('.mb-cell');
      cells.forEach(c => c.classList.remove('called'));
    }

    this.generateCards();
  }

  setPattern(patternType) {
    this.patternType = patternType;
    const names = {
      'any-line': 'Any 1 Line',
      'double-line': '2 Lines',
      'four-corners': 'Four Corners',
      'x-pattern': 'X - Pattern',
      'postage-stamp': 'Postage Stamp (2x2)',
      'outer-frame': 'Outer Frame',
      'full-house': 'Blackout'
    };
    if (this.patternNameDisplay) {
      this.patternNameDisplay.textContent = names[patternType] || 'Any Line';
    }
  }

  setCardCount(count) {
    this.numCards = parseInt(count) || 1;
    this.generateCards();
  }

  generateCards() {
    this.cards = [];
    for (let i = 0; i < this.numCards; i++) {
      const grid = this.generateSingleGrid();
      const daubedSet = new Set();
      daubedSet.add('FREE');
      this.cards.push({ id: i + 1, grid, daubedSet });
    }

    this.renderAllCards();
  }

  generateSingleGrid() {
    const getRandomNumbers = (min, max, count) => {
      const nums = [];
      while (nums.length < count) {
        const r = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!nums.includes(r)) nums.push(r);
      }
      return nums;
    };

    const bCol = getRandomNumbers(1, 15, 5);
    const iCol = getRandomNumbers(16, 30, 5);
    const nCol = getRandomNumbers(31, 45, 4);
    const gCol = getRandomNumbers(46, 60, 5);
    const oCol = getRandomNumbers(61, 75, 5);

    return [
      [bCol[0], bCol[1], bCol[2], bCol[3], bCol[4]],
      [iCol[0], iCol[1], iCol[2], iCol[3], iCol[4]],
      [nCol[0], nCol[1], 'FREE', nCol[2], nCol[3]],
      [gCol[0], gCol[1], gCol[2], gCol[3], gCol[4]],
      [oCol[0], oCol[1], oCol[2], oCol[3], oCol[4]]
    ];
  }

  renderAllCards() {
    if (!this.cardsContainer) return;
    this.cardsContainer.innerHTML = '';

    this.cardsContainer.className = `caller-cards-wrapper count-${this.numCards}`;

    this.cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'bingo-75-card glass-card';
      cardEl.dataset.cardId = card.id;

      const headers = ['B', 'I', 'N', 'G', 'O'];
      headers.forEach(h => {
        const hCell = document.createElement('div');
        hCell.className = 'c75-header-cell';
        hCell.textContent = h;
        cardEl.appendChild(hCell);
      });

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const val = card.grid[c][r];
          const cell = document.createElement('div');
          cell.className = 'c75-cell';
          if (val === 'FREE') {
            cell.classList.add('free-space', 'daubed');
            cell.textContent = '★ FREE';
          } else {
            cell.textContent = val;
            if (card.daubedSet.has(val)) {
              cell.classList.add('daubed');
            }
            cell.addEventListener('click', () => this.handleCellDaub(card, val, cell));
          }
          cardEl.appendChild(cell);
        }
      }

      this.cardsContainer.appendChild(cardEl);
    });
  }

  handleCellDaub(card, val, element) {
    if (val === 'FREE') return;

    if (!this.drawnSet.has(val)) {
      sound.playPop();
      return;
    }

    if (card.daubedSet.has(val)) {
      card.daubedSet.delete(val);
      element.classList.remove('daubed');
    } else {
      card.daubedSet.add(val);
      element.classList.add('daubed');
      sound.playDaub();
      sound.triggerHaptic();
    }
  }

  drawBall() {
    if (this.drawnBalls.length >= 75) {
      this.stopAutoCall();
      return;
    }

    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * 75) + 1;
    } while (this.drawnSet.has(nextNum));

    this.drawnSet.add(nextNum);
    this.drawnBalls.push(nextNum);

    let letter = 'B';
    if (nextNum >= 16 && nextNum <= 30) letter = 'I';
    else if (nextNum >= 31 && nextNum <= 45) letter = 'N';
    else if (nextNum >= 46 && nextNum <= 60) letter = 'G';
    else if (nextNum >= 61) letter = 'O';

    sound.playPop();
    sound.speakCall(letter, nextNum);

    if (multiplayerManager.isConnected && multiplayerManager.isHost) {
      multiplayerManager.broadcast({
        type: 'C75_BALL_DRAWN',
        number: nextNum,
        letter
      });
    }

    if (this.ballDisplay) {
      this.ballDisplay.querySelector('.ball-letter').textContent = letter;
      this.ballDisplay.querySelector('.ball-number').textContent = nextNum;
      this.ballDisplay.classList.remove('pop-anim');
      void this.ballDisplay.offsetWidth;
      this.ballDisplay.classList.add('pop-anim');
    }

    if (this.callCountDisplay) {
      this.callCountDisplay.textContent = `${this.drawnBalls.length}/75`;
    }

    this.updateRecentBalls(letter, nextNum);

    const mbCell = document.getElementById(`mb-cell-${nextNum}`);
    if (mbCell) mbCell.classList.add('called');

    // Auto-daub logic
    if (this.autoDaub) {
      this.performAutoDaubScan();
    }
  }

  performAutoDaubScan() {
    this.cards.forEach(card => {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 5; r++) {
          const val = card.grid[c][r];
          if (val !== 'FREE' && this.drawnSet.has(val)) {
            card.daubedSet.add(val);
          }
        }
      }
    });
    this.renderAllCards();
  }

  updateRecentBalls(letter, num) {
    if (!this.recentBallsContainer) return;
    const mini = document.createElement('div');
    mini.className = 'mini-ball';
    mini.textContent = `${letter}${num}`;

    if (this.recentBallsContainer.querySelector('.placeholder-text')) {
      this.recentBallsContainer.innerHTML = '';
    }
    this.recentBallsContainer.prepend(mini);
  }

  toggleAutoCall() {
    if (this.autoCallTimer) {
      this.stopAutoCall();
      return false;
    } else {
      this.drawBall();
      this.autoCallTimer = setInterval(() => {
        if (this.drawnBalls.length >= 75) {
          this.stopAutoCall();
        } else {
          this.drawBall();
        }
      }, this.autoCallSpeed);
      return true;
    }
  }

  stopAutoCall() {
    if (this.autoCallTimer) {
      clearInterval(this.autoCallTimer);
      this.autoCallTimer = null;
    }
  }

  claimBingo() {
    let winningCardId = null;

    for (const card of this.cards) {
      if (this.validateCardPattern(card, this.patternType)) {
        winningCardId = card.id;
        break;
      }
    }

    if (winningCardId !== null) {
      sound.playVictoryFanfare();
      this.stopAutoCall();
      this.onVictory({
        gameType: `75-Ball Bingo (${this.patternType})`,
        callsCount: this.drawnBalls.length,
        winningCard: winningCardId
      });
      return true;
    } else {
      sound.playPop();
      return false;
    }
  }

  validateCardPattern(card, pattern) {
    const grid = card.grid;
    const daubed = card.daubedSet;

    const countLines = () => {
      let lines = 0;
      for (let r = 0; r < 5; r++) {
        let rFull = true;
        for (let c = 0; c < 5; c++) {
          if (!daubed.has(grid[c][r])) rFull = false;
        }
        if (rFull) lines++;
      }
      for (let c = 0; c < 5; c++) {
        let cFull = true;
        for (let r = 0; r < 5; r++) {
          if (!daubed.has(grid[c][r])) cFull = false;
        }
        if (cFull) lines++;
      }
      let d1 = true, d2 = true;
      for (let i = 0; i < 5; i++) {
        if (!daubed.has(grid[i][i])) d1 = false;
        if (!daubed.has(grid[4 - i][i])) d2 = false;
      }
      if (d1) lines++;
      if (d2) lines++;
      return lines;
    };

    if (pattern === 'any-line') {
      return countLines() >= 1;
    }

    if (pattern === 'double-line') {
      return countLines() >= 2;
    }

    if (pattern === 'four-corners') {
      const topL = grid[0][0];
      const topR = grid[4][0];
      const botL = grid[0][4];
      const botR = grid[4][4];
      return daubed.has(topL) && daubed.has(topR) && daubed.has(botL) && daubed.has(botR);
    }

    if (pattern === 'x-pattern') {
      let d1 = true, d2 = true;
      for (let i = 0; i < 5; i++) {
        if (!daubed.has(grid[i][i])) d1 = false;
        if (!daubed.has(grid[4 - i][i])) d2 = false;
      }
      return d1 && d2;
    }

    if (pattern === 'postage-stamp') {
      const s1 = grid[3][0], s2 = grid[4][0], s3 = grid[3][1], s4 = grid[4][1];
      return daubed.has(s1) && daubed.has(s2) && daubed.has(s3) && daubed.has(s4);
    }

    if (pattern === 'outer-frame') {
      for (let i = 0; i < 5; i++) {
        if (!daubed.has(grid[i][0]) || !daubed.has(grid[i][4]) || !daubed.has(grid[0][i]) || !daubed.has(grid[4][i])) {
          return false;
        }
      }
      return true;
    }

    if (pattern === 'full-house') {
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 5; r++) {
          if (!daubed.has(grid[c][r])) return false;
        }
      }
      return true;
    }

    return countLines() >= 1;
  }
}

