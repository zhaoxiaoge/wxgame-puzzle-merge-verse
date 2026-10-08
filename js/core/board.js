/**
 * 2048 棋盘核心逻辑（纯逻辑，不含渲染）
 * tile: { id, value, r, c, prevR, prevC, isNew, mergedFrom }
 *
 * move() 返回动画计划 plan，渲染层据此播放滑动/合并/生成动画：
 *   plan.slides  [{ id, fromR, fromC, toR, toC, value }] 参与滑动的牌
 *   plan.merges  [{ id, r, c, value, underValue }]       合并产生的新牌（underValue 为被吞底牌值）
 *   plan.spawned { id, r, c, value }                     移动后随机生成的新牌
 */
const VECTORS = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 }
};

class Board {
  constructor(size) {
    this.size = size || 4;
    this.rng = Math.random; // 可注入种子随机数（每日挑战用）
    this.clear();
  }

  clear() {
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      this.grid.push(new Array(this.size).fill(null));
    }
    this.tiles = [];
    this.nextId = 1;
    this.rngCalls = 0;
  }

  within(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  cell(r, c) {
    return this.within(r, c) ? this.grid[r][c] : undefined;
  }

  availableCells() {
    const list = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.grid[r][c]) list.push({ r, c });
      }
    }
    return list;
  }

  spawn(r, c, value) {
    const t = { id: this.nextId++, value, r, c, prevR: r, prevC: c, isNew: true, mergedFrom: null };
    this.grid[r][c] = t;
    this.tiles.push(t);
    return t;
  }

  addRandomTile() {
    const cells = this.availableCells();
    if (!cells.length) return null;
    const cell = cells[Math.floor(this.rng() * cells.length)];
    const value = this.rng() < 0.9 ? 2 : 4;
    this.rngCalls += 2;
    return this.spawn(cell.r, cell.c, value);
  }

  /** 移动前调用：记录旧位置，清理动画标记 */
  prepare() {
    for (const t of this.tiles) {
      t.prevR = t.r;
      t.prevC = t.c;
      t.isNew = false;
      t.mergedFrom = null;
    }
  }

  removeTile(t) {
    const i = this.tiles.indexOf(t);
    if (i >= 0) this.tiles.splice(i, 1);
    if (this.grid[t.r][t.c] === t) this.grid[t.r][t.c] = null;
  }

  /** 移除指定格子的方块（消除道具），返回被移除的数值 */
  removeTileAt(r, c) {
    const t = this.within(r, c) ? this.grid[r][c] : null;
    if (!t) return null;
    const value = t.value;
    this.removeTile(t);
    return value;
  }

  findFarthest(r, c, vector) {
    let pr = r;
    let pc = c;
    r += vector.r;
    c += vector.c;
    while (this.within(r, c) && !this.grid[r][c]) {
      pr = r;
      pc = c;
      r += vector.r;
      c += vector.c;
    }
    return { farthest: { r: pr, c: pc }, next: { r, c } };
  }

  /**
   * 执行一次移动
   * @returns {{moved: boolean, gained: number, plan: object|null}}
   */
  move(dir) {
    const vector = VECTORS[dir];
    if (!vector) return { moved: false, gained: 0, plan: null };

    const rows = [];
    const cols = [];
    for (let i = 0; i < this.size; i++) {
      rows.push(i);
      cols.push(i);
    }
    if (vector.r === 1) rows.reverse();
    if (vector.c === 1) cols.reverse();

    this.prepare();
    let moved = false;
    let gained = 0;
    const slides = [];
    const merges = [];
    const mergedIds = new Set();

    for (const r of rows) {
      for (const c of cols) {
        const tile = this.grid[r][c];
        if (!tile) continue;

        const far = this.findFarthest(tile.r, tile.c, vector);
        const nextTile = this.cell(far.next.r, far.next.c);

        if (nextTile && nextTile.value === tile.value && !mergedIds.has(nextTile.id)) {
          // 合并：tile 滑向 nextTile 位置，生成 2 倍值新牌
          const targetR = nextTile.r;
          const targetC = nextTile.c;
          const fromR = tile.r;
          const fromC = tile.c;
          this.removeTile(tile);
          this.removeTile(nextTile);
          const m = this.spawn(targetR, targetC, tile.value * 2);
          m.isNew = false;
          m.mergedFrom = [tile.id, nextTile.id];
          m.prevR = fromR;
          m.prevC = fromC;
          mergedIds.add(m.id);
          gained += m.value;
          moved = true;
          slides.push({ id: tile.id, fromR, fromC, toR: targetR, toC: targetC, value: tile.value });
          merges.push({ id: m.id, r: targetR, c: targetC, value: m.value, underValue: nextTile.value });
        } else if (far.farthest.r !== tile.r || far.farthest.c !== tile.c) {
          // 普通移动
          this.grid[tile.r][tile.c] = null;
          tile.r = far.farthest.r;
          tile.c = far.farthest.c;
          this.grid[tile.r][tile.c] = tile;
          moved = true;
          slides.push({ id: tile.id, fromR: tile.prevR, fromC: tile.prevC, toR: tile.r, toC: tile.c, value: tile.value });
        }
      }
    }

    let spawned = null;
    if (moved) {
      const t = this.addRandomTile();
      if (t) spawned = { id: t.id, r: t.r, c: t.c, value: t.value };
    }

    return { moved, gained, plan: moved ? { slides, merges, spawned } : null };
  }

  hasMoves() {
    if (this.availableCells().length) return true;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c].value;
        if (c + 1 < this.size && this.grid[r][c + 1].value === v) return true;
        if (r + 1 < this.size && this.grid[r + 1][c].value === v) return true;
      }
    }
    return false;
  }

  maxTile() {
    let m = 0;
    for (const t of this.tiles) {
      if (t.value > m) m = t.value;
    }
    return m;
  }

  /** 序列化为纯数值矩阵（存档/撤销用），0 表示空 */
  serialize() {
    const cells = [];
    for (let r = 0; r < this.size; r++) {
      const row = [];
      for (let c = 0; c < this.size; c++) {
        row.push(this.grid[r][c] ? this.grid[r][c].value : 0);
      }
      cells.push(row);
    }
    return cells;
  }

  /** 从数值矩阵恢复（无动画） */
  loadCells(cells) {
    this.clear();
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (cells[r] && cells[r][c]) this.spawn(r, c, cells[r][c]);
      }
    }
  }
}

module.exports = { Board, VECTORS };
