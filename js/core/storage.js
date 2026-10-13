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

/* ---------- 自定义主题图片的低清备份（对抗管家类"按文件年龄清理"） ---------- */

const BK_PREFIX = 'bk_';

/** 保存某主题某槽位的低清图片备份（base64） */
function saveBackup(themeId, key, base64) {
  try { wx.setStorageSync(BK_PREFIX + themeId + '_' + key, base64); } catch (e) { /* 存储满等：忽略，缺失时走降级 */ }
}

/** 读取某主题某槽位的低清备份（无则返回 null） */
function getBackup(themeId, key) {
  try { return wx.getStorageSync(BK_PREFIX + themeId + '_' + key) || null; } catch (e) { return null; }
}

/** 清除某主题的全部备份键 */
function clearBackups(themeId) {
  try {
    const prefix = BK_PREFIX + themeId + '_';
    const keys = (wx.getStorageInfoSync().keys || []);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(prefix) === 0) { try { wx.removeStorageSync(keys[i]); } catch (e) { /* ignore */ } }
    }
  } catch (e) { /* ignore */ }
}

/** 载入某主题的全部备份：{ key: base64 } */
function loadBackups(themeId) {
  const out = {};
  try {
    const prefix = BK_PREFIX + themeId + '_';
    const keys = (wx.getStorageInfoSync().keys || []);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(prefix) === 0) {
        try { out[keys[i].slice(prefix.length)] = wx.getStorageSync(keys[i]); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }
  return out;
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

module.exports = { loadSave, saveSave, loadSettings, saveSettings, loadThemes, saveThemes, clearAll, saveBackup, getBackup, clearBackups, loadBackups, dateStr, cnDate };
