/**
 * 游戏场景：HUD + 棋盘 + 动画 + 结算浮层
 * 手感要点：滑动在 touchmove 达到阈值即触发（无需抬手），
 * 动画期间的下一次滑动会被缓冲，动画结束立刻执行。
 */
const { Board } = require('../core/board');
const storage = require('../core/storage');
const themeMgr = require('../render/theme');
const R = require('../render/renderer');
const ads = require('../feature/ads');
const share = require('../feature/share');
const audio = require('../core/audio');
const palette = require('../render/palette');

const POPUP_MS = 600;

/* ---------- 每日挑战：种子随机（mulberry32 + 日期哈希，全网同一天同一序列） ---------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDate(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class GameScene {
  constructor(app) {
    this.app = app;
  }

  enter(params) {
    params = params || {};
    this.theme = themeMgr.current();
    this.settings = storage.loadSettings();
    this.save = storage.loadSave();

    this.board = new Board(4);
    this.score = 0;
    this.over = false;
    this.win = false;
    this.keepPlaying = false;
    this.winShown = false;
    this.anim = null;
    this.pendingDir = null;
    this.undoSnap = null;
    this.undoUsedCount = 0;
    this.removeUsedCount = 0;
    this.reviveUsedCount = 0;
    this.moves = 0;
    this.touch = null;
    this.confirm = null;
    this.undoAfterAnim = false;
    this.removeMode = null;
    this.removeSel = null;
    this.popups = [];

    // 模式：classic 经典（棋局按主题分槽）/ daily 每日挑战（独立槽，固定种子）
    this.getVideoIcon(); // 预加载视频图标：避免首次弹窗时图标延迟出现
    const currents = this.save.currents || {};
    if (params.mode === 'daily') {
      this.mode = 'daily';
      const cur = currents['__daily__'];
      if (cur && cur.date === storage.dateStr(0) && cur.cells && cur.cells.length === 4) {
        this.restoreCurrent(cur);
      } else {
        this.startDaily();
      }
    } else {
      this.mode = 'classic';
      const cur = currents[this.theme.id];
      if (cur && cur.cells && cur.cells.length === 4) {
        this.restoreCurrent(cur);
      } else {
        this.startRound();
      }
    }
    this.computeLayout();
  }

  restoreCurrent(cur) {
    this.board.loadCells(cur.cells);
    this.score = cur.score || 0;
    this.moves = cur.moves || 0;
    this.undoUsedCount = cur.undoUsed || 0;
    this.removeUsedCount = cur.removeUsed || 0;
    this.reviveUsedCount = cur.reviveUsed || 0;
    this.keepPlaying = !!cur.keepPlaying;
    this.winShown = !!cur.winShown;
    if (this.mode === 'daily') {
      // 续玩：重播种并快进随机数流，保证后续发牌与原局一致
      this.board.rng = mulberry32(seedFromDate(storage.dateStr(0)));
      const calls = cur.rngCalls || 0;
      for (let i = 0; i < calls; i++) this.board.rng();
      this.board.rngCalls = calls;
    }
    if (!this.board.hasMoves()) this.over = true;
  }

  /** 每日挑战：以当天日期为种子开局 */
  startDaily() {
    this.board.rng = mulberry32(seedFromDate(storage.dateStr(0)));
    this.board.clear();
    this.board.addRandomTile();
    this.board.addRandomTile();
    this.score = 0;
    this.over = false;
    this.win = false;
    this.keepPlaying = false;
    this.winShown = false;
    this.anim = null;
    this.pendingDir = null;
    this.undoSnap = null;
    this.undoUsedCount = 0;
    this.removeUsedCount = 0;
    this.reviveUsedCount = 0;
    this.moves = 0;
    this.removeMode = null;
    this.removeSel = null;
    this.popups = [];
    // 首次进入每日挑战：弹一次规则说明
    if (!this.save.daily.rulesShown) {
      this.save.daily.rulesShown = true;
      storage.saveSave(this.save);
      wx.showModal({
        title: '每日挑战',
        content: '每天一副固定棋盘，全网玩家相同开局，可多次尝试。合成出 2048 或玩到游戏结束即挑战完成，当日分数取所有局最高分，并记录连胜；中途退出可随时回来续玩。明天来挑战新棋盘吧！',
        showCancel: false,
        confirmText: '开始'
      });
    }
    this.persistCurrent();
  }

  exit() {
    this.persistCurrent();
  }

  startRound() {
    this.mode = 'classic';
    this.board.rng = Math.random;
    this.board.clear();
    this.board.addRandomTile();
    this.board.addRandomTile();
    this.score = 0;
    this.over = false;
    this.win = false;
    this.keepPlaying = false;
    this.winShown = false;
    this.anim = null;
    this.pendingDir = null;
    this.undoSnap = null;
    this.undoUsedCount = 0;
    this.removeUsedCount = 0;
    this.reviveUsedCount = 0;
    this.moves = 0;
    this.removeMode = null;
    this.removeSel = null;
    this.popups = [];
    ads.hideBanner();
    this.persistCurrent();
  }

  computeLayout() {
    const W = this.app.W;
    const H = this.app.H;
    const s = Math.max(0.9, Math.min(W / 390, 1.25));
    const margin = Math.round(16 * s);
    const top = this.app.navSafe;
    const hudY = top + Math.round(6 * s);
    const btnH = Math.round(44 * s);
    const smallH = Math.round(36 * s);
    const row2Y = hudY + btnH + Math.round(10 * s);   // 成绩/最佳面板行
    const row3Y = row2Y + btnH + Math.round(10 * s);  // 撤销/重开按钮行
    const boardY = row3Y + smallH + Math.round(14 * s);
    const boardSize = Math.min(W - margin * 2, H - boardY - Math.round(46 * s));
    const gap = Math.max(5, Math.round(boardSize * 0.024));
    const cell = (boardSize - gap * 5) / 4;
    // 右侧面板组：得分/最高（上排）、成绩/最佳（下排，上下对齐），内容居中
    const panelGap = Math.round(10 * s);
    // 左侧主题面板：正方形，上沿对齐得分、下沿对齐成绩（跨两排面板）
    const themeLabelH = btnH * 2 + panelGap;
    const themeLabelW = themeLabelH;
    const panelW = Math.round((W - margin * 2 - themeLabelW - Math.round(12 * s) - panelGap) / 2);
    const pxRight = W - margin - panelW;
    const pxLeft = pxRight - panelW - panelGap;

    this.s = s;
    this.layout = {
      x: margin, y: boardY, size: boardSize, gap, cell,
      radius: Math.round(12 * s), cellR: Math.round(cell * 0.12)
    };
    const row3Gap = Math.round(10 * s);
    const sideW = Math.round(76 * s);
    if (this.mode === 'daily') {
      // 每日挑战：撤销/消除隐藏，重开保留（可多次尝试，分数取当天最高）
      this.buttons = [
        { id: 'menu', label: '返回菜单', x: margin, y: row3Y, w: sideW, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) },
        { id: 'restart', label: '重开', x: W - margin - sideW, y: row3Y, w: sideW, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) }
      ];
    } else {
      const row3W = Math.round((W - margin * 2 - row3Gap * 3) / 4);
      this.buttons = [
        { id: 'menu', label: '返回菜单', x: margin, y: row3Y, w: row3W, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) },
        { id: 'undo', label: '撤销', x: margin + row3W + row3Gap, y: row3Y, w: row3W, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) },
        { id: 'remove', label: '消除', x: margin + (row3W + row3Gap) * 2, y: row3Y, w: row3W, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) },
        { id: 'restart', label: '重开', x: margin + (row3W + row3Gap) * 3, y: row3Y, w: row3W, h: smallH, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s) }
      ];
    }
    // 主题名文本（原菜单位置，两行自适应不溢出）
    this.themeLabel = { x: margin, y: hudY, w: themeLabelW, h: themeLabelH };
    if (this.mode === 'daily') {
      this.panels = [
        { x: pxLeft, y: hudY, w: panelW, h: btnH, title: '连胜 · 最长 ' + ((this.save.daily && this.save.daily.maxStreak) || 0), kind: 'streak' },
        { x: pxRight, y: hudY, w: panelW, h: btnH, title: '总完成', kind: 'totalDays' },
        { x: pxLeft, y: row2Y, w: panelW, h: btnH, title: '得分', kind: 'score' },
        { x: pxRight, y: row2Y, w: panelW, h: btnH, title: '当日最高', kind: 'dailyBest' }
      ];
    } else {
      this.panels = [
        { x: pxLeft, y: hudY, w: panelW, h: btnH, title: '得分', kind: 'score' },
        { x: pxRight, y: hudY, w: panelW, h: btnH, title: '最高分', kind: 'best' },
        { x: pxLeft, y: row2Y, w: panelW, h: btnH, title: '成绩', kind: 'runMax' },
        { x: pxRight, y: row2Y, w: panelW, h: btnH, title: '最佳', kind: 'bestMax' }
      ];
    }
  }

  /* ---------- 存档 ---------- */

  currentKey() {
    return this.mode === 'daily' ? '__daily__' : this.theme.id;
  }

  /** 当前主题的战绩（懒初始化） */
  themeStat() {
    if (!this.save.themeStats) this.save.themeStats = {};
    const id = this.theme.id;
    if (!this.save.themeStats[id]) {
      this.save.themeStats[id] = { best: 0, games: 0, merges: 0, maxTile: 0 };
    }
    return this.save.themeStats[id];
  }

  persistCurrent() {
    const key = this.currentKey();
    if (this.over) {
      delete this.save.currents[key];
    } else {
      if (!this.save.currents) this.save.currents = {};
      this.save.currents[key] = {
        mode: this.mode || 'classic',
        theme: this.theme.id,
        cells: this.board.serialize(),
        score: this.score,
        moves: this.moves,
        undoUsed: this.undoUsedCount,
        removeUsed: this.removeUsedCount,
        reviveUsed: this.reviveUsedCount,
        keepPlaying: this.keepPlaying,
        winShown: this.winShown,
        date: storage.dateStr(0),
        rngCalls: this.mode === 'daily' ? this.board.rngCalls : 0
      };
    }
    if (this.mode !== 'daily') {
      this.save.best = Math.max(this.save.best || 0, this.score);
      this.themeStat().best = Math.max(this.themeStat().best || 0, this.score);
    }
    storage.saveSave(this.save);
  }

  /* ---------- 输入 ---------- */

  onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    this.touch = { x: t.clientX, y: t.clientY, fired: false };
  }

  onTouchMove(e) {
    if (!this.touch || this.touch.fired) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const dx = t.clientX - this.touch.x;
    const dy = t.clientY - this.touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 28) {
      this.touch.fired = true;
      this.swipe(dx, dy);
    }
  }

  onTouchEnd(e) {
    if (!this.touch) return;
    const t = e.changedTouches && e.changedTouches[0];
    const dx = t ? t.clientX - this.touch.x : 0;
    const dy = t ? t.clientY - this.touch.y : 0;
    const fired = this.touch.fired;
    this.touch = null;
    if (fired) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 28) {
      this.swipe(dx, dy);
      return;
    }
    if (t && Math.abs(dx) < 12 && Math.abs(dy) < 12) this.tap(t.clientX, t.clientY);
  }

  onTouchCancel() { this.touch = null; }

  swipe(dx, dy) {
    if (this.confirm || this.removeMode || this.over || this.win) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    this.applyDir(dir);
  }

  tap(x, y) {
    if (this.confirm) {
      for (const b of this.confirmButtons().buttons) {
        if (!R.hit(b, x, y)) continue;
        const type = this.confirm.type;
        if (b.id === 'cancel') this.confirm = null;
        else if (b.id === 'ok') {
          this.confirm = null;
          this.onConfirmOk(type);
        }
      }
      return;
    }
    if (this.removeMode) {
      this.handleRemoveTap(x, y);
      return;
    }
    if (this.over || this.win) {
      for (const b of this.overlayButtons()) {
        if (!R.hit(b, x, y)) continue;
        if (b.id === 'revive') this.doRevive();
        else if (b.id === 'share') share.shareScore(this.score, this.save.best || 0);
        else if (b.id === 'again') {
          if (this.mode === 'daily') {
            // 每日可多次尝试：重开前入账当前局分数，开新的一局
            this.bankDailyScore();
            this.startDaily();
          } else {
            this.startRound();
          }
        }
        else if (b.id === 'continue') {
          this.win = false;
          this.keepPlaying = true;
          ads.hideBanner();
          this.persistCurrent();
        } else if (b.id === 'menu') this.app.switch('menu');
      }
      return;
    }
    for (const b of this.buttons) {
      if (!R.hit(b, x, y)) continue;
      if (b.id === 'menu') this.app.switch('menu');
      else if (b.id === 'undo') this.openUndoConfirm();
      else if (b.id === 'remove') this.openRemoveConfirm();
      else if (b.id === 'restart') {
        if (this.mode === 'daily') {
          // 当日分数取所有局最高分：重开前先入账当前局分数
          this.bankDailyScore();
          this.startDaily();
        } else {
          this.confirm = { type: 'restart' };
        }
      }
    }
  }

  /* ---------- 游戏流程 ---------- */

  applyDir(dir) {
    if (this.anim) {
      this.pendingDir = dir;
      return;
    }
    const cells = this.board.serialize();
    const res = this.board.move(dir);
    if (!res.moved) return;
    this.moves++;

    this.undoSnap = { cells, score: this.score };
    this.score += res.gained;

    const ts = this.themeStat();
    if (res.plan.merges.length) {
      if (this.mode !== 'daily') this.save.stats.merges += res.plan.merges.length;
      if (this.settings.vibrate) {
        try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* 部分设备不支持 */ }
      }
      let maxMerged = 0;
      for (const m of res.plan.merges) {
        if (m.value > maxMerged) maxMerged = m.value;
        const rect = R.cellRect(this.layout, m.r, m.c);
        this.popups.push({
          x: rect.x + rect.size / 2,
          y: rect.y + rect.size * 0.3,
          text: '+' + m.value,
          t: 0
        });
      }
      audio.play(maxMerged >= 128 ? 'merge-high' : 'merge');
    } else {
      audio.play('move');
    }
    if (this.mode !== 'daily') {
      const prevMax = this.save.stats.maxTile || 0;
      this.save.stats.maxTile = Math.max(prevMax, this.board.maxTile());
      ts.maxTile = Math.max(ts.maxTile || 0, this.board.maxTile());
      this.checkMilestones(prevMax, this.save.stats.maxTile);
      this.save.best = Math.max(this.save.best || 0, this.score);
      ts.best = Math.max(ts.best || 0, this.score);
    }
    storage.saveSave(this.save);

    this.anim = { phase: 'slide', t: 0, plan: res.plan };
  }

  /** 每日挑战完成：合成出 2048 或玩到游戏结束均算；当日重复完成只更新分数 */
  completeDaily() {
    const d = this.save.daily;
    const today = storage.dateStr(0);
    this._prevDailyBest = d.best || 0; // 记录更新前的当日最高（弹窗判断是否刷新纪录）
    if (d.completedDate === today) {
      // 已完成过（2048 后继续玩到结束）：分数取更高值，连胜不动
      d.score = Math.max(d.score || 0, this.score);
      d.best = Math.max(d.best || 0, this.score);
      return;
    }
    d.streak = (d.completedDate === storage.dateStr(-1)) ? (d.streak || 0) + 1 : 1;
    d.completedDate = today;
    d.totalDays = (d.totalDays || 0) + 1; // 累计完成天数（每日首次完成时 +1）
    // 尊重重开时已入账的分数：当日分数取所有局最高分
    d.score = Math.max(d.score || 0, this.score);
    d.best = Math.max(d.best || 0, this.score);
    d.maxStreak = Math.max(d.maxStreak || 0, d.streak);
  }

  /** 重开前入账：当日分数取所有局最高分 */
  bankDailyScore() {
    const d = this.save.daily;
    d.score = Math.max(d.score || 0, this.score);
    d.best = Math.max(d.best || 0, this.score);
  }

  /** 成就里程碑：首次合成 128/512/1024/4096/8192/16384 时提示（2048 由达成弹窗负责） */
  checkMilestones(prev, now) {
    const MILESTONES = [128, 512, 1024, 4096, 8192, 16384];
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      const m = MILESTONES[i];
      if (prev < m && now >= m) {
        const st = themeMgr.tileStyle(this.theme, m);
        const label = (st && st.label) ? st.label + ' ' : '';
        wx.showToast({ title: '🏆 首次合成 ' + label + m + '！', icon: 'none', duration: 2000 });
        audio.play('win');
        return;
      }
    }
  }

  update(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      if (p.t > POPUP_MS) this.popups.splice(i, 1);
    }

    if (!this.anim) return;
    this.anim.t += dt;
    if (this.anim.phase === 'slide' && this.anim.t >= R.SLIDE_MS) {
      this.anim.phase = 'settle';
      this.anim.t = 0;
    } else if (this.anim.phase === 'settle' && this.anim.t >= R.SETTLE_MS) {
      this.anim = null;
      this.afterMove();
    }
  }

  afterMove() {
    // 缓冲的下一次滑动立即执行，保证连滑手感
    if (this.pendingDir) {
      const d = this.pendingDir;
      this.pendingDir = null;
      this.applyDir(d);
      return;
    }
    // 动画期间确认的撤销：动画正常结束后执行（游戏结束/达成弹窗则放弃，复活才是正规续命途径）
    const deferredUndo = this.undoAfterAnim;
    this.undoAfterAnim = false;
    if (!this.keepPlaying && !this.winShown && this.board.maxTile() >= 2048) {
      this.winShown = true;
      this.win = true;
      audio.play('win');
      if (this.mode === 'daily') this.completeDaily(); // 合成出 2048 即完成当日挑战
      this.persistCurrent();
      return;
    }
    if (!this.board.hasMoves()) {
      this.over = true;
      audio.play('over');
      this.save.stats.games += 1;
      if (this.mode !== 'daily') this.themeStat().games += 1;
      if (this.mode === 'daily') this.completeDaily();
      delete this.save.currents[this.currentKey()];
      storage.saveSave(this.save);
      // 结算插屏（每 3 局一次）+ 结算页 Banner
      ads.maybeShowInterstitial(this.save.stats.games);
      ads.showBanner();
    } else {
      this.persistCurrent();
      if (deferredUndo) this.performUndo();
    }
  }

  openUndoConfirm() {
    if (this.over || this.win || this.confirm) return;
    if (!this.undoSnap) return;
    if (this.undoUsedCount >= 3) {
      wx.showToast({ title: '本局撤销次数已用完', icon: 'none' });
      return;
    }
    this.confirm = { type: 'undo' };
  }

  performUndo() {
    if (!this.undoSnap) return;
    if (this.anim) { this.undoAfterAnim = true; return; } // 动画结束后再回退，避免打断动画
    this.board.loadCells(this.undoSnap.cells);
    this.score = this.undoSnap.score;
    this.persistCurrent();
  }

  /** 确认弹窗点击确定：撤销 3 次机会均需观看激励视频（每局上限 3 次） */
  onConfirmOk(type) {
    if (type === 'restart') {
      this.startRound();
      return;
    }
    if (type === 'remove') {
      // 看完广告进入消除模式：点选方块后才真正消耗次数
      ads.showRewarded((ok) => {
        if (!ok) return;
        this.removeMode = { armed: true };
        this.removeSel = null;
      });
      return;
    }
    ads.showRewarded((ok) => {
      if (!ok) return;
      this.undoUsedCount++;
      this.performUndo();
    });
  }

  confirmTexts() {
    const type = this.confirm.type;
    if (type === 'undo') {
      return { title: '撤销', line1: '回到上一步状态', sub: '每局限用3次（已用 ' + this.undoUsedCount + '/3）' };
    }
    if (type === 'remove') {
      return { title: '消除', line1: '选择一个方块将其消除', sub: '每局限用3次（已用 ' + this.removeUsedCount + '/3）' };
    }
    return { title: '重开', line1: '重新开始本局', sub: '当前得分将清零' };
  }

  confirmButtons() {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const pw = Math.round(260 * s);
    const ph = Math.round(260 * s);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const bw = Math.round(110 * s);
    const bh = Math.round(44 * s);
    const by = py + ph - bh - Math.round(24 * s);
    const needAd = this.confirm.type !== 'restart';
    return {
      geometry: { px, py, pw, ph },
      buttons: [
        { id: 'cancel', label: '取消', x: px + Math.round(20 * s), y: by, w: bw, h: bh, bg: 'rgba(128,128,128,0.35)', text: this.theme.overlayText, fontSize: Math.round(15 * s) },
        { id: 'ok', label: '确定', iconImg: needAd ? this.getTintedVideoIcon(this.accentText()) : null, x: px + pw - bw - Math.round(20 * s), y: by, w: bw, h: bh, bg: this.theme.accent, text: this.accentText(), fontSize: Math.round(15 * s) }
      ]
    };
  }

  drawConfirm(ctx) {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const cb = this.confirmButtons();
    const g = cb.geometry;
    ctx.fillStyle = 'rgba(5,7,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    R.fillRR(ctx, g.px, g.py, g.pw, g.ph, Math.round(16 * s), this.theme.overlayPanel);
    const cx = W / 2;
    const t = this.confirmTexts();
    R.text(ctx, t.title, cx, g.py + Math.round(52 * s), Math.round(20 * s), this.theme.overlayText, true);
    R.text(ctx, t.line1, cx, g.py + Math.round(112 * s), Math.round(16 * s), this.theme.overlayText, true);
    R.text(ctx, t.sub, cx, g.py + Math.round(146 * s), Math.round(12 * s), this.theme.hudText);
    R.drawButton(ctx, cb.buttons[0]);
    R.drawButton(ctx, cb.buttons[1]);
  }

  openRemoveConfirm() {
    if (this.over || this.win || this.confirm || this.removeMode) return;
    if (this.removeUsedCount >= 3) {
      wx.showToast({ title: '本局消除次数已用完', icon: 'none' });
      return;
    }
    this.confirm = { type: 'remove' };
  }

  /** 消除模式底部操作按钮 */
  removeActionButtons() {
    const s = this.s;
    const W = this.app.W;
    const bw = Math.round(120 * s);
    const bh = Math.round(36 * s);
    const by = this.layout.y + this.layout.size + Math.round(8 * s);
    const gap = Math.round(16 * s);
    const list = [
      { id: 'cancel', label: '放弃', x: W / 2 - bw - gap / 2, y: by, w: bw, h: bh, bg: 'rgba(128,128,128,0.35)', text: this.theme.overlayText, fontSize: Math.round(14 * s) }
    ];
    if (this.removeSel) {
      list.push({ id: 'ok', label: '确定消除', x: W / 2 + gap / 2, y: by, w: bw, h: bh, bg: this.theme.accent, text: this.accentText(), fontSize: Math.round(14 * s) });
    }
    return list;
  }

  /** 消除模式的点击处理：仅底部按钮与棋盘方块可点，其余被遮罩覆盖 */
  handleRemoveTap(x, y) {
    for (const b of this.removeActionButtons()) {
      if (!R.hit(b, x, y)) continue;
      if (b.id === 'cancel') {
        this.removeMode = null;
        this.removeSel = null;
      } else if (b.id === 'ok') {
        this.performRemove();
      }
      return;
    }
    if (this.anim) return; // 动画结束后再选择
    const L = this.layout;
    const col = Math.floor((x - L.x - L.gap) / (L.cell + L.gap));
    const row = Math.floor((y - L.y - L.gap) / (L.cell + L.gap));
    if (row < 0 || row > 3 || col < 0 || col > 3) return;
    if (this.board.grid[row][col]) {
      this.removeSel = { r: row, c: col };
      audio.play('move');
    }
  }

  performRemove() {
    if (!this.removeSel) return;
    const v = this.board.removeTileAt(this.removeSel.r, this.removeSel.c);
    this.removeSel = null;
    this.removeMode = null;
    if (v) {
      this.removeUsedCount++;
      if (this.settings.vibrate) {
        try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* ignore */ }
      }
      audio.play('merge');
      this.persistCurrent();
    }
  }

  /** 消除模式：棋盘外遮罩 + 顶部提示 + 选中高亮 + 底部操作 */
  drawRemoveMode(ctx) {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const L = this.layout;
    // 遮罩：棋盘区域镂空（四条带），棋盘外不可点击
    ctx.fillStyle = 'rgba(5,7,18,0.72)';
    ctx.fillRect(0, 0, W, L.y);
    ctx.fillRect(0, L.y + L.size, W, H - L.y - L.size);
    ctx.fillRect(0, L.y, L.x, L.size);
    ctx.fillRect(L.x + L.size, L.y, W - L.x - L.size, L.size);
    // 棋盘高亮边框
    R.strokeRR(ctx, L.x - 2, L.y - 2, L.size + 4, L.size + 4, L.radius + 2, this.theme.accent, 2);
    // 顶部提示浮层（盖在变暗的 HUD 上）
    const pw2 = Math.round(230 * s);
    const ph2 = Math.round(36 * s);
    R.fillRR(ctx, (W - pw2) / 2, this.app.navSafe + Math.round(10 * s), pw2, ph2, ph2 / 2, this.theme.overlayPanel);
    R.text(ctx, '点击要消除的方块', W / 2, this.app.navSafe + Math.round(28 * s), Math.round(14 * s), this.theme.overlayText, true);
    // 选中高亮
    if (this.removeSel) {
      const rect = R.cellRect(L, this.removeSel.r, this.removeSel.c);
      R.strokeRR(ctx, rect.x - 2, rect.y - 2, rect.size + 4, rect.size + 4, L.cellR + 2, this.theme.accent, 3);
    }
    // 底部操作按钮
    for (const b of this.removeActionButtons()) R.drawButton(ctx, b);
  }

  /** 主题名排版：面板固定两行高度；含空格强制按空格分两行，无空格单行；字号自适应 */
  themeLabelLayout(ctx, box, name) {
    name = (name || '').trim();
    const key = this.theme.id + '|' + name + '|' + box.w + '|' + box.h;
    if (this._labelCache && this._labelCache.key === key) return this._labelCache;
    const maxF = Math.round(26 * this.s);
    const minF = Math.round(11 * this.s);
    // 含空格 → 按首个空格分两行；无空格且 ≥4 字 → 居中均分两行（不截断数字/字母串）；否则单行
    let lines;
    if (name.indexOf(' ') >= 0) {
      const i = name.indexOf(' ');
      lines = [name.slice(0, i), name.slice(i + 1)];
    } else {
      const chars = Array.from(name);
      if (chars.length >= 4) {
        let cut = Math.ceil(chars.length / 2);
        const isWordChar = (ch) => /[0-9A-Za-z]/.test(ch);
        if (cut < chars.length && isWordChar(chars[cut]) && isWordChar(chars[cut - 1])) {
          let j = cut;
          while (j > 1 && isWordChar(chars[j - 1])) { j--; }
          cut = j;
        }
        lines = [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
      } else {
        lines = [name];
      }
    }
    // 字体自适应：每行宽度不超面板 + 总高不超面板
    let chosen = { fontSize: minF, lines };
    for (let f = maxF; f >= minF; f--) {
      ctx.font = 'bold ' + f + 'px sans-serif';
      let ok = true;
      for (const line of lines) {
        if (ctx.measureText(line).width > box.w) { ok = false; break; }
      }
      if (!ok) continue;
      if (lines.length * f * 1.2 > box.h * 0.92) continue;
      chosen = { fontSize: f, lines };
      break;
    }
    // 兜底：最小字号仍超宽的行按字硬拆
    ctx.font = 'bold ' + minF + 'px sans-serif';
    const finalLines = [];
    for (const line of chosen.lines) {
      if (ctx.measureText(line).width <= box.w) { finalLines.push(line); continue; }
      let cur = '';
      for (const ch of line) {
        if (cur && ctx.measureText(cur + ch).width > box.w) { finalLines.push(cur); cur = ch; }
        else { cur += ch; }
      }
      if (cur) finalLines.push(cur);
    }
    chosen = { fontSize: chosen.fontSize, lines: finalLines };
    chosen.key = key;
    this._labelCache = chosen;
    return chosen;
  }

  drawThemeLabel(ctx, box) {
    // 每日挑战模式：面板显示「每日挑战」而非主题名
    const name = this.mode === 'daily' ? '每日挑战' : this.theme.name;
    const lay = this.themeLabelLayout(ctx, box, name);
    // 文本框背景跟随主题（与得分面板同款）
    R.fillRR(ctx, box.x, box.y, box.w, box.h, Math.round(10 * this.s), this.theme.hudPanel);
    ctx.font = 'bold ' + lay.fontSize + 'px sans-serif';
    ctx.fillStyle = this.theme.hudText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = lay.fontSize * 1.2;
    const totalH = lay.lines.length * lh;
    let ly = box.y + (box.h - totalH) / 2 + lh / 2;
    const cx = box.x + box.w / 2;
    for (const line of lay.lines) {
      ctx.fillText(line, cx, ly);
      ly += lh;
    }
  }

  hasLowTiles() {
    for (const t of this.board.tiles) {
      if (t.value <= 4) return true;
    }
    return false;
  }

  /** 数值 → 当前主题的天体名（无命名的主题显示数字） */
  tileName(v) {
    if (!v) return '—';
    const st = themeMgr.tileStyle(this.theme, v);
    return (st && st.label) ? st.label : String(v);
  }

  /** 超宽文本用省略号截断（调用前需先设置 ctx.font） */
  truncateText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0;
    let hi = text.length;
    let cut = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) { cut = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    return text.slice(0, cut) + '…';
  }

  /** 激励视频标识图标（images/ 目录随包分发） */
  getVideoIcon() {
    if (!this._videoIcon) {
      const img = wx.createImage();
      const entry = { img, ok: false };
      this._videoIcon = entry;
      img.onload = function () { entry.ok = true; };
      img.onerror = function () { entry.ok = false; };
      img.src = 'images/video-icon.png';
    }
    return this._videoIcon;
  }

  /** 确定/取消按钮文字与图标颜色：彩色背景一律白色，接近白色/浅灰才用深色 */
  accentText() {
    let h = String(this.theme.accent || '#f4c542').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    const hsv = palette.rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
    // 太浅（l>0.8）或无彩度的浅灰（s<0.15 且 l>0.55）→ 深色；其余彩色背景 → 白色
    const tooLight = hsv.l > 0.8 || (hsv.s < 0.15 && hsv.l > 0.55);
    return tooLight ? '#1a1a2e' : '#ffffff';
  }

  /** 视频图标染成指定颜色（染色逻辑在 renderer 共用） */
  getTintedVideoIcon(color) {
    return R.getTintedIcon('video', this.getVideoIcon(), color);
  }

  doRevive() {
    if (!this.over || this.reviveUsedCount >= 3 || this.anim) return;
    if (!this.hasLowTiles()) return; // 没有低阶牌可清，不消耗复活
    // 激励视频复活（开发模式无广告位时直接发放）
    ads.showRewarded((ok) => {
      if (!ok) return;
      const cells = this.board.serialize();
      let cleared = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (cells[r][c] === 2 || cells[r][c] === 4) {
            cells[r][c] = 0;
            cleared++;
          }
        }
      }
      if (cleared === 0) return;
      this.reviveUsedCount++;
      this.board.loadCells(cells);
      this.board.addRandomTile();
      this.over = false;
      ads.hideBanner();
      this.persistCurrent();
    });
  }

  /* ---------- 浮层 ---------- */

  overlayButtons() {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const pw = W - Math.round(72 * s);
    const contentW = pw - Math.round(48 * s); // 面板内左右各留 24
    const h = Math.round(48 * s);
    const gap = Math.round(12 * s);
    // 全宽按钮：复活（变现位，最前）/ 分享
    const stacked = [];
    if (this.over) {
      if (this.mode !== 'daily' && this.reviveUsedCount < 3 && this.hasLowTiles()) stacked.push({ id: 'revive', label: '复活 · 清除 2 和 4', iconImg: this.getTintedVideoIcon(this.theme.btnText) });
      stacked.push({ id: 'share', label: '分享战绩' });
    } else {
      stacked.push({ id: 'share', label: '分享战绩' });
    }
    // 面板高度随内容自适应
    const ph = Math.round(150 * s) + stacked.length * (h + gap) + h + Math.round(24 * s);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    let y = py + Math.round(150 * s);
    for (const it of stacked) {
      it.x = px + Math.round(24 * s);
      it.y = y;
      it.w = contentW;
      it.h = h;
      it.bg = this.theme.btnBg;
      it.text = this.theme.btnText;
      it.fontSize = Math.round(16 * s);
      y += h + gap;
    }
    // 底部行：左弱（返回菜单/暂离，幽灵描边）右强（核心动作，accent）
    y += Math.round(12 * s); // 与上方按钮拉开分组间距（总间隔 24）
    const menuW = Math.round((contentW - gap) / 2);
    const mainW = contentW - menuW - gap;
    stacked.push({ id: 'menu', label: this.over ? '返回菜单' : '暂离', x: px + Math.round(24 * s), y: y, w: menuW, h: h, bg: 'rgba(0,0,0,0)', ghost: true, text: this.theme.hudText, fontSize: Math.round(14 * s) });
    stacked.push({ id: this.over ? 'again' : 'continue', label: this.over ? '再来一局' : '继续挑战', x: px + Math.round(24 * s) + menuW + gap, y: y, w: mainW, h: h, bg: this.theme.accent, text: '#1a1a2e', fontSize: Math.round(16 * s) });
    this._overlayGeom = { px, py, pw, ph };
    return stacked;
  }

  drawOverlayBase(ctx, title, subtitle, celebrate) {
    const s = this.s;
    const W = this.app.W;
    ctx.fillStyle = 'rgba(5,7,18,0.72)';
    ctx.fillRect(0, 0, W, this.app.H);
    const buttons = this.overlayButtons(); // 内部计算并缓存面板几何（高度随内容自适应）
    const g = this._overlayGeom;
    R.fillRR(ctx, g.px, g.py, g.pw, g.ph, Math.round(20 * s), this.theme.overlayPanel);
    if (celebrate) R.strokeRR(ctx, g.px + 1, g.py + 1, g.pw - 2, g.ph - 2, Math.round(20 * s), this.theme.accent, 2);
    R.text(ctx, title, W / 2, g.py + Math.round(64 * s), Math.round(26 * s), celebrate ? '#f4c542' : this.theme.overlayText, true);
    R.text(ctx, subtitle, W / 2, g.py + Math.round(106 * s), Math.round(14 * s), this.theme.hudText);
    for (const b of buttons) {
      R.drawButton(ctx, b);
      if (b.ghost) R.strokeRR(ctx, b.x, b.y, b.w, b.h, b.h / 2, R.hexToRgba(this.theme.hudText, 0.4), 1);
    }
  }

  /* ---------- 渲染 ---------- */

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    R.drawScreenBg(ctx, W, H, this.theme, this.app.dpr);

    // HUD 按钮
    // 视觉状态只看次数：滑动动画期间按钮保持稳定，不闪烁
    const undoDisabled = !this.undoSnap || this.undoUsedCount >= 3;
    const removeDisabled = this.removeUsedCount >= 3;
    for (const b of this.buttons) {
      b.disabled = b.id === 'undo'
        ? undoDisabled
        : (b.id === 'remove' ? removeDisabled : false);
      R.drawButton(ctx, b);
    }
    // 主题名（原菜单位置，两行自适应不溢出）
    this.drawThemeLabel(ctx, this.themeLabel);
    // 数据面板：得分/最高/成绩/最佳（内容居中，上下两排对齐）
    for (const p of this.panels) {
      R.fillRR(ctx, p.x, p.y, p.w, p.h, 10, this.theme.hudPanel);
      // 连胜面板的标题动态计算：局内完成挑战（连胜+1）后立即刷新，不等重进
      const ptitle = p.kind === 'streak' ? ('连胜 · 最长 ' + ((this.save.daily && this.save.daily.maxStreak) || 0)) : p.title;
      R.text(ctx, ptitle, p.x + p.w / 2, p.y + p.h * 0.26, Math.round(11 * this.s), this.theme.hudText);
      const daily = this.save.daily || {};
      const ts = this.themeStat();
      let val;
      if (p.kind === 'score') val = String(this.score);
      else if (p.kind === 'best') val = String(ts.best || 0);
      else if (p.kind === 'dailyBest') val = String(daily.best || 0);
      else if (p.kind === 'streak') val = (daily.streak || 0) + ' 天';
      else if (p.kind === 'totalDays') val = (daily.totalDays || 0) + ' 天';
      else if (p.kind === 'runMax') val = this.tileName(this.board.maxTile());
      else val = this.tileName(ts.maxTile || 0);
      const vs = (p.kind === 'score' || p.kind === 'best')
        ? Math.round(18 * this.s)
        : Math.round(14 * this.s);
      R.text(ctx, val, p.x + p.w / 2, p.y + p.h * 0.66, vs, this.theme.hudText, true);
    }

    R.drawBoard(ctx, this.board, this.theme, this.layout, this.anim);

    // 合并飘字
    for (const p of this.popups) {
      const k = p.t / POPUP_MS;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      R.text(ctx, p.text, p.x, p.y - 30 * this.s * k, Math.round(16 * this.s), this.theme.accent, true);
      ctx.restore();
    }

    // 棋盘下数据行：主题提示（左，超宽省略号截断不换行）+ 步数（右，完整显示）
    if (!this.removeMode) {
      const fs = Math.round(12 * this.s);
      const margin = Math.round(16 * this.s);
      const y = this.layout.y + this.layout.size + 24 * this.s;
      ctx.font = fs + 'px sans-serif';
      const movesText = '步数 ' + this.moves;
      const mw = ctx.measureText(movesText).width;
      const hintFull = this.mode === 'daily'
        ? (this.save.daily && this.save.daily.completedDate === storage.dateStr(0)
          ? '今日已完成 ✓ 继续冲击更高分'
          : '每日挑战 ' + storage.cnDate(0) + ' · 合成2048或玩到结束即挑战完成')
        : (this.theme.hint || '滑动合并相同数字 · 冲击 2048');
      const maxHintW = W - margin * 2 - mw - Math.round(16 * this.s);
      if (maxHintW > 0) {
        const hint = this.truncateText(ctx, hintFull, maxHintW);
        R.text(ctx, hint, margin, y, fs, this.theme.hudText, false, 'left');
      }
      R.text(ctx, movesText, W - margin, y, fs, this.theme.hudText, false, 'right');
    }

    if (this.over) {
      const streakN = (this.save.daily && this.save.daily.streak) || 1;
      const ms = [3, 7, 14, 30].indexOf(streakN) >= 0 ? ' 🎉' : '';
      if (this.mode === 'daily') {
        const record = this.score > 0 && this.score > (this._prevDailyBest || 0) ? ' · 刷新当日最高！' : '';
        this.drawOverlayBase(ctx, '挑战完成', '本局 ' + this.score + ' 分 · 连胜 ' + streakN + ' 天' + ms + record, true);
      } else {
        this.drawOverlayBase(ctx, '游戏结束', '本局 ' + this.score + ' 分 · 最高 ' + (this.themeStat().best || 0) + ' 分');
      }
    } else if (this.win) {
      if (this.mode === 'daily') {
        const streakN = (this.save.daily && this.save.daily.streak) || 1;
        const ms = [3, 7, 14, 30].indexOf(streakN) >= 0 ? ' 🎉' : '';
        const record = this.score > (this._prevDailyBest || 0) ? ' · 刷新当日最高！' : '';
        this.drawOverlayBase(ctx, '挑战完成', '🏆 恭喜达成 2048！ · 本局 ' + this.score + ' 分 · 连胜 ' + streakN + ' 天' + ms + record, true);
      } else {
        this.drawOverlayBase(ctx, this.theme.winTitle || '🏆 达成 2048！', '你合成了 2048 · 继续冲击更高分', true);
      }
    }

    if (this.confirm) this.drawConfirm(ctx);
    if (this.removeMode) this.drawRemoveMode(ctx);
  }
}

module.exports = GameScene;
