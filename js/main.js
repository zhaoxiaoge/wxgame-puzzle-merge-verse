/**
 * 益智合成小宇宙 - 主入口
 * 场景管理 + 主循环 + 触摸分发
 */
const MenuScene = require('./ui/scene-menu');
const GameScene = require('./ui/scene-game');
const ThemesScene = require('./ui/scene-themes');
const CropScene = require('./ui/scene-crop');
const PreviewScene = require('./ui/scene-preview');
const StatsScene = require('./ui/scene-stats');
const ThemeEditorScene = require('./ui/scene-theme-editor');
const themeMgr = require('./render/theme');
const share = require('./feature/share');
const audio = require('./core/audio');
const storage = require('./core/storage');

// 第一个 createCanvas 返回屏幕主画布
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
const dpr = Math.min(info.pixelRatio || 2, 3);
canvas.width = Math.round(info.screenWidth * dpr);
canvas.height = Math.round(info.screenHeight * dpr);
ctx.scale(dpr, dpr);

// 首行内容起始位置：系统胶囊按钮（右上角 ⋯/关闭）下沿 + 间距，不同机型自动适配
let navSafe = (info.safeArea && info.safeArea.top) || 24;
try {
  const rect = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
  if (rect && rect.bottom) navSafe = rect.bottom + 8;
} catch (e) { /* 无胶囊接口的环境用 safeTop 兜底 */ }

const app = {
  W: info.screenWidth,
  H: info.screenHeight,
  dpr,
  canvas,
  ctx,
  safeTop: (info.safeArea && info.safeArea.top) || 24,
  navSafe,
  scene: null,
  sceneMap: { menu: MenuScene, game: GameScene, themes: ThemesScene, crop: CropScene, preview: PreviewScene, stats: StatsScene, editor: ThemeEditorScene },
  instances: {},
  switch(name, params) {
    const Cls = this.sceneMap[name];
    if (!Cls) return;
    const next = this.instances[name] || (this.instances[name] = new Cls(this));
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = next;
    if (next.enter) next.enter(params);
  }
};

wx.onTouchStart(function (e) { if (app.scene && app.scene.onTouchStart) app.scene.onTouchStart(e); });
wx.onTouchMove(function (e) { if (app.scene && app.scene.onTouchMove) app.scene.onTouchMove(e); });
wx.onTouchEnd(function (e) { if (app.scene && app.scene.onTouchEnd) app.scene.onTouchEnd(e); });
wx.onTouchCancel(function (e) { if (app.scene && app.scene.onTouchCancel) app.scene.onTouchCancel(e); });

let last = Date.now();
function frame() {
  const now = Date.now();
  const dt = Math.min(now - last, 50);
  last = now;
  if (app.scene) {
    if (app.scene.update) app.scene.update(dt);
    app.scene.render(ctx);
  }
  requestAnimationFrame(frame);
}

share.setCanvas(canvas);
share.initShare();
audio.warmup();

// 隐私授权：注册自定义弹窗处理（官方弹窗在部分真机环境不弹出，导致选图接口直接失败）
if (wx.onNeedPrivacyAuthorization) {
  wx.onNeedPrivacyAuthorization(function (resolve) {
    wx.showModal({
      title: '隐私保护提示',
      content: '自定义主题功能需要你同意《用户隐私保护指引》：选择相册图片用于生成专属主题。是否同意并继续？',
      confirmText: '同意',
      cancelText: '拒绝',
      success: function (r) {
        if (r.confirm) resolve({ event: 'agree' });
        else resolve({ event: 'disagree' });
      }
    });
  });
  // 启动时预检并预授权：避免首次调用隐私接口时因配置未就绪而直接失败
  if (wx.getPrivacySetting) {
    wx.getPrivacySetting({
      success: function (res) {
        if (res.needAuthorization && wx.requirePrivacyAuthorize) {
          wx.requirePrivacyAuthorize({ fail: function () { /* 用户拒绝，静默处理 */ } });
        }
      }
    });
  }
}

// 旧版存档迁移：全局战绩/单槽棋局 → 按主题维度（一次性）
const legacy = storage.loadSave();
if (!legacy.themeStats || Object.keys(legacy.themeStats).length === 0) {
  const tid = themeMgr.current().id;
  legacy.themeStats = {};
  legacy.themeStats[tid] = {
    best: legacy.best || 0,
    games: legacy.stats.games || 0,
    merges: legacy.stats.merges || 0,
    maxTile: legacy.stats.maxTile || 0
  };
  if (legacy.current) {
    legacy.currents = legacy.currents || {};
    legacy.currents[tid] = legacy.current;
    legacy.current = null;
  }
  storage.saveSave(legacy);
}

app.switch('menu');

// 自定义主题图片健壮性校验 + 预加载当前主题图
themeMgr.validateCustoms();
themeMgr.preloadCurrent();

requestAnimationFrame(frame);
