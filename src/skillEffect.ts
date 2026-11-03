import { ANTI_GRAVITY_DURATION, FREEZE_RADIUS, MAGNET_RANGE, SKILL_LABEL_DURATION } from './data/constants';
import type { GameObject } from './gameObject';
import type { ColorTheme } from './types/ColorTheme';
import type { VectorLike } from './types/VectorLike';

const lifetime = 500;

export class SkillEffect implements GameObject {
  private _size: number = 0;
  position: VectorLike;
  private _elapsed: number = 0;
  isDestroy: boolean = false;

  constructor(x: number, y: number) {
    this.position = { x, y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    this._size = (this._elapsed / lifetime) * 10;
    if (this._elapsed > lifetime) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    ctx.save();
    const rate = this._elapsed / lifetime;
    ctx.globalAlpha = 1 - rate * rate;
    ctx.strokeStyle = theme.skillColor;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this._size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 부스터: 구슬을 따라가며 위쪽으로 꼬리 같은 선을 그린다.
 * 구슬은 골인 500ms 뒤에 물리에서 지워지므로 그보다 짧게 살아야 지워진 구슬 위치(0, 0)를 따라가지 않는다
 */
const BOOST_LIFETIME = 400;
const BOOST_TRAIL_LENGTH = 1.5;

export class BoostEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;

  constructor(private _target: VectorLike) {}

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._elapsed > BOOST_LIFETIME) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / BOOST_LIFETIME);
    const { x, y } = this._target;
    const length = BOOST_TRAIL_LENGTH * (1 - rate * 0.5);
    ctx.save();
    ctx.globalAlpha = 1 - rate * rate;
    ctx.strokeStyle = theme.skillColors.boost;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    // 가운데 긴 선 하나와 양옆 짧은 선 두 개
    for (const [dx, scale] of [
      [0, 1],
      [-0.15, 0.6],
      [0.15, 0.6],
    ]) {
      ctx.moveTo(x + dx, y - 0.3);
      ctx.lineTo(x + dx, y - 0.3 - length * scale);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** 자리 바꾸기: 두 구슬 자리를 잇는 선이 잠깐 보였다 사라진다 */
const SWAP_LIFETIME = 500;

export class SwapEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;
  private _from: VectorLike;
  private _to: VectorLike;

  constructor(from: VectorLike, to: VectorLike) {
    this._from = { x: from.x, y: from.y };
    this._to = { x: to.x, y: to.y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._elapsed > SWAP_LIFETIME) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / SWAP_LIFETIME);
    ctx.save();
    ctx.globalAlpha = 1 - rate * rate;
    ctx.strokeStyle = theme.skillColors.swap;
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(this._from.x, this._from.y);
    ctx.lineTo(this._to.x, this._to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [this._from, this._to]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 얼음: 하늘색 원이 얼음 반경까지 퍼진다 */
const FREEZE_LIFETIME = 600;

export class FreezeEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;
  private _position: VectorLike;

  constructor(x: number, y: number) {
    this._position = { x, y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._elapsed > FREEZE_LIFETIME) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / FREEZE_LIFETIME);
    // 빠르게 퍼지고 천천히 멈춘다
    const radius = FREEZE_RADIUS * (1 - (1 - rate) * (1 - rate));
    ctx.save();
    ctx.globalAlpha = 1 - rate * rate;
    ctx.fillStyle = theme.skillColors.freeze;
    ctx.strokeStyle = theme.skillColors.freeze;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(this._position.x, this._position.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha *= 0.2;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 반중력: 구슬을 따라가며 작은 점들이 위로 올라간다.
 * 골인한 구슬은 물리에서 지워지면 위치가 (0, 0) 이 되므로 골인 뒤에는 따라가지 않는다
 */
const ANTI_GRAVITY_DOTS = 6;
const ANTI_GRAVITY_DOT_RISE = 1.2;

export class AntiGravityEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;
  private _position: VectorLike;
  private _following = true;
  /** 점마다 가로 위치(-1 ~ 1)와 출발 시점(0 ~ 1)을 다르게 해서 보글보글 올라가게 한다 */
  private _dots: { dx: number; phase: number }[];

  constructor(
    private _target: VectorLike,
    private _goalY: number
  ) {
    this._position = { x: _target.x, y: _target.y };
    this._dots = Array.from({ length: ANTI_GRAVITY_DOTS }, (_, i) => ({
      dx: Math.random() * 2 - 1,
      phase: i / ANTI_GRAVITY_DOTS,
    }));
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._following) {
      if (this._target.y > this._goalY) {
        this._following = false;
      } else {
        this._position = { x: this._target.x, y: this._target.y };
      }
    }
    if (this._elapsed > ANTI_GRAVITY_DURATION) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / ANTI_GRAVITY_DURATION);
    const { x, y } = this._position;
    ctx.save();
    ctx.fillStyle = theme.skillColors.antiGravity;
    for (const dot of this._dots) {
      // 점 하나는 전체 시간의 절반 동안 아래에서 위로 올라가며 흐려진다
      const t = (rate * 2 - dot.phase) % 1;
      if (t < 0) continue;
      ctx.globalAlpha = (1 - t) * (1 - rate * rate);
      ctx.beginPath();
      ctx.arc(x + dot.dx * 0.3, y + 0.2 - t * ANTI_GRAVITY_DOT_RISE, 3 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 자석: 원이 바깥(자석 범위)에서 안쪽으로 좁아진다. 두 겹이 차례로 좁아진다 */
const MAGNET_LIFETIME = 600;

export class MagnetEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;
  private _position: VectorLike;

  constructor(x: number, y: number) {
    this._position = { x, y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._elapsed > MAGNET_LIFETIME) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / MAGNET_LIFETIME);
    ctx.save();
    ctx.strokeStyle = theme.skillColors.magnet;
    ctx.lineWidth = 2 / zoom;
    for (const delay of [0, 0.3]) {
      const t = (rate - delay) / (1 - delay);
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = Math.min(1, t * 4) * (1 - t * 0.5);
      ctx.beginPath();
      ctx.arc(this._position.x, this._position.y, Math.max(0.3, MAGNET_RANGE * (1 - t * t)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 스킬 이름 말풍선: 구슬 위에서 위로 살짝 떠오르며 사라진다.
 * 구슬 이름(marble.ts 의 _drawName)처럼 1/zoom 으로 그려서 줌과 상관없이 글자 크기가 일정하다
 */
const LABEL_RISE = 0.8;

export class SkillLabelEffect implements GameObject {
  private _elapsed = 0;
  isDestroy = false;
  private _position: VectorLike;
  /** 구슬이 골인하면 더 따라가지 않는다. 골인 뒤 물리에서 지워진 구슬은 위치가 (0, 0) 이 되기 때문 */
  private _following = true;

  constructor(
    private _target: VectorLike,
    private _text: string,
    private _color: string,
    private _goalY: number
  ) {
    this._position = { x: _target.x, y: _target.y };
  }

  update(deltaTime: number) {
    this._elapsed += deltaTime;
    if (this._following) {
      if (this._target.y > this._goalY) {
        this._following = false;
      } else {
        this._position = { x: this._target.x, y: this._target.y };
      }
    }
    if (this._elapsed > SKILL_LABEL_DURATION) {
      this.isDestroy = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, zoom: number, theme: ColorTheme) {
    const rate = Math.min(1, this._elapsed / SKILL_LABEL_DURATION);
    // 처음엔 빠르게 올라가다 천천히 멈춘다
    const rise = LABEL_RISE * (1 - (1 - rate) * (1 - rate));
    ctx.save();
    ctx.globalAlpha = rate < 0.6 ? 1 : 1 - (rate - 0.6) / 0.4;
    ctx.translate(this._position.x, this._position.y - 0.5 - rise);
    ctx.scale(1 / zoom, 1 / zoom);
    ctx.font = 'bold 12pt sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowBlur = 0;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.background;
    ctx.fillStyle = this._color;
    ctx.strokeText(this._text, 0, 0);
    ctx.fillText(this._text, 0, 0);
    ctx.restore();
  }
}
