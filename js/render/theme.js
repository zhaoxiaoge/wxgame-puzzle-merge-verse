/**
 * 主题系统：内置主题 + 自定义主题（玩家上传图片，自动取色派生配色）
 * - tileMode: 'number' 数字为主 / 'emoji' emoji 为主
 * - reveal: 显影模式（仅自定义主题）：牌面数值越高越透明，逐步"显影"出图片
 * - 自定义主题图片存于 USER_DATA_PATH/themes/，元信息存 mv_themes_v1
 */
const storage = require('../core/storage');

const THEMES = {
  cosmos: {
    id: 'cosmos',
    name: '星宇宙',
    desc: '一粒星尘到深空黑洞的天体进化',
    hint: '滑动合并同值天体 · 冲击 2048 黑洞',
    winTitle: '🏆 达成黑洞！',
    tagline: '合成星尘 · 点亮你的小宇宙',
    type: 'gradient',
    tileMode: 'number',
    screenBg: ['#0b1026', '#1b2447'],
    boardBg: '#161e3a',
    boardBorder: 'rgba(140,160,255,0.18)',
    cellEmpty: 'rgba(255,255,255,0.07)',
    hudText: '#cdd6ff',
    hudPanel: 'rgba(255,255,255,0.08)',
    btnBg: 'rgba(255,255,255,0.12)',
    btnText: '#e8edff',
    accent: '#f4c542',
    overlayPanel: 'rgba(26,34,62,0.97)',
    overlayText: '#e8edff',
    tiles: {
      2: { bg1: '#55618c', bg2: '#414c73', fg: '#e8edff', label: '星尘', glow: 0 },
      4: { bg1: '#5d6fa8', bg2: '#4a5a8f', fg: '#eef2ff', label: '流星', glow: 0 },
      8: { bg1: '#6f8ac2', bg2: '#5a74b0', fg: '#f2f5ff', label: '陨石', glow: 0 },
      16: { bg1: '#8fa7d8', bg2: '#7a92c6', fg: '#ffffff', label: '月球', glow: 0 },
      32: { bg1: '#4fb3a9', bg2: '#3a9a92', fg: '#ffffff', label: '行星', glow: 0 },
      64: { bg1: '#e0a458', bg2: '#c98a3e', fg: '#fff8ec', label: '气态巨星', glow: 0 },
      128: { bg1: '#f4c542', bg2: '#e0a92e', fg: '#7a5b00', label: '恒星', glow: 0.35 },
      256: { bg1: '#ef6f4c', bg2: '#d9542f', fg: '#fff1ec', label: '红巨星', glow: 0.45 },
      512: { bg1: '#f25d9c', bg2: '#dd3f80', fg: '#fff0f7', label: '超新星', glow: 0.55 },
      1024: { bg1: '#a06bf5', bg2: '#8449e0', fg: '#f8f2ff', label: '星系', glow: 0.65 },
      2048: { bg1: '#3a3556', bg2: '#171526', fg: '#c9b6ff', label: '黑洞', glow: 0.8, ring: '#9d5cff' },
      4096: { bg1: '#5ce1e6', bg2: '#3aa7f5', fg: '#063a4a', label: '宇宙', glow: 1 },
      8192: { bg1: '#f472b6', bg2: '#db2777', fg: '#ffffff', label: '多重宇宙', glow: 1 },
      16384: { bg1: '#c7d2fe', bg2: '#6366f1', fg: '#ffffff', label: '奇点', glow: 1, ring: '#e0e7ff' }
    }
  },
  classic: {
    id: 'classic',
    name: '经典 2048',
    desc: '2048 的本来面目',
    hint: '滑动合并相同数字 · 冲击 2048',
    winTitle: '🏆 达成 2048！',
    tagline: '少即是多 · 经典永流传',
    type: 'solid',
    tileMode: 'number',
    screenBg: ['#faf8ef', '#faf8ef'],
    boardBg: '#bbada0',
    boardBorder: 'rgba(0,0,0,0)',
    cellEmpty: 'rgba(238,228,218,0.35)',
    hudText: '#776e65',
    hudPanel: 'rgba(187,173,160,0.35)',
    btnBg: '#8f7a66',
    btnText: '#f9f6f2',
    accent: '#edc22e',
    overlayPanel: 'rgba(250,248,239,0.98)',
    overlayText: '#776e65',
    tiles: {
      2: { bg1: '#eee4da', bg2: '#eee4da', fg: '#776e65', label: '', glow: 0 },
      4: { bg1: '#ede0c8', bg2: '#ede0c8', fg: '#776e65', label: '', glow: 0 },
      8: { bg1: '#f2b179', bg2: '#f2b179', fg: '#f9f6f2', label: '', glow: 0 },
      16: { bg1: '#f59563', bg2: '#f59563', fg: '#f9f6f2', label: '', glow: 0 },
      32: { bg1: '#f67c5f', bg2: '#f67c5f', fg: '#f9f6f2', label: '', glow: 0 },
      64: { bg1: '#f65e3b', bg2: '#f65e3b', fg: '#f9f6f2', label: '', glow: 0 },
      128: { bg1: '#edcf72', bg2: '#edcf72', fg: '#f9f6f2', label: '', glow: 0.25 },
      256: { bg1: '#edcc61', bg2: '#edcc61', fg: '#f9f6f2', label: '', glow: 0.35 },
      512: { bg1: '#edc850', bg2: '#edc850', fg: '#f9f6f2', label: '', glow: 0.45 },
      1024: { bg1: '#edc53f', bg2: '#edc53f', fg: '#f9f6f2', label: '', glow: 0.55 },
      2048: { bg1: '#edc22e', bg2: '#edc22e', fg: '#f9f6f2', label: '', glow: 0.65 },
      4096: { bg1: '#3c3a32', bg2: '#3c3a32', fg: '#f9f6f2', label: '', glow: 0.7 },
      8192: { bg1: '#2c2a26', bg2: '#2c2a26', fg: '#f9f6f2', label: '', glow: 0.75 },
      16384: { bg1: '#1f1e1a', bg2: '#1f1e1a', fg: '#f9f6f2', label: '', glow: 0.8 }
    }
  },
  orchard: {
    id: 'orchard',
    name: '果园',
    desc: '从一颗番茄，种出一座果园',
    hint: '滑动合并相同果蔬 · 目标 2048 西瓜',
    winTitle: '🏆 合成 2048 西瓜！',
    tagline: '合成果实 · 收获整片果园',
    type: 'solid',
    tileMode: 'emoji',
    screenBg: ['#f0f7e8', '#f0f7e8'],
    boardBg: '#c8dfa8',
    boardBorder: 'rgba(0,0,0,0)',
    cellEmpty: 'rgba(255,255,255,0.45)',
    hudText: '#5a6b3f',
    hudPanel: 'rgba(255,255,255,0.5)',
    btnBg: '#7fa055',
    btnText: '#ffffff',
    accent: '#e85d3a',
    overlayPanel: 'rgba(250,252,244,0.98)',
    overlayText: '#5a6b3f',
    tiles: {
      2: { bg1: '#d8efc0', bg2: '#d8efc0', fg: '#44522c', label: '🍅', glow: 0 },
      4: { bg1: '#cfe9b2', bg2: '#cfe9b2', fg: '#44522c', label: '🍓', glow: 0 },
      8: { bg1: '#c2e2a0', bg2: '#c2e2a0', fg: '#3d4a27', label: '🍋', glow: 0 },
      16: { bg1: '#b0d68a', bg2: '#b0d68a', fg: '#35421f', label: '🍊', glow: 0 },
      32: { bg1: '#9cc874', bg2: '#9cc874', fg: '#2f3b1c', label: '🍎', glow: 0 },
      64: { bg1: '#85b95e', bg2: '#85b95e', fg: '#ffffff', label: '🍐', glow: 0 },
      128: { bg1: '#6ca344', bg2: '#6ca344', fg: '#ffffff', label: '🍑', glow: 0 },
      256: { bg1: '#558d31', bg2: '#558d31', fg: '#ffffff', label: '🍍', glow: 0 },
      512: { bg1: '#47762a', bg2: '#47762a', fg: '#ffffff', label: '🥝', glow: 0 },
      1024: { bg1: '#3a6122', bg2: '#3a6122', fg: '#ffffff', label: '🍇', glow: 0 },
      2048: { bg1: '#2d4d1b', bg2: '#2d4d1b', fg: '#ffffff', label: '🍉', glow: 0.3 },
      4096: { bg1: '#233d14', bg2: '#233d14', fg: '#ffffff', label: '🧺', glow: 0.4 },
      8192: { bg1: '#1b3310', bg2: '#1b3310', fg: '#ffffff', label: '🌳', glow: 0.45 },
      16384: { bg1: '#132509', bg2: '#132509', fg: '#ffffff', label: '🏆', glow: 0.5 }
    }
  },
  kitty: {
    id: 'kitty',
    name: '喵喵',
    desc: '从一颗蛋，孵出猫大王',
    hint: '滑动合并相同猫咪 · 目标 2048 猫大王',
    winTitle: '🏆 猫大王诞生！',
    tagline: '喵星人养成计划 · 喵～',
    type: 'solid',
    tileMode: 'emoji',
    screenBg: ['#fdf3ec', '#fdf3ec'],
    boardBg: '#f4d9c8',
    boardBorder: 'rgba(0,0,0,0)',
    cellEmpty: 'rgba(255,255,255,0.5)',
    hudText: '#8a5a44',
    hudPanel: 'rgba(255,255,255,0.55)',
    btnBg: '#e8a87c',
    btnText: '#ffffff',
    accent: '#f08a5d',
    overlayPanel: 'rgba(253,243,236,0.98)',
    overlayText: '#8a5a44',
    tiles: {
      2: { bg1: '#fbe8dc', bg2: '#fbe8dc', fg: '#6b4030', label: '🥚', glow: 0 },
      4: { bg1: '#f8dcc8', bg2: '#f8dcc8', fg: '#6b4030', label: '🐾', glow: 0 },
      8: { bg1: '#f5cfb2', bg2: '#f5cfb2', fg: '#6b4030', label: '🐱', glow: 0 },
      16: { bg1: '#f2c19c', bg2: '#f2c19c', fg: '#6b4030', label: '🐈', glow: 0 },
      32: { bg1: '#eeb285', bg2: '#eeb285', fg: '#5a2f1e', label: '😺', glow: 0 },
      64: { bg1: '#e8a271', bg2: '#e8a271', fg: '#5a2f1e', label: '🐯', glow: 0 },
      128: { bg1: '#e0915f', bg2: '#e0915f', fg: '#4a2415', label: '🦁', glow: 0 },
      256: { bg1: '#d67f4e', bg2: '#d67f4e', fg: '#ffffff', label: '🐆', glow: 0 },
      512: { bg1: '#ca6c3f', bg2: '#ca6c3f', fg: '#ffffff', label: '😼', glow: 0 },
      1024: { bg1: '#b95a35', bg2: '#b95a35', fg: '#ffffff', label: '😻', glow: 0 },
      2048: { bg1: '#a4492c', bg2: '#a4492c', fg: '#ffffff', label: '👑', glow: 0.3 },
      4096: { bg1: '#8f3a24', bg2: '#8f3a24', fg: '#ffffff', label: '💫', glow: 0.4 },
      8192: { bg1: '#7c2d12', bg2: '#7c2d12', fg: '#ffffff', label: '🪐', glow: 0.45 },
      16384: { bg1: '#631a0b', bg2: '#631a0b', fg: '#ffffff', label: '🏆', glow: 0.5 }
    }
  },
  mono: {
    id: 'mono',
    name: '极简暗黑',
    desc: '纯灰阶 · OLED 友好',
    hint: '滑动合并相同数字 · 冲击 2048',
    winTitle: '🏆 达成 2048！',
    tagline: '关掉颜色 · 只留思考',
    type: 'solid',
    tileMode: 'number',
    screenBg: ['#000000', '#000000'],
    boardBg: '#0f0f0f',
    boardBorder: 'rgba(255,255,255,0.08)',
    cellEmpty: '#1a1a1a',
    hudText: '#9a9a9a',
    hudPanel: 'rgba(255,255,255,0.06)',
    btnBg: 'rgba(255,255,255,0.10)',
    btnText: '#e5e5e5',
    accent: '#ffffff',
    overlayPanel: 'rgba(18,18,18,0.98)',
    overlayText: '#e5e5e5',
    tiles: {
      2: { bg1: '#232323', bg2: '#232323', fg: '#bdbdbd', label: '', glow: 0 },
      4: { bg1: '#2e2e2e', bg2: '#2e2e2e', fg: '#c8c8c8', label: '', glow: 0 },
      8: { bg1: '#3b3b3b', bg2: '#3b3b3b', fg: '#d4d4d4', label: '', glow: 0 },
      16: { bg1: '#4a4a4a', bg2: '#4a4a4a', fg: '#e0e0e0', label: '', glow: 0 },
      32: { bg1: '#5c5c5c', bg2: '#5c5c5c', fg: '#ececec', label: '', glow: 0 },
      64: { bg1: '#717171', bg2: '#717171', fg: '#f5f5f5', label: '', glow: 0 },
      128: { bg1: '#8a8a8a', bg2: '#8a8a8a', fg: '#ffffff', label: '', glow: 0.2 },
      256: { bg1: '#a5a5a5', bg2: '#a5a5a5', fg: '#111111', label: '', glow: 0 },
      512: { bg1: '#c2c2c2', bg2: '#c2c2c2', fg: '#111111', label: '', glow: 0 },
      1024: { bg1: '#e0e0e0', bg2: '#e0e0e0', fg: '#111111', label: '', glow: 0 },
      2048: { bg1: '#ffffff', bg2: '#ffffff', fg: '#111111', label: '', glow: 0.5 },
      4096: { bg1: '#ffffff', bg2: '#ffffff', fg: '#111111', label: '', glow: 0.7 },
      8192: { bg1: '#ffffff', bg2: '#ffffff', fg: '#111111', label: '', glow: 0.85 },
      16384: { bg1: '#ffffff', bg2: '#ffffff', fg: '#111111', label: '', glow: 1 }
    }
  }
};

