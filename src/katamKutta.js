/* ==========================================================================
   KATAM-KUTTA (MODERN DISAPPEARING TIC TAC TOE) GAME ENGINE
   ========================================================================== */

import { sound } from './audio.js';

export class KatamKuttaGame {
  constructor(authManager, multiplayerManager) {
    this.auth = authManager;
    this.mp = multiplayerManager;

    // Configurable Settings
    this.MAX_ACTIVE_PIECES = 3;
    this.boardSize = 3; // 3x3

    // State
    this.board = Array(9).fill(null); // indices 0..8
    this.moveHistory = []; // array of { index, symbol, playerId, moveNumber }
    this.moveCounter = 0;
    this.currentTurnSymbol = 'X'; // 'X' or 'O'
    this.symbols = { p1: 'X', p2: 'O' };
    this.playerNames = { X: 'Player 1', O: 'Player 2' };
    this.isGameOver = false;
    this.gameMode = 'bot'; // 'bot' or 'human'
    this.botDifficulty = 'medium'; // 'easy', 'medium', 'hard'
    this.isBotThinking = false;
    this.disappearingIndex = null;
    this.roundId = 'round_1';

    // Winning Combinations for 3x3
    this.winningLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontal
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Vertical
      [0, 4, 8], [2, 4, 6]             // Diagonal
    ];

