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

  /** 구슬들을 durationMs(물리 시간) 동안 멈춘다. 속도 0, 중력 무시. 충돌은 그대로 받는다 */
  freeze(ids: number[], durationMs: number): void;

  start(): void;

  step(deltaSeconds: number): void;
}