let settings = storage.loadSettings();
let customList = storage.loadThemes();

// 旧版显影主题迁移：kind 归一为 photo（显影机制移除，单图转为棋盘背景）
let migrated = false;
for (const t of customList) {
  if (!t.kind || t.kind === 'reveal') { t.kind = 'photo'; delete t.reveal; migrated = true; }
  if (t.tagline === '图片主题 · 独一无二' || t.tagline === '词条主题 · 独一无二') { t.tagline = '我的专属主题'; migrated = true; }
  if (!t.colorBase) { t.colorBase = 'auto'; migrated = true; }
}
if (migrated) storage.saveThemes(customList);

const imgCache = {};

/* ---------- 查询 ---------- */

function builtinList() {
  return Object.keys(THEMES).map(function (k) { return THEMES[k]; });
}

function customs() {
  return customList;
}

function all() {
  return builtinList().concat(customList);
}

function get(id) {
  return THEMES[id] || customList.find(function (t) { return t.id === id; }) || THEMES.cosmos;
}

function exists(id) {
  return !!THEMES[id] || customList.some(function (t) { return t.id === id; });
}

function current() {
  return get(settings.theme);
}

function tileStyle(theme, value) {
  return theme.tiles[value] || theme.tiles[16384] || theme.tiles[4096];
}

