import type { MapEntity } from '../types/MapEntity.type';
import {
  PINBALL_BUMPER_RADIUS,
  PINBALL_BUMPER_RESTITUTION,
  PINBALL_SPINNER_SPEED,
  WINDMILL_ARM,
  WINDMILL_PIN_RADIUS,
  WINDMILL_SPEEDS,
  WINDMILL_THICKNESS,
  ZIGZAG_BOTTLENECK_WIDTH,
  ZIGZAG_LEVEL_GAP,
  ZIGZAG_LEVELS,
  ZIGZAG_MIXER_RADIUS,
  ZIGZAG_MIXER_ROWS,
  ZIGZAG_PIN_RADIUS,
  ZIGZAG_SLOPE_DROP,
} from './constants';
import { circle, spinner, wall, windmill } from './mapHelpers';

export type AdBoard = {
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type StageDef = {
  title: string;
  entities?: MapEntity[];
  goalY: number;
  zoomY: number;
  adBoards?: AdBoard[];
  /** 순위 계산 보조 정보 (물리에는 영향 없음) */
  progress?: ProgressHints;
  /** 연출 구역. 있으면 zoomY 대신 이 구역들로 줌인과 슬로모션을 건다 */
  zoomZones?: ZoomZone[];
  /** 카메라 구역. 카메라가 주목하는 구슬이 구역 안에 있으면 구슬 대신 구역 전체를 화면에 담는다 (결승 줌인 중에는 쓰지 않는다) */
  cameraZones?: CameraZone[];
};

/** 연출 구역 (x, y 는 가운데, w, h 는 전체 크기). 가운데로 갈수록 연출이 세진다 */
export type ZoomZone = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 카메라 구역 (x, y 는 가운데, w, h 는 전체 크기) */
export type CameraZone = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 일방통행 선: 시작점 → 끝점 방향의 오른쪽으로만 통과할 수 있다고 보고 순위를 계산한다 */
export type OneWayLine = {
  from: [number, number];
  to: [number, number];
};

export type ProgressHints = {
  oneWays?: OneWayLine[];
};

/** Pinball 범퍼: 4칸 간격 줄을 세 가지 위치로 번갈아 놓아, 범퍼를 피해 곧장 떨어지는 세로 줄이 없게 한다 */
function pinballBumpers(): MapEntity[] {
  const bumpers: MapEntity[] = [];
  for (let row = 0; row < 23; row++) {
    const y = 20 + row * 4;
    const x0 = 5 + ((row % 3) * 4) / 3;
    for (let x = x0; x <= 21; x += 4) {
      bumpers.push(circle(x, y, PINBALL_BUMPER_RADIUS, PINBALL_BUMPER_RESTITUTION));
    }
  }
  return bumpers;
}

/** Zigzag Stairs 의 첫 경사판 y, 계단 구간 양쪽 벽 x */
const ZIGZAG_TOP = 17 + ZIGZAG_MIXER_ROWS * 3 + 1;
const ZIGZAG_LEFT = 6;
const ZIGZAG_RIGHT = 20;
/** 경사판이 내려가는 쪽 끝에 남기는 틈의 폭 */
const ZIGZAG_GAP = 2.5;
/** Zigzag Stairs 의 마지막 경사판 아래, 결승 깔때기가 시작하는 y */
const ZIGZAG_BOTTOM = ZIGZAG_TOP + ZIGZAG_LEVELS * ZIGZAG_LEVEL_GAP;

/**
 * Zigzag Stairs 경사판: 왼쪽 벽과 오른쪽 벽 사이에서 좌우로 번갈아 기운다.
 * 내려가는 쪽 끝에 폭 ZIGZAG_GAP 틈을 남기고, 틈 가운데에 작은 핀을 둬서 떨어지는 방향이 갈리게 한다.
 * 핀 양옆 통로는 거대화한 구슬(지름 0.8)도 지나갈 수 있다.
 * 끝에 턱(벽)을 세우면 느린 구슬이 모서리에 갇히므로 턱 대신 핀을 쓴다
 */
function zigzagStairs(): MapEntity[] {
  const result: MapEntity[] = [];
  // 계단 위 범퍼: 입구를 먼저 지난 구슬이 계단에서 계속 앞서가지 않도록 순서를 섞는다.
  // 3칸 간격 줄을 세 가지 위치로 번갈아 놓아 곧장 떨어지는 세로 줄이 없게 한다
  for (let row = 0; row < ZIGZAG_MIXER_ROWS; row++) {
    const y = 17 + row * 3;
    for (let x = ZIGZAG_LEFT + 1.5 + (row % 3); x <= ZIGZAG_RIGHT - 1.5; x += 3) {
      result.push(circle(x, y, ZIGZAG_MIXER_RADIUS, 0.5));
    }
  }
  for (let level = 0; level < ZIGZAG_LEVELS; level++) {
    const y = ZIGZAG_TOP + level * ZIGZAG_LEVEL_GAP;
    const pinY = y + ZIGZAG_SLOPE_DROP + 0.8;
    if (level % 2 === 0) {
      // 왼쪽 벽에서 오른쪽 아래로
      result.push(
        wall([
          [ZIGZAG_LEFT, y],
          [ZIGZAG_RIGHT - ZIGZAG_GAP, y + ZIGZAG_SLOPE_DROP],
        ])
      );
      result.push(circle(ZIGZAG_RIGHT - ZIGZAG_GAP / 2, pinY, ZIGZAG_PIN_RADIUS));
    } else {
      // 오른쪽 벽에서 왼쪽 아래로
      result.push(
        wall([
          [ZIGZAG_RIGHT, y],
          [ZIGZAG_LEFT + ZIGZAG_GAP, y + ZIGZAG_SLOPE_DROP],
        ])
      );
      result.push(circle(ZIGZAG_LEFT + ZIGZAG_GAP / 2, pinY, ZIGZAG_PIN_RADIUS));
    }
  }
  return result;
}

/** Windmill Village 첫 풍차 층 y, 층 간격 */
const WINDMILL_TOP = 24;
const WINDMILL_LAYER_GAP = 12;
/** Windmill Village 마지막 풍차 층 아래, 결승 깔때기가 시작하는 y */
const WINDMILL_BOTTOM = WINDMILL_TOP + (WINDMILL_SPEEDS.length - 1) * WINDMILL_LAYER_GAP + 6;

/**
 * Windmill Village 풍차와 핀 (벽 x 3 ~ 23).
 * 풍차가 2개인 층은 x 8, 18 에, 3개인 층은 x 6.5, 13, 19.5 에 둔다. 날개 끝과 벽 사이는 1.5 이상 띄워
 * 거대화한 구슬(지름 0.8)도 벽과 날개 사이에 끼지 않게 한다.
 * 고정 핀은 풍차 사이(같은 층)와 층 사이(가운데 높이)에 둔다. 층 사이 양쪽 벽에는 안쪽으로 기운 선반이 있다
 */
function windmillVillage(): MapEntity[] {
  const result: MapEntity[] = [];
  WINDMILL_SPEEDS.forEach((speeds, layer) => {
    const y = WINDMILL_TOP + layer * WINDMILL_LAYER_GAP;
    const xs = speeds.length === 2 ? [8, 18] : [6.5, 13, 19.5];
    speeds.forEach((speed, i) => {
      result.push(...windmill(xs[i], y, WINDMILL_ARM, WINDMILL_THICKNESS, speed));
    });
    // 같은 층의 풍차 사이 핀 (풍차 2개인 층만. 3개인 층은 날개 사이가 좁아 핀을 두지 않는다)
    if (speeds.length === 2) {
      result.push(circle(13, y, WINDMILL_PIN_RADIUS));
    }
    // 아래층과의 사이: 가운데 핀 2개, 양쪽 벽에는 안쪽으로 기운 짧은 선반.
    // 선반이 없으면 벽을 따라 풍차를 피해 곧장 떨어지는 구슬이 생긴다.
    // 마지막 층 아래는 결승 깔때기가 시작되는 곳이라 두지 않는다 (깔때기 벽과 쐐기를 만들어 구슬이 막힌다)
    if (layer === WINDMILL_SPEEDS.length - 1) return;
    const pinY = y + WINDMILL_LAYER_GAP / 2;
    const pinXs = layer % 2 === 0 ? [10.5, 15.5] : [9.75, 16.25];
    for (const x of pinXs) result.push(circle(x, pinY, WINDMILL_PIN_RADIUS));
    result.push(
      wall([
        [3, pinY - 1],
        [6.5, pinY + 0.5],
      ]),
      wall([
        [23, pinY - 1],
        [19.5, pinY + 0.5],
      ])
    );
  });
  return result;
}

export const stages: StageDef[] = [
  {
    title: 'Wheel of fortune',
    goalY: 111,
    zoomY: 106.75,
    adBoards: [{ x: 15.92, y: 104.3, w: 5, h: 1.25 }],
    entities: [
      // polyline
      {
        position: { x: 0, y: 0 },
        shape: {
          type: 'polyline',
          points: [
            [16.5, -300],
            [9.25, -300],
            [9.25, 8.5],
            [2, 19.25],
            [2, 26],
            [9.75, 30],
            [9.75, 33.5],
            [1.25, 41],
            [1.25, 53.75],
            [8.25, 58.75],
            [8.25, 63],
            [9.25, 64],
            [8.25, 65],
            [8.25, 99.25],
            [15.1, 106.75],
            [15.1, 111.75],
          ],
          rotation: 0,
        },
        type: 'static',
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [16.5, -300],
            [16.5, 9.25],
            [9.5, 20],
            [9.5, 22.5],
            [17.5, 26],
            [17.5, 33.5],
            [24, 38.5],
            [19, 45.5],
            [19, 55.5],
            [24, 59.25],
            [24, 63],
            [23, 64],
            [24, 65],
            [24, 100.5],
            [16, 106.75],
            [16, 111.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [12.75, 37.5],
            [7, 43.5],
            [7, 49.75],
            [12.75, 53.75],
            [12.75, 37.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [14.75, 37.5],
            [14.75, 43],
            [17.5, 40.25],
            [14.75, 37.5],
          ],
        },
      },
      // boxes
      {
        position: { x: 15.5, y: 30.0 },
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        type: 'static',
        props: { density: 1, angularVelocity: 0, restitution: 1 },
      },
      {
        position: { x: 15.5, y: 32 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 15.5, y: 28 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 12.5, y: 30 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 12.5, y: 32 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 12.5, y: 28 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.4, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 11.3, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 15.1, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 17, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 18.9, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 20.699999999999996, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 22.7, y: 66.6 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: 45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.4, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 11.3, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 15.1, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 17, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 18.9, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 20.699999999999996, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 22.7, y: 69.1 },
        type: 'static',
        shape: { type: 'box', width: 0.6, height: 0.1, rotation: -45 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.5, y: 92 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 12.75, y: 92 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 16, y: 92 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.25, y: 92 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 22.5, y: 92 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 11, y: 95 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 14.25, y: 95 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 17.5, y: 95 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 20.75, y: 95 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.5, y: 98 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 12.75, y: 98 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 16, y: 98 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.25, y: 98 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 22.5, y: 98 },
        type: 'static',
        shape: {
          type: 'box',
          width: 0.25,
          height: 0.25,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },

      // wheels
      {
        position: { x: 8, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 12, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -3.5, restitution: 0 },
      },
      {
        position: { x: 16, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 20, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -3.5, restitution: 0 },
      },
      {
        position: { x: 24, y: 75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3.5, restitution: 0 },
      },
      {
        position: { x: 14, y: 106.75 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -1.2, restitution: 0 },
      },
    ],
  },
  {
    title: 'BubblePop',
    goalY: 83,
    zoomY: 78,
    adBoards: [
      { y: 80.5, x: 10 },
      { y: 80.5, x: 15.05 },
    ],
    entities: [
      {
        type: 'static',
        position: { x: 10.375, y: -108.5 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [6.125, -191.5],
            [-1.125, -191.5],
            [-1.125, 108.5],
            [-1.125, 151.5],
            [-6.125, 158.5],
            [-1.125, 161.5],
            [-1.125, 179.5],
            [-0.9128679656440362, 179.7498817789222],
            [-1.125, 179.9997635578444],
            [-1.125, 183.5],
            [1.625, 188.5],
            [1.625, 191.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 16.25, y: -108.5 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [0.25, -191.5],
            [0.25, 158.5],
            [3.25, 162.5],
            [2.25, 164.5],
            [3.25, 166.5],
            [0.25, 169.5],
            [0.25, 179.5],
            [0.03786796564403616, 179.75925677892224],
            [0.25, 179.9997635578444],
            [0.25, 183.5],
            [-3.25, 188.5],
            [-3.25, 191.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 16.5, y: 55.75 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [0, -3.25],
            [1, -1.75],
            [0, 0.25],
            [1, 2.25],
            [0, 3.25],
            [-1, 0.25],
            [0, -3.25],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 10.375, y: 48.25 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [-1.125, -2.75],
            [-4.125, 1.25],
            [-1.125, 2.75],
            [4.125, 2.25],
            [-1.125, -2.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 10.15625, y: 26.75 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [-0.90625, -0.75],
            [0.90625, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 15.59375, y: 26.75 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [0.90625, -0.75],
            [-0.90625, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 12.875, y: 29.25 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [-1.8125, 0.75],
            [0, -0.75],
            [1.8125, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 10.15625, y: 31.75 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [-0.90625, -0.75],
            [0.90625, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 15.59375, y: 31.75 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [0.90625, -0.75],
            [-0.90625, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 12.875, y: 34.25 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [-1.8125, 0.75],
            [0, -0.75],
            [1.8125, 0.75],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 9.25, y: 18 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 11.25, y: 18 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 13.25, y: 18 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 15.25, y: 18 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 10.5, y: 19 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 12.5, y: 19 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 14.5, y: 19 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 16.5, y: 19 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 9.25, y: 20 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 11.25, y: 20 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 13.25, y: 20 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 15.25, y: 20 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 10.5, y: 21 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 12.5, y: 21 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 14.5, y: 21 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 16.5, y: 21 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 9.25, y: 22 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 11.25, y: 22 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 13.25, y: 22 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 15.25, y: 22 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 10.5, y: 23 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 12.5, y: 23 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 14.5, y: 23 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 16.5, y: 23 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 0.15, height: 0.15 },
      },
      {
        type: 'static',
        position: { x: 9.400000000000002, y: 39 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 3, height: 3 },
      },
      {
        type: 'static',
        position: { x: 16.5, y: 43 },
        props: { angularVelocity: 0, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0.7853981633974483, width: 3, height: 3 },
      },
      {
        type: 'kinematic',
        position: { x: 10.7, y: 10 },
        props: { angularVelocity: 10, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 0.5, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 14.7, y: 10 },
        props: { angularVelocity: -10, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 0.5, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 12.7, y: 10 },
        props: { angularVelocity: 10, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 0.5, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 10.7, y: 14 },
        props: { angularVelocity: -3, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 2, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 14.7, y: 14 },
        props: { angularVelocity: 3, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 2, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 11.2, y: 44 },
        props: { angularVelocity: -5, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 0.5, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 10.3, y: 75 },
        props: { angularVelocity: 8, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 1, height: 0.1 },
      },
      {
        type: 'kinematic',
        position: { x: 15.462132034355964, y: 75 },
        props: { angularVelocity: -8, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 1, height: 0.1 },
      },
      {
        type: 'static',
        position: { x: 11, y: 65 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 13, y: 65 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 15, y: 65 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 12, y: 67.5 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 14, y: 67.5 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 13, y: 69.77058813837772 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.8 },
      },
      {
        type: 'static',
        position: { x: 10.7, y: 77.5 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.8 },
      },
      {
        type: 'static',
        position: { x: 14.7, y: 77.5 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.8 },
      },
      {
        type: 'static',
        position: { x: 12.625, y: 80 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 1.5 },
      },
      {
        type: 'static',
        position: { x: 12.625, y: 80 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 1.2 },
      },
      {
        type: 'kinematic',
        position: { x: 12.625, y: 56.00000000000001 },
        props: { angularVelocity: -8, density: 1, restitution: 0 },
        shape: { type: 'box', rotation: 0, width: 1, height: 0.1 },
      },
      {
        type: 'static',
        position: { x: 9.947604593262161, y: 62.59581680393866 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 11.947604593262161, y: 62.59581680393866 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 13.947604593262161, y: 62.59581680393866 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
      {
        type: 'static',
        position: { x: 15.828283102570442, y: 62.59581680393866 },
        props: { angularVelocity: 0, density: 1, restitution: 1.5, life: 1 },
        shape: { type: 'circle', radius: 0.5 },
      },
    ],
  },
  {
    title: 'Pot of greed',
    goalY: 91,
    zoomY: 92.5,
    adBoards: [{ x: 13.0, y: 75.5, w: 9.5, h: 2.375 }],
    // 바닥에 빠졌다 양옆으로 올라오는 구슬을 따라가면 화면 아래 빈 곳만 보이니 항아리 전체를 보여 준다
    cameraZones: [{ x: 13, y: 74, w: 24, h: 28 }],
    zoomZones: [{ x: 13, y: 77, w: 8, h: 10 }],
    entities: [
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [17, -300],
            [9, -300],
            [9, 8.5],
            [2, 15],
            [6, 61.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [7, 67.2],
            [9, 85.2],
            [8, 84.9],
            [6, 84.6],
            [5, 78.6],
            [4, 66.6],
            [7, 67.2],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [17, -300],
            [17, 8.5],
            [24, 15],
            [20, 61.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [19, 67.2],
            [17, 85.2],
            [18, 84.9],
            [20, 84.6],
            [21, 78.6],
            [22, 66.6],
            [19, 67.2],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [11, 77.4],
            [12, 78.6],
            [12, 91.8],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [15, 77.4],
            [14, 78.6],
            [14, 91.8],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [12, 85.8],
            [11, 86.4],
            [9, 87],
            [8, 87],
            [6, 86.4],
            [5, 85.8],
            [4, 84.6],
            [3, 78.6],
            [2, 66.6],
            [3, 63.6],
            [4, 62.4],
            [5, 61.8],
            [6, 61.5],
          ],
        },
      },
      {
        type: 'static',
        position: { x: 0, y: 0 },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'polyline',
          rotation: 0,
          points: [
            [14, 85.8],
            [15, 86.4],
            [17, 87],
            [18, 87],
            [20, 86.4],
            [21, 85.8],
            [22, 84.6],
            [23, 78.6],
            [24, 66.6],
            [23, 63.6],
            [22, 62.4],
            [21, 61.8],
            [20, 61.5],
          ],
        },
      },
      {
        position: { x: 13, y: 20 },
        type: 'static',
        shape: {
          type: 'box',
          width: 3,
          height: 3,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 13, y: 55 },
        type: 'static',
        shape: {
          type: 'box',
          width: 3,
          height: 3,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 8, y: 37 },
        type: 'static',
        shape: {
          type: 'box',
          width: 2,
          height: 2,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 18, y: 37 },
        type: 'static',
        shape: {
          type: 'box',
          width: 2,
          height: 2,
          rotation: 0.7853981633974483,
        },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 11, y: 12 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -3, restitution: 0 },
      },
      {
        position: { x: 15, y: 12 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 3, restitution: 0 },
      },
      {
        position: { x: 8, y: 87 },
        type: 'kinematic',
        shape: { type: 'box', width: 1, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 6, y: 86.4 },
        type: 'kinematic',
        shape: { type: 'box', width: 1.5, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 4, y: 84.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 1.5, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 3.5, y: 81.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 3, y: 78.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 2.75, y: 75.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 2.5, y: 72.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 2.25, y: 69.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 2, y: 66.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: -10, restitution: 0 },
      },
      {
        position: { x: 18, y: 87 },
        type: 'kinematic',
        shape: { type: 'box', width: 1, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 20, y: 86.4 },
        type: 'kinematic',
        shape: { type: 'box', width: 1.5, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 22, y: 84.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 1.5, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 22.5, y: 81.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 23, y: 78.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 23.25, y: 75.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 23.5, y: 72.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 23.75, y: 69.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
      {
        position: { x: 24, y: 66.6 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0 },
        props: { density: 1, angularVelocity: 10, restitution: 0 },
      },
    ],
  },
  {
    title: 'Yoru ni Kakeru',
    goalY: 248,
    zoomY: 234.5,
    adBoards: [
      { x: 11.5, y: 12, w: 16, h: 4 },
      { x: 11.5, y: 155, w: 16, h: 4 },
    ],
    entities: [
      {
        position: { x: 2, y: 0 },
        shape: {
          type: 'box',
          width: 1,
          height: 800,
          rotation: 0,
          color: '#222',
          bloomColor: '#777',
        },
        type: 'static',
        props: { density: 500, angularVelocity: 0, restitution: 0 },
      },
      {
        type: 'static',
        position: { x: 21, y: 0 },
        props: { density: 500, angularVelocity: 0, restitution: 0 },
        shape: {
          type: 'box',
          rotation: 0,
          width: 1,
          height: 800,
          color: '#222',
          bloomColor: '#777',
        },
      },
      {
        position: { x: 4.0, y: 25.0 },
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        type: 'static',
        props: { density: 1, angularVelocity: 0, restitution: 1 },
      },
      {
        position: { x: 4.0, y: 30.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 4.0, y: 35.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 4.0, y: 40.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.0, y: 25.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.0, y: 30.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.0, y: 35.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 9.0, y: 40.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 14.0, y: 25.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 14.0, y: 30.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 14.0, y: 35.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 14.0, y: 40.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.0, y: 25.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.0, y: 30.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.0, y: 35.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },
      {
        position: { x: 19.0, y: 40.0 },
        type: 'static',
        shape: { type: 'box', width: 0.2, height: 0.2, rotation: -45, color: '#818fb4' },
        props: { density: 1, angularVelocity: 0, restitution: 0 },
      },

      {
        position: { x: 6.5, y: 27.5 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0, color: '#9bec00' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },
      {
        position: { x: 6.5, y: 37.5 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0, color: '#ff6868' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },
      {
        position: { x: 11.5, y: 32.5 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0, color: '#80b3ff' },
        props: { density: 2, angularVelocity: 4.0, restitution: 0 },
      },
      {
        position: { x: 16.5, y: 27.5 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0, color: '#ff6868' },
        props: { density: 1, angularVelocity: -2.0, restitution: 0 },
      },
      {
        position: { x: 16.5, y: 37.5 },
        type: 'kinematic',
        shape: { type: 'box', width: 2, height: 0.1, rotation: 0, color: '#9bec00' },
        props: { density: 1, angularVelocity: -2.0, restitution: 0 },
      },

      {
        position: { x: 10.0, y: 26.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 26.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 26.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.0, y: 27.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 27.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 27.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.0, y: 29.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 29.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 29.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 5.0, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.0, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.0, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 15.0, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 31.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.0, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 32.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.0, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 34.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 10.0, y: 36.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 36.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 36.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.0, y: 37.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 37.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 37.5 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.0, y: 39.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 39.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.0, y: 39.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 11.5, y: 50.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 6.5, height: 0.1, rotation: 0, color: '#5c5470' },
        props: { density: 1, angularVelocity: -2.0, restitution: 0 },
      },

      {
        position: { x: 3.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 20.0, y: 60.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 63.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe227' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 20.0, y: 66.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#fff4b7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 4.5, y: 75.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: 0, color: '#ff577f' },
        props: { density: 1, angularVelocity: -4.0, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 75.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: 0, color: '#ff577f' },
        props: { density: 1, angularVelocity: 4.0, restitution: 0 },
      },

      {
        position: { x: 3.8, y: 90.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.0, restitution: 0 },
      },
      {
        position: { x: 19.2, y: 90.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.0, restitution: 0 },
      },
      {
        position: { x: 5.8, y: 92.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.2, restitution: 0 },
      },
      {
        position: { x: 17.2, y: 92.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.2, restitution: 0 },
      },
      {
        position: { x: 7.8, y: 94.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 15.2, y: 94.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 9.8, y: 96.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 96.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },

      {
        position: { x: 3.8, y: 94.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.2, restitution: 0 },
      },
      {
        position: { x: 19.2, y: 94.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.2, restitution: 0 },
      },
      {
        position: { x: 5.8, y: 96.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 17.2, y: 96.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 7.8, y: 98.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 15.2, y: 98.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 9.8, y: 100.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 100.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },

      {
        position: { x: 10.0, y: 90.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.0, y: 90.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 92.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.0, y: 92.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.0, y: 94.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.0, y: 94.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.0, y: 96.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 96.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ffe3fe' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 10.0, y: 94.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.0, y: 94.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.0, y: 96.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.0, y: 96.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.0, y: 98.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.0, y: 98.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.0, y: 100.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.0, y: 100.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#ff94cc' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 4.5, y: 100.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: 0, color: '#5c8374' },
        props: { density: 1, angularVelocity: -2.5, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 100.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: 0, color: '#5c8374' },
        props: { density: 1, angularVelocity: 2.5, restitution: 0 },
      },

      {
        position: { x: 3.8, y: 104.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 19.2, y: 104.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.4, restitution: 0 },
      },
      {
        position: { x: 5.8, y: 106.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 17.2, y: 106.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 7.8, y: 108.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },
      {
        position: { x: 15.2, y: 108.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },
      {
        position: { x: 9.8, y: 110.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 110.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#c7ffd8' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },

      {
        position: { x: 3.8, y: 108.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 19.2, y: 108.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.6, restitution: 0 },
      },
      {
        position: { x: 5.8, y: 110.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },
      {
        position: { x: 17.2, y: 110.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 1.8, restitution: 0 },
      },
      {
        position: { x: 7.8, y: 112.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },
      {
        position: { x: 15.2, y: 112.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 2.0, restitution: 0 },
      },
      {
        position: { x: 9.8, y: 114.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 2.2, restitution: 0 },
      },
      {
        position: { x: 13.2, y: 114.0 },
        type: 'static',
        shape: { type: 'box', width: 0.1, height: 0.1, rotation: -90, color: '#98ded9' },
        props: { density: 1, angularVelocity: 2.2, restitution: 0 },
      },

      {
        position: { x: 3.5, y: 105.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 105.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 3.5, y: 107.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 107.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 107.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 107.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 3.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 109.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.5, color: '#edeef7' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 5.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.4, color: '#e6176d' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 5 },
      },
      {
        position: { x: 17.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.4, color: '#e6176d' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 5 },
      },
      {
        position: { x: 5.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 1.2, color: '#e64588' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 4 },
      },
      {
        position: { x: 17.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 1.2, color: '#e64588' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 4 },
      },
      {
        position: { x: 5.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.0, color: '#e673a3' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 3 },
      },
      {
        position: { x: 17.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.0, color: '#e673a3' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 3 },
      },
      {
        position: { x: 5.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.8, color: '#e6a1bd' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 2 },
      },
      {
        position: { x: 17.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.8, color: '#e6a1bd' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 2 },
      },
      {
        position: { x: 5.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 3.8, color: '#e6cfd8' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 115.0 },
        type: 'static',
        shape: { type: 'circle', radius: 3.8, color: '#e6cfd8' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 11.5, y: 120.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.4, color: '#e6176d' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 5 },
      },
      {
        position: { x: 11.5, y: 120.0 },
        type: 'static',
        shape: { type: 'circle', radius: 1.2, color: '#e64588' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 4 },
      },
      {
        position: { x: 11.5, y: 120.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.0, color: '#e673a3' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 3 },
      },
      {
        position: { x: 11.5, y: 120.0 },
        type: 'static',
        shape: { type: 'circle', radius: 2.8, color: '#e6a1bd' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 2 },
      },
      {
        position: { x: 11.5, y: 120.0 },
        type: 'static',
        shape: { type: 'circle', radius: 3.8, color: '#e6cfd8' },
        props: { angularVelocity: 0.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 4.5, y: 130.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: 0, color: '#435585' },
        props: { density: 1, angularVelocity: 0.25, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 130.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: 0, color: '#5c8374' },
        props: { density: 1, angularVelocity: -0.32, restitution: 0 },
      },
      {
        position: { x: 4.5, y: 140.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: 30, color: '#610c9f' },
        props: { density: 1, angularVelocity: 0.32, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 140.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: -30, color: '#872341' },
        props: { density: 1, angularVelocity: -0.32, restitution: 0 },
      },
      {
        position: { x: 4.5, y: 150.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: 60, color: '#503c3c' },
        props: { density: 1, angularVelocity: 0.32, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 150.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 5.0, height: 0.1, rotation: -60, color: '#5c5470' },
        props: { density: 1, angularVelocity: -0.32, restitution: 0 },
      },
      {
        position: { x: 4.5, y: 160.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: 90, color: '#1a3636' },
        props: { density: 1, angularVelocity: 0.32, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 160.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 4.0, height: 0.1, rotation: -90, color: '#522258' },
        props: { density: 1, angularVelocity: -0.32, restitution: 0 },
      },

      {
        position: { x: 3.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 135.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 140.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 144.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 147.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 149.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 3.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 4.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 5.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 6.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 7.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 8.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 9.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 10.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 11.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 12.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 13.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 14.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 15.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 16.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 17.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 18.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },
      {
        position: { x: 19.5, y: 150.0 },
        type: 'static',
        shape: { type: 'circle', radius: 0.2, color: '#e6e1ae' },
        props: { angularVelocity: 1.0, density: 1, restitution: 1.5, life: 1 },
      },

      {
        position: { x: 4.5, y: 180.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 6.0, height: 0.1, rotation: 0, color: '#ccb1b1' },
        props: { density: 1, angularVelocity: 4.6, restitution: 0 },
      },
      {
        position: { x: 18.5, y: 180.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 7.0, height: 0.1, rotation: 0, color: '#b1ccb1' },
        props: { density: 1, angularVelocity: -4.0, restitution: 0 },
      },

      {
        position: { x: 11.5, y: 195.0 },
        type: 'kinematic',
        shape: { type: 'box', width: 8.0, height: 0.1, rotation: 0, color: '#b3ccff' },
        props: { density: 1, angularVelocity: 5.5, restitution: 0 },
      },
    ],
  },
  {
    // 원형 범퍼 사이를 튕기며 내려가다, 서로 반대로 도는 막대 두 쌍을 지나 결승으로
    title: 'Pinball',
    goalY: 147,
    zoomY: 143,
    entities: [
      // 시작 깔때기(기존 맵과 같은 x 9.25 ~ 16.5)는 폭 2 입구(x 12 ~ 14)로 모였다가 범퍼 구간(x 3 ~ 23)으로 넓어진다.
      // 입구에서 구슬끼리 부딪혀 순서가 섞이므로 시작 위치에 따른 쏠림이 줄어든다. 그 다음
      // 막대 구간(x 5 ~ 21)을 지나 결승 통로(x 12.5 ~ 13.5)로
      wall([
        [16.5, -300],
        [9.25, -300],
        [9.25, 6],
        [12, 10],
        [12, 11],
        [3, 17],
        [3, 108],
        [5, 110],
        [5, 136],
        [12.5, 143],
        [12.5, 148],
      ]),
      wall([
        [16.5, -300],
        [16.5, 6],
        [14, 10],
        [14, 11],
        [23, 17],
        [23, 108],
        [21, 110],
        [21, 136],
        [13.5, 143],
        [13.5, 148],
      ]),
      // 범퍼 23줄. 탄성이 1 을 넘으면 위로 역주행하므로 1 보다 작게 (PINBALL_BUMPER_RESTITUTION)
      ...pinballBumpers(),
      // 서로 반대 방향으로 도는 막대 두 쌍
      spinner(9.5, 116, 2.2, 0.15, PINBALL_SPINNER_SPEED),
      spinner(16.5, 116, 2.2, 0.15, -PINBALL_SPINNER_SPEED),
      spinner(9.5, 126, 2.2, 0.15, -PINBALL_SPINNER_SPEED),
      spinner(16.5, 126, 2.2, 0.15, PINBALL_SPINNER_SPEED),
    ],
  },
  {
    // 좌우로 번갈아 기운 경사판 9단을 굴러 내려가고, 결승 직전 좁은 병목을 지난다
    title: 'Zigzag Stairs',
    goalY: ZIGZAG_BOTTOM + 16,
    zoomY: ZIGZAG_BOTTOM + 10,
    entities: [
      // 시작 깔때기(x 9.25 ~ 16.5)는 폭 2 입구(x 12 ~ 14)로 모였다가 범퍼·계단 구간(x 6 ~ 20)으로 넓어진다.
      // 계단이 끝나면 병목(폭 ZIGZAG_BOTTLENECK_WIDTH)으로 모인다
      wall([
        [16.5, -300],
        [9.25, -300],
        [9.25, 6],
        [12, 10],
        [12, 11],
        [ZIGZAG_LEFT, 15],
        [ZIGZAG_LEFT, ZIGZAG_BOTTOM + 2],
        [13 - ZIGZAG_BOTTLENECK_WIDTH / 2, ZIGZAG_BOTTOM + 10],
        [13 - ZIGZAG_BOTTLENECK_WIDTH / 2, ZIGZAG_BOTTOM + 17],
      ]),
      wall([
        [16.5, -300],
        [16.5, 6],
        [14, 10],
        [14, 11],
        [ZIGZAG_RIGHT, 15],
        [ZIGZAG_RIGHT, ZIGZAG_BOTTOM + 2],
        [13 + ZIGZAG_BOTTLENECK_WIDTH / 2, ZIGZAG_BOTTOM + 10],
        [13 + ZIGZAG_BOTTLENECK_WIDTH / 2, ZIGZAG_BOTTOM + 17],
      ]),
      ...zigzagStairs(),
    ],
  },
  {
    // 층마다 방향과 속도가 다른 십자 풍차 사이를 고정 핀에 부딪히며 내려간다
    title: 'Windmill Village',
    goalY: WINDMILL_BOTTOM + 15,
    zoomY: WINDMILL_BOTTOM + 10,
    entities: [
      // 시작 깔때기(x 9.25 ~ 16.5)는 폭 2 입구(x 12 ~ 14)로 모였다가 풍차 구간(x 3 ~ 23)으로 넓어지고,
      // 마지막 층 아래에서 결승 통로(x 12.2 ~ 13.8, 폭 1.6)로 모인다.
      // 통로가 구슬 지름의 2배 안팎이면 구슬들이 아치처럼 서로 버티며 막히므로 3배 이상으로 둔다
      wall([
        [16.5, -300],
        [9.25, -300],
        [9.25, 6],
        [12, 10],
        [12, 11],
        [3, 17],
        [3, WINDMILL_BOTTOM],
        [12.2, WINDMILL_BOTTOM + 10],
        [12.2, WINDMILL_BOTTOM + 16],
      ]),
      wall([
        [16.5, -300],
        [16.5, 6],
        [14, 10],
        [14, 11],
        [23, 17],
        [23, WINDMILL_BOTTOM],
        [13.8, WINDMILL_BOTTOM + 10],
        [13.8, WINDMILL_BOTTOM + 16],
      ]),
      ...windmillVillage(),
    ],
  },
];
