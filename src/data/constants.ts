import type { ColorTheme } from '../types/ColorTheme';

export const initialZoom = 30;
export const canvasWidth = 1600;
export const canvasHeight = 900;
export const zoomThreshold = 5;
export const STUCK_DELAY = 5000;
export const winnerAreaHeight = 168;

export enum Skills {
  None,
  Impact,
  Boost,
  Swap,
  Freeze,
}

/** 스킬이 발동할 때 어떤 스킬이 나올지의 가중치. 발동 확률 자체는 marble.ts 의 _skillRate 가 정한다 */
export const SKILL_WEIGHTS: Record<Exclude<Skills, Skills.None>, number> = {
  [Skills.Impact]: 25,
  [Skills.Boost]: 25,
  [Skills.Swap]: 25,
  [Skills.Freeze]: 25,
};

/** 부스터: 아래(+y) 방향으로 더하는 속도. 질량과 무관하게 같은 만큼 빨라진다 */
export const BOOST_SPEED = 5;
/** 부스터 후 아래 방향 속도 상한. 한 물리 스텝(0.01초)에 구슬 반지름보다 덜 움직이게 해서 벽을 뚫지 않게 한다 */
export const BOOST_MAX_SPEED = 12;
/** 자리 바꾸기: 상대를 고르는 거리 */
export const SWAP_RANGE = 5;
/** 얼음: 멈추게 하는 반경과 시간(ms, 물리 시간 기준) */
export const FREEZE_RADIUS = 3;
export const FREEZE_DURATION = 1000;

/**
 * 개발 확인용. null 이 아니면 스킬이 발동할 때 항상 이 스킬이 나온다 (예: Skills.Swap).
 * 배포 전에는 반드시 null 로 되돌린다
 */
export const DEBUG_FORCE_SKILL: Skills | null = null;
/** 개발 확인용. null 이 아니면 쿨타임이 끝날 때의 발동 확률을 이 값으로 덮어쓴다 (예: 1) */
export const DEBUG_SKILL_RATE: number | null = null;

/** 스킬이 발동했을 때 구슬 위에 잠깐 떠오르는 이름 */
export const SKILL_LABELS: Partial<Record<Skills, string>> = {
  [Skills.Impact]: '💥 밀어내기!',
  [Skills.Boost]: '💨 부스터!',
  [Skills.Swap]: '🔄 자리 바꾸기!',
  [Skills.Freeze]: '❄️ 얼음!',
};
/** 스킬 이름이 떠 있는 시간(ms) */
export const SKILL_LABEL_DURATION = 800;

export const DefaultEntityColor = {
  box: 'cyan',
  circle: 'yellow',
  polyline: 'white',
} as const;

export const DefaultBloomColor = {
  box: 'cyan',
  circle: 'yellow',
  polyline: 'cyan',
};

export const Themes: Record<string, ColorTheme> = {
  light: {
    background: '#eee',
    marbleLightness: 50,
    marbleWinningBorder: 'black',
    skillColor: '#69c',
    skillColors: {
      boost: '#e67e22',
      swap: '#8e44ad',
      freeze: '#3a9fd8',
    },
    coolTimeIndicator: '#999',
    entity: {
      box: {
        fill: '#226f92',
        outline: 'black',
        bloom: 'cyan',
        bloomRadius: 0,
      },
      circle: {
        fill: 'yellow',
        outline: '#ed7e11',
        bloom: 'yellow',
        bloomRadius: 0,
      },
      polyline: {
        fill: 'white',
        outline: 'black',
        bloom: 'cyan',
        bloomRadius: 0,
      },
    },
    rankStroke: 'black',
    minimapBackground: '#fefefe',
    minimapViewport: '#6699cc',

    winnerBackground: 'rgba(255, 255, 255, 0.5)',
    winnerOutline: 'black',
    winnerText: '#cccccc',
  },
  dark: {
    background: 'black',
    marbleLightness: 75,
    marbleWinningBorder: 'white',
    skillColor: 'white',
    skillColors: {
      boost: '#ffb347',
      swap: '#d98cff',
      freeze: '#8fe3ff',
    },
    coolTimeIndicator: 'red',
    entity: {
      box: {
        fill: 'cyan',
        outline: 'cyan',
        bloom: 'cyan',
        bloomRadius: 15,
      },
      circle: {
        fill: 'yellow',
        outline: 'yellow',
        bloom: 'yellow',
        bloomRadius: 15,
      },
      polyline: {
        fill: 'white',
        outline: 'white',
        bloom: 'cyan',
        bloomRadius: 15,
      },
    },
    rankStroke: '',
    minimapBackground: '#333333',
    minimapViewport: 'white',
    winnerBackground: 'rgba(0, 0, 0, 0.5)',
    winnerOutline: 'black',
    winnerText: 'white',
  },
};
