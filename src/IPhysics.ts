import type { StageDef } from './data/maps';
import type { MapEntityState } from './types/MapEntity.type';

export interface IPhysics {
  init(): Promise<void>;

  clear(): void;

  clearMarbles(): void;

  createStage(stage: StageDef): void;

  createMarble(id: number, x: number, y: number): void;

  shakeMarble(id: number): void;

  removeMarble(id: number): void;

  getMarblePosition(id: number): { x: number; y: number; angle: number };

  getEntities(): MapEntityState[];

  impact(id: number): void;

  /** 아래(+y) 방향으로 speed 만큼 속도를 더한다. 아래 방향 속도는 maxSpeed 를 넘지 않는다 */
  boost(id: number, speed: number, maxSpeed: number): void;

  /** 두 구슬의 위치와 속도를 맞바꾼다 */
  swapMarbles(a: number, b: number): void;

  /**
   * 구슬들을 durationMs(물리 시간) 동안 멈춘다. 속도 0, 중력 무시. 충돌은 그대로 받는다.
   * 이미 얼어 있거나, 풀린 지 immunityMs 가 지나지 않은 구슬은 건너뛴다
   */
  freeze(ids: number[], durationMs: number, immunityMs: number): void;

  /**
   * 구슬의 중력 배율을 durationMs(물리 시간) 동안 scale 로 바꾼다. 음수면 위로 뜬다.
   * 위로 올라가는 속도는 maxUpSpeed 를 넘지 않는다. 얼음과 겹치면 얼음이 우선한다
   */
  antiGravity(id: number, durationMs: number, scale: number, maxUpSpeed: number): void;

  /**
   * 구슬 크기를 scale 배로 바꿔 durationMs(물리 시간) 동안 유지했다가 원래대로 되돌린다.
   * 바뀌는 동안 rampMs 에 걸쳐 step 배율 단위로 물리 원을 다시 만든다.
   * 같은 배율이 진행 중이면 시간만 연장하고, 다른 배율이면 새 배율로 대체한다
   */
  resize(id: number, scale: number, durationMs: number, rampMs: number, step: number): void;

  /** 구슬의 지금 크기 배율 (원래 크기 = 1) */
  getMarbleScale(id: number): number;

  /** Impact 의 반대. targets 를 id 구슬 쪽으로 끌어당긴다. 가까울수록 세고 range 에서 0 이 된다 */
  magnet(id: number, targets: number[], range: number, power: number): void;

  start(): void;

  step(deltaSeconds: number): void;
}