/* ---------- 应用与维护 ---------- */

function setCurrent(id) {
  if (!exists(id)) return;
  // 先重读设置再改，避免模块缓存覆盖其他字段（如菜单里刚切换的 sound 开关）
  settings = storage.loadSettings();
  settings.theme = id;
  storage.saveSettings(settings);
  loadImageFor(get(id));
}

function addCustom(themeObj) {
  themeObj.updatedAt = Date.now();
  customList.push(themeObj);
  storage.saveThemes(customList);
}

function updateCustom(id, patch) {
  const t = customList.find(function (x) { return x.id === id; });
  if (!t) return;
  Object.assign(t, patch);
  t.updatedAt = Date.now();
  storage.saveThemes(customList);
}

function removeCustom(id) {
  const t = customList.find(function (x) { return x.id === id; });
  customList = customList.filter(function (x) { return x.id !== id; });
  storage.saveThemes(customList);
  storage.clearBackups(id); // 同步清除低清备份
  // 同步清理主题相关数据：按主题战绩 + 进行中棋局
  const save = storage.loadSave();
  let dirty = false;
  if (save.themeStats && save.themeStats[id]) { delete save.themeStats[id]; dirty = true; }
  if (save.currents && save.currents[id]) { delete save.currents[id]; dirty = true; }
  if (dirty) storage.saveSave(save);
  const fs = wx.getFileSystemManager();
  if (t && t.image) {
    try { fs.unlinkSync(t.image); } catch (e) { /* 文件可能已不存在 */ }
  }
  if (t && t.images) {
    for (const k in t.images) {
      try { fs.unlinkSync(t.images[k]); } catch (e2) { /* ignore */ }
    }
  }
  delete imgCache[id];
  if (settings.theme === id) setCurrent('cosmos');
}

