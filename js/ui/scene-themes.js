/**
 * 主题选择页：内置主题 + 自定义主题管理（应用 / 显影开关 / 删除 / 新建）
 */
const themeMgr = require('../render/theme');
const R = require('../render/renderer');

class ThemesScene {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.theme = themeMgr.current();
    const s = this.s = Math.max(0.9, Math.min(this.app.W / 390, 1.25));
    const W = this.app.W;
    const H = this.app.H;
    this.margin = Math.round(16 * s);
    this.gap = Math.round(12 * s);
    this.cardW = (W - this.margin * 2 - this.gap) / 2;
    this.cardH = Math.round(156 * s);
    this.listTop = this.app.navSafe + Math.round(52 * s);
    const fabH = Math.round(52 * s);
    this.viewH = H - this.listTop - fabH - Math.round(24 * s);
    this.fab = {
      id: 'start', label: '开始游戏',
      x: (W - Math.round(200 * s)) / 2, y: H - fabH - Math.round(16 * s),
      w: Math.round(200 * s), h: fabH,
      bg: this.theme.accent, text: '#1a1a2e', fontSize: Math.round(17 * s)
    };
    this.backBtn = {
      id: 'back', label: '返回菜单',
      x: this.margin, y: this.app.navSafe,
      w: Math.round(88 * s), h: Math.round(40 * s),
      bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(14 * s)
    };
    this.scroll = 0;
    this.touch = null;
    this.pickerOpen = false;
    this.rebuild();
  }

  rebuild() {
    const list = [{ kind: 'add' }];
    themeMgr.builtinList().forEach((t) => list.push({ kind: 'builtin', theme: t }));
    themeMgr.customs().forEach((t) => list.push({ kind: 'custom', theme: t }));
    this.items = list;
    this.rows = Math.ceil(list.length / 2);
    this.listH = this.rows * (this.cardH + this.gap);
    this.maxScroll = Math.max(0, this.listH - this.viewH);
    if (this.scroll > this.maxScroll) this.scroll = this.maxScroll;
  }

  exit() {}
  update() {}

  /* ---------- 输入 ---------- */

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

  cardPos(i) {
    const col = i % 2;
    const row = (i / 2) | 0;
    return {
      x: this.margin + col * (this.cardW + this.gap),
      y: this.listTop + row * (this.cardH + this.gap)
    };
  }

  previewPillRect(x, y) {
    const s = this.s;
    return {
      x: x + this.cardW - Math.round(60 * s),
      y: y + Math.round(98 * s),
      w: Math.round(48 * s),
      h: Math.round(20 * s)
    };
  }

  chipRects(x, y) {
    const s = this.s;
    const h = Math.round(26 * s);
    const cy = y + this.cardH - h - Math.round(8 * s);
    const w1 = Math.round((this.cardW - Math.round(30 * s)) * 0.58);
    const w2 = this.cardW - Math.round(20 * s) - w1 - Math.round(10 * s);
    return {
      reveal: { id: 'reveal', x: x + Math.round(10 * s), y: cy, w: w1, h: h },
      del: { id: 'del', x: x + Math.round(10 * s) + w1 + Math.round(10 * s), y: cy, w: w2, h: h }
    };
  }

  pickerButtons() {
    const s = this.s;
    const W = this.app.W;
    const H = this.app.H;
    const pw = Math.round(280 * s);
    const ph = Math.round(240 * s);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const bw = Math.round(220 * s);
    const bh = Math.round(44 * s);
    const mk = (id, label, y) => ({ id, label, x: (W - bw) / 2, y, w: bw, h: bh, bg: this.theme.btnBg, text: this.theme.btnText, fontSize: Math.round(15 * s) });
    return {
      px, py, pw, ph,
      buttons: [
        mk('photo', '图片主题', py + Math.round(56 * s)),
        mk('words', '词条主题', py + Math.round(114 * s)),
        mk('cancel', '取消', py + Math.round(172 * s))
      ]
    };
  }

  tap(x, y) {
    if (this.pickerOpen) {
      const pb = this.pickerButtons();
      for (const b of pb.buttons) {
        if (!R.hit(b, x, y)) continue;
        if (b.id === 'cancel') this.pickerOpen = false;
        else if (b.id === 'photo') { this.pickerOpen = false; this.app.themeDraft = null; this.app.themeEdit = null; this.app.switch('editor', { kind: 'photo' }); }
        else if (b.id === 'words') { this.pickerOpen = false; this.app.themeDraft = null; this.app.themeEdit = null; this.app.switch('editor', { kind: 'words' }); }
      }
      return;
    }
    if (R.hit(this.backBtn, x, y)) {
      this.app.switch('menu');
      return;
    }
    // 悬浮开始按钮浮于卡片之上，优先响应
    if (R.hit(this.fab, x, y)) {
      this.app.switch('game');
      return;
    }
    for (let i = 0; i < this.items.length; i++) {
      const pos = this.cardPos(i);
      const cy = pos.y - this.scroll;
      if (x < pos.x || x > pos.x + this.cardW || y < cy || y > cy + this.cardH) continue;
      const it = this.items[i];
      if (it.kind === 'add') {
        this.pickerOpen = true;
        return;
      }
      // 预览按钮优先于"点卡片应用"
      const pv = this.previewPillRect(pos.x, cy);
      if (R.hit(pv, x, y)) {
        this.app.switch('preview', { themeId: it.theme.id });
        return;
      }
      if (it.kind === 'custom') {
        const chips = this.chipRects(pos.x, cy);
        if (R.hit(chips.reveal, x, y)) {
          // 编辑：重新进入编辑器改图/改词
          this.app.themeDraft = null;
          this.app.switch('editor', { kind: it.theme.kind || 'photo', editId: it.theme.id });
          return;
        }
        if (R.hit(chips.del, x, y)) {
          this.confirmDelete(it.theme);
          return;
        }
      }
      themeMgr.setCurrent(it.theme.id);
      this.theme = themeMgr.current();
      return;
    }
  }

  confirmDelete(t) {
    wx.showModal({
      title: '删除主题',
      content: '确定删除「' + t.name + '」吗？图片将一并删除。',
      confirmText: '删除',
      success: (r) => {
        if (!r.confirm) return;
        themeMgr.removeCustom(t.id);
        this.theme = themeMgr.current();
        this.rebuild();
      }
    });
  }

  pickImage() {
    if (themeMgr.customs().length >= 9) {
      wx.showToast({ title: '最多 9 套自定义主题', icon: 'none' });
      return;
    }
    const app = this.app;
    // 诊断：输出当前隐私授权状态（needAuthorization / 指引名称）
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          console.log('[custom-theme] 隐私状态 needAuthorization =', res.needAuthorization, '，指引名称 =', res.privacyContractName);
        },
        fail: (err) => console.error('[custom-theme] getPrivacySetting fail:', err && err.errMsg)
      });
    }
    const onError = (err) => {
      const msg = (err && err.errMsg) || '未知错误';
      console.error('[custom-theme] 选图失败:', msg);
      if (msg.indexOf('privacy') >= 0) {
        wx.showModal({
          title: '暂时无法打开相册',
          content: '错误详情：' + msg + '\n\n请检查：1.后台《用户隐私保护指引》已声明「选中的照片或视频信息」并审核通过；2.修改指引后需重新生成预览二维码再试。',
          showCancel: false
        });
      } else if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
        wx.showModal({
          title: '无法打开相册',
          content: '相册权限被拒绝，请在微信的「设置-隐私-授权管理」中允许本小游戏访问相册后重试。',
          showCancel: false
        });
      } else {
        wx.showToast({ title: '选图失败 ' + msg.slice(0, 40), icon: 'none' });
      }
    };

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (f && f.tempFilePath) {
          app.switch('crop', { tempPath: f.tempFilePath });
        } else {
          onError({ errMsg: '未返回图片路径' });
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        console.error('[custom-theme] chooseMedia fail:', msg);
        if (msg.indexOf('cancel') >= 0) return; // 用户主动取消，不回退不提示
        // 部分环境（游客模式/旧基础库）不支持 chooseMedia，回退旧接口再试一次
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            const p = res.tempFilePaths && res.tempFilePaths[0];
            if (p) app.switch('crop', { tempPath: p });
            else onError({ errMsg: '未返回图片路径' });
          },
          fail: onError
        });
      }
    });
  }

  /* ---------- 渲染 ---------- */

  drawCard(ctx, it, x, y) {
    const s = this.s;
    const theme = this.theme;
    const isCur = it.theme && it.theme.id === theme.id;
    R.fillRR(ctx, x, y, this.cardW, this.cardH, Math.round(14 * s), theme.hudPanel);
    if (isCur) {
      R.strokeRR(ctx, x + 1, y + 1, this.cardW - 2, this.cardH - 2, Math.round(14 * s), theme.accent, 2);
    } else {
      // 非当前主题也描一圈淡边框，浅色主题下卡片边界更清晰
      R.strokeRR(ctx, x + 1, y + 1, this.cardW - 2, this.cardH - 2, Math.round(14 * s), R.hexToRgba(theme.hudText, 0.25), 1);
    }

    if (it.kind === 'add') {
      // hudText 是"面板/背景上可读"的颜色；btnText 只配实色按钮，浅色主题下会白字白底
      R.text(ctx, '＋', x + this.cardW / 2, y + this.cardH * 0.38, Math.round(40 * s), theme.hudText, true);
      R.text(ctx, '自定义主题', x + this.cardW / 2, y + this.cardH * 0.68, Math.round(14 * s), theme.hudText, true);
      return;
    }

    const t = it.theme;
    // 预览区
    const px = x + Math.round(10 * s);
    const py = y + Math.round(10 * s);
    const pw = this.cardW - Math.round(20 * s);
    const ph = Math.round(88 * s);
    const img = themeMgr.getCustomImage(t);
    if (img) {
      R.drawImageCover(ctx, img, px, py, pw, ph, Math.round(10 * s));
      if (!t.reveal) {
        R.fillRR(ctx, px, py, pw, ph, Math.round(10 * s), 'rgba(8,10,22,0.35)');
      }
    } else {
      R.fillRR(ctx, px, py, pw, ph, Math.round(10 * s), t.screenBg[0]);
    }
    // 六枚示例牌（3×2，均匀覆盖进化链，在预览区内居中）
    const vals = [2, 16, 64, 256, 1024, 4096];
    const cols = 3;
    const gap = Math.round(6 * s);
    const cs = Math.min((ph - gap * 3) / 2, (pw - gap * 4) / cols);
    const gridW = cols * cs + (cols + 1) * gap;
    const gridH = 2 * cs + 3 * gap;
    const gx = px + (pw - gridW) / 2;
    const gy = py + (ph - gridH) / 2;
    for (let k = 0; k < vals.length; k++) {
      const cx = gx + gap + (k % cols) * (cs + gap);
      const cy2 = gy + gap + ((k / cols) | 0) * (cs + gap);
      R.drawTileRaw(ctx, t, cx, cy2, cs, vals[k], 1, 1, Math.round(6 * s));
    }

    // 名称（左对齐）+ 预览按钮（右）
    R.text(ctx, t.name, x + Math.round(12 * s), y + Math.round(108 * s), Math.round(14 * s), theme.hudText, true, 'left');
    const pv = this.previewPillRect(x, y);
    R.fillRR(ctx, pv.x, pv.y, pv.w, pv.h, pv.h / 2, theme.btnBg);
    R.text(ctx, '预览', pv.x + pv.w / 2, pv.y + pv.h / 2 + 1, Math.round(11 * s), theme.btnText, true);

    if (it.kind === 'custom') {
      const chips = this.chipRects(x, y);
      R.fillRR(ctx, chips.reveal.x, chips.reveal.y, chips.reveal.w, chips.reveal.h, chips.reveal.h / 2, theme.btnBg);
      R.text(ctx, '编辑', chips.reveal.x + chips.reveal.w / 2, chips.reveal.y + chips.reveal.h / 2 + 1, Math.round(12 * s), theme.btnText);
      R.fillRR(ctx, chips.del.x, chips.del.y, chips.del.w, chips.del.h, chips.del.h / 2, 'rgba(220,80,80,0.25)');
      R.text(ctx, '删除', chips.del.x + chips.del.w / 2, chips.del.y + chips.del.h / 2 + 1, Math.round(12 * s), '#e5484d');
    } else {
      R.text(ctx, t.desc || '', x + Math.round(12 * s), y + Math.round(130 * s), Math.round(11 * s), theme.hudText, false, 'left');
    }
  }

  render(ctx) {
    const W = this.app.W;
    const H = this.app.H;
    R.drawScreenBg(ctx, W, H, this.theme, this.app.dpr);
    // 返回按钮每帧跟随当前主题配色：切换主题后立即刷新，避免旧配色在浅色背景上看不清
    this.backBtn.bg = this.theme.btnBg;
    this.backBtn.text = this.theme.btnText;
    R.drawButton(ctx, this.backBtn);
    R.text(ctx, '主题', W / 2, this.app.navSafe + Math.round(20 * this.s), Math.round(20 * this.s), this.theme.hudText, true);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.listTop, W, this.viewH);
    ctx.clip();
    ctx.translate(0, -this.scroll);
    for (let i = 0; i < this.items.length; i++) {
      const pos = this.cardPos(i);
      this.drawCard(ctx, this.items[i], pos.x, pos.y);
    }
    ctx.restore();

    // 滚动条
    if (this.maxScroll > 0) {
      const trackH = this.viewH;
      const thumbH = Math.max(40, trackH * (trackH / this.listH));
      const thumbY = this.listTop + (trackH - thumbH) * (this.scroll / this.maxScroll);
      R.fillRR(ctx, W - Math.round(5 * this.s), this.listTop, Math.round(3 * this.s), trackH, 2, R.hexToRgba(this.theme.hudText, 0.15));
      R.fillRR(ctx, W - Math.round(5 * this.s), thumbY, Math.round(3 * this.s), thumbH, 2, R.hexToRgba(this.theme.hudText, 0.45));
    }

    // 悬浮开始按钮（主题跟随，浮于列表之上）
    this.fab.bg = this.theme.accent;
    this.fab.text = '#1a1a2e';
    R.drawButton(ctx, this.fab);

    // 类型选择弹窗（三选一）
    if (this.pickerOpen) {
      ctx.fillStyle = 'rgba(5,7,18,0.72)';
      ctx.fillRect(0, 0, W, H);
      const pb = this.pickerButtons();
      R.fillRR(ctx, pb.px, pb.py, pb.pw, pb.ph, Math.round(16 * this.s), this.theme.overlayPanel);
      R.text(ctx, '选择主题类型', W / 2, pb.py + Math.round(30 * this.s), Math.round(16 * this.s), this.theme.overlayText, true);
      for (const b of pb.buttons) R.drawButton(ctx, b);
    }
  }
}

module.exports = ThemesScene;
