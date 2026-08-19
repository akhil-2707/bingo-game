import confetti from 'canvas-confetti';
import { createIcons, icons } from 'lucide';
import { sound } from './audio.js';
import { GridBattleGame } from './gridBattle.js';
import { Caller75Game } from './callerBingo.js';
import { CustomBingoBuilder } from './customBingo.js';
import { statsManager } from './stats.js';
import { multiplayerManager } from './multiplayer.js';
import { authManager } from './auth.js';
import { FriendsManager } from './friends.js';
import { KatamKuttaGame } from './katamKutta.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  createIcons({ icons });

  // Initialize Auth UI & Socket integration
  authManager.initUI(statsManager);
  if (multiplayerManager.socket) {
    authManager.setSocket(multiplayerManager.socket);
  }

  // Initialize Friends System & Game Invites
  const friendsManager = new FriendsManager(authManager, multiplayerManager);
  friendsManager.init();

  // Initialize Katam Kutta Game Engine
  const kkGame = new KatamKuttaGame(authManager, multiplayerManager);

  // ==========================================
  // CINEMATIC GAME INTRO ANIMATION CONTROLLER
  // ==========================================
  // Nickname Setup Modal Elements
  const modalNicknameSetup = document.getElementById('modal-nickname-setup');
  const startupPlayerName = document.getElementById('startup-player-name');
  const nameStatusIndicator = document.getElementById('name-status-indicator');
  const nameErrorMsg = document.getElementById('name-error-msg');
  const btnSaveNickname = document.getElementById('btn-save-nickname');
  const playerNickname = document.getElementById('player-nickname');

  const openNicknameModal = () => {
    let savedName = localStorage.getItem('bingo_player_nickname');
    if (!savedName && authManager.isLoggedIn()) {
      savedName = authManager.currentUser.username;
      localStorage.setItem('bingo_player_nickname', savedName);
    }

    if (savedName) {
      if (playerNickname) playerNickname.value = savedName;
      if (startupPlayerName) startupPlayerName.value = savedName;
      multiplayerManager.myPlayerName = savedName;
      if (modalNicknameSetup) modalNicknameSetup.classList.add('hidden');
      return;
    }

    if (modalNicknameSetup && (!savedName || modalNicknameSetup.dataset.forceOpen)) {
      modalNicknameSetup.classList.remove('hidden');
    }
  };

  // Open Game Instantly
  openNicknameModal();

  if (startupPlayerName) {
    let checkTimeout = null;
    startupPlayerName.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (checkTimeout) clearTimeout(checkTimeout);

      if (!val || val.length < 2) {
        if (nameStatusIndicator) nameStatusIndicator.textContent = '';
        if (nameErrorMsg) nameErrorMsg.classList.add('hidden');
        startupPlayerName.classList.remove('error', 'valid');
        if (btnSaveNickname) btnSaveNickname.disabled = true;
        return;
      }

      checkTimeout = setTimeout(() => {
        multiplayerManager.checkNickname(val, (res) => {
          if (res.available) {
            if (nameStatusIndicator) {
              nameStatusIndicator.textContent = '✓';
              nameStatusIndicator.style.color = 'var(--ios-mint)';
            }
            if (nameErrorMsg) nameErrorMsg.classList.add('hidden');
            startupPlayerName.classList.remove('error');
            startupPlayerName.classList.add('valid');
            if (btnSaveNickname) btnSaveNickname.disabled = false;
          } else {
            if (nameStatusIndicator) {
              nameStatusIndicator.textContent = '❌';
              nameStatusIndicator.style.color = 'var(--ios-pink)';
            }
            if (nameErrorMsg) {
              nameErrorMsg.textContent = `⚠️ Name not available! Please choose another nickname.`;
              nameErrorMsg.classList.remove('hidden');
            }
            startupPlayerName.classList.remove('valid');
            startupPlayerName.classList.add('error');
            if (btnSaveNickname) btnSaveNickname.disabled = true;
          }
        });
      }, 300);
    });
  }

  if (btnSaveNickname) {
    btnSaveNickname.addEventListener('click', () => {
      const val = startupPlayerName ? startupPlayerName.value.trim() : '';
      if (!val || val.length < 2) {
        showToast('Please enter a valid nickname (min 2 characters)!');
        return;
      }

      multiplayerManager.checkNickname(val, (res) => {
        if (res.available) {
          localStorage.setItem('bingo_player_nickname', val);
          if (playerNickname) playerNickname.value = val;
          multiplayerManager.myPlayerName = val;
          if (modalNicknameSetup) modalNicknameSetup.classList.add('hidden');
          showToast(`🎉 Welcome ${val}! Entered Bingo Master!`, 3000);
          sound.playLineChime();
        } else {
          if (nameErrorMsg) {
            nameErrorMsg.textContent = `⚠️ Name not available! Please choose another nickname.`;
            nameErrorMsg.classList.remove('hidden');
          }
          if (startupPlayerName) startupPlayerName.classList.add('error');
          sound.playPop();
        }
      });
    });
  }

  // DOM Elements
  const appRoot = document.getElementById('app-root');
  const btnOnlineRoom = document.getElementById('btn-online-room');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const iconSound = document.getElementById('icon-sound');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnStats = document.getElementById('btn-stats');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const viewPanels = document.querySelectorAll('.view-panel');

  // Modals
  const modalVictory = document.getElementById('modal-victory');
  const victoryTitle = document.getElementById('victory-title');
  const victoryDesc = document.getElementById('victory-desc');
  const victoryStats = document.getElementById('victory-stats');
  const btnVictoryReplay = document.getElementById('btn-victory-replay');

  const modalStats = document.getElementById('modal-stats');
  const btnCloseStats = document.getElementById('btn-close-stats');
  const statsContainerBody = document.getElementById('stats-container-body');

  // Toast
  const appToast = document.getElementById('app-toast');
  const toastMessage = document.getElementById('toast-message');

  const showToast = (msg, duration = 2500) => {
    if (!appToast || !toastMessage) return;
    toastMessage.textContent = msg;
    appToast.classList.remove('hidden');
    setTimeout(() => {
      appToast.classList.add('hidden');
    }, duration);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.log('Confetti triggered', e);
    }
  };

  let lastVictoryGameType = '5x5 Battle';

  const showVictoryModal = ({ winner = 'Player 1', gameType = '5x5 Battle', p1Lines, p2Lines, totalCalls, opponentType = '', isLossForMe = false }) => {
    lastVictoryGameType = gameType;
    const victoryIcon = document.getElementById('victory-icon');

    if (btnVictoryReplay) {
      btnVictoryReplay.disabled = false;
      btnVictoryReplay.innerHTML = '<i data-lucide="rotate-ccw"></i> Play Again';
      createIcons({ icons });
    }

    if (isLossForMe) {
      sound.playPop();
      if (victoryIcon) victoryIcon.textContent = '😔';
      if (victoryTitle) {
        victoryTitle.textContent = `😔 ${winner} Won!`;
        victoryTitle.style.color = 'var(--ios-pink)';
      }
      if (victoryDesc) {
        victoryDesc.textContent = `${winner} has completed Bingo.`;
      }
    } else if (winner === 'Tie Game!') {
      sound.playPop();
      if (victoryIcon) victoryIcon.textContent = '🤝';
      if (victoryTitle) {
        victoryTitle.textContent = '🤝 TIE GAME!';
        victoryTitle.style.color = 'var(--ios-amber)';
      }
      if (victoryDesc) {
        victoryDesc.textContent = 'Both players completed 5 lines at the same time!';
      }
    } else {
      triggerConfetti();
      sound.playVictoryFanfare();
      if (victoryIcon) victoryIcon.textContent = '🎉';
      if (victoryTitle) {
        victoryTitle.textContent = winner.includes('Bot') ? '🤖 BOT WINS!' : `🎉 BINGO!\n${winner}, You Won!`;
        victoryTitle.style.color = 'var(--ios-mint)';
      }
      if (victoryDesc) {
        victoryDesc.textContent = `Congratulations! You completed 5 lines first and won the match!`;
      }
    }

    if (victoryStats) {
      const isHost = multiplayerManager.isConnected ? multiplayerManager.isHost : true;
      const myLineCount = (p1Lines !== undefined && p2Lines !== undefined) ? (isHost ? p1Lines : p2Lines) : p1Lines;
      const oppLineCount = (p1Lines !== undefined && p2Lines !== undefined) ? (isHost ? p2Lines : p1Lines) : p2Lines;

      victoryStats.innerHTML = `
        <div class="stat-row"><strong>Game Mode:</strong> ${gameType}</div>
        ${myLineCount !== undefined ? `<div class="stat-row"><strong>Your Lines:</strong> ${myLineCount} / 5</div>` : ''}
        ${oppLineCount !== undefined ? `<div class="stat-row"><strong>Opponent Lines:</strong> ${oppLineCount} / 5</div>` : ''}
        ${totalCalls ? `<div class="stat-row"><strong>Total Numbers Called:</strong> ${totalCalls}</div>` : ''}
      `;
    }

    // Track Stats & Trophy Rewards
    const isWin = !isLossForMe && winner !== 'Tie Game!' && !winner.includes('Bot') && winner !== 'Player 2';
    const isBotMatch = opponentType && opponentType.includes('ai');
    const isMultiplayer = multiplayerManager.isConnected || opponentType === 'multiplayer' || opponentType === 'online';

    if (authManager.isLoggedIn()) {
      if (isMultiplayer) {
        if (isWin) {
          authManager.updateTrophies(5, 'multiplayer_win');
        } else if (isLossForMe) {
          authManager.updateTrophies(-5, 'multiplayer_loss');
        }
      } else if (isBotMatch && isWin) {
        authManager.updateTrophies(1, 'bot_win');
      } else if (isWin) {
        authManager.updateTrophies(1, 'game_win');
      }
    }

    const newlyUnlocked = statsManager.recordGameEnd({
      gameType,
      isWin,
      lines: multiplayerManager.isHost ? (p1Lines || 1) : (p2Lines || 1),
      opponentType
    });

    if (newlyUnlocked && newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(ach => {
        setTimeout(() => {
          showToast(`🏆 Achievement Unlocked: ${ach.title}!`, 3500);
        }, 800);
      });
    }

    if (modalVictory) modalVictory.classList.remove('hidden');
  };

  if (btnVictoryReplay) {
    btnVictoryReplay.addEventListener('click', () => {
      if (multiplayerManager.isConnected) {
        multiplayerManager.requestRematch();
        btnVictoryReplay.disabled = true;
        btnVictoryReplay.innerHTML = '<span class="pulse-icon">⏳</span> Waiting for Opponent...';
        showToast('🔄 Rematch requested! Waiting for opponent to accept...', 3500);
        return;
      }
      if (modalVictory) modalVictory.classList.add('hidden');
      if (lastVictoryGameType.includes('Housie') || lastVictoryGameType.includes('90')) {
        if (btnH90Restart) btnH90Restart.click();
      } else if (lastVictoryGameType.includes('Custom')) {
        customBuilder.generateCustomCard();
      } else if (lastVictoryGameType.includes('75-Ball')) {
        caller75.startNewGame();
      } else {
        gridGame.init(selectOpponent ? selectOpponent.value : 'ai-medium');
      }
    });
  }

  const btnVictoryClose = document.getElementById('btn-victory-close');
  const btnVictoryViewBoard = document.getElementById('btn-victory-view-board');

  if (btnVictoryClose) {
    btnVictoryClose.addEventListener('click', () => {
      if (modalVictory) modalVictory.classList.add('hidden');
    });
  }

  if (btnVictoryViewBoard) {
    btnVictoryViewBoard.addEventListener('click', () => {
      if (modalVictory) modalVictory.classList.add('hidden');
    });
  }

  if (modalVictory) {
    modalVictory.addEventListener('click', (e) => {
      if (e.target === modalVictory) {
        modalVictory.classList.add('hidden');
      }
    });
  }

  // Header Actions
  btnSoundToggle.addEventListener('click', () => {
    sound.soundEnabled = !sound.soundEnabled;
    sound.speechEnabled = sound.soundEnabled;
    showToast(sound.soundEnabled ? '🔊 Sound & Voice Enabled' : '🔇 Muted');
    btnSoundToggle.style.opacity = sound.soundEnabled ? '1' : '0.5';
  });

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      appRoot.classList.toggle('mobile-shell');
      showToast(appRoot.classList.contains('mobile-shell') ? '📱 Mobile Frame On' : '🖥️ Full Screen Mode');
    });
  }

  if (btnStats) {
    btnStats.addEventListener('click', () => {
      statsManager.renderStatsModal(statsContainerBody);
      if (modalStats) modalStats.classList.remove('hidden');
    });
  }

  if (btnCloseStats) {
    btnCloseStats.addEventListener('click', () => {
      if (modalStats) modalStats.classList.add('hidden');
    });
  }

  const switchTab = (targetTab) => {
    tabButtons.forEach(b => b.classList.remove('active'));
    viewPanels.forEach(p => p.classList.remove('active'));

    const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    const activePanel = document.getElementById(`view-${targetTab}`);
    if (activePanel) activePanel.classList.add('active');

    if (targetTab === 'katam-kutta') {
      if (!multiplayerManager.isConnected) {
        const p1 = authManager.isLoggedIn() ? (authManager.currentUser.displayName || authManager.currentUser.username) : 'Player 1';
        kkGame.init({
          gameMode: 'bot',
          botDifficulty: kkGame.botDifficulty || 'medium',
          p1Name: p1,
          p2Name: 'Bingo Bot 🤖'
        });
      }
    }
  };

  if (btnOnlineRoom) {
    btnOnlineRoom.addEventListener('click', () => {
      sound.playPop();
      switchTab('online-room');
    });
  }

  // Navigation Tabs Switcher (Only Home button returns to Main Hub; modes are entered strictly via Hub 3D cards)
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playPop();
      if (btn.dataset.tab === 'main-hub') {
        switchTab('main-hub');
      } else {
        showToast('👉 Please tap a 3D Mode Card on the Home Hub to enter!');
      }
    });
  });

  // Main Hub Mode Cards Launchers & Bot Level Selector Modal
  const modalSelectBotLevel = document.getElementById('modal-select-bot-level');
  const btnCloseBotSelect = document.getElementById('btn-close-bot-select');
  const btnBotManualFill = document.getElementById('btn-bot-manual-fill');
  const botLevelCards = document.querySelectorAll('.btn-bot-level');

  if (btnCloseBotSelect && modalSelectBotLevel) {
    btnCloseBotSelect.addEventListener('click', () => modalSelectBotLevel.classList.add('hidden'));
  }

  if (btnBotManualFill && modalSelectBotLevel) {
    btnBotManualFill.addEventListener('click', () => {
      modalSelectBotLevel.classList.add('hidden');
      switchTab('grid-battle');
      gridGame.startManualFillMode();
      showToast('✍️ Custom Manual Fill: Tap or slide across cells to fill 1-25!');
    });
  }

  botLevelCards.forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level || 'ai-medium';
      if (modalSelectBotLevel) modalSelectBotLevel.classList.add('hidden');
      
      selectOpponent.value = level;
      gridGame.init(level);
      switchTab('grid-battle');
      sound.playPop();

      const levelNames = { 'ai-easy': 'Easy Bot 🌱', 'ai-medium': 'Medium Bot ⚡', 'ai-hard': 'Hard Bot 🔥' };
      showToast(`🚀 Match Started vs ${levelNames[level] || 'Bot'}!`);
    });
  });

  const hubModeCards = document.querySelectorAll('.hub-mode-card');
  hubModeCards.forEach(card => {
    card.addEventListener('click', () => {
      sound.playPop();
      const target = card.dataset.launchTab;
      if (target === 'grid-battle') {
        if (modalSelectBotLevel) modalSelectBotLevel.classList.remove('hidden');
      } else if (target) {
        switchTab(target);
      }
    });
  });

  // Exit Game / Back to Hub Buttons Handler
  const btnBackHubs = document.querySelectorAll('.btn-back-hub');
  btnBackHubs.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playPop();
      switchTab('main-hub');
    });
  });


  // ==========================================
  // 1. INITIALIZE 5x5 GRID BATTLE
  // ==========================================
  const battleGridContainer = document.getElementById('battle-grid');
  const lettersContainer = document.querySelector('.bingo-letters-container');
  const selectOpponent = document.getElementById('select-opponent');
  const btnShuffleGrid = document.getElementById('btn-shuffle-grid');
  const btnResetBattle = document.getElementById('btn-reset-battle');
  const btnSwitchBoard = document.getElementById('btn-switch-board');
  const p1Status = document.getElementById('p1-status');
  const oppStatus = document.getElementById('opp-status');
  const oppName = document.getElementById('opp-name');
  const oppAvatar = document.getElementById('opp-avatar');
  const lastCalledNum = document.getElementById('last-called-num');

  const updateBattleHudNames = () => {
    const p1NameEl = document.querySelector('#hud-player .name');
    if (multiplayerManager.isConnected && multiplayerManager.players.length > 0) {
      const hostP = multiplayerManager.players.find(p => p.isHost);
      const guestP = multiplayerManager.players.find(p => !p.isHost);

      const hostName = hostP ? hostP.name : 'Player 1';
      const guestName = guestP ? guestP.name : (multiplayerManager.players.length >= 2 ? 'Player 2' : 'Waiting...');

      if (p1NameEl) p1NameEl.textContent = hostName;
      if (oppName) oppName.textContent = guestName;
      if (oppAvatar) oppAvatar.textContent = '👥';
    } else {
      if (p1NameEl) p1NameEl.textContent = multiplayerManager.myPlayerName || 'Player 1';
      if (selectOpponent && selectOpponent.value === 'pass-play') {
        if (oppName) oppName.textContent = 'Player 2';
        if (oppAvatar) oppAvatar.textContent = '👥';
      } else {
        if (oppName) oppName.textContent = 'Bingo Bot';
        if (oppAvatar) oppAvatar.textContent = '🤖';
      }
    }
  };

  const gridGame = new GridBattleGame({
    container: battleGridContainer,
    lettersContainer: lettersContainer,
    onTurnChange: (turn, oppType, lastCalled, viewingPlayer) => {
      if (lastCalledNum && lastCalled) {
        lastCalledNum.textContent = lastCalled;
      }
      updateBattleHudNames();
      
      const hostP = multiplayerManager.players.find(p => p.isHost);
      const guestP = multiplayerManager.players.find(p => !p.isHost);
      const hostName = hostP ? hostP.name : 'Player 1';
      const guestName = guestP ? guestP.name : 'Player 2';

      if (oppType === 'online') {
        const isMyTurn = (multiplayerManager.isHost && turn === 1) || (!multiplayerManager.isHost && turn === 2);
        if (isMyTurn) {
          p1Status.textContent = 'Your Turn';
          p1Status.style.color = 'var(--accent-cyan)';
          oppStatus.textContent = 'Waiting';
          oppStatus.style.color = 'var(--text-muted)';
        } else {
          p1Status.textContent = 'Waiting';
          p1Status.style.color = 'var(--text-muted)';
          oppStatus.textContent = `${multiplayerManager.isHost ? guestName : hostName}'s Turn`;
          oppStatus.style.color = 'var(--accent-pink)';
        }
      } else if (turn === 1) {
        p1Status.textContent = viewingPlayer === 1 ? 'Your Turn' : `${hostName}'s Turn`;
        p1Status.style.color = 'var(--accent-cyan)';
        oppStatus.textContent = 'Waiting';
        oppStatus.style.color = 'var(--text-muted)';
      } else {
        p1Status.textContent = 'Waiting';
        p1Status.style.color = 'var(--text-muted)';
        oppStatus.textContent = oppType.startsWith('ai') ? 'Thinking...' : `${guestName}'s Turn`;
        oppStatus.style.color = 'var(--accent-pink)';
      }
    },
    onVictory: (data) => showVictoryModal({ ...data, gameType: '5x5 Grid Battle' })
  });

  const countMagic = document.getElementById('count-powerup-magic');
  const countFreeze = document.getElementById('count-powerup-freeze');
  const countBomb = document.getElementById('count-powerup-bomb');

  const updateBoosterUI = () => {
    if (countMagic) countMagic.textContent = gridGame.powerupUses.magic;
    if (countFreeze) countFreeze.textContent = gridGame.powerupUses.freeze;
    if (countBomb) countBomb.textContent = gridGame.powerupUses.bomb;
  };

  const btnModeClassic = document.getElementById('btn-mode-classic');
  const btnModeBooster = document.getElementById('btn-mode-booster');
  const powerupsBarContainer = document.getElementById('powerups-bar-container');

  if (btnModeClassic && btnModeBooster && powerupsBarContainer) {
    btnModeClassic.addEventListener('click', () => {
      btnModeClassic.classList.add('active');
      btnModeBooster.classList.remove('active');
      powerupsBarContainer.classList.add('hidden');
      sound.playPop();
      showToast('🏆 Switched to Classic Bingo Mode');
    });

    btnModeBooster.addEventListener('click', () => {
      btnModeBooster.classList.add('active');
      btnModeClassic.classList.remove('active');
      powerupsBarContainer.classList.remove('hidden');
      sound.playPop();
      showToast('⚡ Switched to Power Booster Mode');
    });
  }

  selectOpponent.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'manual-fill') {
      gridGame.startManualFillMode();
      showToast('✍️ Manual Custom Fill: Tap or Slide finger across cells to fill 1-25!');
      return;
    }

    if (val === 'pass-play') {
      oppName.textContent = 'Player 2';
      oppAvatar.textContent = '👥';
      if (btnSwitchBoard) btnSwitchBoard.classList.remove('hidden');
    } else {
      oppName.textContent = 'Bingo Bot';
      oppAvatar.textContent = '🤖';
      if (btnSwitchBoard) btnSwitchBoard.classList.add('hidden');
    }
    gridGame.init(val);
    updateBoosterUI();
  });

  if (btnSwitchBoard) {
    btnSwitchBoard.addEventListener('click', () => {
      const viewing = gridGame.toggleViewBoard();
      showToast(`👁️ Viewing Player ${viewing} Board`);
    });
  }

  const btnManualFill = document.getElementById('btn-manual-fill');
  if (btnManualFill) {
    btnManualFill.addEventListener('click', () => {
      gridGame.startManualFillMode();
      showToast('✍️ Manual Custom Fill: Tap or Slide finger across cells to fill 1-25!');
    });
  }

  btnShuffleGrid.addEventListener('click', () => {
    gridGame.shuffleCurrentBoard();
    updateBoosterUI();
  });
  
  btnResetBattle.addEventListener('click', () => {
    gridGame.init(selectOpponent.value);
    gridGame.startGridSetupPhase(25);
    updateBoosterUI();
  });

  const btnSetupShuffle = document.getElementById('btn-setup-shuffle');
  const btnSetupManual = document.getElementById('btn-setup-manual');
  const btnSetupReady = document.getElementById('btn-setup-ready');

  if (btnSetupShuffle) {
    btnSetupShuffle.addEventListener('click', () => {
      gridGame.shuffleCurrentBoard();
      showToast('🎲 Board Shuffled!');
    });
  }

  if (btnSetupManual) {
    btnSetupManual.addEventListener('click', () => {
      gridGame.startManualFillMode();
      showToast('✍️ Custom Fill Mode: Tap cells 1-25!');
    });
  }

  if (btnSetupReady) {
    btnSetupReady.addEventListener('click', () => {
      gridGame.lockGridEarly();
      showToast('🔒 Grid Locked & Ready!');
    });
  }

  const btnPowerupMagic = document.getElementById('btn-powerup-magic');
  const btnPowerupFreeze = document.getElementById('btn-powerup-freeze');
  const btnPowerupBomb = document.getElementById('btn-powerup-bomb');

  if (btnPowerupMagic) {
    btnPowerupMagic.addEventListener('click', () => {
      const num = gridGame.useMagicPowerup();
      if (num) {
        showToast(`⚡ Magic Booster: Called Best Number ${num}!`);
        updateBoosterUI();
      } else {
        showToast('❌ Booster unavailable or already used!');
      }
    });
  }

  if (btnPowerupFreeze) {
    btnPowerupFreeze.addEventListener('click', () => {
      const ok = gridGame.useFreezePowerup();
      if (ok) {
        showToast('❄️ Freeze Booster: Opponent Turn Frozen!');
        updateBoosterUI();
      } else {
        showToast('❌ Booster unavailable or already used!');
      }
    });
  }

  if (btnPowerupBomb) {
    btnPowerupBomb.addEventListener('click', () => {
      const num = gridGame.useCenterBombPowerup();
      if (num) {
        showToast(`💣 Bomb Booster: Struck Center Tile ${num}!`);
        updateBoosterUI();
      } else {
        showToast('❌ Booster unavailable or already used!');
      }
    });
  }

  gridGame.init(selectOpponent.value);


  // ==========================================
  // 2. INITIALIZE MULTIPLAYER NETWORK CONTROLLER
  // ==========================================
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoomSubmit = document.getElementById('btn-join-room-submit');
  const btnCopyRoomLink = document.getElementById('btn-copy-room-link');
  const btnLeaveRoom = document.getElementById('btn-leave-room');
  const inputRoomCode = document.getElementById('input-room-code');
  const roomPlayerBadges = document.getElementById('room-player-badges');
  const playerCountNum = document.getElementById('player-count-num');
  const roomSetupActions = document.getElementById('room-setup-actions');
  const activeRoomHud = document.getElementById('active-room-hud');
  const activeRoomCodeDisplay = document.getElementById('active-room-code-display');
  const hostRoomControls = document.getElementById('host-room-controls');

  const tabSubCreate = document.getElementById('tab-sub-create');
  const tabSubJoin = document.getElementById('tab-sub-join');
  const panelSubCreate = document.getElementById('panel-sub-create');
  const panelSubJoin = document.getElementById('panel-sub-join');

  if (tabSubCreate && tabSubJoin && panelSubCreate && panelSubJoin) {
    tabSubCreate.addEventListener('click', () => {
      tabSubCreate.classList.add('active');
      tabSubJoin.classList.remove('active');
      panelSubCreate.classList.remove('hidden');
      panelSubJoin.classList.add('hidden');
    });

    tabSubJoin.addEventListener('click', () => {
      tabSubJoin.classList.add('active');
      tabSubCreate.classList.remove('active');
      panelSubJoin.classList.remove('hidden');
      panelSubCreate.classList.add('hidden');
    });
  }

  let selectedRoomMode = 'grid-battle';

  const optModeGrid = document.getElementById('opt-mode-grid');
  const optModeC75 = document.getElementById('opt-mode-c75');
  const selectedRoomModeBadge = document.getElementById('selected-room-mode-badge');
  const roomCapacityDisplay = document.getElementById('room-capacity-display');
  const btnHostStartGame = document.getElementById('btn-host-start-game');

  if (optModeGrid && optModeC75) {
    optModeGrid.addEventListener('click', () => {
      selectedRoomMode = 'grid-battle';
      optModeGrid.classList.add('selected');
      optModeC75.classList.remove('selected');
      if (selectedRoomModeBadge) selectedRoomModeBadge.textContent = '⚔️ 5x5 Battle (2 Players Max)';
      if (roomCapacityDisplay) roomCapacityDisplay.textContent = '1 / 2 Players';
    });

    optModeC75.addEventListener('click', () => {
      selectedRoomMode = 'caller-75';
      optModeC75.classList.add('selected');
      optModeGrid.classList.remove('selected');
      if (selectedRoomModeBadge) selectedRoomModeBadge.textContent = '🎉 75-Ball Party (4-5 Players)';
      if (roomCapacityDisplay) roomCapacityDisplay.textContent = '1 / 5 Players';
    });
  }

  const modalRoomLobby = document.getElementById('modal-room-lobby');
  const btnCloseRoomModal = document.getElementById('btn-close-room-modal');
  const modalRoomCode = document.getElementById('modal-room-code');
  const btnCopyModalKey = document.getElementById('btn-copy-modal-key');
  const modalPlayerCount = document.getElementById('modal-player-count');
  const modalCapacityBadge = document.getElementById('modal-capacity-badge');
  const modalPlayersList = document.getElementById('modal-players-list');
  const modalHostActions = document.getElementById('modal-host-actions');
  const modalGuestWaiting = document.getElementById('modal-guest-waiting');
  const btnModalStartGame = document.getElementById('btn-modal-start-game');
  const btnModalLeaveRoom = document.getElementById('btn-modal-leave-room');

  if (btnCloseRoomModal && modalRoomLobby) {
    btnCloseRoomModal.addEventListener('click', () => {
      modalRoomLobby.classList.add('hidden');
    });
  }

  const copyKeyHandler = () => {
    if (!multiplayerManager.roomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${multiplayerManager.roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(`📋 Room Invite Link copied to clipboard! Share with friends.`, 3500);
    }).catch(() => {
      navigator.clipboard.writeText(multiplayerManager.roomCode).then(() => {
        showToast(`🔑 Room Key: ${multiplayerManager.roomCode}`, 3500);
      });
    });
  };

  if (btnCopyModalKey) btnCopyModalKey.addEventListener('click', copyKeyHandler);

  multiplayerManager.onStatusChange = (msg, type) => {
    if (type === 'error') {
      gridGame.isTurnPending = false;
      gridGame.renderBoard();
    }
    showToast(msg, type === 'error' ? 4000 : 2500);
  };

  multiplayerManager.onPlayerListChange = (players) => {
    if (!roomPlayerBadges || !playerCountNum) return;
    playerCountNum.textContent = players.length;
    const maxPlayers = selectedRoomMode === 'grid-battle' ? 2 : 5;
    const capText = `${players.length} / ${maxPlayers} Players`;

    if (roomCapacityDisplay) roomCapacityDisplay.textContent = capText;
    if (modalPlayerCount) modalPlayerCount.textContent = players.length;
    if (modalCapacityBadge) modalCapacityBadge.textContent = capText;

    const hostP = players.find(p => p.isHost);
    const hostName = hostP ? hostP.name : 'Room Leader';

    const playerHtml = players.map((p) => `
      <div class="player-badge-pill ${p.isHost ? 'host' : ''}">
        <span class="p-avatar">${p.isHost ? '👑' : '👤'}</span>
        <span class="p-name">${p.name || 'Player'} ${p.isHost ? '(Room Leader)' : ''}</span>
      </div>
    `).join('');

    roomPlayerBadges.innerHTML = playerHtml;
    if (modalPlayersList) modalPlayersList.innerHTML = playerHtml;

    if (multiplayerManager.isConnected && multiplayerManager.roomCode) {
      if (roomSetupActions) roomSetupActions.classList.add('hidden');
      if (activeRoomHud) activeRoomHud.classList.remove('hidden');
      if (activeRoomCodeDisplay) activeRoomCodeDisplay.textContent = multiplayerManager.roomCode;
      if (modalRoomCode) modalRoomCode.textContent = multiplayerManager.roomCode;

      // Show Room Lobby Modal Popup
      if (modalRoomLobby) modalRoomLobby.classList.remove('hidden');

      // Leader vs Guest Start Control: Strictly check if current socket is room host
      const meInRoom = players.find(p => p.socketId === multiplayerManager.socket?.id);
      const isActualLeader = meInRoom ? !!meInRoom.isHost : multiplayerManager.isHost;

      if (isActualLeader) {
        if (players.length >= 2) {
          // Friend HAS joined! Unlock Start Game button for Leader ONLY
          if (hostRoomControls) hostRoomControls.classList.remove('hidden');
          if (modalHostActions) modalHostActions.classList.remove('hidden');
          if (modalGuestWaiting) modalGuestWaiting.classList.add('hidden');
        } else {
          // Waiting for friend to enter key
          if (hostRoomControls) hostRoomControls.classList.add('hidden');
          if (modalHostActions) modalHostActions.classList.add('hidden');
          if (modalGuestWaiting) {
            modalGuestWaiting.innerHTML = '<span class="pulse-icon">⏳</span> Waiting for friend to join with Room Key...';
            modalGuestWaiting.classList.remove('hidden');
          }
        }
      } else {
        // Guest waiting for Leader to click Start - NEVER show Start button to guests!
        if (hostRoomControls) hostRoomControls.classList.add('hidden');
        if (modalHostActions) modalHostActions.classList.add('hidden');
        if (modalGuestWaiting) {
          modalGuestWaiting.innerHTML = `<span class="pulse-icon">⏳</span> Waiting for ${hostName} to start the match...`;
          modalGuestWaiting.classList.remove('hidden');
        }
      }
    } else {
      if (roomSetupActions) roomSetupActions.classList.remove('hidden');
      if (activeRoomHud) activeRoomHud.classList.add('hidden');
      if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
    }
  };

  const startOnlineGridGame = () => {
    switchTab('grid-battle');
    if (btnModeClassic) btnModeClassic.click();
    selectOpponent.value = 'pass-play';
    gridGame.init('online'); // Enforces strict turn-based online mode
    oppName.textContent = 'Online Friend';
    oppAvatar.textContent = '👥';
    if (btnSwitchBoard) btnSwitchBoard.classList.add('hidden');

    // Trigger 25s Grid Setup / Shuffle phase for room players
    gridGame.startGridSetupPhase(25);
  };

  multiplayerManager.onMessageReceived = (data, senderPeerId) => {
    if (data.type === 'EMOJI_REACTION') {
      showToast(`${data.senderName}: ${data.emoji}`, 3000);
      sound.playPop();
    } else if (data.type === 'START_GAME') {
      if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
      if (data.mode === 'caller-75' || data.mode === '75-Ball') {
        switchTab('caller-75');
        caller75.startNewGame();
        showToast('🚀 75-Ball Party Started! Watch for drawn balls!');
      } else {
        startOnlineGridGame();
        const isMyStartTurn = multiplayerManager.socket && (data.currentTurnSocketId === multiplayerManager.socket.id);
        showToast(isMyStartTurn ? '🚀 Game Started! Your turn first!' : '🚀 Game Started! Room Leader goes first!');
      }
    } else if (data.type === 'PLAYER_READY') {
      const isMe = multiplayerManager.socket && (data.senderSocketId === multiplayerManager.socket.id);
      if (!isMe) {
        gridGame.setOpponentReady(true);
        showToast(`🎯 ${data.senderName || 'Opponent'} is READY!`, 2500);
      }
    } else if (data.type === 'START_COUNTDOWN') {
      showToast('Both players are ready!', 3000);
      if (gridGame.isSetupPhase || gridGame.isMyReady) {
        gridGame.startSynchronizedCountdown(data.startAt);
      }
    } else if (data.type === 'ALL_PLAYERS_READY') {
      if (gridGame.isSetupPhase && data.startAt) {
        gridGame.startSynchronizedCountdown(data.startAt);
      }
    } else if (data.type === 'REMATCH_REQUESTED') {
      const isMe = multiplayerManager.socket && (data.requesterSocketId === multiplayerManager.socket.id);
      if (!isMe) {
        const modalRematch = document.getElementById('modal-rematch-request');
        const titleEl = document.getElementById('rematch-request-title');
        const descEl = document.getElementById('rematch-request-desc');
        if (titleEl) titleEl.textContent = `🔄 Rematch Requested!`;
        if (descEl) descEl.textContent = `${data.requesterName} wants to play again!`;
        if (modalRematch) modalRematch.classList.remove('hidden');
        sound.playPop();
      }
    } else if (data.type === 'REMATCH_ACCEPTED') {
      const modalRematch = document.getElementById('modal-rematch-request');
      if (modalRematch) modalRematch.classList.add('hidden');
      if (modalVictory) modalVictory.classList.add('hidden');

      if (btnVictoryReplay) {
        btnVictoryReplay.disabled = false;
        btnVictoryReplay.innerHTML = '<i data-lucide="rotate-ccw"></i> Play Again';
      }

      showToast(`🎉 Rematch Accepted! Starting new game...`, 3000);
      if (multiplayerManager.selectedMode === 'katam-kutta') {
        switchTab('katam-kutta');
        const hostName = multiplayerManager.room?.players[0]?.name || 'Player 1';
        const guestName = multiplayerManager.room?.players[1]?.name || 'Player 2';
        kkGame.init({
          gameMode: 'human',
          roundId: data.newRoundId,
          p1Name: hostName,
          p2Name: guestName
        });
      } else {
        switchTab('grid-battle');
        selectOpponent.value = 'pass-play';
        gridGame.init('online');
        gridGame.resetForNewRound(data.newRoundId);
      }
    } else if (data.type === 'MODE_CHANGED') {
      multiplayerManager.selectedMode = data.selectedMode;
      const modeBadge = document.getElementById('selected-room-mode-badge');
      if (modeBadge) {
        modeBadge.textContent = data.selectedMode === 'katam-kutta' ? '❌⭕ Katam-Kutta (2 Players Max)' : (data.selectedMode === 'grid-battle' ? '⚔️ 5x5 Battle (2 Players Max)' : '🎉 75-Ball Party (5 Players Max)');
      }
      showToast(`🎮 Room Game Mode changed to: ${data.selectedMode === 'katam-kutta' ? 'Katam-Kutta (Tic Tac Toe)' : data.selectedMode}`);
    } else if (data.type === 'MOVE_APPLIED') {
      if (data.roundId === kkGame.roundId || !kkGame.roundId) {
        kkGame.applyServerMovePayload(data);
        if (data.winner) {
          showVictoryModal({
            winner: data.winner,
            gameType: 'Katam-Kutta (Tic-Tac-Toe)',
            opponentType: 'multiplayer',
            isLossForMe: data.winner !== multiplayerManager.myPlayerName
          });
        }
      }
    } else if (data.type === 'KK_MOVE') {
      if (data.roundId === kkGame.roundId) {
        kkGame.makeMove(data.index !== undefined ? data.index : data.cell, data.symbol || 'X');
      }
    } else if (data.type === 'KK_VICTORY') {
      kkGame.isGameOver = true;
      showVictoryModal({
        winner: data.winnerName,
        gameType: 'Katam-Kutta (Tic-Tac-Toe)',
        opponentType: 'multiplayer',
        isLossForMe: data.winnerName !== (multiplayerManager.myPlayerName)
      });
    } else if (data.type === 'REMATCH_DECLINED') {
      const modalRematch = document.getElementById('modal-rematch-request');
      if (modalRematch) modalRematch.classList.add('hidden');

      if (btnVictoryReplay) {
        btnVictoryReplay.disabled = false;
        btnVictoryReplay.innerHTML = '<i data-lucide="rotate-ccw"></i> Play Again';
      }
      showToast(`❌ ${data.declinerName || 'Opponent'} declined the rematch.`, 4000);
    } else if (data.type === 'GRID_CALL_NUMBER') {
      gridGame.processNumberCall(data.number, true, data.nextTurnSocketId);
      const isMyNextTurn = multiplayerManager.socket && (data.nextTurnSocketId === multiplayerManager.socket.id);
      showToast(isMyNextTurn ? `🎯 Number ${data.number} Called! Your Turn!` : `🎯 Number ${data.number} Called! Opponent's Turn...`);
    } else if (data.type === 'GRID_VICTORY') {
      const isMe = multiplayerManager.socket && (data.winnerSocketId === multiplayerManager.socket.id);
      if (!isMe) {
        gridGame.handleRemoteVictory(data);
        showToast(`❌ BINGO! ${data.winnerName || 'Opponent'} completed 5 lines! Aapka Bingo nahi hua!`, 5000);
      } else {
        gridGame.isGameOver = true;
        gridGame.isTurnPending = false;
        gridGame.renderBoard();
        showVictoryModal({
          winner: data.winnerName || multiplayerManager.myPlayerName || 'You',
          gameType: '5x5 Grid Battle',
          p1Lines: data.p1Lines !== undefined ? data.p1Lines : gridGame.p1LinesCount,
          p2Lines: data.p2Lines !== undefined ? data.p2Lines : gridGame.p2LinesCount,
          totalCalls: data.totalCalls || gridGame.calledNumbers.size,
          opponentType: gridGame.opponentType,
          isLossForMe: false
        });
      }
    } else if (data.type === 'C75_BALL_DRAWN') {
      if (!caller75.drawnSet.has(data.number)) {
        caller75.drawnSet.add(data.number);
        caller75.drawnBalls.push(data.number);
        sound.speakCall(data.letter, data.number);
        if (caller75.ballDisplay) {
          caller75.ballDisplay.querySelector('.ball-letter').textContent = data.letter;
          caller75.ballDisplay.querySelector('.ball-number').textContent = data.number;
          caller75.ballDisplay.classList.remove('pop-anim');
          void caller75.ballDisplay.offsetWidth;
          caller75.ballDisplay.classList.add('pop-anim');
        }
        if (caller75.callCountDisplay) {
          caller75.callCountDisplay.textContent = `${caller75.drawnBalls.length}/75`;
        }
        caller75.updateRecentBalls(data.letter, data.number);
        const mbCell = document.getElementById(`mb-cell-${data.number}`);
        if (mbCell) mbCell.classList.add('called');
        if (caller75.autoDaub) {
          caller75.performAutoDaubScan();
        }
      }
    } else if (data.type === 'C75_VICTORY') {
      const isMe = multiplayerManager.socket && (data.winnerSocketId === multiplayerManager.socket.id);
      caller75.stopAutoCall();
      if (!isMe) {
        showVictoryModal({
          winner: data.winnerName || 'Online Player',
          gameType: `75-Ball Party (${data.pattern || 'Bingo'})`,
          callsCount: data.callsCount || caller75.drawnBalls.length,
          winningCard: 'Room Winner',
          isLossForMe: true
        });
        showToast(`❌ ${data.winnerName || 'Player'} WON BINGO! Aapka Bingo nahi hua!`, 5000);
      } else {
        showVictoryModal({
          winner: data.winnerName || 'Online Player',
          gameType: `75-Ball Party (${data.pattern || 'Bingo'})`,
          callsCount: data.callsCount || caller75.drawnBalls.length,
          winningCard: 'Room Winner',
          isLossForMe: false
        });
      }
    } else if (data.type === 'SWITCH_TAB') {
      if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
      if (data.tab === 'grid-battle') {
        startOnlineGridGame();
      } else {
        switchTab(data.tab);
      }
    }
  };

  const btnRematchAccept = document.getElementById('btn-rematch-accept');
  const btnRematchDecline = document.getElementById('btn-rematch-decline');
  const modalRematchRequest = document.getElementById('modal-rematch-request');

  if (btnRematchAccept) {
    btnRematchAccept.addEventListener('click', () => {
      if (modalRematchRequest) modalRematchRequest.classList.add('hidden');
      multiplayerManager.respondRematch(true);
    });
  }

  if (btnRematchDecline) {
    btnRematchDecline.addEventListener('click', () => {
      if (modalRematchRequest) modalRematchRequest.classList.add('hidden');
      multiplayerManager.respondRematch(false);
    });
  }

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      const name = playerNickname ? playerNickname.value || 'Host Player' : 'Host Player';
      multiplayerManager.createRoom(name, selectedRoomMode);
      showToast(`🎉 Room Created! Selected Mode: ${selectedRoomMode === 'grid-battle' ? '5x5 Battle' : '75-Ball Party'}`);
    });
  }

  if (btnJoinRoomSubmit) {
    btnJoinRoomSubmit.addEventListener('click', () => {
      const code = inputRoomCode ? inputRoomCode.value : '';
      if (!code) {
        showToast('Please enter a Room Code!');
        return;
      }
      const name = playerNickname ? playerNickname.value || 'Guest Player' : 'Guest Player';
      multiplayerManager.joinRoom(code, name);
    });
  }

  if (btnCopyRoomLink) btnCopyRoomLink.addEventListener('click', copyKeyHandler);

  const leaveRoomHandler = () => {
    multiplayerManager.leaveRoom();
    if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
    showToast('Left multiplayer room.');
  };

  if (btnLeaveRoom) btnLeaveRoom.addEventListener('click', leaveRoomHandler);
  if (btnModalLeaveRoom) btnModalLeaveRoom.addEventListener('click', leaveRoomHandler);

  const startGameHandler = () => {
    if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
    multiplayerManager.broadcast({ type: 'START_GAME', mode: selectedRoomMode });
    if (selectedRoomMode === 'grid-battle') {
      startOnlineGridGame();
    } else {
      switchTab(selectedRoomMode);
    }
    showToast(`🚀 Game Started! Launching ${selectedRoomMode === 'grid-battle' ? '5x5 Battle' : '75-Ball Party'}...`);
  };

  if (btnHostStartGame) btnHostStartGame.addEventListener('click', startGameHandler);
  if (btnModalStartGame) btnModalStartGame.addEventListener('click', startGameHandler);

  // Quick Emoji Reactions
  document.querySelectorAll('.btn-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      if (multiplayerManager.isConnected) {
        multiplayerManager.broadcast({
          type: 'EMOJI_REACTION',
          emoji,
          senderName: multiplayerManager.myPlayerName
        });
      }
      showToast(`You: ${emoji}`);
      sound.playPop();
    });
  });

  // Auto-join room if URL has ?room=BINGO-XXXX
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    switchTab('online-room');
    if (inputRoomCode) inputRoomCode.value = roomParam.toUpperCase();
    showToast(`Joining Room ${roomParam}... Click Join when ready!`);
  }



  // ==========================================
  // 2. INITIALIZE 75-BALL CALLER
  // ==========================================
  const c75CardsContainer = document.getElementById('caller-cards-wrapper');
  const c75MasterContainer = document.getElementById('c75-master-grid');
  const c75BallDisplay = document.getElementById('caller-ball-display');
  const c75RecentBalls = document.getElementById('c75-recent-balls');
  const c75CallCount = document.getElementById('c75-call-count');
  const c75PatternName = document.getElementById('c75-pattern-name');
  const btnC75Draw = document.getElementById('btn-c75-draw');
  const btnC75Auto = document.getElementById('btn-c75-auto');
  const btnC75Restart = document.getElementById('btn-c75-restart');
  const btnC75NewCard = document.getElementById('btn-c75-new-card');
  const btnC75Claim = document.getElementById('btn-c75-claim-bingo');
  const selectC75Pattern = document.getElementById('select-c75-pattern');
  const selectC75Cards = document.getElementById('select-c75-cards');
  const selectC75Speed = document.getElementById('select-c75-speed');
  const chkAutoDaub = document.getElementById('chk-auto-daub');
  const modalC75Board = document.getElementById('modal-c75-board');
  const btnC75BoardToggle = document.getElementById('btn-c75-board-toggle');
  const dauberOptions = document.querySelectorAll('.dauber-option');

  const caller75 = new Caller75Game({
    cardsContainer: c75CardsContainer,
    masterGridContainer: c75MasterContainer,
    ballDisplay: c75BallDisplay,
    recentBallsContainer: c75RecentBalls,
    callCountDisplay: c75CallCount,
    patternNameDisplay: c75PatternName,
    onVictory: (data) => showVictoryModal(data)
  });

  if (selectC75Pattern) {
    selectC75Pattern.addEventListener('change', (e) => {
      caller75.setPattern(e.target.value);
    });
  }

  if (selectC75Cards) {
    selectC75Cards.addEventListener('change', (e) => {
      caller75.setCardCount(e.target.value);
    });
  }

  if (selectC75Speed) {
    selectC75Speed.addEventListener('change', (e) => {
      caller75.autoCallSpeed = parseInt(e.target.value) || 3500;
    });
  }

  btnC75Draw.addEventListener('click', () => caller75.drawBall());
  btnC75Auto.addEventListener('click', () => {
    const isRunning = caller75.toggleAutoCall();
    btnC75Auto.classList.toggle('btn-accent', isRunning);
    showToast(isRunning ? '▶️ Auto Calling Started' : '⏸️ Auto Calling Paused');
  });
  btnC75Restart.addEventListener('click', () => caller75.startNewGame());
  btnC75NewCard.addEventListener('click', () => caller75.generateCards());
  btnC75Claim.addEventListener('click', () => {
    const win = caller75.claimBingo();
    if (win) {
      if (multiplayerManager.isConnected) {
        multiplayerManager.broadcast({
          type: 'C75_VICTORY',
          winnerName: multiplayerManager.myPlayerName,
          winnerSocketId: multiplayerManager.socket?.id,
          pattern: caller75.patternType,
          callsCount: caller75.drawnBalls.length
        });
      }
    } else {
      showToast(`❌ Invalid claim for pattern "${selectC75Pattern.options[selectC75Pattern.selectedIndex].text}"!`);
    }
  });

  if (chkAutoDaub) {
    chkAutoDaub.addEventListener('change', (e) => {
      caller75.autoDaub = e.target.checked;
      if (caller75.autoDaub) {
        caller75.performAutoDaubScan();
      }
      showToast(caller75.autoDaub ? '✨ Auto-Daub Enabled' : 'Manual Daub Mode');
    });
  }

  dauberOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      dauberOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const style = opt.dataset.dauber;
      const colorMap = {
        'neon-purple': '#a855f7',
        'neon-cyan': '#06b6d4',
        'neon-pink': '#ec4899',
        'neon-amber': '#f59e0b'
      };
      document.documentElement.style.setProperty('--active-dauber-color', colorMap[style] || '#a855f7');
      sound.playPop();
    });
  });

  if (btnC75BoardToggle) {
    btnC75BoardToggle.addEventListener('click', () => modalC75Board.classList.remove('hidden'));
  }
  if (modalC75Board) {
    modalC75Board.querySelector('.close-modal').addEventListener('click', () => modalC75Board.classList.add('hidden'));
  }

  caller75.startNewGame();


  // ==========================================


  // ==========================================
  // 4. INITIALIZE CUSTOM BINGO BUILDER
  // ==========================================
  const customBuilder = new CustomBingoBuilder({
    titleInput: document.getElementById('custom-card-title'),
    wordsInput: document.getElementById('custom-words-input'),
    wordCountLabel: document.getElementById('custom-word-count'),
    playArea: document.getElementById('custom-card-play-area'),
    gridContainer: document.getElementById('custom-bingo-grid'),
    displayTitle: document.getElementById('display-custom-title'),
    onVictory: (data) => showVictoryModal(data)
  });

  customBuilder.init();
  if (!customBuilder.wordsInput.value) {
    customBuilder.loadPreset('party');
  }

  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      customBuilder.loadPreset(btn.dataset.preset);
    });
  });

  document.getElementById('btn-generate-custom').addEventListener('click', () => {
    const ok = customBuilder.generateCustomCard();
    if (ok) {
      document.querySelector('.custom-builder-container').classList.add('hidden');
      document.getElementById('custom-card-play-area').classList.remove('hidden');
    }
  });

  const btnSaveCustom = document.getElementById('btn-save-custom');
  if (btnSaveCustom) {
    btnSaveCustom.addEventListener('click', () => {
      const ok = customBuilder.saveCurrentSet();
      if (ok) showToast('💾 Custom Bingo set saved to local storage!');
    });
  }

  document.getElementById('btn-back-builder').addEventListener('click', () => {
    document.querySelector('.custom-builder-container').classList.remove('hidden');
    document.getElementById('custom-card-play-area').classList.add('hidden');
  });

  document.getElementById('btn-print-custom').addEventListener('click', () => {
    window.print();
  });

  // ==========================================
  // 5. KATAM KUTTA (MODERN TIC TAC TOE) UI & EVENT CONTROLLER
  // ==========================================
  const kkCells = document.querySelectorAll('.kk-cell');
  const kkTurnIndicator = document.getElementById('kk-turn-indicator');
  const kkBotThinkingBadge = document.getElementById('kk-bot-thinking-badge');
  const kkNameX = document.getElementById('kk-name-x');
  const kkNameO = document.getElementById('kk-name-o');
  const kkAvatarX = document.getElementById('kk-avatar-x');
  const kkAvatarO = document.getElementById('kk-avatar-o');
  const kkDotsX = document.getElementById('kk-dots-x');
  const kkDotsO = document.getElementById('kk-dots-o');
  const kkPlayerCardX = document.getElementById('kk-player-x');
  const kkPlayerCardO = document.getElementById('kk-player-o');
  const diffBtns = document.querySelectorAll('.diff-btn');

  // How to Play Rules Modal
  const btnKkHelp = document.getElementById('btn-kk-help');
  const modalKkHelp = document.getElementById('modal-kk-help');
  const btnCloseKkHelp = document.getElementById('btn-close-kk-help');

  if (btnKkHelp && modalKkHelp) {
    btnKkHelp.addEventListener('click', () => modalKkHelp.classList.remove('hidden'));
  }
  if (btnCloseKkHelp && modalKkHelp) {
    btnCloseKkHelp.addEventListener('click', () => modalKkHelp.classList.add('hidden'));
  }

  // State change renderer for Katam Kutta
  kkGame.onStateChangeCallback = (state) => {
    if (kkNameX) kkNameX.textContent = state.playerNames.X || 'Player 1';
    if (kkNameO) kkNameO.textContent = state.playerNames.O || 'Player 2';

    if (authManager.currentUser) {
      if (kkAvatarX) kkAvatarX.textContent = state.playerNames.X === (authManager.currentUser.displayName || authManager.currentUser.username) ? (authManager.currentUser.avatar || '👤') : '👤';
      if (kkAvatarO) kkAvatarO.textContent = state.playerNames.O === (authManager.currentUser.displayName || authManager.currentUser.username) ? (authManager.currentUser.avatar || '👤') : (kkGame.gameMode === 'bot' ? '🤖' : '👤');
    }

    // Update Turn Indicator & Player Card Highlights
    if (kkTurnIndicator) {
      const activeName = state.playerNames[state.currentTurnSymbol] || state.currentTurnSymbol;
      kkTurnIndicator.textContent = state.isGameOver ? '🎉 Game Finished!' : `${activeName}'s Turn (${state.currentTurnSymbol})`;
    }

    if (kkPlayerCardX) kkPlayerCardX.classList.toggle('active', state.currentTurnSymbol === 'X' && !state.isGameOver);
    if (kkPlayerCardO) kkPlayerCardO.classList.toggle('active', state.currentTurnSymbol === 'O' && !state.isGameOver);

    if (kkBotThinkingBadge) {
      kkBotThinkingBadge.classList.toggle('hidden', !state.isBotThinking);
    }

    // Update Active Piece Dots (3 dots per player)
    if (kkDotsX) {
      const dots = kkDotsX.querySelectorAll('.dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx < state.activeXCount);
      });
    }

    if (kkDotsO) {
      const dots = kkDotsO.querySelectorAll('.dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx < state.activeOCount);
      });
    }

    // Render Board Grid Cells
    kkCells.forEach((cell, idx) => {
      const val = state.board[idx];
      cell.classList.remove('symbol-x', 'symbol-o', 'occupied', 'oldest-warning', 'disappearing');

      if (val === 'X') {
        cell.textContent = '❌';
        cell.classList.add('symbol-x', 'occupied');
      } else if (val === 'O') {
        cell.textContent = '⭕';
        cell.classList.add('symbol-o', 'occupied');
      } else {
        cell.textContent = '';
      }

      // Check if cell is oldest warning piece (will vanish next)
      if (state.currentTurnSymbol === 'X' && state.activeXCount >= 3 && idx === state.oldestXIndex) {
        cell.classList.add('oldest-warning');
      } else if (state.currentTurnSymbol === 'O' && state.activeOCount >= 3 && idx === state.oldestOIndex) {
        cell.classList.add('oldest-warning');
      }

      // Trigger disappearing animation
      if (state.disappearingIndex === idx) {
        cell.classList.add('disappearing');
      }

      // Highlight winning line cells
      if (state.winResult && state.winResult.line && state.winResult.line.includes(idx)) {
        cell.classList.add('winning-cell');
      }
    });
  };

  // Victory callback
  kkGame.onVictoryCallback = ({ winnerSymbol, winnerName, loserName, winningLine }) => {
    lastVictoryGameType = 'Katam-Kutta (Tic-Tac-Toe)';
    const isMeWinner = (multiplayerManager.isConnected && multiplayerManager.myPlayerName === winnerName) || (!multiplayerManager.isConnected && winnerSymbol === 'X');

    setTimeout(() => {
      showVictoryModal({
        winner: winnerName,
        gameType: 'Katam-Kutta (Tic-Tac-Toe)',
        opponentType: kkGame.gameMode === 'bot' ? 'ai-medium' : 'multiplayer',
        isLossForMe: !isMeWinner
      });
    }, 800);
  };

  // Cell Click Event
  kkCells.forEach((cell, idx) => {
    cell.addEventListener('click', () => {
      if (kkGame.isGameOver || kkGame.isBotThinking) return;

      if (multiplayerManager.isConnected) {
        // Multiplayer turn check
        const mySymbol = multiplayerManager.isHost ? 'X' : 'O';
        const myPlayerKey = multiplayerManager.isHost ? 'player1' : 'player2';

        if (kkGame.currentTurnSymbol !== mySymbol) {
          showToast(`⏳ It's ${kkGame.playerNames[kkGame.currentTurnSymbol]}'s turn! Please wait.`);
          return;
        }

        const moveId = `move_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        multiplayerManager.broadcast({
          type: 'KK_MOVE',
          roundId: kkGame.roundId,
          moveId,
          playerId: myPlayerKey,
          cell: idx,
          index: idx,
          symbol: mySymbol,
          timestamp: Date.now()
        });
      } else {
        // Single player vs Bot
        kkGame.makeMove(idx, kkGame.currentTurnSymbol);
      }
    });
  });

  // Bot Difficulty Switcher
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const diff = btn.dataset.diff || 'medium';
      kkGame.botDifficulty = diff;

      if (!multiplayerManager.isConnected) {
        const p1 = authManager.isLoggedIn() ? (authManager.currentUser.displayName || authManager.currentUser.username) : 'Player 1';
        kkGame.init({
          gameMode: 'bot',
          botDifficulty: diff,
          p1Name: p1,
          p2Name: 'Bingo Bot 🤖'
        });
      }
      showToast(`🤖 Bot difficulty set to ${diff.toUpperCase()}! Match restarted.`);
    });
  });
});