/* ---------- 自定义主题图片加载 ---------- */

function loadImageFor(theme) {
  if (!theme || theme.type !== 'custom' || !theme.image) return null;
  if (imgCache[theme.id]) return imgCache[theme.id];
  const img = wx.createImage();
  const entry = { img: img, ok: false };
  imgCache[theme.id] = entry;
  img.onload = function () { entry.ok = true; };
  img.onerror = function () { entry.ok = false; };
  img.src = theme.image;
  return entry;
}

function getCustomImage(theme) {
  if (!theme || theme.type !== 'custom' || !theme.image) return null;
  const e = imgCache[theme.id];
  if (e) return e.ok ? e.img : null;
  loadImageFor(theme);
  return null;
}

function preloadCurrent() {
  loadImageFor(current());
}

const tileImgCache = {};

/** 图片主题：按档位加载方块图片（懒加载 + 缓存，按图片路径为键——不同主题/草稿同档位不串图） */
function getTileImage(theme, value) {
  if (!theme.images || !theme.images[value]) return null;
  const path = theme.images[value];
  if (tileImgCache[path]) return tileImgCache[path];
  const img = wx.createImage();
  const entry = { img: img, ok: false };
  tileImgCache[path] = entry;
  img.onload = function () { entry.ok = true; };
  img.onerror = function () { entry.ok = false; };
  img.src = path;
  return entry;
}

