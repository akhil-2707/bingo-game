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

  // ==========================================
  // CINEMATIC GAME INTRO ANIMATION CONTROLLER
  // ==========================================
  const gameIntroOverlay = document.getElementById('game-intro-overlay');
  const btnSkipIntro = document.getElementById('btn-skip-intro');
  const introLettersContainer = document.getElementById('intro-letters-container');
  const introMascot = document.getElementById('intro-mascot');
  const introBombFlash = document.getElementById('intro-bomb-flash');

  // Nickname Setup Modal Elements
  const modalNicknameSetup = document.getElementById('modal-nickname-setup');
  const startupPlayerName = document.getElementById('startup-player-name');
  const nameStatusIndicator = document.getElementById('name-status-indicator');
  const nameErrorMsg = document.getElementById('name-error-msg');
  const btnSaveNickname = document.getElementById('btn-save-nickname');
  const playerNickname = document.getElementById('player-nickname');

  let introTimeouts = [];

  const openNicknameModal = () => {
    const savedName = localStorage.getItem('bingo_player_nickname');
    if (savedName) {
      if (playerNickname) playerNickname.value = savedName;
      if (startupPlayerName) startupPlayerName.value = savedName;
      multiplayerManager.myPlayerName = savedName;
    }

    if (modalNicknameSetup && (!savedName || modalNicknameSetup.dataset.forceOpen)) {
      modalNicknameSetup.classList.remove('hidden');
    }
  };

  const closeIntro = () => {
    introTimeouts.forEach(t => clearTimeout(t));
    if (gameIntroOverlay) {
      gameIntroOverlay.classList.add('fade-out');
      setTimeout(() => {
        gameIntroOverlay.classList.add('hidden');
        openNicknameModal();
      }, 500);
    } else {
      openNicknameModal();
    }
  };

  if (btnSkipIntro) {
    btnSkipIntro.addEventListener('click', closeIntro);
  }

  // Real-time Nickname Availability Check Handler
  let nicknameCheckDebounce = null;
  if (startupPlayerName) {
    startupPlayerName.addEventListener('input', () => {
      clearTimeout(nicknameCheckDebounce);
      const val = startupPlayerName.value.trim();

      if (!val || val.length < 2) {
        if (nameStatusIndicator) nameStatusIndicator.textContent = '';
        if (nameErrorMsg) nameErrorMsg.classList.add('hidden');
        startupPlayerName.classList.remove('error', 'valid');
        return;
      }

      nicknameCheckDebounce = setTimeout(() => {
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

  const robotBeam = document.getElementById('robot-beam');
  const tractorBeamsContainer = document.getElementById('tractor-beams-container');

  if (gameIntroOverlay) {
    // Failsafe Timer: Guarantee intro overlay closes in max 3.2 seconds no matter what!
    const failsafeTimer = setTimeout(() => {
      closeIntro();
    }, 3200);

    // Tap anywhere on screen to close intro immediately
    gameIntroOverlay.addEventListener('click', () => {
      clearTimeout(failsafeTimer);
      closeIntro();
    });

    // Phase 1 (0.5s): Mascot drops in
    introTimeouts.push(setTimeout(() => {
      if (introMascot) introMascot.classList.remove('hidden');
      try { sound.playWhoosh(); } catch (e) {}
    }, 500));

    // Phase 1.5 (1.0s): Beams appear
    introTimeouts.push(setTimeout(() => {
      if (robotBeam) robotBeam.classList.remove('hidden');
      if (tractorBeamsContainer) tractorBeamsContainer.classList.remove('hidden');
      try { sound.playPop(); } catch (e) {}
    }, 1000));

    // Phase 2 (1.6s): Letters join
    introTimeouts.push(setTimeout(() => {
      if (introLettersContainer) {
        introLettersContainer.classList.remove('scattered');
        introLettersContainer.classList.add('joined');
      }
      if (tractorBeamsContainer) {
        tractorBeamsContainer.classList.add('contracting');
      }
      try { sound.playPop(); } catch (e) {}
    }, 1600));

    // Phase 3 (2.8s): Auto close intro overlay
    introTimeouts.push(setTimeout(() => {
      clearTimeout(failsafeTimer);
      closeIntro();
    }, 2800));
  } else {
    openNicknameModal();
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

  const showVictoryModal = ({ winner = 'Player 1', gameType = '5x5 Battle', p1Lines, p2Lines, totalCalls, opponentType = '' }) => {
    lastVictoryGameType = gameType;
    triggerConfetti();
    if (victoryTitle) victoryTitle.textContent = winner.includes('Bot') ? 'BOT WINS!' : 'BINGO VICTORY!';
    if (victoryDesc) victoryDesc.textContent = `${winner} won the ${gameType} match!`;

    if (victoryStats) {
      victoryStats.innerHTML = `
        <div class="stat-row"><strong>Game Mode:</strong> ${gameType}</div>
        ${p1Lines !== undefined ? `<div class="stat-row"><strong>Your Lines:</strong> ${p1Lines} / 5</div>` : ''}
        ${p2Lines !== undefined ? `<div class="stat-row"><strong>Opponent Lines:</strong> ${p2Lines} / 5</div>` : ''}
        ${totalCalls ? `<div class="stat-row"><strong>Total Numbers Called:</strong> ${totalCalls}</div>` : ''}
      `;
    }

    // Track Stats & Trophy Rewards
    const isWin = !winner.includes('Bot') && winner !== 'Player 2';
    const isBotMatch = opponentType && opponentType.includes('ai');
    const isMultiplayer = multiplayerManager.isConnected || opponentType === 'multiplayer';

    if (authManager.isLoggedIn()) {
      if (isMultiplayer) {
        if (isWin) {
          authManager.updateTrophies(5, 'multiplayer_win');
        } else {
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
      lines: p1Lines || 1,
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

  // Main Hub Mode Cards Launchers
  const hubModeCards = document.querySelectorAll('.hub-mode-card');
  hubModeCards.forEach(card => {
    card.addEventListener('click', () => {
      sound.playPop();
      const target = card.dataset.launchTab;
      if (target) {
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

  const gridGame = new GridBattleGame({
    container: battleGridContainer,
    lettersContainer: lettersContainer,
    onTurnChange: (turn, oppType, lastCalled, viewingPlayer) => {
      if (lastCalledNum && lastCalled) {
        lastCalledNum.textContent = lastCalled;
      }
      if (turn === 1) {
        p1Status.textContent = viewingPlayer === 1 ? 'Your Turn' : 'P1 Turn';
        p1Status.style.color = 'var(--accent-cyan)';
        oppStatus.textContent = 'Waiting';
        oppStatus.style.color = 'var(--text-muted)';
      } else {
        p1Status.textContent = 'Waiting';
        p1Status.style.color = 'var(--text-muted)';
        oppStatus.textContent = oppType.startsWith('ai') ? 'Thinking...' : 'Player 2 Turn';
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
    updateBoosterUI();
  });

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

    const playerHtml = players.map((p, idx) => `
      <div class="player-badge-pill ${p.isHost ? 'host' : ''}">
        <span class="p-avatar">${p.isHost ? '👑' : '👤'}</span>
        <span class="p-name">Player ${idx + 1}: ${p.name} ${p.isHost ? '(Room Leader)' : ''}</span>
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
          modalGuestWaiting.innerHTML = '<span class="pulse-icon">⏳</span> Waiting for Room Leader (Player 1) to start the match...';
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
    } else if (data.type === 'GRID_CALL_NUMBER') {
      gridGame.processNumberCall(data.number, true, data.nextTurnSocketId);
      const isMyNextTurn = multiplayerManager.socket && (data.nextTurnSocketId === multiplayerManager.socket.id);
      showToast(isMyNextTurn ? `🎯 Number ${data.number} Called! Your Turn!` : `🎯 Number ${data.number} Called! Opponent's Turn...`);
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
      sound.playVictoryFanfare();
      caller75.stopAutoCall();
      showVictoryModal({
        winner: data.winnerName || 'Online Player',
        gameType: `75-Ball Party (${data.pattern || 'Bingo'})`,
        callsCount: data.callsCount || caller75.drawnBalls.length,
        winningCard: 'Room Winner'
      });
      showToast(`🏆 ${data.winnerName || 'Player'} WON BINGO! 🎉`, 5000);
    } else if (data.type === 'SWITCH_TAB') {
      if (modalRoomLobby) modalRoomLobby.classList.add('hidden');
      if (data.tab === 'grid-battle') {
        startOnlineGridGame();
      } else {
        switchTab(data.tab);
      }
    }
  };

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
});
