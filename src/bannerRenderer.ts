import { BANNER_DURATION } from './data/constants';
import type { RenderParameters } from './rouletteRenderer';
import type { Rect } from './types/rect.type';
import type { UIObject } from './UIObject';

/** 나타날 때와 사라질 때 걸리는 시간(ms) */
const FADE_TIME = 200;

/**
 * 역전 알림 배너. 화면 위쪽 가운데에 잠깐 떴다가 사라진다.
 * 언제 띄울지는 roulette.ts 가 정하고, 여기서는 그리기만 한다
 */
export class BannerRenderer implements UIObject {
  private _text = '';
  private _hue = 0;
  private _remaining = 0;

  show(text: string, hue: number) {
    this._text = text;
    this._hue = hue;
    this._remaining = BANNER_DURATION;
  }

  hide() {
    this._remaining = 0;
  }

  update(deltaTime: number) {
    if (this._remaining > 0) {
      this._remaining = Math.max(0, this._remaining - deltaTime);
    }
  }

  render(ctx: CanvasRenderingContext2D, { theme }: RenderParameters, width: number, height: number) {
    if (this._remaining <= 0) return;

    const shown = BANNER_DURATION - this._remaining;
    const alpha = Math.min(1, shown / FADE_TIME, this._remaining / FADE_TIME);
    // 나타날 때 위에서 살짝 내려온다
    const slide = (1 - Math.min(1, shown / FADE_TIME)) * -10;

    const fontSize = Math.round(Math.min(28, Math.max(16, height * 0.045)));
    const padX = fontSize * 0.9;
    const padY = fontSize * 0.45;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(this._text).width;
    const boxW = textW + padX * 2;
    const boxH = fontSize + padY * 2;
    const x = width / 2;
    const y = fontSize * 1.2 + boxH / 2 + slide;

    ctx.fillStyle = theme.winnerBackground;
    ctx.strokeStyle = `hsl(${this._hue} 100% ${theme.marbleLightness}%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.background;
    ctx.fillStyle = `hsl(${this._hue} 100% ${theme.marbleLightness}%)`;
    ctx.strokeText(this._text, x, y);
    ctx.fillText(this._text, x, y);
    ctx.restore();
  }

  getBoundingBox(): Rect | null {
    return null;
  }
}
