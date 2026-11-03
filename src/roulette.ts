import { BannerRenderer } from './bannerRenderer';
import { Camera } from './camera';
import {
  BANNER_COOLDOWN,
  BANNER_DURATION,
  BANNER_START_DELAY,
  canvasHeight,
  canvasWidth,
  initialZoom,
  SKILL_LABELS,
  Skills,
  Themes,
  zoomThreshold,
} from './data/constants';
import { type StageDef, stages } from './data/maps';
import { FastForwader } from './fastForwader';
import type { GameObject } from './gameObject';
import type { IPhysics } from './IPhysics';
import { Marble } from './marble';
import { Minimap } from './minimap';
import options, { type WinnerRange } from './options';
import { ParticleManager } from './particleManager';
import { Box2dPhysics } from './physics-box2d';
import { ProgressMap } from './progressMap';
import { RankRenderer } from './rankRenderer';
import { type AdHit, RouletteRenderer } from './rouletteRenderer';
import {
  AntiGravityEffect,
  BoostEffect,
  FreezeEffect,
  MagnetEffect,
  SkillEffect,
  SkillLabelEffect,
  SwapEffect,
} from './skillEffect';
import { applySkill } from './skillLogic';
import { type SoundName, sound } from './sound';
import type { RoundAd } from './types/Ad.type';
import type { ColorTheme } from './types/ColorTheme';
import type { MouseEventHandlerName, MouseEventName } from './types/mouseEvents.type';
import type { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { parseName, shuffle } from './utils/utils';
import { VideoRecorder } from './utils/videoRecorder';
import { drawZoomZones, zoomZoneIntensity } from './zoomZone';

/** 입력 범위를 실제 구슬 수에 맞춰 자른다. 범위를 넘기면 뒤쪽이 잘린다 */
function clipWinnerRange({ start, end }: WinnerRange, marbleCount: number): WinnerRange {
  const last = Math.max(0, marbleCount - 1);
  const clippedStart = Math.min(Math.max(0, start), last);
  return { start: clippedStart, end: Math.min(Math.max(clippedStart, end), last) };
}

/**
 * 순위 흔들림 줄이기. 구슬마다 순위 값(결승까지 남은 거리) 을 이 시간(초) 동안 부드럽게 따라가고,
 * 앞 구슬보다 RANK_MARGIN 넘게 앞서야 자리를 바꾼다
 */
const RANK_EMA_SEC = 0.4;

/** 스킬별 효과음 */
const SKILL_SOUNDS: Partial<Record<Skills, SoundName>> = {
  [Skills.Impact]: 'impact',
  [Skills.Boost]: 'boost',
  [Skills.Swap]: 'swap',
  [Skills.Freeze]: 'freeze',
  [Skills.AntiGravity]: 'antiGravity',
  [Skills.Magnet]: 'magnet',
};
const RANK_MARGIN = 0.25;

export class Roulette extends EventTarget {
  private _marbles: Marble[] = [];

  private _lastTime: number = 0;
  private _elapsed: number = 0;

  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;

  private _winners: Marble[] = [];
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null;
  /** 'builtin:{index}' | 'community:{id}'. 맵 공유마당에서 받은 맵은 stages 에 없어서 인덱스 대신 이 값으로 구분한다 */
  private _mapId = 'builtin:0';

  protected _camera: Camera = new Camera();
  protected _renderer: RouletteRenderer;

  private _effects: GameObject[] = [];

  private _winnerRange: WinnerRange = { start: 0, end: 0 };
  private _goalDist: number = Infinity;
  /** 연출 구역이 있는 맵에서 커트라인을 다투는 두 구슬 중 센 쪽의 연출 강도 (0 ~ 1). 구역이 없으면 null 이고 zoomY 로 판단한다 */
  private _zoomIntensity: number | null = null;
  /** 연출이 _targetIndex 구슬이 아니라 _rivalIndex 구슬 때문에 걸렸는지 */
  private _focusOnRival = false;
  /** 구슬별 평활화한 순위 값 (결승까지 남은 거리) */
  private _rankKeys = new Map<Marble, number>();
  /** 진행도 지도 그림 (setProgressDebug 로 켰을 때 맵마다 한 번 만든다) */
  private _progressImage: { map: ProgressMap; image: HTMLCanvasElement } | null = null;
  private _isRunning: boolean = false;
  /** 진행 중에는 null, 당첨자가 모두 확정되면 당첨자 배열 */
  private _result: Marble[] | null = null;

  // 구슬 id(= order)는 매 라운드 재사용된다. 리셋 시 취소하지 않으면 이 타이머가
  // 뒤늦게 발화해 같은 id를 가진 새 라운드의 구슬을 지워버린다
  private _pendingRemovals: number[] = [];

  private _uiObjects: UIObject[] = [];

  /** 역전 알림 배너 */
  private _banner = new BannerRenderer();
  /** 이번 라운드가 시작된 뒤 지난 시간(ms) */
  private _roundTime = 0;
  /** 다음 배너를 띄울 수 있는 시각 (_roundTime 기준) */
  private _nextBannerTime = 0;
  /** 지난 프레임에 당첨 자리에 있던 구슬과 그때의 골인 수 */
  private _lastLeader: Marble | null = null;
  private _lastWinnerCount = 0;
  /** 라운드 시작 때 구슬 수. 꼴찌 모드인지 판단하는 데 쓴다 */
  private _roundMarbleCount = 0;

  private _autoRecording: boolean = false;
  private _recorder!: VideoRecorder;

  private physics!: IPhysics;

  private _isReady: boolean = false;
  protected fastForwarder!: FastForwader;
  protected _theme: ColorTheme = Themes.dark;

  get isReady() {
    return this._isReady;
  }

  protected createRenderer(): RouletteRenderer {
    return new RouletteRenderer();
  }

  protected createFastForwader(): FastForwader {
    return new FastForwader();
  }

  constructor() {
    super();
    this._renderer = this.createRenderer();
    this._renderer.init().then(() => {
      this._init().then(() => {
        this._isReady = true;
        this._update();
      });
    });
  }

  public getZoom() {
    return initialZoom * this._camera.zoom;
  }

  private addUiObject(obj: UIObject) {
    this._uiObjects.push(obj);
    if (obj.onWheel) {
      this._renderer.canvas.addEventListener('wheel', obj.onWheel);
    }
    if (obj.onMessage) {
      obj.onMessage((msg) => {
        console.log('onMessage', msg);
        this.dispatchEvent(new CustomEvent('message', { detail: msg }));
      });
    }
  }

  @bound
  private _update() {
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this._speed * this.fastForwarder.speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    // _timeScale 은 _updateMarbles 에서 갱신되지만 물리 스텝 크기는 이 프레임 시작값으로 고정된다.
    // 구슬 정지 판정도 같은 값을 써야 실제 진행된 물리 시간과 맞는다
    const timeScale = this._timeScale;
    const interval = (this._updateInterval / 1000) * timeScale;

    let simSeconds = 0;
    let steps = 0;
    while (this._elapsed >= this._updateInterval) {
      steps++;
      simSeconds += interval;
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval, timeScale);
      this._particleManager.update(this._updateInterval);
      this._updateEffects(this._updateInterval);
      this._elapsed -= this._updateInterval;
      this._uiObjects.forEach((obj) => obj.update(this._updateInterval));
    }

    if (this._marbles.length > 1) {
      this._sortMarbles(simSeconds);
    }
    this._checkLeaderChange(steps * this._updateInterval);

    if (this._stage) {
      const cameraTargetIndex = this._winners.length > 0 ? this._targetIndex : 0;
      this._camera.update({
        marbles: this._marbles,
        stage: this._stage,
        intensity: this._zoomIntensity ?? Math.max(0, 1 - this._goalDist / zoomThreshold),
        targetIndex: cameraTargetIndex,
        // 첫 골인 전에는 카메라가 커트라인 대신 선두를 따라가므로 커트라인 쪽 판단을 넘기지 않는다
        focusOnRival: cameraTargetIndex === this._targetIndex && this._focusOnRival,
        viewSize: { x: this._renderer.width / initialZoom, y: this._renderer.height / initialZoom },
      });
    }

    this._render();
    window.requestAnimationFrame(this._update);
  }

  /**
   * 순위대로 정렬한다. 순위 값은 진행도 지도의 "결승까지 남은 거리" (progressMap.ts).
   * dt = 이번 프레임에 진행된 물리 시간(초)
   */
  private _sortMarbles(dt: number) {
    if (!this._stage) return;
    const map = ProgressMap.for(this._stage);

    /** 지난 프레임 기록이 있는 구슬 수. 구슬을 새로 넣은 직후면 0 */
    let known = 0;
    const alpha = 1 - Math.exp(-dt / RANK_EMA_SEC);
    const keys = new Map<Marble, number>();
    for (const m of this._marbles) {
      const raw = map.distanceAt(m.x, m.y);
      const prev = this._rankKeys.get(m);
      if (prev !== undefined) known++;
      keys.set(m, prev !== undefined ? prev + (raw - prev) * alpha : raw);
    }
    this._rankKeys = keys;

    // 구슬을 막 넣었을 때는 지난 순서가 없으니 그냥 정렬한다
    if (known < this._marbles.length / 2) {
      this._marbles.sort((a, b) => keys.get(a)! - keys.get(b)! || b.y - a.y);
      return;
    }
    // 지난 프레임 순서에서 출발해, 앞 구슬보다 RANK_MARGIN 넘게 앞설 때만 앞으로 보낸다 (여유를 둔 삽입 정렬).
    // 순서가 거의 그대로라 일반 정렬보다 빠르다
    const list = this._marbles;
    for (let i = 1; i < list.length; i++) {
      const m = list[i];
      const k = keys.get(m)! + RANK_MARGIN;
      let j = i;
      while (j > 0 && k < keys.get(list[j - 1])!) {
        list[j] = list[j - 1];
        j--;
      }
      list[j] = m;
    }
  }

  /** 진행도 지도(순위 계산에 쓰는 남은 거리), 일방통행 선, 연출 구역, 카메라 구역을 맵 위에 그린다 (테스트 플레이에서 확인용) */
  public setProgressDebug(on: boolean) {
    this._renderer.debugDraw = on
      ? (ctx) => {
          if (!this._stage) return;
          const map = ProgressMap.for(this._stage);
          if (this._progressImage?.map !== map) this._progressImage = { map, image: map.toCanvas() };
          map.drawDebug(ctx, this._progressImage.image);
          if (this._stage.zoomZones?.length) drawZoomZones(ctx, this._stage.zoomZones);
          if (this._stage.cameraZones?.length) drawZoomZones(ctx, this._stage.cameraZones, '200, 60, 255');
        }
      : null;
  }

  private _updateMarbles(deltaTime: number, timeScale: number) {
    if (!this._stage) return;

    for (let i = 0; i < this._marbles.length; i++) {
      const marble = this._marbles[i];
      marble.update(deltaTime, timeScale);
      if (marble.skill === Skills.Impact) {
        this._effects.push(new SkillEffect(marble.x, marble.y));
        this.physics.impact(marble.id);
        this._onSkillUsed(marble, marble.skill);
      } else if (marble.skill !== Skills.None) {
        if (this._useSkill(marble, marble.skill)) {
          this._onSkillUsed(marble, marble.skill);
        }
      }
      if (marble.y > this._stage.goalY) {
        this._winners.push(marble);
        sound.play('goal');
        if (this._isRunning && this._isWinningRank(this._winners.length - 1)) {
          this._particleManager.shot(this._renderer.width, this._renderer.height);
        }
        this._pendingRemovals.push(
          window.setTimeout(() => {
            this.physics.removeMarble(marble.id);
          }, 500)
        );
      }
    }

    // 연출(줌인, 슬로모션) 은 커트라인을 다투는 두 구슬 중 연출이 더 센 쪽을 기준으로 건다.
    // 예: 꼴찌를 뽑을 때는 바로 앞 구슬이 골인하는 순간 꼴찌가 정해진다
    const stage = this._stage;
    const zones = stage.zoomZones?.length ? stage.zoomZones : null;
    const intensityOf = (m: Marble) =>
      zones ? zoomZoneIntensity(zones, m.x, m.y) : Math.max(0, 1 - Math.abs(stage.zoomY - m.y) / zoomThreshold);
    const target = this._marbles[this._targetIndex];
    const rival = this._marbles[this._rivalIndex];
    this._focusOnRival = !!target && !!rival && intensityOf(rival) > intensityOf(target);
    const focus = this._focusOnRival ? rival : target;
    this._goalDist = Math.abs(stage.zoomY - (focus ? focus.y : 0));
    this._zoomIntensity = zones ? (focus ? intensityOf(focus) : 0) : null;
    this._timeScale = this._calcTimeScale();

    this._marbles = this._marbles.filter((marble) => marble.y <= this._stage?.goalY);

    this._checkFinish();
  }

  /** 스킬이 실제로 발동한 뒤: 효과음을 내고 구슬 위에 스킬 이름을 잠깐 띄운다 */
  private _onSkillUsed(marble: Marble, skill: Skills) {
    const soundName = SKILL_SOUNDS[skill];
    if (soundName) sound.play(soundName);
    const label = SKILL_LABELS[skill];
    if (!label || !this._stage) return;
    this._effects.push(new SkillLabelEffect(marble, label, this._skillColor(skill), this._stage.goalY));
  }

  private _skillColor(skill: Skills): string {
    switch (skill) {
      case Skills.Boost:
        return this._theme.skillColors.boost;
      case Skills.Swap:
        return this._theme.skillColors.swap;
      case Skills.Freeze:
        return this._theme.skillColors.freeze;
      case Skills.AntiGravity:
        return this._theme.skillColors.antiGravity;
      case Skills.Magnet:
        return this._theme.skillColors.magnet;
      default:
        return this._theme.skillColor;
    }
  }

  /**
   * Impact 외의 새 스킬을 발동한다. 물리 처리는 skillLogic.ts 가 하고 여기서는 이펙트만 붙인다.
   * 실제로 아무 일도 없었으면 false
   */
  private _useSkill(marble: Marble, skill: Skills): boolean {
    if (!this._stage) return false;
    const goalY = this._stage.goalY;
    const candidates = this._marbles.filter((m) => m.y <= goalY);
    // 이펙트가 발동 위치를 쓰므로 물리 처리 전에 기억해 둔다 (자리 바꾸기는 위치가 바뀐다)
    const origin = { x: marble.x, y: marble.y };
    const result = applySkill(this.physics, marble, skill, candidates);
    if (!result) return false;

    switch (skill) {
      case Skills.Boost:
        this._effects.push(new BoostEffect(marble));
        break;
      case Skills.Swap:
        // 바꾼 뒤에는 발동한 구슬이 상대의 원래 자리에 있다
        this._effects.push(new SwapEffect(origin, marble));
        break;
      case Skills.Freeze:
        this._effects.push(new FreezeEffect(origin.x, origin.y));
        break;
      case Skills.AntiGravity:
        this._effects.push(new AntiGravityEffect(marble, goalY));
        break;
      case Skills.Magnet:
        this._effects.push(new MagnetEffect(origin.x, origin.y));
        break;
    }
    return true;
  }

  /**
   * 당첨 자리(_targetIndex)의 구슬이 바뀌었으면 역전 배너를 띄운다.
   * 순위는 _sortMarbles 의 결과를 읽기만 한다
   */
  private _checkLeaderChange(deltaMs: number) {
    if (!this._isRunning) return;
    this._roundTime += deltaMs;

    const slowMotion = this._timeScale < 1;
    // 결승 슬로모션 연출을 가리지 않게 떠 있던 배너도 바로 숨긴다
    if (slowMotion) this._banner.hide();

    const leader = this._marbles[this._targetIndex] ?? null;
    const prevLeader = this._lastLeader;
    // 구슬이 골인하면 당첨 자리가 한 칸씩 밀리는데, 이건 역전이 아니므로 기준만 새로 잡는다
    const someoneFinished = this._winners.length !== this._lastWinnerCount;
    this._lastLeader = leader;
    this._lastWinnerCount = this._winners.length;

    if (!leader || !prevLeader || leader === prevLeader || someoneFinished) return;
    if (slowMotion || this._roundTime < BANNER_START_DELAY || this._roundTime < this._nextBannerTime) return;

    this._banner.show(this._bannerText(leader), leader.hue);
    this._nextBannerTime = this._roundTime + BANNER_DURATION + BANNER_COOLDOWN;
  }

  /** 당첨 모드에 맞는 배너 문구 */
  private _bannerText(marble: Marble): string {
    const { start, end } = this._winnerRange;
    if (start === 0 && end === 0) return `${marble.name} 1위 탈환!`;
    if (start === end && end === this._roundMarbleCount - 1) return `${marble.name} 꼴찌 위기!`;
    return `${marble.name} 당첨권 진입!`;
  }

  private _resetBanner() {
    this._banner.hide();
    this._roundTime = 0;
    this._nextBannerTime = 0;
    this._lastLeader = null;
    this._lastWinnerCount = 0;
  }

  /** 카메라와 슬로우모션이 주목할 구슬 = 당첨 커트라인에 걸쳐있는 구슬 */
  private get _targetIndex() {
    return this._winnerRange.end - this._winners.length;
  }

  /** 커트라인을 두고 _targetIndex 구슬과 다투는 구슬 = 바로 뒤, 없으면 바로 앞 구슬 */
  private get _rivalIndex() {
    const i = this._targetIndex;
    return this._marbles[i + 1] ? i + 1 : i - 1;
  }

  private _isWinningRank(rank: number) {
    return rank >= this._winnerRange.start && rank <= this._winnerRange.end;
  }

  private _checkFinish() {
    if (!this._isRunning) return;
    const { start, end } = this._winnerRange;

    // 남은 구슬이 1개면 그 등수는 골인하지 않아도 확정된다. 2개 이상 남았다면 그들 사이의
    // 순위는 물리로만 정해지므로 예측하지 않는다 (당첨 범위 안에서도 순위는 의미를 가진다)
    const early = this._winners.length > 0 && this._marbles.length === 1;
    const ranked = early ? [...this._winners, this._marbles[0]] : this._winners;
    if (ranked.length <= end) return;

    if (early && this._isWinningRank(this._winners.length)) {
      this._particleManager.shot(this._renderer.width, this._renderer.height);
    }

    this._result = ranked.slice(start, end + 1);
    this._isRunning = false;
    sound.play('fanfare');
    this.dispatchEvent(
      new CustomEvent('goal', {
        detail: { winner: this._result[0].name, winners: this._result.map((m) => m.name) },
      })
    );
    setTimeout(() => {
      this._recorder.stop();
    }, 1000);
  }

  private _calcTimeScale(): number {
    if (!this._stage) return 1;
    const targetIndex = this._targetIndex;
    // 연출 구역: 커트라인 구슬이 구역 가운데로 갈수록 느려진다. 경쟁하는 구슬이 있을 때만
    if (this._zoomIntensity !== null) {
      if (
        this._winners.length < this._winnerRange.end + 1 &&
        this._zoomIntensity > 0 &&
        (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
      ) {
        return Math.max(0.2, 1 - this._zoomIntensity);
      }
      return 1;
    }
    if (this._winners.length < this._winnerRange.end + 1 && this._goalDist < zoomThreshold) {
      if (
        this._marbles[this._focusOnRival ? this._rivalIndex : targetIndex].y >
          this._stage.zoomY - zoomThreshold * 1.2 &&
        (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
      ) {
        return Math.max(0.2, this._goalDist / zoomThreshold);
      }
    }
    return 1;
  }

  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
  }

  private _render() {
    if (!this._stage) return;
    const renderParams = {
      camera: this._camera,
      stage: this._stage,
      entities: this.physics.getEntities(),
      marbles: this._marbles,
      winners: this._winners,
      particleManager: this._particleManager,
      effects: this._effects,
      winnerRange: this._winnerRange,
      result: this._result,
      size: { x: this._renderer.width, y: this._renderer.height },
      theme: this._theme,
    };
    this._renderer.render(renderParams, this._uiObjects);
  }

  private async _init() {
    this._recorder = new VideoRecorder(this._renderer.canvas);

    this.physics = new Box2dPhysics();
    await this.physics.init();

    this.addUiObject(new RankRenderer());
    this.addUiObject(this._banner);
    this.attachEvent();
    const minimap = new Minimap();
    minimap.onViewportChange((pos) => {
      if (pos) {
        this._camera.setPosition(pos, false);
        this._camera.lock(true);
      } else {
        this._camera.lock(false);
      }
    });
    this.addUiObject(minimap);
    this.fastForwarder = this.createFastForwader();
    this.addUiObject(this.fastForwarder);
    this._stage = stages[0];
    this._loadMap();
  }

  @bound
  private mouseHandler(eventName: MouseEventName, e: MouseEvent) {
    const handlerName = `on${eventName}` as MouseEventHandlerName;

    const sizeFactor = this._renderer.sizeFactor;
    const pos = { x: e.offsetX * sizeFactor, y: e.offsetY * sizeFactor };
    this._uiObjects.forEach((obj) => {
      if (!obj[handlerName]) return;
      const bounds = obj.getBoundingBox();
      if (!bounds) {
        obj[handlerName]({ ...pos, button: e.button });
      } else if (
        bounds &&
        pos.x >= bounds.x &&
        pos.y >= bounds.y &&
        pos.x <= bounds.x + bounds.w &&
        pos.y <= bounds.y + bounds.h
      ) {
        obj[handlerName]({ x: pos.x - bounds.x, y: pos.y - bounds.y, button: e.button });
      } else {
        obj[handlerName](undefined);
      }
    });
  }

  private attachEvent() {
    const canvas = this._renderer.canvas;
    const onPointerRelease = (e: Event) => {
      this.mouseHandler('MouseUp', e as MouseEvent);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
    };

    canvas.addEventListener('pointerdown', (e: Event) => {
      this.mouseHandler('MouseDown', e as MouseEvent);
      window.addEventListener('pointerup', onPointerRelease);
      window.addEventListener('pointercancel', onPointerRelease);
    });

    ['MouseMove', 'DblClick'].forEach((ev) => {
      // @ts-expect-error
      canvas.addEventListener(ev.toLowerCase().replace('mouse', 'pointer'), this.mouseHandler.bind(this, ev));
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    canvas.addEventListener('click', (e) => {
      // 광고 오버레이가 팝업 위에 그려지므로 먼저 검사한다
      const hit = this.adHitAt(e);
      if (hit) {
        if (hit.type === 'close') {
          this.hideAdOverlay();
        } else {
          window.open(hit.url, '_blank', 'noopener');
        }
        return;
      }
      if (this.resultCloseHitAt(e)) {
        this._renderer.closeResultPopup();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      canvas.style.cursor = this.adHitAt(e) || this.resultCloseHitAt(e) ? 'pointer' : '';
    });
  }

  private _loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }

    this.physics.createStage(this._stage);
    this._camera.initializePosition();
  }

  public clearMarbles() {
    this._pendingRemovals.forEach((id) => window.clearTimeout(id));
    this._pendingRemovals = [];
    this.physics.clearMarbles();
    this._result = null;
    this._winners = [];
    this._marbles = [];
  }

  public async startRecording() {
    if (!this._autoRecording) return;
    try {
      await this._recorder.start();
    } catch (e) {
      console.error('recording failed to start', e);
    }
  }

  public start() {
    this._isRunning = true;
    this._winnerRange = clipWinnerRange(options.winnerRange, this._marbles.length);
    this._roundMarbleCount = this._marbles.length;
    this._resetBanner();
    this._camera.startFollowingMarbles();

    if (this._autoRecording) {
      this._recorder.start().then(() => {
        this.physics.start();
        this._marbles.forEach((marble) => (marble.isActive = true));
      });
    } else {
      this.physics.start();
      this._marbles.forEach((marble) => (marble.isActive = true));
    }
  }

  public setSpeed(value: number) {
    if (value <= 0) {
      throw new Error('Speed multiplier must larger than 0');
    }
    this._speed = value;
  }

  public setAd(ad: RoundAd | null) {
    this._renderer.setAd(ad);
  }

  public preloadAdImages(srcs: (string | undefined)[]) {
    this._renderer.preloadAdImages(srcs);
  }

  public showAdOverlay(mode: 'preroll' | 'result') {
    this._renderer.showAdOverlay(mode);
  }

  public hideAdOverlay() {
    this._renderer.hideAdOverlay();
  }

  private adHitAt(e: MouseEvent): AdHit | null {
    const sizeFactor = this._renderer.sizeFactor;
    return this._renderer.getAdHitAt(e.offsetX * sizeFactor, e.offsetY * sizeFactor);
  }

  private resultCloseHitAt(e: MouseEvent): boolean {
    const sizeFactor = this._renderer.sizeFactor;
    return this._renderer.getResultCloseHitAt(e.offsetX * sizeFactor, e.offsetY * sizeFactor);
  }

  public setTheme(themeName: keyof typeof Themes) {
    this._theme = Themes[themeName];
  }

  public getSpeed() {
    return this._speed;
  }

  public setWinningRank(rank: number) {
    this.setWinnerRange(rank, rank);
  }

  public setWinnerRange(start: number, end: number) {
    options.winnerRange = { start, end };
    this._winnerRange = clipWinnerRange(options.winnerRange, this._marbles.length);
  }

  /** 실제 구슬 수에 맞춰 잘린 범위 (0-based, 양끝 포함) */
  public getWinnerRange(): WinnerRange {
    return { ...this._winnerRange };
  }

  public setAutoRecording(value: boolean) {
    this._autoRecording = value;
  }

  public setMarbles(names: string[]) {
    this.reset();
    const arr = names.slice();

    let maxWeight = -Infinity;
    let minWeight = Infinity;

    const members = arr
      .map((nameString) => {
        const result = parseName(nameString);
        if (!result) return null;
        const { name, weight, count } = result;
        if (weight > maxWeight) maxWeight = weight;
        if (weight < minWeight) minWeight = weight;
        return { name, weight, count };
      })
      .filter((member) => !!member);

    const gap = maxWeight - minWeight;

    let totalCount = 0;
    members.forEach((member) => {
      if (member) {
        member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
        totalCount += member.count;
      }
    });

    const orders = shuffle(
      Array(totalCount)
        .fill(0)
        .map((_, i) => i)
    );
    members.forEach((member) => {
      if (member) {
        for (let j = 0; j < member.count; j++) {
          const order = orders.pop() || 0;
          this._marbles.push(new Marble(this.physics, order, totalCount, member.name, member.weight));
        }
      }
    });

    // 카메라를 구슬 생성 위치 중앙으로 이동 + 줌인
    if (totalCount > 0) {
      const cols = Math.min(totalCount, 10);
      const rows = Math.ceil(totalCount / 10);
      const lineDelta = -Math.max(0, Math.ceil(rows - 5));
      const centerX = 10.25 + (cols - 1) * 0.3;
      const centerY = (1 + rows) / 2 + lineDelta;

      const spawnWidth = Math.max((cols - 1) * 0.6, 1);
      const spawnHeight = Math.max(rows - 1, 1);
      const margin = 3;
      const viewW = canvasWidth / initialZoom;
      const viewH = canvasHeight / initialZoom;
      const zoom = Math.max(
        1.5,
        Math.min(Math.min(viewW / (spawnWidth + margin * 2), viewH / (spawnHeight + margin * 2)), 3)
      );

      this._camera.initializePosition({ x: centerX, y: centerY }, zoom);
    }
  }

  private _clearMap() {
    this.physics.clear();
    this._marbles = [];
  }

  public reset() {
    this._resetBanner();
    this.clearMarbles();
    this._clearMap();
    this._loadMap();
    this._goalDist = Infinity;
    this._focusOnRival = false;
  }

  public getCount() {
    return this._marbles.length;
  }

  public getMaps() {
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }

  /** index 는 기본 맵의 인덱스, 다운로드한 맵이면 -1 */
  public getCurrentMap() {
    if (!this._stage) return null;
    return {
      index: stages.indexOf(this._stage),
      title: this._stage.title,
      id: this._mapId,
    };
  }

  public setMap(index: number) {
    if (index < 0 || index > stages.length - 1) {
      throw new Error('Incorrect map number');
    }
    this.setStage(stages[index], `builtin:${index}`);
  }

  /** 기본 맵 목록에 없는 맵(맵 공유마당에서 받은 맵) 을 쓴다 */
  public setStage(stage: StageDef, id: string) {
    const names = this._marbles.map((marble) => marble.name);
    this._stage = stage;
    this._mapId = id;
    this.setMarbles(names);
    this._camera.initializePosition();
  }
}
