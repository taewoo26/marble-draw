/**
 * 스킬을 켠 상태로 물리만 돌려보는 시뮬레이션 (공용 코드: lib/sim.ts).
 * simulate.ts 와 같은 배치·정지 판정·shake 에 스킬 발동(Marble 의 쿨타임·발동 확률, skillLogic.ts 의 물리 처리)을 더했다.
 *
 *   yarn simulate:skills [6,16,30,100]               모든 스킬, 게임과 같은 발동 확률
 *   yarn simulate:skills 16,30 --skill Magnet        한 스킬만 나오게
 *   yarn simulate:skills 16 --rate 1 --seeds 5       쿨타임마다 무조건 발동, 시드 5개
 *   yarn simulate:skills 30 --map 2                  한 맵만 (stages 인덱스 또는 제목 일부, 예: --map pinball)
 *
 * 미완주(unfinished)와 이탈(outOfBounds)이 0 이면 스킬 때문에 구슬이 끼거나 맵 밖으로 나가지 않은 것이다.
 */
import { SKILL_WEIGHTS, type SkillName } from '../src/data/constants';
import { skillRateFor } from '../src/skillLogic';
import { DEFAULT_MARBLE_WEIGHT, selectMaps, simulate } from './lib/sim';

function parseArgs(argv: string[]) {
  let counts = [6, 16, 30, 100];
  let skill: SkillName | null = null;
  let rate: number | null = null;
  let seeds = 1;
  let map: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skill') skill = argv[++i] as SkillName;
    else if (a === '--rate') rate = Number(argv[++i]);
    else if (a === '--seeds') seeds = Number(argv[++i]);
    else if (a === '--map') map = argv[++i];
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
    `스킬: ${skill ?? '전체 (SKILL_WEIGHTS)'}, 발동 확률: ${rate ?? `게임과 같음 (${skillRateFor(DEFAULT_MARBLE_WEIGHT).toFixed(2)})`}, 시드: 1~${seeds}`
  );
  console.log('| 맵 | 구슬 | 시드 | 스킬 발동 | 첫 골인 | 마지막 골인 | shake | 미완주 | 이탈 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  let problems = 0;
  for (const m of selectMaps(map)) {
    for (const n of counts) {
      for (let seed = 1; seed <= seeds; seed++) {
        const r = await simulate({ mapIdx: m, n, seed, skills: { rate, weights } });
        if (r.unfinished || r.outOfBounds) problems++;
        for (const m of r.leftovers) {
          console.log(`  미완주 구슬 #${m.id}: (${m.x.toFixed(2)}, ${m.y.toFixed(2)})`);
        }
        console.log(
          `| ${r.title} | ${n} | ${seed} | ${r.skillsUsed} | ${r.goals[0]?.toFixed(1)}s | ${r.goals.at(-1)?.toFixed(1)}s | ${r.shakes} | ${r.unfinished} | ${r.outOfBounds} |`
        );
      }
    }
  }
  console.log(problems ? `\n문제 있는 조합: ${problems}개` : '\n모든 조합에서 미완주 0, 이탈 0');
}

main();
