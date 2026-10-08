/**
 * 菜单场景
 */
const storage = require('../core/storage');
const themeMgr = require('../render/theme');
const R = require('../render/renderer');
const ads = require('../feature/ads');

class MenuScene {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.theme = themeMgr.current();
    this.save = storage.loadSave();
    const s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    this.s = s;
    const W = this.app.W;
    const bw = Math.round(210 * s);
    const bh = Math.round(56 * s);
    this.startBtn = {
      id: 'start', label: '开 始 游 戏',
      x: (W - bw) / 2, y: this.app.H * 0.48, w: bw, h: bh,
      bg: this.theme.accent, text: '#1a1a2e', fontSize: Math.round(18 * s)
    };
    this.themeBtn = {
      id: 'theme', label: '主题：' + this.theme.name,
      x: (W - bw) / 2, y: this.startBtn.y + bh + Math.round(14 * s),
      w: bw, h: Math.round(42 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    const daily = this.save.daily || {};
    const dailyDone = daily.completedDate === storage.dateStr(0);
    this.dailyDone = dailyDone;
    // 热度显示：连胜 ≥ 2 才显示；未完成时显示截止昨天的连胜（提醒今天别断）
    let heatStreak = 0;
    if (dailyDone) {
      heatStreak = daily.streak || 1;
    } else if (daily.completedDate === storage.dateStr(-1)) {
      heatStreak = daily.streak || 0; // 截止昨天的连胜
    }
    let dailyLabel;
    if (dailyDone) {
      dailyLabel = heatStreak >= 2 ? '每日挑战 · 已完成 · ' + heatStreak + '🔥' : '每日挑战 · 已完成';
    } else {
      dailyLabel = heatStreak >= 2 ? '每日挑战 · 未完成 · ' + heatStreak + '🔥' : '每日挑战 · 未完成';
    }
    this.dailyBtn = {
      id: 'daily',
      label: dailyLabel,
      x: (W - bw) / 2, y: this.themeBtn.y + Math.round(56 * s),
      w: bw, h: Math.round(42 * s),
      bg: this.theme.accent,
      text: '#1a1a2e',
      fontSize: Math.round(14 * s)
    };
    this.statsBtn = {
      id: 'stats', label: '战绩统计',
      x: (W - bw) / 2, y: this.dailyBtn.y + Math.round(54 * s),
      w: bw, h: Math.round(38 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    this.settings = storage.loadSettings();
    this.soundBtn = {
      id: 'sound', iconImg: null,
      x: Math.round(16 * s), y: this.app.navSafe,
      w: Math.round(44 * s), h: Math.round(40 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(18 * s)
    };
    this.touch = null;
    ads.showBanner();
  }

  /** 加载 images/ 下的图标（voice / mute） */
  getIcon(name) {
    if (!this._icons) this._icons = {};
    if (!this._icons[name]) {
      const img = wx.createImage();
      const entry = { img, ok: false };
      img.onload = function () { entry.ok = true; };
      img.onerror = function () { entry.ok = false; };
      img.src = 'images/' + name + '-icon.png';
      this._icons[name] = entry;
    }
    return this._icons[name];
  }

  exit() {
    ads.hideBanner();
  }

  update() {}

  onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (t) this.touch = { x: t.clientX, y: t.clientY };
  }

  onTouchMove() {}

  onTouchEnd(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || !this.touch) return;
    const moved = Math.abs(t.clientX - this.touch.x) >= 12 || Math.abs(t.clientY - this.touch.y) >= 12;
    this.touch = null;
    if (moved) return;
    if (R.hit(this.startBtn, t.clientX, t.clientY)) {
      this.app.switch('game');
    } else if (R.hit(this.themeBtn, t.clientX, t.clientY)) {
      this.app.switch('themes');
    } else if (R.hit(this.dailyBtn, t.clientX, t.clientY)) {
      // 已完成也可进入玩新一局，当日分数取所有局的最高分
      this.app.switch('game', { mode: 'daily' });
    } else if (R.hit(this.statsBtn, t.clientX, t.clientY)) {
      this.app.switch('stats');
    } else if (R.hit(this.soundBtn, t.clientX, t.clientY)) {
      this.settings.sound = !this.settings.sound;
      storage.saveSettings(this.settings);
    }
  }

  onTouchCancel() { this.touch = null; }

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    R.drawScreenBg(ctx, W, H, this.theme, this.app.dpr);

    // 标题（辉光颜色跟随主题 accent，文字用 overlayText 保证浅色主题下可读）
    ctx.save();
    ctx.shadowColor = this.theme.accent;
    ctx.shadowBlur = 18;
    R.text(ctx, '益智合成小宇宙', W / 2, H * 0.3, Math.round(32 * this.s), this.theme.overlayText, true);
    ctx.restore();

    R.text(
      ctx, this.theme.tagline || '合成星尘 · 点亮你的小宇宙',
      W / 2, H * 0.3 + Math.round(34 * this.s), Math.round(14 * this.s), this.theme.hudText
    );

    R.drawButton(ctx, this.startBtn);
    R.drawButton(ctx, this.themeBtn);
    R.drawButton(ctx, this.dailyBtn);
    if (this.dailyDone) {
      // 已完成徽章：右上角金色 ✓ 点缀（状态用小面积点缀色表达，主色恒定）
      const cx = this.dailyBtn.x + this.dailyBtn.w - Math.round(10 * this.s);
      const cy = this.dailyBtn.y + Math.round(10 * this.s);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.round(10 * this.s), 0, Math.PI * 2);
      ctx.fillStyle = '#f4c542';
      ctx.fill();
      R.text(ctx, '✓', cx, cy + 1, Math.round(12 * this.s), '#1a1a2e', true);
    }
    R.drawButton(ctx, this.statsBtn);
    // 声音/静音图标（染色跟随主题文字色）
    const soundIconName = this.settings.sound ? 'voice' : 'mute';
    this.soundBtn.iconImg = R.getTintedIcon(soundIconName, this.getIcon(soundIconName), this.theme.btnText);
    R.drawButton(ctx, this.soundBtn);

    R.text(
      ctx, '最高分 ' + (this.save.best || 0),
      W / 2, this.statsBtn.y + this.statsBtn.h + Math.round(26 * this.s),
      Math.round(14 * this.s), this.theme.hudText, true
    );
  }
}

module.exports = MenuScene;
