/**
 * 本地存档：最高分/统计/进行中棋局 + 设置
 * key 带版本号，便于后续迁移
 */
const KEY_SAVE = 'mv_save_v1';
const KEY_SETTINGS = 'mv_settings_v1';

function read(key, def) {
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === null || v === undefined) return def;
    return v;
  } catch (e) {
    return def;
  }
}

function write(key, val) {
  try {
    wx.setStorageSync(key, val);
  } catch (e) { /* 存储失败静默降级 */ }
}

function defaultSave() {
  return {
    best: 0,
    stats: { games: 0, merges: 0, maxTile: 0 },
    currents: {},     // 按主题的进行中棋局（key: 主题id / '__daily__'）
    themeStats: {},   // 按主题的战绩 { best, games, merges, maxTile }
    current: null,    // 旧版单槽棋局（仅迁移用）
    daily: { completedDate: '', score: 0, streak: 0, best: 0, maxStreak: 0, totalDays: 0 }
  };
}

function loadSave() {
  const s = read(KEY_SAVE, null);
  if (!s || typeof s !== 'object') return defaultSave();
  const d = defaultSave();
  return {
    best: s.best || 0,
    stats: Object.assign(d.stats, s.stats || {}),
    currents: s.currents || {},
    themeStats: s.themeStats || {},
    current: s.current || null,
    daily: Object.assign(d.daily, s.daily || {})
  };
}

function saveSave(s) { write(KEY_SAVE, s); }

function defaultSettings() {
  return { theme: 'cosmos', sound: true, vibrate: true };
}

function loadSettings() {
  return Object.assign(defaultSettings(), read(KEY_SETTINGS, {}));
}

function saveSettings(s) { write(KEY_SETTINGS, s); }

const KEY_THEMES = 'mv_themes_v1';

function loadThemes() {
  const l = read(KEY_THEMES, null);
  return Array.isArray(l) ? l : [];
}

function saveThemes(l) { write(KEY_THEMES, l); }

/** 清空全部本地数据（统计页"清空存档"用） */
function clearAll() {
  try { wx.removeStorageSync(KEY_SAVE); } catch (e) { /* ignore */ }
  try { wx.removeStorageSync(KEY_SETTINGS); } catch (e) { /* ignore */ }
  try { wx.removeStorageSync(KEY_THEMES); } catch (e) { /* ignore */ }
}

/** 本地日期字符串（YYYY-MM-DD），offsetDays 为负表示昨天 */
function dateStr(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/** 中文日期（M月D日），用于界面展示 */
function cnDate(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

module.exports = { loadSave, saveSave, loadSettings, saveSettings, loadThemes, saveThemes, clearAll, dateStr, cnDate };
