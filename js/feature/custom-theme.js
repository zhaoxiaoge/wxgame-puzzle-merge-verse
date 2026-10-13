/**
 * 自定义主题：文件持久化 + 自动取色
 * - 裁剪结果经离屏 canvas(720×720) 导出后复制到 USER_DATA_PATH/themes/
 * - 配色由 16×16 采样平均色派生（palette.derive）
 */
const palette = require('../render/palette');

let scratch = null;  // 720×720 裁剪工作画布
let sampler = null;  // 16×16 取样画布

const B64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** ArrayBuffer → base64（纯 JS 实现，不依赖 wx.arrayBufferToBase64 / btoa） */
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const out = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    out.push(B64_TABLE[b0 >> 2]);
    out.push(B64_TABLE[(b0 & 3) << 4 | b1 >> 4]);
    out.push(has1 ? B64_TABLE[(b1 & 15) << 2 | b2 >> 6] : '=');
    out.push(has2 ? B64_TABLE[b2 & 63] : '=');
  }
  return out.join('');
}

function ensureScratch() {
  if (!scratch) {
    const cv = wx.createCanvas();
    cv.width = 720;
    cv.height = 720;
    scratch = { canvas: cv, ctx: cv.getContext('2d') };
  }
  return scratch;
}

function ensureSampler() {
  if (!sampler) {
    const cv = wx.createCanvas();
    cv.width = 16;
    cv.height = 16;
    sampler = { canvas: cv, ctx: cv.getContext('2d') };
  }
  return sampler;
}

function themesDir() {
  return wx.env.USER_DATA_PATH + '/themes';
}

function ensureDir() {
  const dir = themesDir();
  const fs = wx.getFileSystemManager();
  try {
    fs.accessSync(dir);
  } catch (e) {
    try { fs.mkdirSync(dir, true); } catch (e2) { /* 目录可能已存在 */ }
  }
  return dir;
}

/** 把导出的临时文件复制到用户目录持久化，失败返回 null */
function persistTemp(tempPath) {
  const fs = wx.getFileSystemManager();
  const id = 'custom_' + Date.now();
  // 两级降级：themes/ 子目录 → USER_DATA_PATH 根目录（模拟器对子目录支持不稳，根目录永远存在）
  const candidates = [themesDir() + '/' + id + '.jpg', wx.env.USER_DATA_PATH + '/' + id + '.jpg'];
  for (let i = 0; i < candidates.length; i++) {
    try {
      if (i === 0) ensureDir();
      fs.copyFileSync(tempPath, candidates[i]);
      return { id: id, path: candidates[i] };
    } catch (e) {
      console.error('[custom-theme] persistTemp 第' + (i + 1) + '级保存失败', e && e.message ? e.message : e);
    }
  }
  return null;
}

/** 模拟器兜底：用 base64 数据直接写文件（完全不经过临时路径；写根目录——模拟器文件服务器对子目录支持不稳） */
function persistBase64(base64) {
  try {
    const fs = wx.getFileSystemManager();
    const id = 'custom_' + Date.now();
    const path = wx.env.USER_DATA_PATH + '/' + id + '.jpg';
    fs.writeFileSync(path, base64, 'base64');
    // 诊断：读回校验（模拟器对 base64 编码参数的支持存疑）
    try {
      const back = fs.readFileSync(path);
      const size = back && (back.byteLength || back.length) || 0;
      console.log('[custom-theme] persistBase64 写回校验: 文件字节=' + size + ' base64长度=' + base64.length + (size === base64.length ? '（疑似未解码，写入了文本）' : '（已正确解码为二进制）'));
    } catch (e2) {
      console.error('[custom-theme] persistBase64 读回校验失败', e2 && e2.message ? e2.message : e2);
    }
    return { id: id, path: path };
  } catch (e) {
    console.error('[custom-theme] persistBase64 失败', e && e.message ? e.message : e);
    return null;
  }
}

/** 生成图片文件的 base64 备份（读文件 → 编码，不依赖画布 API，全平台可用） */
function makeFileBackup(path) {
  try {
    const data = wx.getFileSystemManager().readFileSync(path);
    const b64 = arrayBufferToBase64(data);
    return b64 || null;
  } catch (e) {
    return null;
  }
}

/** 从裁剪工作画布取样并派生主题配色 */
function deriveFromScratch(sc) {
  const sp = ensureSampler();
  try {
    sp.ctx.drawImage(sc.canvas, 0, 0, 16, 16);
    const data = sp.ctx.getImageData(0, 0, 16, 16).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = 256;
    for (let i = 0; i < n; i++) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
    }
    return palette.derive(r / n, g / n, b / n);
  } catch (e) {
    return palette.derive(110, 120, 150);
  }
}

/** 从编辑器草稿构建主题对象（photo / words） */
function buildFromDraft(id, name, kind, draft, fields) {
  const obj = {
    id: id,
    type: 'custom',
    kind: kind,
    name: name || '我的主题',
    reveal: false,
    tileMode: 'number',
    tagline: '我的专属主题'
  };
  if (kind === 'photo') obj.images = Object.assign({}, draft.images);
  if (kind === 'words') obj.words = Object.assign({}, draft.words);
  if (draft.image) obj.image = draft.image;
  return Object.assign(obj, fields);
}

/** 从图片路径派生配色（异步加载后回调） */
function deriveFromImagePath(path, callback) {
  const img = wx.createImage();
  img.onload = function () {
    const sc = ensureScratch();
    sc.ctx.clearRect(0, 0, 720, 720);
    sc.ctx.drawImage(img, 0, 0, 720, 720);
    callback(deriveFromScratch(sc));
  };
  img.onerror = function () { callback(palette.derive(110, 120, 150)); };
  img.src = path;
}

module.exports = { ensureScratch, persistTemp, persistBase64, makeFileBackup, deriveFromScratch, buildFromDraft, deriveFromImagePath };
