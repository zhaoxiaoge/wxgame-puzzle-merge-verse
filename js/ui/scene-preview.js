/**
 * 主题预览页：展示某主题全部数值牌面（2 → 16384）
 * 自定义主题带图片底板；显影模式下示例牌呈现真实透明梯度
 * 页内可直接「使用此主题」
 */
const themeMgr = require('../render/theme');
const R = require('../render/renderer');

const VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];

class PreviewScene {
  constructor(app) {
    this.app = app;
  }

  enter(params) {
    params = params || {};
    this.theme = themeMgr.get(params.themeId);
    const s = this.s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    const W = this.app.W;
    const H = this.app.H;
    const margin = Math.round(16 * s);
    const gap = Math.round(10 * s);
    const gridTop = this.app.navSafe + Math.round(80 * s);
    const availH = H - gridTop - Math.round(88 * s);
    const cs = Math.min((W - margin * 2 - gap * 3) / 4, (availH - gap * 3) / 4);
    this.grid = {
      cs: cs,
      gap: gap,
      gx: (W - (cs * 4 + gap * 3)) / 2,
      gy: gridTop,
      rows: Math.ceil(VALUES.length / 4)
    };
    this.backBtn = {
      id: 'back', label: '返回',
      x: margin, y: this.app.navSafe,
      w: Math.round(88 * s), h: Math.round(40 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    const bw = Math.round(200 * s);
    this.useBtn = {
      id: 'use', label: '使用此主题',
      x: (W - bw) / 2, y: H - Math.round(64 * s), w: bw, h: Math.round(48 * s),
      bg: this.theme.accent, text: '#1a1a2e', fontSize: Math.round(16 * s)
    };
    this.touch = null;
  }

  isCurrent() {
    return this.theme.id === themeMgr.current().id;
  }

  exit() {}
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
    if (R.hit(this.backBtn, t.clientX, t.clientY)) {
      this.app.switch('themes');
      return;
    }
    if (!this.isCurrent() && R.hit(this.useBtn, t.clientX, t.clientY)) {
      themeMgr.setCurrent(this.theme.id);
      wx.showToast({ title: '已应用「' + this.theme.name + '」', icon: 'none' });
    }
  }

  onTouchCancel() { this.touch = null; }

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    const theme = this.theme;
    R.drawScreenBg(ctx, W, H, theme, this.app.dpr);

    // 返回按钮实时跟随主题配色
    this.backBtn.bg = theme.btnBg;
    this.backBtn.text = theme.btnText;
    R.drawButton(ctx, this.backBtn);
    R.text(ctx, theme.name, W / 2, this.app.navSafe + Math.round(20 * this.s), Math.round(20 * this.s), theme.overlayText || theme.hudText, true);
    if (theme.tagline || theme.desc) {
      R.text(ctx, theme.tagline || theme.desc, W / 2, this.app.navSafe + Math.round(44 * this.s), Math.round(12 * this.s), theme.hudText);
    }

    const g = this.grid;
    const img = themeMgr.getCustomImage(theme);
    const gridW = g.cs * 4 + g.gap * 3;
    const gridH = g.rows * g.cs + (g.rows - 1) * g.gap;
    if (img) {
      // 自定义主题：图片底板（显影模式不压暗，让示例牌呈现真实显影梯度）
      const px = g.gx - 10 * this.s;
      const py = g.gy - 10 * this.s;
      const pw = gridW + 20 * this.s;
      const ph = gridH + 20 * this.s;
      R.drawImageCover(ctx, img, px, py, pw, ph, Math.round(12 * this.s));
      if (!theme.reveal) {
        R.fillRR(ctx, px, py, pw, ph, Math.round(12 * this.s), 'rgba(8,10,22,0.45)');
      }
    }
    for (let i = 0; i < VALUES.length; i++) {
      const cx = g.gx + (i % 4) * (g.cs + g.gap);
      const cy = g.gy + ((i / 4) | 0) * (g.cs + g.gap);
      R.drawTileRaw(ctx, theme, cx, cy, g.cs, VALUES[i], 1, 1, Math.round(10 * this.s));
    }

    if (this.isCurrent()) {
      R.text(ctx, '✓ 当前使用中', W / 2, this.useBtn.y + this.useBtn.h / 2, Math.round(16 * this.s), theme.accent, true);
    } else {
      R.drawButton(ctx, this.useBtn);
    }
  }
}

module.exports = PreviewScene;
