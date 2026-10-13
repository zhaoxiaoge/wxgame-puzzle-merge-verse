/**
 * 自定义主题网格编辑器：图片主题 / 词条主题共用
 * - 图片：点格子 → 选图 → 裁剪 → 回编辑器（缩略图即最终牌面）
 * - 词条：点格子 → 输入框填词
 * - 完成：≥1 格即可创建；未填格子回退标准牌面
 * - 草稿挂在 app.themeDraft 上（裁剪往返不丢失）
 */
const themeMgr = require('../render/theme');
const customTheme = require('../feature/custom-theme');
const storage = require('../core/storage');
const R = require('../render/renderer');

const VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];

class ThemeEditorScene {
  constructor(app) {
    this.app = app;
  }

  enter(params) {
    params = params || {};
    // 裁剪往返：参数缺 kind/editId 时从全局编辑会话恢复（编辑模式不丢）
    if (params.kind === undefined && params.editId === undefined && this.app.themeEdit) {
      params.kind = this.app.themeEdit.kind;
      params.editId = this.app.themeEdit.editId;
    }
    this.kind = params.kind || 'photo';
    this.editId = params.editId || null;
    this.app.themeEdit = { kind: this.kind, editId: this.editId };
    this.theme = themeMgr.current();
    this.save = storage.loadSave();

    // 草稿：会话匹配时复用（裁剪往返不丢图/不专名称）；否则初始化
    const reuse = this.app.themeDraft && this.app.themeDraft.sessionKind === this.kind && (this.app.themeDraft.sessionEditId || null) === (this.editId || null);
    if (reuse) {
      this.draft = this.app.themeDraft;
    } else if (this.editId) {
      // 编辑已有主题：草稿从主题数据载入
      const t = themeMgr.get(this.editId);
      this.draft = {
        sessionKind: this.kind, sessionEditId: this.editId,
        images: Object.assign({}, t.images || {}),
        words: Object.assign({}, t.words || {}),
        image: t.image || '',
        name: t.name || '',
        colorBase: t.colorBase || 'auto',
        imgBackups: storage.loadBackups(this.editId)
      };
      this.app.themeDraft = this.draft;
    } else {
      // 新建：草稿挂 app.themeDraft（裁剪页往返写入，名称也存草稿防丢失）
      this.draft = { sessionKind: this.kind, sessionEditId: null, images: {}, words: {}, image: '', name: '', colorBase: 'auto', imgBackups: {} };
      this.app.themeDraft = this.draft;
    }
    this.app.themeDraft = this.draft;
    this.computeLayout();
  }

