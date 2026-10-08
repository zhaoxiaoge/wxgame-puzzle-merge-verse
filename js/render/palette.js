/**
 * 自动取色：从用户图片主色派生整套主题配色
 * 思路：取平均色 → 转 HSL → 按数值等级生成 11 阶牌面色（低阶浅底深字，高阶深底白字+发光）
 */
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s, l: l };
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  function f(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3);
    g = f(p, q, h);
    b = f(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function hex(c) {
  return '#' + [c.r, c.g, c.b].map(function (v) {
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

/**
 * @param avgR/avgG/avgB 图片平均色（0-255）
 * @returns 主题字段对象（不含 id/name/image 等元信息）
 */
function derive(avgR, avgG, avgB) {
  const hsv = rgbToHsl(avgR, avgG, avgB);
  const H = hsv.s < 0.08 ? 220 : hsv.h; // 近灰图片给一个默认蓝调
  const S = hsv.s;
  const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const tiles = {};

  values.forEach(function (v, i) {
    const t = i / (values.length - 1);
    const L = 0.84 - t * 0.4;                          // 0.84 → 0.44
    const SS = clamp(S * 0.5 + 0.28 + t * 0.34, 0, 0.78);
    const HH = H + (t - 0.5) * 26;                     // 色相轻微漂移增加层次
    const base = hslToRgb(HH, SS, L);
    const lum = 0.299 * base.r + 0.587 * base.g + 0.114 * base.b;
    tiles[v] = {
      bg1: hex(hslToRgb(HH, SS, Math.min(L + 0.05, 0.95))),
      bg2: hex(base),
      fg: lum > 168 ? '#4a4238' : '#ffffff',
      label: '',
      glow: t > 0.55 ? (t - 0.55) * 1.2 : 0
    };
  });

  return {
    type: 'custom',
    tileMode: 'number',
    screenBg: [
      hex(hslToRgb(H, Math.min(S, 0.5), 0.14)),
      hex(hslToRgb(H, Math.min(S, 0.5), 0.22))
    ],
    boardBg: hex(hslToRgb(H, Math.min(S * 0.8, 0.45), 0.22)),
    boardBorder: 'rgba(255,255,255,0.14)',
    cellEmpty: 'rgba(255,255,255,0.10)',
    cellCover: 'rgba(10,13,24,0.96)',
    hudText: '#dfe6ff',
    hudPanel: 'rgba(255,255,255,0.10)',
    btnBg: 'rgba(255,255,255,0.14)',
    btnText: '#f0f3ff',
    accent: hex(hslToRgb(H, 0.75, 0.58)),
    overlayPanel: 'rgba(22,28,50,0.97)',
    overlayText: '#eef1ff',
    hint: '滑动合并相同数字 · 冲击 2048',
    winTitle: '🏆 达成 2048！',
    tiles: tiles
  };
}

module.exports = { derive, rgbToHsl, hslToRgb, hex };
