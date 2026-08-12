/* ==========================================================================
   BINGO MASTER - STATISTICS & ACHIEVEMENTS SYSTEM
   ========================================================================== */

const STORAGE_KEY = 'bingo_master_stats_v1';

const DEFAULT_STATS = {
  totalGames: 0,
  victories: 0,
  gridBattleWins: 0,
  gridBattleLosses: 0,
  callerWins: 0,
  housieWins: 0,
  customWins: 0,
  totalLinesCompleted: 0,
  currentStreak: 0,
  bestStreak: 0,
  unlockedAchievements: []
};

export const ACHIEVEMENTS = [
  {
    id: 'first_win',
    title: 'First Blood',
    desc: 'Win your first Bingo game in any mode',
    icon: '🏆'
  },
  {
    id: 'grid_master',
    title: 'Grid Warlord',
    desc: 'Win 5 games of 5x5 Grid Battle',
    icon: '⚔️'
  },
  {
    id: 'bot_slayer',
    title: 'AI Buster',
    desc: 'Defeat Master AI in 5x5 Grid Battle',
    icon: '🤖'
  },
  {
    id: 'pattern_king',
    title: 'Pattern Prodigy',
    desc: 'Win a 75-Ball game on X-Pattern or 4 Corners',
    icon: '🎯'
  },
  {
    id: 'blackout_legend',
    title: 'Blackout Legend',
    desc: 'Win a 75-Ball game on Blackout / Full House pattern',
    icon: '🌟'
  },
  {
    id: 'custom_creator',
    title: 'Bingo Designer',
    desc: 'Play and win a Custom Word Bingo match',
    icon: '🎨'
  },
  {
    id: 'streak_3',
    title: 'On a Roll',
    desc: 'Achieve a 3-game win streak',
    icon: '🔥'
  }
];

export class StatsManager {
  constructor() {
    this.data = this.loadStats();
  }

  loadStats() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_STATS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load bingo stats', e);
    }
    return { ...DEFAULT_STATS };
  }

  saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save bingo stats', e);
    }
  }

  recordGameEnd({ gameType, isWin, lines = 0, opponentType = '' }) {
    this.data.totalGames++;

    if (isWin) {
      this.data.victories++;
      this.data.currentStreak++;
      if (this.data.currentStreak > this.data.bestStreak) {
        this.data.bestStreak = this.data.currentStreak;
      }

      if (gameType.includes('Grid')) {
        this.data.gridBattleWins++;
      } else if (gameType.includes('75-Ball')) {
        this.data.callerWins++;
      } else if (gameType.includes('Housie') || gameType.includes('90')) {
        this.data.housieWins++;
      } else if (gameType.includes('Custom')) {
        this.data.customWins++;
      }
    } else {
      this.data.currentStreak = 0;
      if (gameType.includes('Grid')) {
        this.data.gridBattleLosses++;
      }
    }

    this.data.totalLinesCompleted += lines;

    // Check Achievements
    const newUnlocks = this.checkAchievements({ gameType, isWin, opponentType });

    this.saveStats();
    return newUnlocks;
  }

  checkAchievements({ gameType, isWin, opponentType }) {
    const newlyUnlocked = [];

    const unlock = (id) => {
      if (!this.data.unlockedAchievements.includes(id)) {
        this.data.unlockedAchievements.push(id);
        newlyUnlocked.push(ACHIEVEMENTS.find(a => a.id === id));
      }
    };

    if (this.data.victories >= 1) unlock('first_win');
    if (this.data.gridBattleWins >= 5) unlock('grid_master');
    if (isWin && opponentType === 'ai-master') unlock('bot_slayer');
    if (isWin && (gameType.includes('X-Pattern') || gameType.includes('Four Corners'))) unlock('pattern_king');
    if (isWin && gameType.includes('Full House')) unlock('housie_champ');
    if (isWin && gameType.includes('Custom')) unlock('custom_creator');
    if (this.data.currentStreak >= 3) unlock('streak_3');

    return newlyUnlocked;
  }

  getWinRate() {
    if (this.data.totalGames === 0) return 0;
    return Math.round((this.data.victories / this.data.totalGames) * 100);
  }

  renderStatsModal(container) {
    if (!container) return;

    const winRate = this.getWinRate();

    let achievementsHtml = ACHIEVEMENTS.map(ach => {
      const isUnlocked = this.data.unlockedAchievements.includes(ach.id);
      return `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="ach-icon">${ach.icon}</div>
          <div class="ach-info">
            <div class="ach-title">${ach.title} ${isUnlocked ? '✓' : ''}</div>
            <div class="ach-desc">${ach.desc}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="stats-overview-grid">
        <div class="stat-box">
          <span class="sb-val">${this.data.totalGames}</span>
          <span class="sb-lbl">Total Matches</span>
        </div>
        <div class="stat-box">
          <span class="sb-val">${winRate}%</span>
          <span class="sb-lbl">Win Rate</span>
        </div>
        <div class="stat-box">
          <span class="sb-val">${this.data.currentStreak} 🔥</span>
          <span class="sb-lbl">Current Streak</span>
        </div>
        <div class="stat-box">
          <span class="sb-val">${this.data.bestStreak} 🏆</span>
          <span class="sb-lbl">Best Streak</span>
        </div>
      </div>

      <div class="stats-mode-breakdown">
        <h4>Victories Breakdown</h4>
        <div class="mode-bar"><span>5x5 Battle:</span> <strong>${this.data.gridBattleWins} W</strong></div>
        <div class="mode-bar"><span>75-Ball Caller:</span> <strong>${this.data.callerWins} W</strong></div>
        <div class="mode-bar"><span>90-Ball Housie:</span> <strong>${this.data.housieWins} W</strong></div>
        <div class="mode-bar"><span>Custom Word:</span> <strong>${this.data.customWins} W</strong></div>
      </div>

      <div class="achievements-section">
        <h4>Trophies & Achievements (${this.data.unlockedAchievements.length}/${ACHIEVEMENTS.length})</h4>
        <div class="achievements-grid">
          ${achievementsHtml}
        </div>
      </div>
    `;
  }
}

export const statsManager = new StatsManager();