  computeLayout() {
    const s = this.s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    const W = this.app.W;
    const H = this.app.H;
    this.margin = Math.round(16 * s);
    this.gap = Math.round(10 * s);
    this.cols = 4;
    this.slotW = Math.round((W - this.margin * 2 - this.gap * 3) / 4);
    this.slotH = this.slotW;
    this.gridTop = this.app.navSafe + Math.round(96 * s);
    this.rows = Math.ceil(VALUES.length / 4);
    this.listH = this.rows * (this.slotH + this.gap);

    this.backBtn = {
      id: 'back', label: '返回',
      x: this.margin, y: this.app.navSafe,
      w: Math.round(76 * s), h: Math.round(40 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    const doneW = Math.round(210 * s);
    const fabH = Math.round(52 * s);
    this.doneBtn = {
      id: 'done', label: '完成',
      x: (W - doneW) / 2, y: H - fabH - Math.round(16 * s),
      w: doneW, h: fabH,
      bg: this.theme.accent, text: '#1a1a2e', fontSize: Math.round(16 * s)
    };
    // 名称栏（返回键下方一行，居中显示，点击弹出输入框修改）
    const nameW = Math.round(240 * s);
    this.nameField = {
      x: (W - nameW) / 2, y: this.app.navSafe + Math.round(46 * s),
      w: nameW, h: Math.round(40 * s)
    };
    // 底部区（固定不滚动）：背景行 + 配色行 + 进度 + 完成按钮
    this.colorRowH = Math.round(40 * s);
    this.colorRowY = this.doneBtn.y - Math.round(76 * s);
    this.bgRowH = Math.round(40 * s);
    const bgRowY = this.colorRowY - this.bgRowH - Math.round(8 * s);
    this.viewH = bgRowY - Math.round(8 * s) - this.gridTop;
    this.maxScroll = Math.max(0, this.listH - this.viewH);
    this.scroll = 0;
    this.touch = null;
    this.colorOpen = false;
  }

  filledCount() {
    const src = this.kind === 'photo' ? this.draft.images : this.draft.words;
    let n = 0;
    for (const v of VALUES) {
      if (src[v]) n++;
    }
    return n;
  }

  exit() {}
  update() {}

  /* ---------- 触摸：滚动 + 点按 ---------- */

  onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    this.touch = { x: t.clientX, y: t.clientY, lastY: t.clientY, moved: false };
  }

  onTouchMove(e) {
    if (!this.touch) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    if (Math.abs(t.clientY - this.touch.y) > 8 || Math.abs(t.clientX - this.touch.x) > 8) {
      this.touch.moved = true;
    }
    if (this.touch.moved) {
      this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll - (t.clientY - this.touch.lastY)));
    }
    this.touch.lastY = t.clientY;
  }

  onTouchEnd(e) {
    if (!this.touch) return;
    const t = e.changedTouches && e.changedTouches[0];
    const moved = this.touch.moved;
    this.touch = null;
    if (!t || moved) return;
    this.tap(t.clientX, t.clientY);
  }

  onTouchCancel() { this.touch = null; }

  slotRect(i) {
    const col = i % 4;
    const row = (i / 4) | 0;
    return {
      x: this.margin + col * (this.slotW + this.gap),
      y: this.gridTop + row * (this.slotH + this.gap)
    };
  }

  /** 按路径加载图片（背景缩略图用） */
  getPathImage(path) {
    if (!this._pathImgs) this._pathImgs = {};
    if (!this._pathImgs[path]) {
      const img = wx.createImage();
      const entry = { img, ok: false };
      img.onload = function () { entry.ok = true; };
      img.onerror = function () { entry.ok = false; };
      img.src = path;
      this._pathImgs[path] = entry;
    }
    return this._pathImgs[path];
  }

  bgRowRect() {
    const s = this.s;
    return {
      x: this.margin,
      y: this.colorRowY - this.bgRowH - Math.round(8 * s),
      w: this.app.W - this.margin * 2,
      h: this.bgRowH
    };
  }

  colorRowRect() {
    return {
      x: this.margin,
      y: this.colorRowY,
      w: this.app.W - this.margin * 2,
      h: this.colorRowH
    };
  }

  /** 配色基调的显示名 */
  colorBaseLabel(base) {
    if (base === 'cosmos') return '星宇宙配色';
    if (base === 'classic') return '经典 2048 配色';
    if (base === 'orchard') return '果园配色';
    if (base === 'kitty') return '喵喵配色';
    if (base === 'mono') return '极简暗黑配色';
    return this.kind === 'photo' ? '自动取色' : '跟随当前主题';
  }

  /** 配色选择弹窗的按钮布局 */
  colorOptions() {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const items = [
      { id: 'auto', label: this.kind === 'photo' ? '自动取色（推荐）' : '跟随当前主题' },
      { id: 'cosmos', label: '星宇宙配色' },
      { id: 'classic', label: '经典 2048 配色' },
      { id: 'orchard', label: '果园配色' },
      { id: 'kitty', label: '喵喵配色' },
      { id: 'mono', label: '极简暗黑配色' }
    ];
    const cur = this.draft.colorBase || 'auto';
    const bw = Math.round(240 * s);
    const bh = Math.round(38 * s);
    const gap = Math.round(8 * s);
    const titleH = Math.round(40 * s);
    const ph = titleH + items.length * (bh + gap) + bh + Math.round(28 * s);
    const pw = Math.round(280 * s);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const mk = (id, label, y, accent) => ({ id, label, x: (W - bw) / 2, y, w: bw, h: bh, bg: accent ? this.theme.accent : this.theme.btnBg, text: accent ? '#1a1a2e' : this.theme.btnText, fontSize: Math.round(14 * s) });
    const buttons = [];
    let y = py + titleH;
    for (const it of items) {
      buttons.push(mk(it.id, it.label, y, it.id === cur));
      y += bh + gap;
    }
    buttons.push(mk('cancel', '取消', y + Math.round(4 * s), false));
    return { px, py, pw, ph, buttons };
  }

  bgClearRect() {
    const s = this.s;
    const r = this.bgRowRect();
    return { x: r.x + r.w - Math.round(30 * s), y: r.y + Math.round(4 * s), w: Math.round(26 * s), h: r.h - Math.round(8 * s) };
  }

  tap(x, y) {
    // 配色选择弹窗打开时优先处理（选择后记录，完成时生效）
    if (this.colorOpen) {
      const co = this.colorOptions();
      for (const b of co.buttons) {
        if (!R.hit(b, x, y)) continue;
        this.colorOpen = false;
        if (b.id === 'cancel') return;
        this.draft.colorBase = b.id;
        return;
      }
      return;
    }
    // 名称栏：点击弹出输入框（预填当前名称）
    const nf = this.nameField;
    if (x >= nf.x && x <= nf.x + nf.w && y >= nf.y && y <= nf.y + nf.h) {
      wx.showModal({
        title: '主题名称',
        editable: true,
        content: this.draft.name || '',
        placeholderText: '最多 6 个字',
        success: (r) => {
          if (!r.confirm) return;
          const raw = (r.content || '').trim();
          if (raw.length > 6) wx.showToast({ title: '名称最多 6 个字，已截断', icon: 'none' });
          this.draft.name = raw.slice(0, 6);
        }
      });
      return;
    }
    if (R.hit(this.backBtn, x, y)) {
      if (this.filledCount() > 0) {
        wx.showModal({
          title: '返回',
          content: '返回将丢弃未保存的编辑内容，确定吗？',
          confirmText: '丢弃',
          success: (r) => {
            if (!r.confirm) return;
            this.app.themeDraft = null;
            this.app.themeEdit = null;
            this.app.switch('themes');
          }
        });
      } else {
        this.app.themeDraft = null;
        this.app.themeEdit = null;
        this.app.switch('themes');
      }
      return;
    }
    // 棋盘背景行（可选）：点行设置/更换，×清除（只清引用不删文件——编辑模式下主题仍引用该文件，避免悬空）
    const br = this.bgRowRect();
    if (x >= br.x && x <= br.x + br.w && y >= br.y && y <= br.y + br.h) {
      if (this.draft.image) {
        const clr = this.bgClearRect();
        if (R.hit(clr, x, y)) {
          if (this.draft.imgBackups) delete this.draft.imgBackups.bg; // 备份同步清除
          this.draft.image = '';
          return;
        }
      }
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0];
          if (f && f.tempFilePath) this.app.switch('crop', { tempPath: f.tempFilePath, editorSlot: 'bg' });
        },
        fail: () => { /* 用户取消 */ }
      });
      return;
    }
    // 配色行：点击弹出选择弹窗
    const cr = this.colorRowRect();
    if (x >= cr.x && x <= cr.x + cr.w && y >= cr.y && y <= cr.y + cr.h) {
      this.colorOpen = true;
      return;
    }
    // 棋盘区域：映射到最近格子（间隙也算命中，避免边缘点不中）；仅限网格可视区内
    const gx = x - this.margin;
    const gy = y - this.gridTop + this.scroll;
    if (gx >= 0 && gy >= 0 && gx <= this.slotW * 4 + this.gap * 3 && gy <= this.listH && y <= this.gridTop + this.viewH) {
      const col = Math.min(3, Math.max(0, Math.floor(gx / (this.slotW + this.gap))));
      const row = Math.min(3, Math.max(0, Math.floor(gy / (this.slotH + this.gap))));
      const idx = row * 4 + col;
      if (idx < VALUES.length) {
        this.tapSlot(VALUES[idx]);
      }
      return;
    }
    if (R.hit(this.doneBtn, x, y)) this.finish();
  }

  tapSlot(value) {
    if (this.kind === 'photo') {
      // 已填/未填都可点：重新选图替换
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0];
          if (f && f.tempFilePath) this.app.switch('crop', { tempPath: f.tempFilePath, editorSlot: value });
        },
        fail: () => { /* 用户取消 */ }
      });
    } else {
      const cur = this.draft.words[value] || '';
      wx.showModal({
        title: value + ' 的名称',
        editable: true,
        content: cur,
        placeholderText: '最多 6 个字',
        success: (r) => {
          if (!r.confirm) return;
          const raw = (r.content || '').trim();
          if (raw.length > 6) wx.showToast({ title: '最多 6 个字，已截断', icon: 'none' });
          const w = raw.slice(0, 6);
          if (w) this.draft.words[value] = w;
          else delete this.draft.words[value];
        }
      });
    }
  }

  /* ---------- 完成 ---------- */

  finish() {
    if (this.filledCount() === 0 && !this.draft.image) {
      wx.showToast({ title: '请至少为 1 个方块设置内容', icon: 'none' });
      return;
    }
    // 新建/编辑统一：按所选基调生成配色（auto = 自动取色/跟随当前主题）
    const base = this.draft.colorBase || 'auto';
    if (base === 'auto') {
      this.applyAutoColor();
      return;
    }
    this.saveChanges(this.clonePaletteFields(themeMgr.get(base)));
  }

  applyAutoColor() {
    if (this.kind === 'photo') {
      // 从第一张已填图派生配色
      let firstPath = null;
      for (const v of VALUES) {
        if (this.draft.images[v]) { firstPath = this.draft.images[v]; break; }
      }
      if (!firstPath && this.editId) {
        // 无图可取色（编辑时清空了方块图）：保留主题原配色，不用通用兜底色
        this.saveChanges(this.clonePaletteFields(themeMgr.get(this.editId)));
        return;
      }
      customTheme.deriveFromImagePath(firstPath, (fields) => this.saveChanges(fields));
    } else {
      // 词条主题：继承当前主题配色
      this.saveChanges(this.clonePaletteFields(themeMgr.current()));
    }
  }

  clonePaletteFields(t) {
    const tiles = {};
    for (const k in t.tiles) {
      const c = Object.assign({}, t.tiles[k]);
      delete c.label; // 自定义主题的空方块只显示数字，不继承基调主题的名称/emoji
      tiles[k] = c;
    }
    return {
      tiles,
      tileMode: 'number',
      bgDecor: t.type === 'gradient' ? 'gradient' : '',
      screenBg: t.screenBg,
      boardBg: t.boardBg,
      boardBorder: t.boardBorder,
      cellEmpty: t.cellEmpty,
      hudText: t.hudText,
      hudPanel: t.hudPanel,
      btnBg: t.btnBg,
      btnText: t.btnText,
      accent: t.accent,
      overlayPanel: t.overlayPanel,
      overlayText: t.overlayText
    };
  }

  saveChanges(fields) {
    const defaultName = this.kind === 'photo' ? '图片主题' : '词条主题';
    const name = (this.draft.name || '').trim().slice(0, 6) || defaultName;
    const id = this.editId || ('custom_' + Date.now());
    const obj = customTheme.buildFromDraft(id, name, this.kind, this.draft, fields);
    obj.colorBase = this.draft.colorBase || 'auto';
    if (this.editId) themeMgr.updateCustom(this.editId, obj);
    else themeMgr.addCustom(obj);
    themeMgr.setCurrent(obj.id);
    // 低清备份入账 storage：清旧写新（文件被管家类清理丢失时，启动可自动恢复）
    storage.clearBackups(obj.id);
    const imgs = this.draft.imgBackups || {};
    for (const k in imgs) {
      if (imgs[k]) storage.saveBackup(obj.id, k, imgs[k]);
    }
    this.app.themeDraft = null;
    this.app.themeEdit = null;
    wx.showToast({ title: '已保存并应用', icon: 'none' });
    this.app.switch('themes');
  }

  /* ---------- 渲染 ---------- */

  slotRect(i) {
    const col = i % 4;
    const row = (i / 4) | 0;
    return {
      x: this.margin + col * (this.slotW + this.gap),
      y: this.gridTop + row * (this.slotH + this.gap)
    };
  }

  drawSlot(ctx, value, x, y) {
    const s = this.s;
    const w = this.slotW;
    const filled = this.kind === 'photo' ? !!this.draft.images[value] : !!this.draft.words[value];

    if (this.kind === 'photo' && filled) {
      const e = themeMgr.getTileImage({ id: 'draft', images: this.draft.images }, value);
      if (e && e.ok) {
        // 缩略图 + 数字徽章（最终牌面缩小版）
        ctx.save();
        R.rr(ctx, x, y, w, w, Math.round(10 * s));
        ctx.clip();
        const img = e.img;
        const cs = Math.max(w / img.width, w / img.height);
        ctx.drawImage(img, x + (w - img.width * cs) / 2, y + (w - img.height * cs) / 2, img.width * cs, img.height * cs);
        const badgeH = w * 0.26;
        ctx.font = 'bold ' + Math.round(badgeH * 0.6) + 'px sans-serif';
        const lbl = String(value);
        const badgeW = Math.min(w * 0.9, Math.max(w * 0.3, ctx.measureText(lbl).width + w * 0.16));
        const bx = x + (w - badgeW) / 2;
        const by = y + w - badgeH - w * 0.06;
        R.fillRR(ctx, bx, by, badgeW, badgeH, badgeH / 2, this.theme.hudPanel);
        R.text(ctx, lbl, bx + badgeW / 2, by + badgeH / 2 + 1, Math.round(11 * s), this.theme.hudText, true);
        ctx.restore();
        return;
      }
      // 图片加载中：占位
      R.fillRR(ctx, x, y, w, w, Math.round(10 * s), this.theme.hudPanel);
      R.text(ctx, '…', x + w / 2, y + w / 2, 14, this.theme.hudText);
      return;
    }

    if (this.kind === 'words' && filled) {
      const word = this.draft.words[value];
      const st = themeMgr.tileStyle(this.theme, value);
      const g = ctx.createLinearGradient(0, y, 0, y + w);
      g.addColorStop(0, st.bg1);
      g.addColorStop(1, st.bg2);
      R.fillRR(ctx, x, y, w, w, Math.round(10 * s), g);
      let wfs = Math.round(w * 0.3);
      ctx.font = 'bold ' + wfs + 'px sans-serif';
      while (wfs > 10 && ctx.measureText(word).width > w * 0.88) {
        wfs -= 1;
        ctx.font = 'bold ' + wfs + 'px sans-serif';
      }
      R.text(ctx, word, x + w / 2, y + w * 0.4, wfs, st.fg, true);
      R.text(ctx, String(value), x + w / 2, y + w * 0.78, Math.round(w * 0.18), st.fg);
      return;
    }

    // 空格子：虚线框 + 档位数字
    ctx.save();
    ctx.setLineDash([5, 4]);
    R.strokeRR(ctx, x, y, w, w, Math.round(10 * s), R.hexToRgba(this.theme.hudText, 0.35), 1);
    ctx.setLineDash([]);
    R.text(ctx, String(value), x + w / 2, y + w / 2, Math.round(16 * s), R.hexToRgba(this.theme.hudText, 0.5));
    ctx.restore();
  }

  render(ctx) {
    // 防御：热更新等场景下实例状态缺失时自动补算布局（只检查编辑器自己的字段）
    if (!this.backBtn || !this.nameField || !this.doneBtn) this.computeLayout();
    const W = this.app.W;
    const H = this.app.H;
    R.drawScreenBg(ctx, W, H, this.theme, this.app.dpr);
    this.backBtn.bg = this.theme.btnBg;
    this.backBtn.text = this.theme.btnText;
    R.drawButton(ctx, this.backBtn);
    // 标题（居中）
    const title = this.editId ? '编辑主题' : (this.kind === 'photo' ? '创建图片主题' : '创建词条主题');
    R.text(ctx, title, W / 2, this.app.navSafe + Math.round(20 * this.s), Math.round(18 * this.s), this.theme.hudText, true);
    // 名称栏（返回键下方一行，居中显示，点击可输入/修改）
    const nf = this.nameField;
    R.fillRR(ctx, nf.x, nf.y, nf.w, nf.h, Math.round(10 * this.s), this.theme.hudPanel);
    const nm = this.draft.name || '';
    if (nm) {
      R.text(ctx, nm, nf.x + nf.w / 2, nf.y + nf.h / 2, Math.round(15 * this.s), this.theme.hudText, true);
    } else {
      R.text(ctx, '点击输入主题名', nf.x + nf.w / 2, nf.y + nf.h / 2, Math.round(13 * this.s), R.hexToRgba(this.theme.hudText, 0.6));
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.gridTop, W, this.viewH);
    ctx.clip();
    ctx.translate(0, -this.scroll);
    for (let i = 0; i < VALUES.length; i++) {
      const pos = this.slotRect(i);
      this.drawSlot(ctx, VALUES[i], pos.x, pos.y);
    }
    ctx.restore();

    // 棋盘背景行（网格下方固定区）
    const br = this.bgRowRect();
    R.fillRR(ctx, br.x, br.y, br.w, br.h, Math.round(10 * this.s), this.theme.hudPanel);
    const e = this.draft.image ? this.getPathImage(this.draft.image) : null;
    if (e && e.ok) {
      R.drawImageCover(ctx, e.img, br.x + Math.round(4 * this.s), br.y + Math.round(4 * this.s), Math.round(32 * this.s), Math.round(32 * this.s), Math.round(6 * this.s));
      R.text(ctx, '棋盘背景', br.x + Math.round(46 * this.s), br.y + br.h / 2, Math.round(14 * this.s), this.theme.hudText, false, 'left');
      R.text(ctx, '×', br.x + br.w - Math.round(16 * this.s), br.y + br.h / 2, Math.round(16 * this.s), this.theme.hudText);
    } else {
      R.text(ctx, '棋盘背景（可选）· 点击设置', br.x + Math.round(12 * this.s), br.y + br.h / 2, Math.round(14 * this.s), R.hexToRgba(this.theme.hudText, 0.7), false, 'left');
    }

    // 配色行（网格下方固定区）：显示当前选择，点击弹出选择弹窗
    const cr = this.colorRowRect();
    R.fillRR(ctx, cr.x, cr.y, cr.w, cr.h, Math.round(10 * this.s), this.theme.hudPanel);
    R.text(ctx, '配色', cr.x + Math.round(12 * this.s), cr.y + cr.h / 2, Math.round(14 * this.s), this.theme.hudText, true, 'left');
    R.text(ctx, this.colorBaseLabel(this.draft.colorBase || 'auto'), cr.x + Math.round(56 * this.s), cr.y + cr.h / 2, Math.round(14 * this.s), this.theme.hudText, false, 'left');
    R.text(ctx, '＞', cr.x + cr.w - Math.round(16 * this.s), cr.y + cr.h / 2, Math.round(14 * this.s), R.hexToRgba(this.theme.hudText, 0.6));

    this.doneBtn.bg = this.theme.accent;
    this.doneBtn.text = '#1a1a2e';
    R.drawButton(ctx, this.doneBtn);
    // 已填进度（完成按钮上方）
    R.text(ctx, '已填 ' + this.filledCount() + '/14', W / 2, this.doneBtn.y - Math.round(14 * this.s), Math.round(13 * this.s), this.theme.hudText);

    // 配色选择弹窗
    if (this.colorOpen) {
      ctx.fillStyle = 'rgba(5,7,18,0.72)';
      ctx.fillRect(0, 0, W, H);
      const co = this.colorOptions();
      R.fillRR(ctx, co.px, co.py, co.pw, co.ph, Math.round(16 * this.s), this.theme.overlayPanel);
      R.text(ctx, '选择配色', W / 2, co.py + Math.round(24 * this.s), Math.round(16 * this.s), this.theme.overlayText, true);
      for (const b of co.buttons) R.drawButton(ctx, b);
    }
  }
}

module.exports = ThemeEditorScene;
