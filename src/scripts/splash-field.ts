/**
 * 开屏页全屏信号场。
 * 一个 rAF 循环内绘制：透明拖影擦除 → 透视网格 → 数码雨 → 粒子 → 指针尾迹 → 冲击波 → 撕裂。
 * 只操作 Canvas 2D，不依赖任何第三方库。
 */

const TAU = Math.PI * 2;

const DARK_PALETTE = {
  accent: '216, 255, 62',
  cyan: '52, 224, 224',
  magenta: '255, 61, 129',
  bone: '231, 230, 225',
};

// 浅色模式：同色相转深，保证奶油底上仍有足够对比
const LIGHT_PALETTE = {
  accent: '90, 107, 0',
  cyan: '11, 143, 143',
  magenta: '211, 26, 94',
  bone: '18, 19, 22',
};

let ACCENT = DARK_PALETTE.accent;
let CYAN = DARK_PALETTE.cyan;
let MAGENTA = DARK_PALETTE.magenta;
let BONE = DARK_PALETTE.bone;

function syncPalette() {
  const light = document.documentElement.dataset.theme === 'light';
  const palette = light ? LIGHT_PALETTE : DARK_PALETTE;
  ACCENT = palette.accent;
  CYAN = palette.cyan;
  MAGENTA = palette.magenta;
  BONE = palette.bone;
}

const RAIN_GLYPHS = '0123456789ABCDEF#%&/<>_';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  tone: 0 | 1 | 2;
};

type Column = {
  x: number;
  y: number;
  speed: number;
  glyphs: string[];
};

type Shard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  len: number;
  tone: 0 | 1;
};

type Blast = {
  x: number;
  y: number;
  age: number;
  life: number;
  maxRadius: number;
  power: number;
};

/** 爆点留下的持续形变场：断口外圈的网格被牵拉，但不断裂；坐标存球面经纬度，跟随自转 */
type Scar = {
  lat: number;
  lon: number;
  radius: number;
  seed: number;
  power: number;
};

export interface SignalField {
  resize: () => void;
  burst: (x: number, y: number) => void;
  setEnergy: (value: number) => void;
  destroy: () => void;
}

export interface SignalFieldOptions {
  onTear?: () => void;
}

const pointer = {
  x: -9999,
  y: -9999,
  active: false,
};

