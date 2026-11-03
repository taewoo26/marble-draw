import type { MapEntity } from '../types/MapEntity.type';
import { RING_COLORS, RING_RESTITUTION } from './constants';

/**
 * 새 맵을 짧게 쓰기 위한 엔티티 생성 함수들. 만들어지는 값은 기존 맵의 엔티티와 같은 모양이다.
 * 색을 지정하지 않으면 테마 색을 따른다
 */

/** 고정 벽 (꺾은선) */
export function wall(points: [number, number][], restitution = 0): MapEntity {
  return {
    type: 'static',
    position: { x: 0, y: 0 },
    props: { density: 1, angularVelocity: 0, restitution },
    shape: { type: 'polyline', rotation: 0, points },
  };
}

/** 고정 원 (핀, 범퍼) */
export function circle(x: number, y: number, radius: number, restitution = 0): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { density: 1, angularVelocity: 0, restitution },
    shape: { type: 'circle', radius },
  };
}

/**
 * 튕기는 링: 부딪히면 세게 튕겨내고 부서진다 (life 1). colorIndex 로 RING_COLORS 중 색을 고른다
 */
export function ring(x: number, y: number, radius: number, colorIndex = 0): MapEntity {
  const color = RING_COLORS[colorIndex % RING_COLORS.length];
  return {
    type: 'static',
    position: { x, y },
    props: { density: 1, angularVelocity: 0, restitution: RING_RESTITUTION, life: 1 },
    shape: { type: 'circle', radius, color, bloomColor: color },
  };
}

/**
 * 경사면 위 링: from → to 경사면의 1/3, 2/3 지점에서 위쪽으로 gap 만큼 띄워 링을 둔다.
 * 링 아래 틈이 구슬 지름보다 좁아서 굴러가는 구슬은 링에 부딪혀 튕긴다 (링은 부서지므로 막히지 않는다)
 */
export function slopeRings(
  from: [number, number],
  to: [number, number],
  colorIndex = 0,
  radius = 0.2,
  gap = 0.6
): MapEntity[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  // 경사면에 수직이면서 위(-y)를 향하는 방향
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return [1 / 3, 2 / 3].map((t, i) =>
    ring(from[0] + dx * t + nx * gap, from[1] + dy * t + ny * gap, radius, colorIndex + i)
  );
}

/** 과녁 링: 같은 자리에 크기가 다른 링을 겹쳐 둔다. 바깥 링부터 한 겹씩 부서진다 */
export function target(x: number, y: number, radii: number[]): MapEntity[] {
  return radii.map((radius, i) => ring(x, y, radius, i));
}

/** 고정 상자. width, height 는 절반 크기, rotation 은 라디안 */
export function box(x: number, y: number, width: number, height: number, rotation = 0, restitution = 0): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { density: 1, angularVelocity: 0, restitution },
    shape: { type: 'box', width, height, rotation },
  };
}

/** 제자리에서 도는 막대 (kinematic). angularVelocity 는 라디안/초, 양수면 시계 방향 */
export function spinner(
  x: number,
  y: number,
  width: number,
  height: number,
  angularVelocity: number,
  rotation = 0
): MapEntity {
  return {
    type: 'kinematic',
    position: { x, y },
    props: { density: 1, angularVelocity, restitution: 0 },
    shape: { type: 'box', width, height, rotation },
  };
}

/** 십자 풍차: 같은 자리에서 같이 도는 막대 두 개 */
export function windmill(x: number, y: number, arm: number, thickness: number, angularVelocity: number): MapEntity[] {
  return [
    spinner(x, y, arm, thickness, angularVelocity, 0),
    spinner(x, y, arm, thickness, angularVelocity, Math.PI / 2),
  ];
}
