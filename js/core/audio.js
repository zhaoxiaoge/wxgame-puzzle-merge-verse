/**
 * 音效：wx.createInnerAudioContext 预加载，受设置里的 sound 开关控制
 * 音频文件由 gen-sounds.ps1 合成（纯音，无版权，共约 56KB；脚本已归档至素材目录）
 */
const storage = require('../core/storage');

const VOLUMES = {
  move: 0.5,
  merge: 0.8,
  'merge-high': 0.9,
  over: 0.8,
  win: 0.9
};

const pool = {};

function get(name) {
  if (!pool[name]) {
    const ctx = wx.createInnerAudioContext();
    ctx.src = 'audio/' + name + '.wav';
    ctx.obeyMuteSwitch = false; // 游戏音效不跟随系统静音开关（应用内有独立开关）
    ctx.volume = VOLUMES[name] || 0.8;
    pool[name] = ctx;
  }
  return pool[name];
}

function play(name) {
  try {
    const settings = storage.loadSettings();
    if (!settings.sound) return;
    const ctx = get(name);
    ctx.stop();
    ctx.play();
  } catch (e) { /* 音效失败静默降级 */ }
}

/** 启动时预创建播放器并加载音频，避免首次播放无声/延迟 */
function warmup() {
  for (const name in VOLUMES) get(name);
}

module.exports = { play, warmup };
