import {
  ANTI_GRAVITY_DURATION,
  ANTI_GRAVITY_MAX_UP_SPEED,
  ANTI_GRAVITY_SCALE,
  BOOST_MAX_SPEED,
  BOOST_SPEED,
  DEBUG_FORCE_SKILL,
  FREEZE_DURATION,
  FREEZE_IMMUNITY,
  FREEZE_RADIUS,
  GIANT_DURATION,
  GIANT_SCALE,
  MAGNET_POWER,
  MAGNET_RANGE,
  RESIZE_RAMP_TIME,
  RESIZE_STEP,
  SHRINK_DURATION,
  SHRINK_SCALE,
  SKILL_COOL_TIME,
  SKILL_RATE,
  SKILL_WEIGHTS,
  type SkillName,
  Skills,
  SWAP_RANGE,
} from './data/constants';
import type { IPhysics } from './IPhysics';

/**
 * 스킬의 물리 처리. 게임(roulette.ts)과 스킬 시뮬레이션(scripts/simulate-skills.ts)이 같은 코드를 쓴다.
 * 이펙트, 말풍선, 효과음 같은 연출은 여기서 다루지 않는다
 */

/** 스킬을 쓰거나 맞는 구슬. Marble 이나 시뮬레이션의 위치 정보 모두 이 모양이면 된다 */
export type SkillActor = { id: number; x: number; y: number };

/** 스킬을 쓴 결과. 연출에 쓴다. null 이면 아무 일도 일어나지 않았다 */
export type SkillResult = {
  /** 자리 바꾸기 상대 */
  partner?: SkillActor;
  /** 얼음, 자석에 걸린 구슬들 */
  targets: SkillActor[];
} | null;

/** 이름 가중치가 모두 같을 때 구슬이 받는 가중치 (roulette.ts setMarbles). 구슬 가중치는 0.1 ~ 1.1 */
export const BASE_MARBLE_WEIGHT = 0.1;

/** 쿨타임이 끝날 때 스킬이 발동할 확률. weight 는 구슬 가중치. 가중치가 가장 크면 SKILL_RATE + 0.2 */
export function skillRateFor(weight: number): number {
  return Math.min(1, Math.max(0, SKILL_RATE + 0.2 * (weight - BASE_MARBLE_WEIGHT)));
}

/** 스킬 쿨타임(ms). 가중치가 클수록 짧아지고, SKILL_COOL_TIME 의 1/4 보다 짧아지지는 않는다 */
export function coolTimeFor(weight: number): number {
  return SKILL_COOL_TIME * Math.max(0.25, 1 - (weight - BASE_MARBLE_WEIGHT));
}

/** 발동한 스킬의 종류를 가중치대로 고른다. 가중치가 0 이하인 스킬은 나오지 않는다 */
export function pickSkill(weights: Record<SkillName, number> = SKILL_WEIGHTS): Skills {
  if (DEBUG_FORCE_SKILL !== null) return DEBUG_FORCE_SKILL;
  const entries = (Object.keys(weights) as SkillName[]).map(
    (name) => [Skills[name], Math.max(0, weights[name])] as const
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return Skills.Impact;
  let r = Math.random() * total;
  for (const [skill, weight] of entries) {
    r -= weight;
    if (r < 0) return skill;
  }
  return entries[entries.length - 1][0];
}

/** candidates 중 actor 를 뺀, actor 에서 range 안에 있는 구슬들 */
export function marblesNear(actor: SkillActor, candidates: SkillActor[], range: number): SkillActor[] {
  const rangeSq = range * range;
  return candidates.filter((m) => {
    if (m.id === actor.id) return false;
    const dx = m.x - actor.x;
    const dy = m.y - actor.y;
    return dx * dx + dy * dy <= rangeSq;
  });
}

/**
 * actor 가 skill 을 쓴다. candidates 는 아직 골인하지 않은 구슬들(actor 가 섞여 있어도 된다)
 */
export function applySkill(physics: IPhysics, actor: SkillActor, skill: Skills, candidates: SkillActor[]): SkillResult {
  switch (skill) {
    case Skills.Impact:
      physics.impact(actor.id);
      return { targets: [] };
    case Skills.Boost:
      physics.boost(actor.id, BOOST_SPEED, BOOST_MAX_SPEED);
      return { targets: [] };
    case Skills.Swap: {
      const near = marblesNear(actor, candidates, SWAP_RANGE);
      if (near.length === 0) return null;
      const partner = near[Math.floor(Math.random() * near.length)];
      physics.swapMarbles(actor.id, partner.id);
      return { partner, targets: [] };
    }
    case Skills.Freeze: {
      const targets = marblesNear(actor, candidates, FREEZE_RADIUS);
      if (targets.length > 0) {
        physics.freeze(
          targets.map((m) => m.id),
          FREEZE_DURATION,
          FREEZE_IMMUNITY
        );
      }
      return { targets };
    }
    case Skills.AntiGravity:
      physics.antiGravity(actor.id, ANTI_GRAVITY_DURATION, ANTI_GRAVITY_SCALE, ANTI_GRAVITY_MAX_UP_SPEED);
      return { targets: [] };
    case Skills.Magnet: {
      const targets = marblesNear(actor, candidates, MAGNET_RANGE);
      if (targets.length > 0) {
        physics.magnet(
          actor.id,
          targets.map((m) => m.id),
          MAGNET_RANGE,
          MAGNET_POWER
        );
      }
      return { targets };
    }
    case Skills.Giant:
      physics.resize(actor.id, GIANT_SCALE, GIANT_DURATION, RESIZE_RAMP_TIME, RESIZE_STEP);
      return { targets: [] };
    case Skills.Shrink:
      physics.resize(actor.id, SHRINK_SCALE, SHRINK_DURATION, RESIZE_RAMP_TIME, RESIZE_STEP);
      return { targets: [] };
    default:
      return null;
  }
}
