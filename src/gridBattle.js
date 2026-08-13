/* ==========================================================================
   5x5 GRID BATTLE GAME ENGINE (1-25 Grid Battle)
   ========================================================================== */

import { sound } from './audio.js';
import { multiplayerManager } from './multiplayer.js';

export class GridBattleGame {
  constructor(options = {}) {
    this.container = options.container;
    this.lettersContainer = options.lettersContainer;
    this.onVictory = options.onVictory || (() => {});
    this.onTurnChange = options.onTurnChange || (() => {});

    this.opponentType = 'ai-medium'; // 'ai-easy', 'ai-medium', 'ai-master', 'pass-play'
    this.currentTurn = 1; // 1 = Player 1, 2 = Player 2 / AI
    this.viewingPlayer = 1; // 1 = View P1 board, 2 = View P2 board (for Pass & Play)
    this.calledNumbers = new Set();

    // Boards state
    this.player1Board = []; // 25 numbers
    this.player2Board = []; // 25 numbers

    this.p1Marked = new Set();
    this.p2Marked = new Set();

    this.p1LinesCount = 0;
    this.p2LinesCount = 0;

    this.isGameOver = false;

    // Manual Fill Mode State
    this.isManualFillMode = false;
    this.nextManualNumber = 1;
    this.isDragging = false;

    // Grid Setup / Shuffle 25s Phase State
    this.isSetupPhase = false;
    this.isGridLockedByPlayer = false;
    this.setupSecondsRemaining = 25;
    this.setupTimerInterval = null;
  }

  init(opponentType = 'ai-medium') {
    if (this.setupTimerInterval) {
      clearInterval(this.setupTimerInterval);
      this.setupTimerInterval = null;
    }

    this.opponentType = opponentType;
    this.currentTurn = 1;
    this.viewingPlayer = (this.opponentType === 'online' && !multiplayerManager.isHost) ? 2 : 1;
    this.calledNumbers.clear();
    this.p1Marked.clear();
    this.p2Marked.clear();
    this.p1LinesCount = 0;
    this.p2LinesCount = 0;
    this.isGameOver = false;
    this.isManualFillMode = false;
    this.isTurnPending = false;
    this.isSetupPhase = false;
    this.isGridLockedByPlayer = false;
    this.nextManualNumber = 1;
    this.powerupUses = { magic: 1, freeze: 1, bomb: 1 };

    const setupBar = document.getElementById('grid-setup-phase-bar');
    if (setupBar) setupBar.classList.add('hidden');

    // Generate random 1-25 boards
    this.player1Board = this.generateShuffledBoard();
    this.player2Board = this.generateShuffledBoard();

    this.renderBoard();
    this.updateBingoBadges(0);
    this.onTurnChange(this.currentTurn, this.opponentType, null, this.viewingPlayer);
  }

  startGridSetupPhase(seconds = 25) {
    if (this.setupTimerInterval) {
      clearInterval(this.setupTimerInterval);
      this.setupTimerInterval = null;
    }

    this.isSetupPhase = true;
    this.isGridLockedByPlayer = false;
    this.setupSecondsRemaining = seconds;

    const setupBar = document.getElementById('grid-setup-phase-bar');
    const timerDisplay = document.getElementById('setup-countdown-timer');
    const btnReady = document.getElementById('btn-setup-ready');

    if (setupBar) setupBar.classList.remove('hidden');
    if (timerDisplay) timerDisplay.textContent = `${this.setupSecondsRemaining}s`;
    if (btnReady) {
      btnReady.innerHTML = '✅ Lock Grid';
      btnReady.disabled = false;
      btnReady.classList.add('pulse-glow');
    }

    this.renderBoard();

    this.setupTimerInterval = setInterval(() => {
      this.setupSecondsRemaining--;
      if (timerDisplay) timerDisplay.textContent = `${this.setupSecondsRemaining}s`;

      if (this.setupSecondsRemaining <= 5 && this.setupSecondsRemaining > 0) {
        sound.playPop();
      }

      if (this.setupSecondsRemaining <= 0) {
        this.finishGridSetupPhase();
      }
    }, 1000);
  }

