import { FREEZE_RADIUS } from './data/constants';
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