export function createSignalField(
  canvas: HTMLCanvasElement,
  options: SignalFieldOptions = {},
): SignalField {
  const context = canvas.getContext('2d');
  if (!context) {
    return { resize: () => {}, burst: () => {}, setEnergy: () => {}, destroy: () => {} };
  }
  const ctx = context;

  syncPalette();

  const snapshot = document.createElement('canvas');
  const snapCtx = snapshot.getContext('2d');

  const particles: Particle[] = [];
  const columns: Column[] = [];
  const blasts: Blast[] = [];
  const scars: Scar[] = [];
  const shards: Shard[] = [];
  const trail: { x: number; y: number }[] = [];

  // 网格被炸断的片段：true 表示该段已飞走，直到下次整体抖帧才恢复
  const ROWS = 18;
  // 线框地球的经线条数（整圈），只有朝向镜头的一半可见
  const MERIDIANS = 52;
  const ROW_SLOTS = 48;
  const COL_SLOTS = 14;
  let rowBreaks: boolean[][] = [];
  let colBreaks: boolean[][] = [];
  // 半断片段：还剩多少比例接在网格上（1 = 完整，更小 = 段尾被炸掉）
  let rowCut: number[][] = [];
  let colCut: number[][] = [];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let energy = 0;
  let gridPhase = 0;
  let spin = 0;
  let lastTime = 0;
  let frameId = 0;
  let tearUntil = 0;
  let nextTear = 0;
  let disposed = false;

  function buildParticles() {
    const budget = Math.round((width * height) / 1500);
    const count = Math.max(280, Math.min(980, budget));
    particles.length = 0;
    for (let i = 0; i < count; i += 1) {
      const roll = Math.random();
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 26,
        size: Math.random() < 0.08 ? 2 : 1,
        tone: roll < 0.62 ? 0 : roll < 0.9 ? 1 : 2,
      });
    }
  }

  function buildRain() {
    columns.length = 0;
    const gap = 30;
    const count = Math.floor(width / gap);
    for (let i = 0; i < count; i += 1) {
      columns.push({
        x: i * gap + 8 + Math.random() * 6,
        y: Math.random() * height,
        speed: 42 + Math.random() * 150,
        glyphs: Array.from({ length: 6 }, () => RAIN_GLYPHS[Math.floor(Math.random() * RAIN_GLYPHS.length)]),
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rowBreaks = Array.from({ length: ROWS }, () => new Array(ROW_SLOTS).fill(false));
    colBreaks = Array.from({ length: MERIDIANS }, () => new Array(COL_SLOTS).fill(false));
    rowCut = Array.from({ length: ROWS }, () => new Array(ROW_SLOTS).fill(1));
    colCut = Array.from({ length: MERIDIANS }, () => new Array(COL_SLOTS).fill(1));
    scars.length = 0;
    shards.length = 0;
    buildParticles();
    buildRain();
  }

  /** 把网格顶点沿鼠标反向推开，形成力场弯折 */
  function pointerPush(x: number, y: number, radius: number, strength: number) {
    if (!pointer.active) return { x, y };
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 > radius * radius) return { x, y };
    const dist = Math.sqrt(dist2) || 1;
    const falloff = (1 - dist / radius) * strength;
    return { x: x + (dx / dist) * falloff, y: y + (dy / dist) * falloff };
  }

  /** 冲击波半径：炸开后快速外扩，随后减速 */
  function blastRadius(blast: Blast) {
    const t = Math.min(1, blast.age / blast.life);
    return blast.maxRadius * (1 - Math.pow(1 - t, 2.6));
  }

  /**
   * 爆炸空气波对单个坐标的径向位移。
   * 波前外侧被推向外、内侧被负压拉回，一鼓一凹，让平面网格产生 3D 被空气撑开的错觉。
   */
  function shock(x: number, y: number) {
    if (!blasts.length) return { x, y };
    let px = x;
    let py = y;
    for (let i = 0; i < blasts.length; i += 1) {
      const blast = blasts[i];
      const t = Math.min(1, blast.age / blast.life);
      const fade = (1 - t) * (1 - t);
      if (fade <= 0) continue;
      const wavefront = blastRadius(blast);
      const dx = x - blast.x;
      const dy = y - blast.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const band = 34 + wavefront * 0.24;
      const delta = Math.abs(dist - wavefront);
      if (delta >= band) continue;
      const side = dist > wavefront ? 1 : -0.62;
      const amp = blast.power * fade * 68 * (1 - delta / band) * side;
      px += (dx / dist) * amp;
      py += (dy / dist) * amp;
    }
    return { x: px, y: py };
  }

  /** 线框地球的纬度：两极收敛、赤道处最宽 */
  function latitudeReach(t: number) {
    return Math.sin(t * Math.PI * 0.5);
  }

  /** 纬线上某个经度槽当前朝向镜头的程度（跟随自转） */
  function rowFacing(step: number) {
    return Math.cos((step / ROW_SLOTS) * TAU + spin);
  }

  /** 网格几何：横向第 i 行、经度槽 step 的点——纬线按经度排布，随自转一起转 */
  function rowPoint(i: number, step: number) {
    const horizon = height * 0.6;
    const centerX = width * 0.5;
    const t = (i / ROWS + gridPhase) % 1;
    const reach = latitudeReach(t);
    return {
      x: centerX + centerX * reach * Math.sin((step / ROW_SLOTS) * TAU + spin),
      y: horizon + (height - horizon) * (t * t),
    };
  }

  /** 经线当前朝向镜头的程度：cos 为 1 时在正中，0 时在球的边缘 */
  function meridianFacing(i: number) {
    return Math.cos((i / MERIDIANS) * TAU + spin);
  }

  /** 线框地球：第 i 条经线第 step 个点（未位移） */
  function colPoint(i: number, step: number) {
    const horizon = height * 0.6;
    const centerX = width * 0.5;
    const t = step / COL_SLOTS;
    const reach = latitudeReach(t);
    return {
      x: centerX + centerX * reach * Math.sin((i / MERIDIANS) * TAU + spin),
      y: horizon + (height - horizon) * (t * t),
    };
  }

  /** 让一段真实网格线从网格上脱落并飞出 */
  function detach(
    a: { x: number; y: number },
    b: { x: number; y: number },
    bx: number,
    by: number,
  ) {
    const cx = (a.x + b.x) * 0.5;
    const cy = (a.y + b.y) * 0.5;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 3) return;
    let nx = cx - bx;
    let ny = cy - by;
    const dist = Math.hypot(nx, ny) || 1;
    nx /= dist;
    ny /= dist;
    const speed = 150 + Math.random() * 260;
    if (shards.length > 260) shards.shift();
    shards.push({
      x: cx,
      y: cy,
      vx: nx * speed + (Math.random() - 0.5) * 44,
      vy: -60 - Math.random() * 150 + ny * speed * 0.25,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      spin: (Math.random() - 0.5) * 7,
      len: Math.max(6, len * 0.86),
      tone: Math.random() < 0.78 ? 1 : 0,
    });
  }

  /** 把爆点范围内真实存在的网格段逐一断开并抛出；外圈只打断一半 */
  function shatterGrid(bx: number, by: number) {
    const radius = Math.min(190, Math.max(90, width * 0.11));
    const inner2 = radius * radius;
    const outer = radius * 1.5;
    const outer2 = outer * outer;

    if (scars.length > 3) scars.shift();
    // 爆点换算成球面经纬度，断口与牵拉会随自转一起转走
    const horizon = height * 0.6;
    const centerX = width * 0.5;
    const span = Math.max(1, height - horizon);
    const lat = Math.min(1, Math.max(0.04, Math.sqrt((by - horizon) / span)));
    const reach = latitudeReach(lat);
    const u = Math.min(0.965, Math.max(-0.965, (bx - centerX) / Math.max(1, centerX * reach)));
    scars.push({
      lat,
      lon: Math.asin(u) - spin,
      radius,
      seed: Math.random() * TAU,
      power: 1,
    });

    for (let i = 0; i < ROWS; i += 1) {
      for (let s = 0; s < ROW_SLOTS; s += 1) {
        if (rowBreaks[i][s] || rowCut[i][s] < 1) continue;
        if (rowFacing(s + 0.5) <= 0.06) continue;
        const a = rowPoint(i, s);
        const b = rowPoint(i, s + 1);
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const d2 = (mx - bx) * (mx - bx) + (my - by) * (my - by);
        if (d2 > outer2) continue;
        if (d2 > inner2) {
          // 外圈：段尾被炸掉一截，其余仍连在网格上
          const cut = 0.34 + Math.random() * 0.44;
          rowCut[i][s] = cut;
          detach({ x: a.x + (b.x - a.x) * cut, y: a.y + (b.y - a.y) * cut }, b, bx, by);
        } else {
          rowBreaks[i][s] = true;
          detach(a, b, bx, by);
        }
      }
    }

    for (let i = 0; i < MERIDIANS; i += 1) {
      if (meridianFacing(i) <= 0.08) continue;
      for (let s = 0; s < COL_SLOTS; s += 1) {
        if (colBreaks[i][s] || colCut[i][s] < 1) continue;
        const a = colPoint(i, s);
        const b = colPoint(i, s + 1);
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const d2 = (mx - bx) * (mx - bx) + (my - by) * (my - by);
        if (d2 > outer2) continue;
        if (d2 > inner2) {
          const cut = 0.34 + Math.random() * 0.44;
          colCut[i][s] = cut;
          detach(
            { x: a.x + (b.x - a.x) * cut, y: a.y + (b.y - a.y) * cut },
            b,
            bx,
            by,
          );
        } else {
          colBreaks[i][s] = true;
          detach(a, b, bx, by);
        }
      }
    }
  }

  /** 整体抖帧时，线框重新接回 */
  function restoreGrid() {
    for (let i = 0; i < rowBreaks.length; i += 1) rowBreaks[i].fill(false);
    for (let i = 0; i < colBreaks.length; i += 1) colBreaks[i].fill(false);
    for (let i = 0; i < rowCut.length; i += 1) rowCut[i].fill(1);
    for (let i = 0; i < colCut.length; i += 1) colCut[i].fill(1);
    scars.length = 0;
    shards.length = 0;
  }

  /** 断口外圈的持续牵拉：网格被爆炸带弯，但没有断；爆点位置随自转转走 */
  function scarWarp(x: number, y: number) {
    if (!scars.length) return { x, y };
    const horizon = height * 0.6;
    const centerX = width * 0.5;
    let px = x;
    let py = y;
    for (let i = 0; i < scars.length; i += 1) {
      const scar = scars[i];
      const lon = scar.lon + spin;
      const facing = Math.cos(lon);
      if (facing <= 0) continue;
      const reach = latitudeReach(scar.lat);
      const sx = centerX + centerX * reach * Math.sin(lon);
      const sy = horizon + (height - horizon) * (scar.lat * scar.lat);
      const dx = x - sx;
      const dy = y - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const inner = scar.radius;
      const outer = scar.radius * 1.55;
      if (dist <= inner || dist > outer) continue;
      const t = 1 - (dist - inner) / (outer - inner);
      const fall = t * t * facing;
      const wave =
        Math.sin(x * 0.045 + y * 0.09 + scar.seed) *
        Math.cos(y * 0.06 - x * 0.025 + scar.seed * 1.7);
      const pull = fall * (7 + wave * 4) * scar.power;
      px -= (dx / dist) * pull;
      py -= (dy / dist) * pull * 0.8;
      const kink = fall * wave * 6 * scar.power;
      px += (-dy / dist) * kink;
      py += (dx / dist) * kink;
    }
    return { x: px, y: py };
  }

  /** 指针力场 + 冲击波 + 断口外圈形变叠加后的坐标 */
  function displaced(x: number, y: number, radius: number, strength: number) {
    const p = pointerPush(x, y, radius, strength);
    const s = shock(p.x, p.y);
    return scarWarp(s.x, s.y);
  }

  function advanceBlasts(dt: number) {
    for (let i = blasts.length - 1; i >= 0; i -= 1) {
      blasts[i].age += dt;
      if (blasts[i].age >= blasts[i].life) blasts.splice(i, 1);
    }
  }

  function drawGrid(dt: number) {
    const horizon = height * 0.6;
    const centerX = width * 0.5;
    const radius = Math.min(260, width * 0.32);

    gridPhase = (gridPhase + dt * 0.00016) % 1;
    // 线框地球绕竖直轴缓慢自转
    spin = (spin + dt * 0.085) % TAU;
    const boost = 1 + energy * 0.9;
    ctx.lineWidth = 1;

    // 横向纬线：按球面朝向衰减——中点最亮，两端在球的边缘淡出；断口随自转一起转走
    for (let i = 0; i < ROWS; i += 1) {
      const t = (i / ROWS + gridPhase) % 1;
      const reach = latitudeReach(t);
      if (reach < 0.06) continue;
      const halfW = centerX * reach;
      const alpha = (0.02 + 0.2 * Math.pow(t, 1.4)) * boost;
      const grad = ctx.createLinearGradient(centerX - halfW, 0, centerX + halfW, 0);
      // 朝向系数 cos(lon) = sqrt(1 - u²)，与经线的 facing 完全同一套
      const curve = [0, 0.745, 0.943, 1, 0.943, 0.745, 0];
      for (let g = 0; g < curve.length; g += 1) {
        grad.addColorStop(g / (curve.length - 1), `rgba(${ACCENT}, ${(alpha * curve[g]).toFixed(3)})`);
      }
      ctx.strokeStyle = grad;
      ctx.beginPath();
      let drawing = false;
      let raw = rowPoint(i, 0);
      for (let s = 0; s < ROW_SLOTS; s += 1) {
        const next = rowPoint(i, s + 1);
        const facing = rowFacing(s + 0.5);
        if (facing <= 0.02 || rowBreaks[i][s]) {
          drawing = false;
          raw = next;
          continue;
        }
        const cut = rowCut[i][s];
        const end =
          cut < 1 ? { x: raw.x + (next.x - raw.x) * cut, y: raw.y } : next;
        const p = displaced(raw.x, raw.y, radius, 34);
        const q = displaced(end.x, end.y, radius, 34);
        if (!drawing) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        drawing = cut >= 1;
        raw = next;
      }
      ctx.stroke();
    }

    // 经线：线框地球自转，朝向镜头的半边可见，与纬线共用同一套远近衰减
    for (let i = 0; i < MERIDIANS; i += 1) {
      const facing = meridianFacing(i);
      if (facing <= 0.06) continue;
      const grad = ctx.createLinearGradient(0, horizon, 0, height);
      const stops = [0.02, 0.096, 0.143, 0.183, 0.22];
      for (let g = 0; g < stops.length; g += 1) {
        grad.addColorStop(g / (stops.length - 1), `rgba(${ACCENT}, ${(stops[g] * facing).toFixed(3)})`);
      }
      ctx.strokeStyle = grad;
      ctx.beginPath();
      let drawing = false;
      let raw = colPoint(i, 0);
      for (let s = 0; s < COL_SLOTS; s += 1) {
        const next = colPoint(i, s + 1);
        if (colBreaks[i][s]) {
          drawing = false;
          raw = next;
          continue;
        }
        const cut = colCut[i][s];
        const end =
          cut < 1
            ? { x: raw.x + (next.x - raw.x) * cut, y: raw.y + (next.y - raw.y) * cut }
            : next;
        const p = displaced(raw.x, raw.y, radius, 46);
        const q = displaced(end.x, end.y, radius, 46);
        if (!drawing) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        drawing = cut >= 1;
        raw = next;
      }
      ctx.stroke();
    }
  }

  /** 脱落的网格段：像粒子一样持续飞散，直到整体抖帧才清空 */
  function drawShards(dt: number) {
    ctx.lineWidth = 1;
    for (let i = 0; i < shards.length; i += 1) {
      const shard = shards[i];
      shard.vx *= 0.986;
      shard.vy *= 0.986;
      shard.angle += shard.spin * dt;
      shard.spin *= 0.985;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;

      const speed = Math.hypot(shard.vx, shard.vy);
      const alpha = Math.min(0.86, 0.34 + speed / 900);
      const tone = shard.tone === 0 ? BONE : ACCENT;
      const dx = Math.cos(shard.angle) * shard.len;
      const dy = Math.sin(shard.angle) * shard.len;

      // 速度拖影：读作这段网格线被抽走
      if (speed > 40) {
        const tail = Math.min(shard.len * 1.6, speed * 0.06);
        const ux = shard.vx / speed;
        const uy = shard.vy / speed;
        ctx.strokeStyle = `rgba(${tone}, ${(alpha * 0.3).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(shard.x - ux * tail, shard.y - uy * tail);
        ctx.lineTo(shard.x, shard.y);
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(${tone}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(shard.x - dx * 0.5, shard.y - dy * 0.5);
      ctx.lineTo(shard.x + dx * 0.5, shard.y + dy * 0.5);
      ctx.stroke();
    }
  }

  function drawRain(dt: number) {
    ctx.font = `13px ui-monospace, "JetBrains Mono", monospace`;
    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];
      column.y += column.speed * dt;
      if (column.y > height + 260) {
        column.y = -Math.random() * 360;
        column.speed = 42 + Math.random() * 150;
      }
      if (Math.random() < 0.12) {
        const slot = Math.floor(Math.random() * column.glyphs.length);
        column.glyphs[slot] = RAIN_GLYPHS[Math.floor(Math.random() * RAIN_GLYPHS.length)];
      }
      const head = column.y;
      for (let row = 0; row < 6; row += 1) {
        const gy = head - row * 15;
        if (gy < -20 || gy > height + 20) continue;
        if (row === 0) {
          ctx.fillStyle = `rgba(${BONE}, 0.9)`;
        } else {
          ctx.fillStyle = `rgba(${ACCENT}, ${(0.42 - row * 0.06).toFixed(3)})`;
        }
        // 数码雨也被空气波推开，强化整屏扭曲
        const p = shock(column.x, gy);
        ctx.fillText(column.glyphs[row], p.x, p.y);
      }
    }
  }

  function drawParticles(dt: number) {
    const radius = Math.min(300, width * 0.34);
    const radius2 = radius * radius;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];

      if (pointer.active) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < radius2) {
          const dist = Math.sqrt(dist2) || 1;
          const pull = (1 - dist / radius) * 52;
          // 切向旋涡
          p.vx += (-dy / dist) * pull * dt;
          p.vy += (dx / dist) * pull * dt;
          // 轻微排斥，避免全部挤成一团
          p.vx += (dx / dist) * pull * 0.24 * dt;
          p.vy += (dy / dist) * pull * 0.24 * dt;
        }
      }

      // 冲击波前缘把粒子掀飞
      for (let b = 0; b < blasts.length; b += 1) {
        const blast = blasts[b];
        const dx = p.x - blast.x;
        const dy = p.y - blast.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const delta = Math.abs(dist - blastRadius(blast));
        if (delta > 52) continue;
        const t = Math.min(1, blast.age / blast.life);
        const force = blast.power * (1 - t) * 1800 * (1 - delta / 52);
        p.vx += (dx / dist) * force * dt;
        p.vy += (dy / dist) * force * dt;
      }

      p.vx *= 0.986;
      p.vy *= 0.986;
      p.vx += (Math.random() - 0.5) * 0.5;
      p.vy += (Math.random() - 0.5) * 0.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < -8) p.x = width + 8;
      if (p.x > width + 8) p.x = -8;
      if (p.y < -8) p.y = height + 8;
      if (p.y > height + 8) p.y = -8;
    }

    ctx.fillStyle = `rgba(${BONE}, 0.42)`;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (p.tone !== 0) continue;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.fillStyle = `rgba(${ACCENT}, 0.62)`;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (p.tone !== 1) continue;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.fillStyle = `rgba(${CYAN}, 0.5)`;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (p.tone !== 2) continue;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  function drawTrail() {
    if (trail.length < 2) return;
    ctx.strokeStyle = `rgba(${ACCENT}, 0.2)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < trail.length; i += 1) {
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();

    const head = trail[trail.length - 1];
    ctx.fillStyle = `rgba(${BONE}, 0.7)`;
    ctx.fillRect(head.x - 1.5, head.y - 1.5, 3, 3);
  }

  /** 爆炸空气波：宽压差环 + 波前 + 色散 + 中心闪光 */
  function drawBlasts() {
    for (let i = 0; i < blasts.length; i += 1) {
      const blast = blasts[i];
      const t = Math.min(1, blast.age / blast.life);
      const wavefront = blastRadius(blast);
      const fade = Math.pow(1 - t, 1.7);
      if (fade <= 0) continue;

      // 被挤压的空气：极宽、极淡
      ctx.strokeStyle = `rgba(${BONE}, ${(fade * 0.09).toFixed(3)})`;
      ctx.lineWidth = 26 + 58 * t;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, wavefront, 0, TAU);
      ctx.stroke();

      // 波前主环
      ctx.strokeStyle = `rgba(${BONE}, ${(fade * 0.55).toFixed(3)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, wavefront, 0, TAU);
      ctx.stroke();

      // 色散双环：外侧青、内侧品红，模拟空气折射
      ctx.strokeStyle = `rgba(${CYAN}, ${(fade * 0.28).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, wavefront + 8 + t * 12, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${MAGENTA}, ${(fade * 0.22).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, Math.max(1, wavefront - 7 - t * 10), 0, TAU);
      ctx.stroke();

      // 前缘放射速度线
      if (t < 0.42) {
        const spark = Math.pow(1 - t / 0.42, 2);
        ctx.strokeStyle = `rgba(${ACCENT}, ${(spark * 0.32).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const count = 28;
        for (let s = 0; s < count; s += 1) {
          const angle = (s / count) * TAU;
          const inner = wavefront * (0.62 + (s % 3) * 0.08);
          ctx.moveTo(blast.x + Math.cos(angle) * inner, blast.y + Math.sin(angle) * inner);
          ctx.lineTo(blast.x + Math.cos(angle) * wavefront, blast.y + Math.sin(angle) * wavefront);
        }
        ctx.stroke();
      }

      // 中心闪白
      if (t < 0.2) {
        const core = Math.pow(1 - t / 0.2, 2);
        const radius = 28 + 150 * t;
        const gradient = ctx.createRadialGradient(blast.x, blast.y, 0, blast.x, blast.y, radius);
        gradient.addColorStop(0, `rgba(${BONE}, ${(core * 0.45).toFixed(3)})`);
        gradient.addColorStop(0.45, `rgba(${ACCENT}, ${(core * 0.14).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${ACCENT}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blast.x, blast.y, radius, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** 周期性撕裂：用上一帧快照横向切开错位，同时回调让 DOM 抖帧 */
  function drawTear(now: number) {
    if (now > nextTear && now > tearUntil && snapCtx) {
      snapCtx.setTransform(1, 0, 0, 1, 0, 0);
      snapCtx.clearRect(0, 0, canvas.width, canvas.height);
      snapCtx.drawImage(canvas, 0, 0);
      tearUntil = now + 120;
      nextTear = now + 2400 + Math.random() * 2800;
      // 整体抖帧的同时，被炸散的线框重新接回
      restoreGrid();
      options.onTear?.();
    }

    if (now >= tearUntil || !snapCtx) return;

    const progress = 1 - (tearUntil - now) / 120;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bands = 4;
    for (let i = 0; i < bands; i += 1) {
      const sourceY = Math.random() * canvas.height * 0.82;
      const sliceH = Math.random() * canvas.height * 0.045 + 10;
      const offset = (Math.random() - 0.5) * 90 * (1 - progress) * dpr;
      ctx.drawImage(snapshot, 0, sourceY, canvas.width, sliceH, offset, sourceY, canvas.width, sliceH);
    }
    ctx.restore();
  }

  function frame(now: number) {
    if (disposed) return;
    const raw = lastTime ? (now - lastTime) / 1000 : 0.016;
    const dt = Math.min(0.05, Math.max(0.004, raw));
    lastTime = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 透明擦除：保留拖影但不遮挡页面背景
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    advanceBlasts(dt);
    drawGrid(dt);
    drawRain(dt);
    drawParticles(dt);
    drawShards(dt);
    drawTrail();
    drawBlasts();
    drawTear(now);

    trail.shift();

    frameId = requestAnimationFrame(frame);
  }

  function onPointerMove(event: PointerEvent) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    trail.push({ x: event.clientX, y: event.clientY });
    if (trail.length > 22) trail.shift();
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  const observer = new ResizeObserver(() => {
    resize();
  });

  resize();
  observer.observe(canvas);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave);
  nextTear = performance.now() + 1200;
  frameId = requestAnimationFrame(frame);

  return {
    resize,
    burst(x: number, y: number) {
      if (blasts.length > 2) blasts.shift();
      blasts.push({
        x,
        y,
        age: 0,
        life: 1.35,
        maxRadius: Math.hypot(width, height) * 0.62,
        power: 1,
      });

      // 爆心把附近粒子瞬间掀飞
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 380) continue;
        const kick = (1 - dist / 380) * 300;
        p.vx += (dx / dist) * kick;
        p.vy += (dy / dist) * kick;
      }

      // 只有落在透视地面上的点击才会撕开线框
      const horizon = height * 0.6;
      if (y >= horizon) {
        shatterGrid(x, Math.min(height - 12, y));
      }
    },
    setEnergy(value: number) {
      energy = Math.max(0, Math.min(1, value));
      // 能量越高，粒子整体速度越快，网格更亮
      for (let i = 0; i < particles.length; i += 1) {
        particles[i].vx += (Math.random() - 0.5) * energy * 6;
        particles[i].vy += (Math.random() - 0.5) * energy * 6;
      }
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