/** 启动时校验自定义主题图片是否还在（系统可能清理用户目录），失效的自动移除 */
function validateCustoms() {
  if (!customList.length) return;
  const fs = wx.getFileSystemManager();
  // 校验所有图片引用（背景图 + 方块图）：
  // 文件在 → 跳过；文件丢但有 storage 低清备份 → 自动恢复文件（自愈）；
  // 无备份 → 降级（背景清引用，方块清引用回退标准牌面）
  const refs = [];
  for (const t of customList) {
    if (t.image) refs.push({ t: t, key: 'bg', path: t.image });
    if (t.images) {
      for (const k in t.images) {
        if (t.images[k]) refs.push({ t: t, key: k, path: t.images[k] });
      }
    }
  }
  if (!refs.length) return;
  let pending = refs.length;
  const broken = [];
  refs.forEach(function (r) {
    fs.access({
      path: r.path,
      success: function () { check(); },
      fail: function () { broken.push(r); check(); }
    });
  });
  function check() {
    if (--pending > 0) return;
    if (!broken.length) return;
    // 恢复写入前确保目录存在（极端清理可能连目录一起删）
    try { fs.mkdirSync(wx.env.USER_DATA_PATH + '/themes', true); } catch (e0) { /* 已存在 */ }
    for (let i = 0; i < broken.length; i++) {
      const r = broken[i];
      const b64 = storage.getBackup(r.t.id, r.key);
      if (b64) {
        try { fs.writeFileSync(r.path, b64, 'base64'); continue; } catch (e) { /* 恢复失败走降级 */ }
      }
      // 无备份/恢复失败：降级
      if (r.key === 'bg') r.t.image = '';
      else if (r.t.images) delete r.t.images[r.key];
    }
    storage.saveThemes(customList);
  }
}

/** 清空存档后重载内存态（设置/自定义主题/图片缓存） */
function reload() {
  settings = storage.loadSettings();
  customList = storage.loadThemes();
  for (const k in imgCache) delete imgCache[k];
}

module.exports = {
  THEMES,
  builtinList,
  customs,
  all,
  get,
  exists,
  current,
  setCurrent,
  addCustom,
  updateCustom,
  removeCustom,
  tileStyle,
  loadImageFor,
  getCustomImage,
  preloadCurrent,
  getTileImage,
  validateCustoms,
  reload
};
