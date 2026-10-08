/**
 * 战绩统计页：核心数据 + 历史最高牌展示
 */
const storage = require('../core/storage');
const themeMgr = require('../render/theme');
const R = require('../render/renderer');

class StatsScene {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.theme = themeMgr.current();
    this.save = storage.loadSave();
    this.ts = this.save.themeStats[this.theme.id] || { best: 0, games: 0, merges: 0, maxTile: 0 };
    const s = this.s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    const W = this.app.W;
    this.margin = Math.round(16 * s);
    this.backBtn = {
      id: 'back', label: '返回菜单',
      x: this.margin, y: this.app.navSafe,
      w: Math.round(88 * s), h: Math.round(40 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    this.touch = null;
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
      this.app.switch('menu');
      return;
    }
  }

  onTouchCancel() { this.touch = null; }

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    R.drawScreenBg(ctx, W, H, this.theme, this.app.dpr);
    this.backBtn.bg = this.theme.btnBg;
    this.backBtn.text = this.theme.btnText;
    R.drawButton(ctx, this.backBtn);
    R.text(ctx, '战绩统计', W / 2, this.app.navSafe + Math.round(20 * this.s), Math.round(20 * this.s), this.theme.hudText, true);
    R.text(ctx, '当前主题 · ' + this.theme.name, W / 2, this.app.navSafe + Math.round(44 * this.s), Math.round(12 * this.s), this.theme.hudText);

    const rows = [
      ['主题最高分', String(this.ts.best || 0)],
      ['主题总局数', String(this.ts.games || 0)],
      ['全局最高分', String(this.save.best || 0)]
    ];
    let y = this.app.navSafe + Math.round(60 * this.s);
    for (const row of rows) {
      R.text(ctx, row[0], this.margin + Math.round(8 * this.s), y + Math.round(22 * this.s), Math.round(15 * this.s), this.theme.hudText, false, 'left');
      R.text(ctx, row[1], W - this.margin - Math.round(8 * this.s), y + Math.round(22 * this.s), Math.round(17 * this.s), this.theme.hudText, true, 'right');
      y += Math.round(44 * this.s);
      ctx.strokeStyle = R.hexToRgba(this.theme.hudText, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.margin, y + 0.5);
      ctx.lineTo(W - this.margin, y + 0.5);
      ctx.stroke();
    }

    // 历史最高牌（用当前主题渲染，直观展示）
    const maxTile = this.ts.maxTile || 0;
    y += Math.round(24 * this.s);
    if (maxTile > 0) {
      const size = Math.round(84 * this.s);
      const tx = (W - size) / 2;
      R.drawTileRaw(ctx, this.theme, tx, y, size, maxTile, 1, 1, Math.round(12 * this.s));
      const st = themeMgr.tileStyle(this.theme, maxTile);
      const label = (st && st.label) ? st.label + ' · ' + maxTile : String(maxTile);
      R.text(ctx, '本主题最高 ' + label, W / 2, y + size + Math.round(26 * this.s), Math.round(13 * this.s), this.theme.hudText);
    } else {
      R.text(ctx, '该主题还没有记录，去玩一局吧', W / 2, y + Math.round(40 * this.s), Math.round(14 * this.s), this.theme.hudText);
    }
  }
}

module.exports = StatsScene;
