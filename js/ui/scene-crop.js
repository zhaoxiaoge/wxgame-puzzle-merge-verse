/**
 * 自定义主题裁剪页：拖动 / 双指缩放选取方形区域 → 720×720 导出 → 自动取色 → 命名
 */
const customTheme = require('../feature/custom-theme');
const R = require('../render/renderer');

class CropScene {
  constructor(app) {
    this.app = app;
  }

  enter(params) {
    params = params || {};
    this.tempPath = params.tempPath;
    this.editorSlot = params.editorSlot || null; // 编辑器模式：为指定档位出图
    const s = this.s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    const W = this.app.W;
    const H = this.app.H;
    const size = Math.min(W - Math.round(32 * s), Math.round(H * 0.5));
    this.preview = {
      size: size,
      x: (W - size) / 2,
      y: Math.max(this.app.safeTop + Math.round(70 * s), H * 0.32 - size / 2)
    };
    this.img = null;
    this.scale = 1;
    this.minScale = 1;
    this.maxScale = 5;
    this.ox = 0;
    this.oy = 0;
    this.lastTouches = null;
    this.moved = false;
    this.busy = false;

    const btnW = Math.round(150 * s);
    const btnH = Math.round(50 * s);
    const by = this.preview.y + size + Math.round(44 * s);
    const isEditor = !!this.editorSlot;
    this.buttons = [
      { id: 'cancel', label: isEditor ? '返回' : '取消', x: W / 2 - btnW - Math.round(12 * s), y: by, w: btnW, h: btnH, bg: 'rgba(255,255,255,0.14)', text: '#e8edff', fontSize: Math.round(16 * s) },
      { id: 'ok', label: isEditor ? '确定' : '生成主题', x: W / 2 + Math.round(12 * s), y: by, w: btnW, h: btnH, bg: '#f4c542', text: '#1a1a2e', fontSize: Math.round(16 * s) }
    ];

    if (this.tempPath) {
      const img = wx.createImage();
      img.onload = () => {
        this.img = img;
        this.fit();
      };
      img.onerror = () => {
        wx.showToast({ title: '图片加载失败', icon: 'none' });
      };
      img.src = this.tempPath;
    }
  }

  exit() {}
  update() {}

  fit() {
    const p = this.preview;
    const iw = this.img.width;
    const ih = this.img.height;
    this.minScale = Math.max(p.size / iw, p.size / ih);
    this.maxScale = this.minScale * 5;
    this.scale = this.minScale * 1.15;
    this.ox = p.x + (p.size - iw * this.scale) / 2;
    this.oy = p.y + (p.size - ih * this.scale) / 2;
    this.clampPan();
  }

  clampPan() {
    if (!this.img) return;
    const p = this.preview;
    const iw = this.img.width * this.scale;
    const ih = this.img.height * this.scale;
    if (iw <= p.size) this.ox = p.x + (p.size - iw) / 2;
    else this.ox = Math.max(p.x + p.size - iw, Math.min(this.ox, p.x));
    if (ih <= p.size) this.oy = p.y + (p.size - ih) / 2;
    else this.oy = Math.max(p.y + p.size - ih, Math.min(this.oy, p.y));
  }

  /* ---------- 触摸：单指拖动 / 双指缩放 ---------- */

  snap(touches) {
    const list = [];
    for (let i = 0; i < touches.length; i++) {
      list.push({ x: touches[i].clientX, y: touches[i].clientY });
    }
    return list;
  }

  dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onTouchStart(e) {
    const t = e.touches && e.touches[0];
    this.startX = t ? t.clientX : 0;
    this.startY = t ? t.clientY : 0;
    this.moved = false;
    this.lastTouches = this.snap(e.touches || []);
  }

