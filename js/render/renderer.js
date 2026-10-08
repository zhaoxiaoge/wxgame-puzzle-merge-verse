/**
 * 渲染工具 + 棋盘/牌面绘制
 * 所有坐标均为逻辑像素（主循环里已按 dpr 缩放）
 * 支持三种主题形态：
 * - 普通主题：纯色/渐变绘制
 * - emoji 主题（tileMode: 'emoji'）：牌面以 emoji 为主、数字为辅
 * - 自定义图片主题：棋盘背景为用户图片；reveal 显影模式下牌面按数值等级逐渐透明
 */
const themeMgr = require('./theme');

const SLIDE_MS = 120;   // 滑动阶段时长
const SETTLE_MS = 150;  // 合并弹出/新牌淡入时长

/* ---------- 缓动与小工具 ---------- */

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function clampV(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/* ---------- 基础图形工具 ---------- */

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, style) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = style;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, style, lineWidth) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth || 1;
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, bold, align, baseline) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = baseline || 'middle';
  ctx.fillText(str, x, y);
}

function drawButton(ctx, btn) {
  const disabled = !!btn.disabled;
  fillRR(
    ctx, btn.x, btn.y, btn.w, btn.h, btn.h / 2,
    disabled ? 'rgba(128,128,128,0.18)' : (btn.bg || 'rgba(255,255,255,0.12)')
  );
  const color = disabled ? 'rgba(255,255,255,0.35)' : (btn.text || '#ffffff');
  const fontSize = btn.fontSize || 15;
  // 可选图标（如激励视频标识）：图标存在则"图标+文字"居中，否则用 prefix 文本兜底
  const icon = (!disabled && btn.iconImg && btn.iconImg.ok) ? btn.iconImg.img : null;
  const label = btn.label || '';
  ctx.font = 'bold ' + fontSize + 'px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const tw = ctx.measureText(label).width;
  const isz = Math.round(fontSize * 1.25);
  const gap2 = Math.round(6);
  const contentW = tw + (icon ? isz + (tw ? gap2 : 0) : 0);
  let sx = btn.x + (btn.w - contentW) / 2;
  const cy = btn.y + btn.h / 2 + 1;
  if (icon) {
    ctx.drawImage(icon, sx, cy - isz / 2, isz, isz);
    sx += isz + gap2;
  }
  ctx.fillText(label, sx, cy);
}

/* ---------- 图标染色（跟随主题色） ---------- */

const tintCache = {};

/**
 * 把透明底 PNG 图标染成指定颜色
 * @param name 缓存键前缀（图标名）
 * @param entry {img, ok} 原图加载项
 * @param color 目标颜色（如主题 btnText）
 * @returns {img, ok} 染色后的可绘制项；原图未就绪返回 null
 */
