/**
 * 렌더링 없이 물리만 돌리는 시뮬레이션 공용 코드. simulate-skills.ts, analyze-maps.ts 가 쓴다.
 * simulate.ts 와 같은 10ms 고정 스텝, 같은 구슬 배치·정지 판정·shake 에 스킬 발동을 선택적으로 더했다.
 * 스킬을 끄면(skills: null) Math.random 을 simulate.ts 와 같은 순서로 써서 같은 시드면 같은 결과가 나온다.
 */
import * as fs from 'node:fs';
import Box2DFactory from 'box2d-wasm';
import { type SkillName, STUCK_DELAY } from '../../src/data/constants';
import { stages } from '../../src/data/maps';
import { Box2dPhysics } from '../../src/physics-box2d';
import { applySkill, pickSkill, type SkillActor } from '../../src/skillLogic';

export const STEP_MS = 10;
export const MAX_SIM_SEC = 900;
/** Marble.update 의 정지 판정 문턱 */
const STUCK_LEN_SQ = 0.00001;
/** 이름 가중치가 모두 같을 때 Marble 이 받는 weight (roulette.ts setMarbles 참고) */
export const DEFAULT_MARBLE_WEIGHT = 0.1;

export function seedRandom(seed: number) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Node 의 emscripten 로더가 fetch 로 wasm 경로를 열려다 실패하므로 바이너리를 직접 넘긴다
export class NodePhysics extends Box2dPhysics {
  async init(): Promise<void> {
    const wasmBinary = fs.readFileSync(
      new URL('../../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm', import.meta.url)
    );
    const self = this as any;
    self.Box2D = await Box2DFactory({ wasmBinary } as any);
    self.gravity = new self.Box2D.b2Vec2(0, 10);
    self.world = new self.Box2D.b2World(self.gravity);
  }
}

export type SkillOptions = {
  /** null 이면 게임과 같은 발동 확률 (0.2 * weight) */
  rate: number | null;
  weights: Record<SkillName, number>;
};

export type SimOptions = {
  mapIdx: number;
  n: number;
  seed: number;
  /** null 이면 스킬 없이 물리만 */
  skills: SkillOptions | null;
};

export type SimResult = {
  title: string;
  /** 골인 시각(초), 골인 순서대로 */
  goals: number[];
  /** 골인한 구슬 id(= 시작 순서 order), 골인 순서대로 */
  finishOrder: number[];
  unfinished: number;
  outOfBounds: number;
  shakes: number;
  skillsUsed: number;
  /** 끝나지 않은 구슬의 마지막 위치 */
  leftovers: { id: number; x: number; y: number }[];
};

export async function simulate({ mapIdx, n, seed, skills }: SimOptions): Promise<SimResult> {
  seedRandom(seed);
  const stage = stages[mapIdx];
  const p = new NodePhysics();
  await p.init();
  p.createStage(stage);

  // Marble 생성자와 같은 배치, 같은 쿨타임·발동 확률
  const maxLine = Math.ceil(n / 10);
  const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
  const maxCoolTime = 1000 + (1 - DEFAULT_MARBLE_WEIGHT) * 4000;
  const skillRate = skills ? (skills.rate ?? 0.2 * DEFAULT_MARBLE_WEIGHT) : 0;
  const coolTime = new Map<number, number>();
  for (let order = 0; order < n; order++) {
    const line = Math.floor(order / 10);
    p.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - line + lineDelta);
    if (skills) coolTime.set(order, maxCoolTime * Math.random());
  }
  p.start();

  const alive = new Set<number>([...Array(n).keys()]);
  const last = new Map<number, { x: number; y: number }>();
  const stuckMs = new Map<number, number>();
  const pending: { id: number; at: number }[] = [];
  const r: SimResult = {
    title: stage.title,
    goals: [],
    finishOrder: [],
    unfinished: 0,
    outOfBounds: 0,
    shakes: 0,
    skillsUsed: 0,
    leftovers: [],
  };
  const stepSec = STEP_MS / 1000;
  let t = 0;
  while (alive.size > 0 && t < MAX_SIM_SEC) {
    p.step(stepSec);
    t += stepSec;
    while (pending.length && pending[0].at <= t) p.removeMarble(pending.shift()!.id);

    // 게임 루프처럼 물리 스텝 다음에 구슬마다 정지 판정, 스킬, 골인 판정을 한다
    const actors: SkillActor[] = [...alive].map((id) => ({ id, ...p.getMarblePosition(id) }));
    for (const actor of actors) {
      const { id } = actor;
      const pos = p.getMarblePosition(id);
      const prev = last.get(id);
      if (prev) {
        const lenSq = (pos.x - prev.x) ** 2 + (pos.y - prev.y) ** 2;
        if (lenSq < STUCK_LEN_SQ) {
          const acc = (stuckMs.get(id) ?? 0) + STEP_MS;
          if (acc > STUCK_DELAY) {
            p.shakeMarble(id);
            r.shakes++;
            stuckMs.set(id, 0);
          } else stuckMs.set(id, acc);
        } else stuckMs.set(id, 0);
      }
      last.set(id, { x: pos.x, y: pos.y });

      if (skills) {
        const cool = coolTime.get(id)! - STEP_MS;
        if (cool <= 0) {
          coolTime.set(id, maxCoolTime);
          if (Math.random() < skillRate) {
            const skill = pickSkill(skills.weights);
            const candidates = actors.filter((a) => alive.has(a.id) && a.y <= stage.goalY);
            if (applySkill(p, { id, x: pos.x, y: pos.y }, skill, candidates)) r.skillsUsed++;
          }
        } else coolTime.set(id, cool);
      }

      const now = p.getMarblePosition(id);
      if (now.x < -5 || now.x > 40) r.outOfBounds++;
      if (now.y > stage.goalY) {
        r.goals.push(t);
        r.finishOrder.push(id);
        alive.delete(id);
        pending.push({ id, at: t + 0.5 });
      }
    }
  }
  r.unfinished = alive.size;
  r.leftovers = [...alive].map((id) => ({ id, ...p.getMarblePosition(id) }));
  return r;
}

/** --map 값(인덱스 또는 제목 일부)을 stages 인덱스 목록으로 바꾼다. 없으면 전체 */
export function selectMaps(arg: string | null): number[] {
  if (arg === null) return stages.map((_, i) => i);
  if (/^\d+$/.test(arg)) return [Number(arg)];
  const q = arg.toLowerCase();
  return stages.flatMap((s, i) => (s.title.toLowerCase().includes(q) ? [i] : []));
}
