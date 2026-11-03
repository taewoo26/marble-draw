/**
 * 스킬을 켠 상태로 물리만 돌려보는 시뮬레이션. simulate.ts 와 같은 10ms 고정 스텝, 같은 배치·정지 판정·shake 에
 * 스킬 발동(Marble 의 쿨타임·발동 확률, skillLogic.ts 의 물리 처리)을 더했다.
 *
 *   yarn simulate:skills [6,16,30,100]               모든 스킬, 게임과 같은 발동 확률
 *   yarn simulate:skills 16,30 --skill Magnet        한 스킬만 나오게
 *   yarn simulate:skills 16 --rate 1 --seeds 5       쿨타임마다 무조건 발동, 시드 5개
 *   yarn simulate:skills 30 --map 2                  한 맵만 (stages 인덱스)
 *
 * 미완주(unfinished)와 이탈(outOfBounds)이 0 이면 스킬 때문에 구슬이 끼거나 맵 밖으로 나가지 않은 것이다.
 */
import * as fs from 'node:fs';
import Box2DFactory from 'box2d-wasm';
import { SKILL_WEIGHTS, type SkillName, STUCK_DELAY } from '../src/data/constants';
import { stages } from '../src/data/maps';
import { Box2dPhysics } from '../src/physics-box2d';
import { applySkill, pickSkill, type SkillActor } from '../src/skillLogic';

const STEP_MS = 10;
const MAX_SIM_SEC = 900;
/** Marble.update 의 정지 판정 문턱 */
const STUCK_LEN_SQ = 0.00001;
/** 이름 가중치가 모두 같을 때 Marble 이 받는 weight (roulette.ts setMarbles 참고) */
const DEFAULT_MARBLE_WEIGHT = 0.1;

function seedRandom(seed: number) {
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
class NodePhysics extends Box2dPhysics {
  async init(): Promise<void> {
    const wasmBinary = fs.readFileSync(new URL('../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm', import.meta.url));
    const self = this as any;
    self.Box2D = await Box2DFactory({ wasmBinary } as any);
    self.gravity = new self.Box2D.b2Vec2(0, 10);
    self.world = new self.Box2D.b2World(self.gravity);
  }
}

type Options = {
  mapIdx: number;
  n: number;
  seed: number;
  /** null 이면 게임과 같은 발동 확률 (0.2 * weight) */
  rate: number | null;
  weights: Record<SkillName, number>;
};

type Result = {
  title: string;
  goals: number[];
  unfinished: number;
  outOfBounds: number;
  shakes: number;
  skillsUsed: number;
};

async function simulate({ mapIdx, n, seed, rate, weights }: Options): Promise<Result> {
  seedRandom(seed);
  const stage = stages[mapIdx];
  const p = new NodePhysics();
  await p.init();
  p.createStage(stage);

  // Marble 생성자와 같은 배치, 같은 쿨타임·발동 확률
  const maxLine = Math.ceil(n / 10);
  const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
  const maxCoolTime = 1000 + (1 - DEFAULT_MARBLE_WEIGHT) * 4000;
  const skillRate = rate ?? 0.2 * DEFAULT_MARBLE_WEIGHT;
  const coolTime = new Map<number, number>();
  for (let order = 0; order < n; order++) {
    const line = Math.floor(order / 10);
    p.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - line + lineDelta);
    coolTime.set(order, maxCoolTime * Math.random());
  }
  p.start();

  const alive = new Set<number>([...Array(n).keys()]);
  const last = new Map<number, { x: number; y: number }>();
  const stuckMs = new Map<number, number>();
  const pending: { id: number; at: number }[] = [];
  const r: Result = { title: stage.title, goals: [], unfinished: 0, outOfBounds: 0, shakes: 0, skillsUsed: 0 };
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

      const cool = coolTime.get(id)! - STEP_MS;
      if (cool <= 0) {
        coolTime.set(id, maxCoolTime);
        if (Math.random() < skillRate) {
          const skill = pickSkill(weights);
          const candidates = actors.filter((a) => alive.has(a.id) && a.y <= stage.goalY);
          if (applySkill(p, { id, x: pos.x, y: pos.y }, skill, candidates)) r.skillsUsed++;
        }
      } else coolTime.set(id, cool);

      const now = p.getMarblePosition(id);
      if (now.x < -5 || now.x > 40) r.outOfBounds++;
      if (now.y > stage.goalY) {
        r.goals.push(t);
        alive.delete(id);
        pending.push({ id, at: t + 0.5 });
      }
    }
  }
  r.unfinished = alive.size;
  return r;
}

function parseArgs(argv: string[]) {
  let counts = [6, 16, 30, 100];
  let skill: SkillName | null = null;
  let rate: number | null = null;
  let seeds = 1;
  let map: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skill') skill = argv[++i] as SkillName;
    else if (a === '--rate') rate = Number(argv[++i]);
    else if (a === '--seeds') seeds = Number(argv[++i]);
    else if (a === '--map') map = Number(argv[++i]);
    else if (/^[\d,]+$/.test(a)) counts = a.split(',').map(Number);
  }
  if (skill !== null && !(skill in SKILL_WEIGHTS)) {
    throw new Error(`unknown skill "${skill}". one of: ${Object.keys(SKILL_WEIGHTS).join(', ')}`);
  }
  return { counts, skill, rate, seeds, map };
}

async function main() {
  const { counts, skill, rate, seeds, map } = parseArgs(process.argv.slice(2));
  // --skill 이면 그 스킬만 1, 나머지는 0
  const weights = skill
    ? (Object.fromEntries(Object.keys(SKILL_WEIGHTS).map((k) => [k, k === skill ? 1 : 0])) as Record<SkillName, number>)
    : SKILL_WEIGHTS;
  console.log(
    `스킬: ${skill ?? '전체 (SKILL_WEIGHTS)'}, 발동 확률: ${rate ?? `게임과 같음 (${0.2 * DEFAULT_MARBLE_WEIGHT})`}, 시드: 1~${seeds}`
  );
  console.log('| 맵 | 구슬 | 시드 | 스킬 발동 | 첫 골인 | 마지막 골인 | shake | 미완주 | 이탈 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  let problems = 0;
  for (let m = 0; m < stages.length; m++) {
    if (map !== null && m !== map) continue;
    for (const n of counts) {
      for (let seed = 1; seed <= seeds; seed++) {
        const r = await simulate({ mapIdx: m, n, seed, rate, weights });
        if (r.unfinished || r.outOfBounds) problems++;
        console.log(
          `| ${r.title} | ${n} | ${seed} | ${r.skillsUsed} | ${r.goals[0]?.toFixed(1)}s | ${r.goals.at(-1)?.toFixed(1)}s | ${r.shakes} | ${r.unfinished} | ${r.outOfBounds} |`
        );
      }
    }
  }
  console.log(problems ? `\n문제 있는 조합: ${problems}개` : '\n모든 조합에서 미완주 0, 이탈 0');
}

main();