    this.onStateChangeCallback = null;
    this.onVictoryCallback = null;
  }

  init(options = {}) {
    this.gameMode = options.gameMode || 'bot';
    this.botDifficulty = options.botDifficulty || 'medium';
    this.roundId = options.roundId || 'round_1';
    this.playerNames = {
      X: options.p1Name || 'Player 1',
      O: options.p2Name || (this.gameMode === 'bot' ? 'Bingo Bot 🤖' : 'Player 2')
    };

    this.resetBoard();
  }

  resetBoard() {
    this.board = Array(9).fill(null);
    this.moveHistory = [];
    this.moveCounter = 0;
    this.currentTurnSymbol = 'X';
    this.isGameOver = false;
    this.isBotThinking = false;
    this.disappearingIndex = null;

    this.notifyStateChange();
  }

  // Get active pieces for a specific symbol ('X' or 'O')
  getActiveMovesFor(symbol) {
    return this.moveHistory.filter(m => m.symbol === symbol && this.board[m.index] === symbol);
  }

  // Get the index of the oldest active piece for a symbol (which will vanish next)
  getOldestPieceIndex(symbol) {
    const active = this.getActiveMovesFor(symbol);
    if (active.length >= this.MAX_ACTIVE_PIECES) {
      return active[0].index;
    }
    return null;
  }

  // Handle a move attempt at cellIndex (0..8)
  makeMove(index, playerSymbol) {
    if (this.isGameOver || this.isBotThinking) return false;
    if (index < 0 || index > 8) return false;
    if (this.board[index] !== null) return false; // Cell occupied
    if (playerSymbol !== this.currentTurnSymbol) return false; // Wrong turn

    this.moveCounter++;
    let removedIndex = null;

    // Check if player already has MAX_ACTIVE_PIECES on board
    const activeMoves = this.getActiveMovesFor(playerSymbol);
    if (activeMoves.length >= this.MAX_ACTIVE_PIECES) {
      // Oldest piece must disappear!
      const oldestMove = activeMoves[0];
      removedIndex = oldestMove.index;
      this.disappearingIndex = removedIndex;
      this.board[removedIndex] = null;
    }

    // Place new piece
    this.board[index] = playerSymbol;
    const newMove = {
      index,
      symbol: playerSymbol,
      playerName: this.playerNames[playerSymbol],
      moveNumber: this.moveCounter
    };
    this.moveHistory.push(newMove);

    // Play sound
    sound.playPop();

    // Evaluate Win Condition strictly on active board state
    const winResult = this.checkWinCondition(playerSymbol);

    if (winResult) {
      this.isGameOver = true;
      this.notifyStateChange({ lastMoveIndex: index, removedIndex, winResult });
      if (this.onVictoryCallback) {
        this.onVictoryCallback({
          winnerSymbol: playerSymbol,
          winnerName: this.playerNames[playerSymbol],
          loserName: this.playerNames[playerSymbol === 'X' ? 'O' : 'X'],
          winningLine: winResult.line
        });
      }
      return true;
    }

    // Switch turn
    this.currentTurnSymbol = this.currentTurnSymbol === 'X' ? 'O' : 'X';
    this.notifyStateChange({ lastMoveIndex: index, removedIndex });

    // Trigger Bot Move if in Bot Mode and it's Bot's turn ('O')
    if (this.gameMode === 'bot' && this.currentTurnSymbol === 'O' && !this.isGameOver) {
      this.triggerBotMove();
    }

    return true;
  }

  // Check 8 winning combinations on active board state
  checkWinCondition(symbol) {
    for (const line of this.winningLines) {
      const [a, b, c] = line;
      if (this.board[a] === symbol && this.board[b] === symbol && this.board[c] === symbol) {
        return { winner: symbol, line };
      }
    }
    return null;
  }

  // AI Bot Turn Execution
  triggerBotMove() {
    this.isBotThinking = true;
    this.notifyStateChange();

    const delay = Math.floor(600 + Math.random() * 400); // 600ms - 1000ms delay

    setTimeout(() => {
      if (this.isGameOver) {
        this.isBotThinking = false;
        return;
      }

      const bestIndex = this.getBotBestMove();
      this.isBotThinking = false;

      if (bestIndex !== null && bestIndex !== undefined) {
        this.makeMove(bestIndex, 'O');
      }
    }, delay);
  }

  // Bot Strategy Algorithm supporting Easy, Medium, Hard
  getBotBestMove() {
    const emptyIndices = this.board
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

    if (emptyIndices.length === 0) return null;

    // EASY DIFFICULTY: Mostly random
    if (this.botDifficulty === 'easy') {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // Check if Bot ('O') can WIN in this move
    for (const idx of emptyIndices) {
      if (this.simulateMoveAndCheckWin(idx, 'O')) {
        return idx;
      }
    }

    // Check if Bot ('O') needs to BLOCK Human ('X') from winning on next turn
    for (const idx of emptyIndices) {
      if (this.simulateMoveAndCheckWin(idx, 'X')) {
        return idx;
      }
    }

    // HARD DIFFICULTY: Lookahead taking into account oldest piece disappearing!
    if (this.botDifficulty === 'hard') {
      // Prefer center cell if open
      if (emptyIndices.includes(4)) return 4;

      // Prefer corners
      const corners = [0, 2, 6, 8].filter(i => emptyIndices.includes(i));
      if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
      }
    }

    // MEDIUM DIFFICULTY: Take center or random empty cell
    if (emptyIndices.includes(4)) return 4;
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // Simulate a move and return true if it results in 3-in-a-row
  simulateMoveAndCheckWin(index, symbol) {
    // Clone current board & active moves
    const tempBoard = [...this.board];
    const active = this.moveHistory.filter(m => m.symbol === symbol && tempBoard[m.index] === symbol);

    if (active.length >= this.MAX_ACTIVE_PIECES) {
      const oldest = active[0];
      tempBoard[oldest.index] = null;
    }

    tempBoard[index] = symbol;

    // Check win on tempBoard
    for (const line of this.winningLines) {
      const [a, b, c] = line;
      if (tempBoard[a] === symbol && tempBoard[b] === symbol && tempBoard[c] === symbol) {
        return true;
      }
    }
    return false;
  }

  resetForNewRound(newRoundId) {
    this.roundId = newRoundId || 'round_1';
    this.resetBoard();
  }

  // Authoritative server result application for real-time multiplayer
  applyServerMovePayload(payload) {
    if (!payload) return;
    if (payload.roundId && payload.roundId !== this.roundId) return;

    this.board = payload.board ? [...payload.board] : this.board;
    this.disappearingIndex = payload.removedMove ? payload.removedMove.cell : null;
    this.isGameOver = !!payload.winner;
    this.currentTurnSymbol = payload.turn === 'player1' ? 'X' : 'O';

    if (payload.winner) {
      this.isGameOver = true;
      if (this.onVictoryCallback) {
        this.onVictoryCallback({
          winnerSymbol: payload.turn === 'player1' ? 'X' : 'O',
          winnerName: payload.winner,
          loserName: payload.winner === this.playerNames.X ? this.playerNames.O : this.playerNames.X,
          winningLine: payload.winningCells
        });
      }
    }

    sound.playPop();

    const p1Active = payload.activeMoves?.player1 || [];
    const p2Active = payload.activeMoves?.player2 || [];

    const oldestX = p1Active.length >= this.MAX_ACTIVE_PIECES ? p1Active[0].cell : null;
    const oldestO = p2Active.length >= this.MAX_ACTIVE_PIECES ? p2Active[0].cell : null;

    this.notifyStateChange({
      lastMoveIndex: payload.addedMove ? payload.addedMove.cell : null,
      removedIndex: this.disappearingIndex,
      oldestXIndex: oldestX,
      oldestOIndex: oldestO,
      activeXCount: p1Active.length,
      activeOCount: p2Active.length,
      winResult: payload.winner ? { winner: payload.winner, line: payload.winningCells } : null
    });
  }

  notifyStateChange(extraData = {}) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        board: [...this.board],
        currentTurnSymbol: this.currentTurnSymbol,
        playerNames: { ...this.playerNames },
        isGameOver: this.isGameOver,
        isBotThinking: this.isBotThinking,
        oldestXIndex: this.getOldestPieceIndex('X'),
        oldestOIndex: this.getOldestPieceIndex('O'),
        activeXCount: this.getActiveMovesFor('X').length,
        activeOCount: this.getActiveMovesFor('O').length,
        ...extraData
      });
    }
  }
}