  onTouchMove(e) {
    if (!this.img || this.busy) return;
    const ts = this.snap(e.touches || []);
    const prev = this.lastTouches;
    if (ts.length >= 2 && prev && prev.length >= 2) {
      const d0 = this.dist(prev[0], prev[1]);
      const d1 = this.dist(ts[0], ts[1]);
      if (d0 > 0 && d1 > 0) {
        const ns = Math.max(this.minScale, Math.min(this.maxScale, this.scale * (d1 / d0)));
        const k = ns / this.scale;
        const mx = (ts[0].x + ts[1].x) / 2;
        const my = (ts[0].y + ts[1].y) / 2;
        // 以双指中心为锚点缩放
        this.ox = mx - (mx - this.ox) * k;
        this.oy = my - (my - this.oy) * k;
        this.scale = ns;
        this.moved = true;
      }
    } else if (ts.length === 1 && prev && prev.length >= 1) {
      // 位移超过阈值才算拖动：手指轻微抖动不应吞掉按钮点击（真机点击必带微抖）
      const totalX = ts[0].x - this.startX;
      const totalY = ts[0].y - this.startY;
      if (Math.abs(totalX) > 10 || Math.abs(totalY) > 10) {
        this.ox += ts[0].x - prev[0].x;
        this.oy += ts[0].y - prev[0].y;
        this.moved = true;
      }
    }
    this.lastTouches = ts;
    this.clampPan();
  }

  onTouchEnd(e) {
    const wasMoved = this.moved;
    this.lastTouches = this.snap(e.touches || []);
    if (!this.lastTouches.length) this.lastTouches = null;
    if (wasMoved || this.busy || !this.img) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    for (const b of this.buttons) {
      if (!R.hit(b, t.clientX, t.clientY)) continue;
      if (b.id === 'cancel') this.app.switch(this.editorSlot ? 'editor' : 'themes');
      else if (b.id === 'ok') this.confirm();
    }
  }

  onTouchCancel() { this.lastTouches = null; }

  /* ---------- 生成 ---------- */

  confirm() {
    if (this.busy || !this.img) return;
    this.busy = true;
    const p = this.preview;
    const sw = Math.min(p.size / this.scale, this.img.width);
    let sx = (p.x - this.ox) / this.scale;
    let sy = (p.y - this.oy) / this.scale;
    sx = Math.max(0, Math.min(sx, this.img.width - sw));
    sy = Math.max(0, Math.min(sy, this.img.height - sw));

    const sc = customTheme.ensureScratch();
    sc.ctx.clearRect(0, 0, 720, 720);
    sc.ctx.drawImage(this.img, sx, sy, sw, sw, 0, 0, 720, 720);

    const onFail = () => {
      this.busy = false;
      this._exporting = false;
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    };

    // 从主画布导出预览区域（离屏画布的 toTempFilePathSync 在真机不可用）
    const dpr = this.app.dpr;
    const exportOpts = () => ({
      x: Math.round(p.x * dpr),
      y: Math.round(p.y * dpr),
      width: Math.round(p.size * dpr),
      height: Math.round(p.size * dpr),
      destWidth: 720,
      destHeight: 720,
      fileType: 'jpg',
      quality: 0.85
    });
    try {
      this._exporting = true;
      this.render(this.app.ctx); // 无网格/边框重绘一帧
      const t = this.app.canvas.toTempFilePathSync(exportOpts());
      this._exporting = false;
      this.render(this.app.ctx); // 恢复网格/边框
      // 兼容：部分环境直接返回路径字符串，部分返回 { tempFilePath }
      const path = (typeof t === 'string') ? t : (t && t.tempFilePath);
      if (path) {
        // 模拟器缺陷：同步导出可能返回未落盘的路径，先校验文件存在
        let exists = true;
        try { wx.getFileSystemManager().accessSync(path); } catch (e) { exists = false; }
        if (exists) {
          this._afterExport(path);
          return;
        }
        console.log('[crop] 同步导出未落盘，改用异步导出');
      } else {
        console.error('[crop] toTempFilePathSync 未返回路径', t);
      }
    } catch (err) {
      this._exporting = false;
      console.error('[crop] 主画布导出异常', err);
    }
    // 异步导出兜底（模拟器对异步版实现完整，真机同样支持）
    this._exporting = true;
    this.render(this.app.ctx);
    this.app.canvas.toTempFilePath(Object.assign(exportOpts(), {
      success: (res) => {
        this._exporting = false;
        this.render(this.app.ctx);
        const p2 = (typeof res === 'string') ? res : (res && res.tempFilePath);
        if (p2) { this._afterExport(p2); return; }
        this.busy = false;
        onFail();
      },
      fail: (err) => {
        this._exporting = false;
        this.render(this.app.ctx);
        console.error('[crop] 异步导出失败', err);
        this.busy = false;
        onFail();
      }
    }));
  }