function getTintedIcon(name, entry, color) {
  if (!entry || !entry.ok) return null;
  const key = name + '|' + color;
  if (tintCache[key]) return tintCache[key];
  const cv = wx.createCanvas();
  cv.width = entry.img.width;
  cv.height = entry.img.height;
  const c = cv.getContext('2d');
  c.drawImage(entry.img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  const out = { img: cv, ok: true };
  tintCache[key] = out;
  return out;
}

function hit(btn, x, y) {
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

/** '#rrggbb' → 'rgba(r,g,b,a)'，用于给主题色做透明变体（边框/滚动条等） */
function hexToRgba(hexStr, alpha) {
  let h = String(hexStr || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(255,255,255,' + (alpha === undefined ? 1 : alpha) + ')';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha === undefined ? 1 : alpha) + ')';
}

/** 图片按 cover 模式绘制进圆角矩形区域 */
function drawImageCover(ctx, img, x, y, w, h, radius) {
  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  const iw = img.width;
  const ih = img.height;
  const sc = Math.max(w / iw, h / ih);
  const dw = iw * sc;
  const dh = ih * sc;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/* ---------- 全屏背景（离屏缓存） ---------- */

let bgCache = null;
let bgKey = '';

function drawScreenBg(ctx, W, H, theme, dpr) {
  // updatedAt 参与缓存键：主题配色更新后背景自动重建（否则同 id 命中旧缓存）
  const key = theme.id + '_' + (theme.updatedAt || 0) + '_' + W + '_' + H;
  if (!bgCache || bgKey !== key) {
    bgCache = buildBg(W, H, theme, dpr || 2);
    bgKey = key;
  }
  ctx.drawImage(bgCache, 0, 0, W, H);
}

function buildBg(W, H, theme, dpr) {
  const cv = wx.createCanvas();
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.screenBg[0]);
  g.addColorStop(1, theme.screenBg[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  if (theme.type === 'gradient' || theme.bgDecor === 'gradient') {
    // 星星：固定种子伪随机，位置稳定不闪烁
    let seed = 7;
    const rnd = function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 110; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const rad = rnd() * 1.3 + 0.4;
      c.globalAlpha = 0.2 + rnd() * 0.6;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // 星云
    const nebulas = [
      { x: 0.22, y: 0.24, r: 0.55, color: 'rgba(90,66,190,0.16)' },
      { x: 0.85, y: 0.62, r: 0.5, color: 'rgba(40,120,190,0.13)' },
      { x: 0.45, y: 1.0, r: 0.55, color: 'rgba(170,80,150,0.10)' }
    ];
    for (let i = 0; i < nebulas.length; i++) {
      const n = nebulas[i];
      const rg = c.createRadialGradient(W * n.x, H * n.y, 0, W * n.x, H * n.y, Math.max(W, H) * n.r);
      rg.addColorStop(0, n.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, H);
    }
  }
  return cv;
}

/* ---------- 棋盘与牌面 ---------- */

function cellRect(layout, r, c) {
  return {
    x: layout.x + layout.gap + c * (layout.cell + layout.gap),
    y: layout.y + layout.gap + r * (layout.cell + layout.gap),
    size: layout.cell
  };
}

function drawTileAtCell(ctx, theme, layout, r, c, value, scale, alpha) {
  const rect = cellRect(layout, r, c);
  drawTileRaw(ctx, theme, rect.x, rect.y, rect.size, value, scale, alpha, layout.cellR);
}

function drawTileRaw(ctx, theme, x, y, size, value, scale, alpha, radius) {
  const st = themeMgr.tileStyle(theme, value);
  if (!st) return;
  const sc = scale || 1;
  const al = alpha === undefined ? 1 : alpha;

  // 图片主题：图片铺满方块 + 底部数字徽章（图片未就绪回退标准牌面）
  if (theme.kind === 'photo') {
    const e = themeMgr.getTileImage(theme, value);
    if (e && e.ok) {
      drawPhotoTile(ctx, x, y, size, value, sc, al, (radius || 8) * sc, e.img, st);
      return;
    }
  }

  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size * sc;
  const tx = cx - s / 2;
  const ty = cy - s / 2;

  ctx.save();

  // 牌面底
  ctx.globalAlpha = al;
  if (st.glow > 0) {
    ctx.shadowColor = st.bg1;
    ctx.shadowBlur = size * 0.35 * st.glow;
  }
  const g = ctx.createLinearGradient(0, ty, 0, ty + s);
  g.addColorStop(0, st.bg1);
  g.addColorStop(1, st.bg2);
  fillRR(ctx, tx, ty, s, s, (radius || 8) * sc, g);
  ctx.shadowBlur = 0;

  if (st.ring) {
    strokeRR(ctx, tx + s * 0.1, ty + s * 0.1, s * 0.8, s * 0.8, (radius || 8) * sc, st.ring, Math.max(1.5, s * 0.03));
  }

  // 文字（始终全不透明）
  ctx.globalAlpha = al;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = st.fg;

  if (theme.kind === 'words' && theme.words && theme.words[value]) {
    // 词条主题：词大字居中（自动缩字号防溢出）+ 数字小字底部
    const word = String(theme.words[value]);
    let wfs = s * 0.32;
    ctx.font = 'bold ' + Math.round(wfs) + 'px sans-serif';
    while (wfs > s * 0.12 && ctx.measureText(word).width > s * 0.86) {
      wfs -= 1;
      ctx.font = 'bold ' + Math.round(wfs) + 'px sans-serif';
    }
    ctx.fillText(word, cx, ty + s * 0.4);
    ctx.font = 'bold ' + Math.round(s * 0.18) + 'px sans-serif';
    ctx.globalAlpha = al * 0.8;
    ctx.fillText(String(value), cx, ty + s * 0.78);
  } else if (theme.tileMode === 'emoji' && st.label) {
    // emoji 主题（果园/喵喵）：大 emoji + 底部小数字
    ctx.font = Math.round(s * 0.44) + 'px sans-serif';
    ctx.fillText(st.label, cx, ty + s * 0.42);
    ctx.font = 'bold ' + Math.round(s * 0.2) + 'px sans-serif';
    ctx.fillText(String(value), cx, ty + s * 0.78);
  } else if (st.label) {
    // 带名称的主题（星宇宙等）：名称居中（自动缩字号）；大格子加底部小数字，小格子只显名称
    let lfs = s * 0.3;
    ctx.font = 'bold ' + Math.round(lfs) + 'px sans-serif';
    while (lfs > s * 0.12 && ctx.measureText(st.label).width > s * 0.86) {
      lfs -= 1;
      ctx.font = 'bold ' + Math.round(lfs) + 'px sans-serif';
    }
    ctx.fillText(st.label, cx, ty + s * (s >= 60 ? 0.4 : 0.5));
    if (s >= 60) {
      ctx.font = 'bold ' + Math.round(s * 0.18) + 'px sans-serif';
      ctx.globalAlpha = al * 0.8;
      ctx.fillText(String(value), cx, ty + s * 0.78);
    }
  } else {
    const str = String(value);
    const digits = str.length;
    const fs = s * (digits <= 2 ? 0.4 : digits === 3 ? 0.34 : digits === 4 ? 0.28 : 0.23);
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.fillText(str, cx, ty + s * 0.52);
  }
  ctx.restore();
}

/** 图片主题的牌面：图片铺满（cover）+ 底部数字徽章（徽章底色沿用该档位牌面配色） */
function drawPhotoTile(ctx, x, y, size, value, sc, al, radius, img, st) {
  const s = size * sc;
  const tx = x + (size - s) / 2;
  const ty = y + (size - s) / 2;
  ctx.save();
  ctx.globalAlpha = al;
  rr(ctx, tx, ty, s, s, radius);
  ctx.clip();
  const iw = img.width;
  const ih = img.height;
  const cs = Math.max(s / iw, s / ih);
  ctx.drawImage(img, tx + (s - iw * cs) / 2, ty + (s - ih * cs) / 2, iw * cs, ih * cs);
  // 底部数字徽章：宽度随数字长度自适应（字号不变）
  const badgeH = s * 0.26;
  ctx.font = 'bold ' + Math.round(badgeH * 0.6) + 'px sans-serif';
  const label = String(value);
  const tw = ctx.measureText(label).width;
  const badgeW = Math.min(s * 0.9, Math.max(s * 0.3, tw + s * 0.16));
  const bx = tx + (s - badgeW) / 2;
  const by = ty + s - badgeH - s * 0.06;
  const g = ctx.createLinearGradient(0, by, 0, by + badgeH);
  g.addColorStop(0, st.bg1);
  g.addColorStop(1, st.bg2);
  fillRR(ctx, bx, by, badgeW, badgeH, badgeH / 2, g);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = st.fg;
  ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2 + 1);
  ctx.restore();
}

function drawBoard(ctx, board, theme, layout, anim) {
  const img = themeMgr.getCustomImage(theme);

  // 面板：自定义主题用图片做棋盘背景（半透明遮罩压暗保证牌面可读）
  if (img) {
    drawImageCover(ctx, img, layout.x, layout.y, layout.size, layout.size, layout.radius);
    fillRR(ctx, layout.x, layout.y, layout.size, layout.size, layout.radius, 'rgba(8,10,22,0.45)');
  } else {
    fillRR(ctx, layout.x, layout.y, layout.size, layout.size, layout.radius, theme.boardBg);
  }
  if (theme.boardBorder && theme.boardBorder !== 'rgba(0,0,0,0)') {
    strokeRR(ctx, layout.x + 0.5, layout.y + 0.5, layout.size - 1, layout.size - 1, layout.radius, theme.boardBorder, 1);
  }

  // 空格
  const emptyStyle = theme.cellEmpty;
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const rect = cellRect(layout, r, c);
      fillRR(ctx, rect.x, rect.y, rect.size, rect.size, layout.cellR, emptyStyle);
    }
  }

  if (!anim) {
    for (const t of board.tiles) {
      drawTileAtCell(ctx, theme, layout, t.r, t.c, t.value, 1, 1);
    }
    return;
  }

  const plan = anim.plan;
  if (anim.phase === 'slide') {
    const k = easeInOutQuad(Math.min(anim.t / SLIDE_MS, 1));
    const skip = {};
    for (const s of plan.slides) skip[s.id] = true;
    for (const m of plan.merges) skip[m.id] = true;
    if (plan.spawned) skip[plan.spawned.id] = true;

    // 未动的牌
    for (const t of board.tiles) {
      if (!skip[t.id]) drawTileAtCell(ctx, theme, layout, t.r, t.c, t.value, 1, 1);
    }
    // 合并目标处先画"被吞"的底牌
    for (const m of plan.merges) {
      drawTileAtCell(ctx, theme, layout, m.r, m.c, m.underValue, 1, 1);
    }
    // 滑动中的牌（含滑向合并点的牌）
    for (const s of plan.slides) {
      const from = cellRect(layout, s.fromR, s.fromC);
      const to = cellRect(layout, s.toR, s.toC);
      const x = from.x + (to.x - from.x) * k;
      const y = from.y + (to.y - from.y) * k;
      drawTileRaw(ctx, theme, x, y, to.size, s.value, 1, 1, layout.cellR);
    }
  } else {
    // settle：合并牌弹出、新牌淡入
    const k = Math.min(anim.t / SETTLE_MS, 1);
    const mergeById = {};
    for (const m of plan.merges) mergeById[m.id] = true;
    for (const t of board.tiles) {
      if (mergeById[t.id]) {
        const scale = 0.7 + 0.3 * easeOutBack(k);
        drawTileAtCell(ctx, theme, layout, t.r, t.c, t.value, scale, 1);
      } else if (plan.spawned && t.id === plan.spawned.id) {
        drawTileAtCell(ctx, theme, layout, t.r, t.c, t.value, 0.6 + 0.4 * k, k);
      } else {
        drawTileAtCell(ctx, theme, layout, t.r, t.c, t.value, 1, 1);
      }
    }
  }
}

module.exports = {
  SLIDE_MS,
  SETTLE_MS,
  rr,
  fillRR,
  strokeRR,
  text,
  drawButton,
  hit,
  hexToRgba,
  getTintedIcon,
  drawImageCover,
  drawScreenBg,
  drawBoard,
  drawTileRaw,
  cellRect
};