  lockGridEarly() {
    this.isGridLockedByPlayer = true;
    const btnReady = document.getElementById('btn-setup-ready');
    if (btnReady) {
      btnReady.innerHTML = '🔒 Grid Locked!';
      btnReady.disabled = true;
      btnReady.classList.remove('pulse-glow');
    }
    this.renderBoard();
    sound.playPop();
  }

  finishGridSetupPhase() {
    if (this.setupTimerInterval) {
      clearInterval(this.setupTimerInterval);
      this.setupTimerInterval = null;
    }

    this.isSetupPhase = false;
    this.isManualFillMode = false;

    // Auto-fill any un-filled cells if manual custom fill was in progress
    const activeBoard = this.viewingPlayer === 1 ? this.player1Board : this.player2Board;
    const hasEmpty = activeBoard.some(n => n === null || n === undefined);
    if (hasEmpty) {
      const used = new Set(activeBoard.filter(n => n !== null && n !== undefined));
      const remaining = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !used.has(n));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      let rIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (activeBoard[i] === null || activeBoard[i] === undefined) {
          activeBoard[i] = remaining[rIdx++];
        }
      }
    }

    const setupBar = document.getElementById('grid-setup-phase-bar');
    if (setupBar) setupBar.classList.add('hidden');

    this.renderBoard();
    sound.playLineChime();
    this.onTurnChange(this.currentTurn, this.opponentType, null, this.viewingPlayer);
  }

  startManualFillMode() {
    if (this.calledNumbers.size > 0 || this.isGameOver || this.isGridLockedByPlayer) return;
    this.isManualFillMode = true;
    this.nextManualNumber = 1;
    if (this.viewingPlayer === 1) {
      this.player1Board = new Array(25).fill(null);
    } else {
      this.player2Board = new Array(25).fill(null);
    }
    this.renderBoard();
    sound.playPop();
  }

  fillCellManual(index) {
    if (!this.isManualFillMode || this.nextManualNumber > 25) return;
    const activeBoard = this.viewingPlayer === 1 ? this.player1Board : this.player2Board;
    if (activeBoard[index] !== null) return; // Already filled

    activeBoard[index] = this.nextManualNumber;
    sound.playPop();
    sound.triggerHaptic();

    this.nextManualNumber++;

    if (this.nextManualNumber > 25) {
      this.isManualFillMode = false;
      if (this.opponentType === 'manual-fill') {
        this.opponentType = 'ai-medium';
      }
      this.renderBoard();
      sound.playLineChime();
    } else {
      this.renderBoard();
    }
  }

  generateShuffledBoard() {
    const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }

  shuffleCurrentBoard() {
    if (this.calledNumbers.size > 0 || this.isGameOver || this.isGridLockedByPlayer) return;
    this.isManualFillMode = false;
    if (this.viewingPlayer === 1) {
      this.player1Board = this.generateShuffledBoard();
    } else {
      this.player2Board = this.generateShuffledBoard();
    }
    this.renderBoard();
    sound.playPop();
  }

  toggleViewBoard() {
    this.viewingPlayer = this.viewingPlayer === 1 ? 2 : 1;
    this.renderBoard();
    const currentLines = this.viewingPlayer === 1 ? this.p1LinesCount : this.p2LinesCount;
    this.updateBingoBadges(currentLines);
    sound.playPop();
    return this.viewingPlayer;
  }

  renderBoard() {
    if (!this.container) return;
    this.container.innerHTML = '';

    // Turn Locking UI & Pointer Control
    let isLocked = false;
    if (this.isSetupPhase) {
      isLocked = this.isGridLockedByPlayer;
    } else if (this.opponentType === 'online') {
      const myTurnId = multiplayerManager.isHost ? 1 : 2;
      isLocked = (this.currentTurn !== myTurnId) || this.isTurnPending;
    } else if (this.opponentType.startsWith('ai')) {
      isLocked = (this.currentTurn === 2) || this.isTurnPending;
    }

    if (isLocked && !this.isManualFillMode && !this.isGameOver) {
      this.container.classList.add('board-locked');
    } else {
      this.container.classList.remove('board-locked');
    }

    const activeBoard = this.viewingPlayer === 1 ? this.player1Board : this.player2Board;
    const activeMarked = this.viewingPlayer === 1 ? this.p1Marked : this.p2Marked;
    const completedLines = this.checkCompletedLines(activeBoard, activeMarked);

    const struckIndices = new Set();
    completedLines.forEach(line => {
      line.indices.forEach(idx => struckIndices.add(idx));
    });

    activeBoard.forEach((num, index) => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.index = index;

      if (this.isManualFillMode) {
        cell.classList.add('manual-mode');
        cell.textContent = num !== null ? num : '';
        if (num !== null) cell.classList.add('filled-manual');

        cell.addEventListener('pointerdown', (e) => {
          this.isDragging = true;
          this.fillCellManual(index);
        });

        cell.addEventListener('pointerenter', (e) => {
          if (this.isDragging) {
            this.fillCellManual(index);
          }
        });
      } else {
        cell.dataset.number = num;
        cell.textContent = num;

        if (activeMarked.has(num)) {
          cell.classList.add('marked');
        }

        if (struckIndices.has(index)) {
          cell.classList.add('line-struck');
        }

        cell.addEventListener('click', () => this.handleCellClick(num));
      }

      this.container.appendChild(cell);
    });

    // Mobile touch-slide gesture support for dragging fingers across cells
    if (this.isManualFillMode && !this.touchListenerAttached) {
      this.touchListenerAttached = true;
      
      const handleGlobalPointerUp = () => { this.isDragging = false; };
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('pointercancel', handleGlobalPointerUp);

      this.container.addEventListener('touchmove', (e) => {
        if (!this.isManualFillMode || !this.isDragging) return;
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('grid-cell') && target.dataset.index !== undefined) {
          const idx = parseInt(target.dataset.index, 10);
          this.fillCellManual(idx);
        }
      }, { passive: true });
    }
  }

  handleCellClick(number) {
    if (this.isSetupPhase) return;
    if (this.isGameOver || this.calledNumbers.has(number) || this.isTurnPending) return;

    // Strict Online Multiplayer & AI Turn Validation:
    if (this.opponentType === 'online') {
      const myTurnId = multiplayerManager.isHost ? 1 : 2;
      if (this.currentTurn !== myTurnId) {
        sound.playPop();
        return; // Block click when it's opponent's turn!
      }
    } else if (this.currentTurn === 2 && this.opponentType.startsWith('ai')) {
      return; // Block click on AI turn
    }

    // Immediately lock board to prevent rapid multi-clicks during turn cycle
    this.isTurnPending = true;
    this.renderBoard();

    this.processNumberCall(number, false);
  }

  processNumberCall(number, isRemote = false, nextTurnSocketId = null) {
    this.calledNumbers.add(number);
    this.p1Marked.add(number);
    this.p2Marked.add(number);

    sound.playDaub();
    sound.triggerHaptic();

    if (!isRemote && (this.opponentType === 'online' || multiplayerManager.isConnected)) {
      multiplayerManager.broadcast({
        type: 'GRID_CALL_NUMBER',
        number
      });
    }

    // Check line completions for both players
    const p1Completed = this.checkCompletedLines(this.player1Board, this.p1Marked);
    const p2Completed = this.checkCompletedLines(this.player2Board, this.p2Marked);

    // Audio chime on new line completed for current active turn player
    const activeCompleted = this.currentTurn === 1 ? p1Completed : p2Completed;
    const previousActiveCount = this.currentTurn === 1 ? this.p1LinesCount : this.p2LinesCount;
    if (activeCompleted.length > previousActiveCount) {
      sound.playLineChime();
    }

    this.p1LinesCount = p1Completed.length;
    this.p2LinesCount = p2Completed.length;

    // Check Win condition (5 or more lines)
    if (this.p1LinesCount >= 5 || this.p2LinesCount >= 5) {
      this.isGameOver = true;
      this.isTurnPending = false;
      let winner = 'Player 1';
      if (this.p1LinesCount >= 5 && this.p2LinesCount >= 5) {
        winner = 'Tie Game!';
      } else if (this.p2LinesCount >= 5) {
        winner = this.opponentType.startsWith('ai') ? 'Bingo Bot' : 'Player 2';
      }

      this.renderBoard();
      this.updateBingoBadges(this.viewingPlayer === 1 ? this.p1LinesCount : this.p2LinesCount);
      sound.playVictoryFanfare();

      this.onVictory({
        winner,
        gameType: '5x5 Grid Battle',
        p1Lines: this.p1LinesCount,
        p2Lines: this.p2LinesCount,
        totalCalls: this.calledNumbers.size,
        opponentType: this.opponentType
      });
      return;
    }

    // Cycle turns and unlock pending state
    if (this.opponentType === 'online') {
      if (nextTurnSocketId && multiplayerManager.socket) {
        const isMyNextTurn = (multiplayerManager.socket.id === nextTurnSocketId);
        const myTurnId = multiplayerManager.isHost ? 1 : 2;
        this.currentTurn = isMyNextTurn ? myTurnId : (myTurnId === 1 ? 2 : 1);
      } else {
        this.currentTurn = this.currentTurn === 1 ? 2 : 1;
      }
      this.isTurnPending = false;
      this.viewingPlayer = multiplayerManager.isHost ? 1 : 2;
      this.renderBoard();
      this.updateBingoBadges(this.viewingPlayer === 1 ? this.p1LinesCount : this.p2LinesCount);
    } else if (this.opponentType === 'pass-play') {
      this.currentTurn = this.currentTurn === 1 ? 2 : 1;
      this.isTurnPending = false;
      this.viewingPlayer = this.currentTurn;
      this.renderBoard();
      this.updateBingoBadges(this.currentTurn === 1 ? this.p1LinesCount : this.p2LinesCount);
    } else {
      this.currentTurn = this.currentTurn === 1 ? 2 : 1;
      this.isTurnPending = false;
      this.renderBoard();
      this.updateBingoBadges(this.viewingPlayer === 1 ? this.p1LinesCount : this.p2LinesCount);
    }

    this.onTurnChange(this.currentTurn, this.opponentType, number, this.viewingPlayer);

    // If AI turn, trigger AI move after brief delay
    if (this.currentTurn === 2 && this.opponentType.startsWith('ai')) {
      if (this.isFrozen) {
        this.isFrozen = false;
        this.currentTurn = 1;
        this.onTurnChange(1, this.opponentType, null, this.viewingPlayer);
        return;
      }
      const delay = this.opponentType === 'ai-easy' ? 1000 : 700;
      setTimeout(() => this.triggerAiMove(), delay);
    }
  }

  useMagicPowerup() {
    if (this.isGameOver || this.currentTurn !== 1 || this.powerupUses.magic <= 0) return false;
    const uncalled = [];
    for (let i = 1; i <= 25; i++) {
      if (!this.calledNumbers.has(i)) uncalled.push(i);
    }
    if (uncalled.length === 0) return false;

    let bestNum = uncalled[0];
    let maxLines = -1;
    uncalled.forEach(num => {
      const testSet = new Set(this.p1Marked);
      testSet.add(num);
      const count = this.checkCompletedLines(this.player1Board, testSet).length;
      if (count > maxLines) {
        maxLines = count;
        bestNum = num;
      }
    });

    this.powerupUses.magic--;
    this.processNumberCall(bestNum);
    return bestNum;
  }

  useFreezePowerup() {
    if (this.isGameOver || this.powerupUses.freeze <= 0) return false;
    this.powerupUses.freeze--;
    this.isFrozen = true;
    sound.playPop();
    return true;
  }

  useCenterBombPowerup() {
    if (this.isGameOver || this.currentTurn !== 1 || this.powerupUses.bomb <= 0) return false;
    const centerNum = this.player1Board[12]; // Center cell
    if (!this.calledNumbers.has(centerNum)) {
      this.powerupUses.bomb--;
      this.processNumberCall(centerNum);
      return centerNum;
    }
    return false;
  }

  checkCompletedLines(board, markedSet) {
    const completedLines = [];

    // Rows (0..4)
    for (let r = 0; r < 5; r++) {
      let fullRow = true;
      const indices = [];
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        indices.push(idx);
        if (!markedSet.has(board[idx])) fullRow = false;
      }
      if (fullRow) completedLines.push({ type: 'row', index: r, indices });
    }

    // Columns (0..4)
    for (let c = 0; c < 5; c++) {
      let fullCol = true;
      const indices = [];
      for (let r = 0; r < 5; r++) {
        const idx = r * 5 + c;
        indices.push(idx);
        if (!markedSet.has(board[idx])) fullCol = false;
      }
      if (fullCol) completedLines.push({ type: 'col', index: c, indices });
    }

    // Diagonal 1 (Top-Left to Bottom-Right)
    let diag1Full = true;
    const diag1Indices = [0, 6, 12, 18, 24];
    diag1Indices.forEach(idx => {
      if (!markedSet.has(board[idx])) diag1Full = false;
    });
    if (diag1Full) completedLines.push({ type: 'diag', index: 1, indices: diag1Indices });

    // Diagonal 2 (Top-Right to Bottom-Left)
    let diag2Full = true;
    const diag2Indices = [4, 8, 12, 16, 20];
    diag2Indices.forEach(idx => {
      if (!markedSet.has(board[idx])) diag2Full = false;
    });
    if (diag2Full) completedLines.push({ type: 'diag', index: 2, indices: diag2Indices });

    return completedLines;
  }

  updateBingoBadges(linesCount) {
    if (!this.lettersContainer) return;
    const badges = this.lettersContainer.querySelectorAll('.bingo-letter-badge');

    badges.forEach((badge, idx) => {
      if (idx < Math.min(linesCount, 5)) {
        badge.classList.add('unlocked');
      } else {
        badge.classList.remove('unlocked');
      }

      if (linesCount >= 5) {
        badge.classList.add('bingo-flash-celebrate');
      } else {
        badge.classList.remove('bingo-flash-celebrate');
      }
    });
  }

  triggerAiMove() {
    if (this.isGameOver) return;

    const uncalled = [];
    for (let i = 1; i <= 25; i++) {
      if (!this.calledNumbers.has(i)) uncalled.push(i);
    }

    if (uncalled.length === 0) return;

    let chosenNum = uncalled[Math.floor(Math.random() * uncalled.length)];

    if (this.opponentType === 'ai-medium' || this.opponentType === 'ai-master') {
      // Find best number that completes lines for AI
      let bestScore = -1;
      uncalled.forEach(num => {
        let score = 0;
        const testSet = new Set(this.p2Marked);
        testSet.add(num);
        const lines = this.checkCompletedLines(this.player2Board, testSet);
        score += lines.length * 10;

        // If master, also evaluate blocking player
        if (this.opponentType === 'ai-master') {
          const p1Test = new Set(this.p1Marked);
          p1Test.add(num);
          const p1Lines = this.checkCompletedLines(this.player1Board, p1Test);
          score += p1Lines.length * 8;
        }

        if (score > bestScore) {
          bestScore = score;
          chosenNum = num;
        }
      });
    }

    this.processNumberCall(chosenNum);
  }
}