  /** 模拟器兜底：临时路径不可复制时，从裁剪画布取 base64 直接写文件 */
  persistFromScratch() {
    try {
      const sc = customTheme.ensureScratch();
      if (!sc.canvas.toDataURL) return null;
      const dataURL = sc.canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataURL.split(',')[1];
      if (!base64) return null;
      return customTheme.persistBase64(base64);
    } catch (e) {
      console.error('[crop] dataURL 兜底失败', e && e.message ? e.message : e);
      return null;
    }
  }

  _afterExport(path) {
    // 编辑器模式：入账到草稿并返回编辑器（替换时清理旧图文件，避免孤儿文件泄漏）
    let saved = customTheme.persistTemp(path);
    if (!saved) saved = this.persistFromScratch(); // 模拟器兜底：临时路径不可复制时直接写 base64
    if (!saved) { this.busy = false; wx.showToast({ title: '保存失败，请重试', icon: 'none' }); return; }
    this.app.themeDraft = this.app.themeDraft || { images: {}, words: {}, image: '', name: '', colorBase: 'auto', imgBackups: {} };
    // 图片备份入草稿：保存主题时写入 storage（对抗管家类文件清理，丢失可自动恢复）
    const imgB64 = customTheme.makeFileBackup(saved.path);
    if (imgB64) {
      this.app.themeDraft.imgBackups = this.app.themeDraft.imgBackups || {};
      this.app.themeDraft.imgBackups[String(this.editorSlot)] = imgB64;
    }
    const fs = wx.getFileSystemManager();
    if (this.editorSlot === 'bg') {
      const old = this.app.themeDraft.image;
      if (old && old !== saved.path) { try { fs.unlinkSync(old); } catch (e) { /* 旧文件可能已不存在 */ } }
      this.app.themeDraft.image = saved.path;
    } else {
      const old = this.app.themeDraft.images[this.editorSlot];
      if (old && old !== saved.path) { try { fs.unlinkSync(old); } catch (e2) { /* ignore */ } }
      this.app.themeDraft.images[this.editorSlot] = saved.path;
    }
    this.busy = false;
    this.app.switch('editor', { filled: this.editorSlot });
  }

  /* ---------- 渲染 ---------- */

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    // 固定深色工作台，不随主题变化
    ctx.fillStyle = '#10131f';
    ctx.fillRect(0, 0, W, H);

    const p = this.preview;
    R.text(ctx, this.editorSlot ? ('为 ' + this.editorSlot + ' 设置图片') : '裁剪主题图片', W / 2, this.app.safeTop + Math.round(28 * this.s), Math.round(20 * this.s), '#e8edff', true);

    if (this.img) {
      ctx.save();
      R.rr(ctx, p.x, p.y, p.size, p.size, Math.round(16 * this.s));
      ctx.clip();
      ctx.drawImage(this.img, this.ox, this.oy, this.img.width * this.scale, this.img.height * this.scale);
      // 参考网格与边框：导出帧时隐藏（保证主题图不含辅助线）
      if (!this._exporting) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const g = p.size * i / 4;
          ctx.beginPath();
          ctx.moveTo(p.x + g, p.y);
          ctx.lineTo(p.x + g, p.y + p.size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + g);
          ctx.lineTo(p.x + p.size, p.y + g);
          ctx.stroke();
        }
      }
      ctx.restore();
      if (!this._exporting) R.strokeRR(ctx, p.x, p.y, p.size, p.size, Math.round(16 * this.s), 'rgba(244,197,66,0.9)', 2);
    } else {
      R.fillRR(ctx, p.x, p.y, p.size, p.size, Math.round(16 * this.s), 'rgba(255,255,255,0.06)');
      R.text(ctx, '加载中…', W / 2, p.y + p.size / 2, 16, 'rgba(255,255,255,0.5)');
    }

    R.text(ctx, '拖动调整位置 · 双指缩放', W / 2, p.y + p.size + Math.round(20 * this.s), Math.round(13 * this.s), 'rgba(232,237,255,0.6)');
    for (const b of this.buttons) R.drawButton(ctx, b);
  }
}

module.exports = CropScene;
