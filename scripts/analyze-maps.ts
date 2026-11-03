/**
 * 맵 검증용 분석 (공용 코드: lib/sim.ts). simulate.ts 는 그대로 두고 따로 만들었다.
 *
 *   yarn analyze:maps                                  모든 맵, 구슬 6/16/30/100, 시드 5개
 *   yarn analyze:maps 16,30 --seeds 20 --map pinball   특정 맵만 (stages 인덱스 또는 제목 일부)
 *   yarn analyze:maps --skills                         스킬을 켠 상태로 (게임과 같은 발동 확률)
 *
 * 출력
 *  1. 골인 시간: 시드별 골인 시각 중앙값의 평균, 마지막 골인의 최댓값, 미완주·이탈 합계
 *  2. 시작 위치 쏠림: 시작 열(order % 10)별 1등 횟수와 평균 순위(0 = 1등, 1 = 꼴찌),
 *     시작 순서와 골인 순서의 순위 상관(스피어만, -1 ~ 1. 0 에 가까울수록 쏠림 없음)
 */
import { SKILL_WEIGHTS } from '../src/data/constants';
import { selectMaps, simulate } from './lib/sim';

function parseArgs(argv: string[]) {
  let counts = [6, 16, 30, 100];
  let seeds = 5;
  let map: string | null = null;
  let skills = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seeds') seeds = Number(argv[++i]);
    else if (a === '--map') map = argv[++i];
    else if (a === '--skills') skills = true;
    else if (/^[\d,]+$/.test(a)) counts = a.split(',').map(Number);
  }
  return { counts, seeds, map, skills };
}

const median = (a: number[]) => {
  if (!a.length) return Number.NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** 순위 상관 (스피어만). 같은 값이 없다고 보고 단순 공식을 쓴다 */
function spearman(order: number[]): number {
  const n = order.length;
  if (n < 2) return 0;
  // order[i] = i 번째로 골인한 구슬의 시작 순서
  let d2 = 0;
  const sorted = [...order].sort((a, b) => a - b);
  const startRank = new Map(sorted.map((v, i) => [v, i]));
  order.forEach((start, finishRank) => {
    const d = startRank.get(start)! - finishRank;
    d2 += d * d;
  });
  return 1 - (6 * d2) / (n * (n * n - 1));
}

async function main() {
  const { counts, seeds, map, skills } = parseArgs(process.argv.slice(2));
  const skillOpt = skills ? { rate: null, weights: SKILL_WEIGHTS } : null;
  const maps = selectMaps(map);
  console.log(`시드 1~${seeds}, 스킬 ${skills ? '켬' : '끔'}\n`);

  console.log('## 골인 시간');
  console.log('| 맵 | 구슬 | 골인 시각 중앙값 (시드 평균) | 마지막 골인 (최대) | 미완주 | 이탈 |');
  console.log('|---|---:|---:|---:|---:|---:|');
  const bias: string[] = [];
  for (const m of maps) {
    for (const n of counts) {
      let medSum = 0;
      let lastMax = 0;
      let unfinished = 0;
      let outOfBounds = 0;
      let title = '';
      const wins = new Array(10).fill(0);
      const rankSum = new Array(10).fill(0);
      const rankCnt = new Array(10).fill(0);
      let rho = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const r = await simulate({ mapIdx: m, n, seed, skills: skillOpt });
        title = r.title;
        medSum += median(r.goals);
        lastMax = Math.max(lastMax, r.goals.at(-1) ?? 0);
        unfinished += r.unfinished;
        outOfBounds += r.outOfBounds;
        if (r.finishOrder.length) wins[r.finishOrder[0] % 10]++;
        r.finishOrder.forEach((id, rank) => {
          rankSum[id % 10] += rank / Math.max(1, n - 1);
          rankCnt[id % 10]++;
        });
        rho += spearman(r.finishOrder);
      }
      console.log(
        `| ${title} | ${n} | ${(medSum / seeds).toFixed(1)}s | ${lastMax.toFixed(1)}s | ${unfinished} | ${outOfBounds} |`
      );
      const cols = Math.min(10, n);
      const avgRank = rankSum.slice(0, cols).map((s, i) => (rankCnt[i] ? s / rankCnt[i] : Number.NaN));
      const topWin = Math.max(...wins);
      bias.push(
        `| ${title} | ${n} | ${wins.slice(0, cols).join(' ')} | ${avgRank.map((v) => v.toFixed(2)).join(' ')} | ${topWin}/${seeds} (열 ${wins.indexOf(topWin)}) | ${(rho / seeds).toFixed(2)} |`
      );
    }
  }

  console.log('\n## 시작 위치 쏠림 (열 = order % 10, 왼쪽부터 0)');
  console.log('| 맵 | 구슬 | 열별 1등 횟수 | 열별 평균 순위 (0=1등) | 최다 1등 | 순위 상관 |');
  console.log('|---|---:|---|---|---:|---:|');
  bias.forEach((line) => console.log(line));
}

main();
