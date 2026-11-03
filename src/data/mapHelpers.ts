import type { MapEntity } from '../types/MapEntity.type';

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
