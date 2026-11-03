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
  AntiGravity,
  Magnet,
  Giant,
  Shrink,
}

/** None 을 뺀 스킬 이름 ('Impact', 'Boost', ...) */
export type SkillName = Exclude<keyof typeof Skills, 'None'>;

/**
 * 스킬이 발동할 때 어떤 스킬이 나올지의 가중치. 0 이면 그 스킬은 나오지 않는다.
 * 발동 확률 자체는 marble.ts 의 _skillRate 가 정한다.
 * 특정 스킬만 보고 싶으면 나머지를 0 으로 둔다 (예: Magnet 만 1)
 */
export const SKILL_WEIGHTS: Record<SkillName, number> = {
  Impact: 1,
  Boost: 1,
  Swap: 1,
  Freeze: 1,
  AntiGravity: 1,
  Magnet: 1,
  Giant: 1,
  Shrink: 1,
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
 * 얼음이 풀린 구슬은 이 시간(ms, 물리 시간) 동안 다시 얼지 않는다.
 * 없으면 몰려 있는 구슬들이 서로를 계속 다시 얼려서 영원히 멈출 수 있다
 */
export const FREEZE_IMMUNITY = 1500;
/** 반중력: 중력 배율(음수면 위로 뜬다), 유지 시간(ms, 물리 시간 기준), 위로 올라가는 속도 상한 */
export const ANTI_GRAVITY_SCALE = -0.5;
export const ANTI_GRAVITY_DURATION = 700;
export const ANTI_GRAVITY_MAX_UP_SPEED = 3;
/** 자석: 끌어당기는 범위, 세기(가장 가까울 때 임펄스. 멀수록 약해진다) */
export const MAGNET_RANGE = 5;
export const MAGNET_POWER = 1;
/** 구슬 기본 지름(화면). 물리 반지름은 이 값의 절반 */
export const MARBLE_BASE_SIZE = 0.5;
/** 거대화: 크기 배율, 유지 시간(ms, 물리 시간) */
export const GIANT_SCALE = 1.6;
export const GIANT_DURATION = 2000;
/** 축소: 크기 배율, 유지 시간(ms, 물리 시간) */
export const SHRINK_SCALE = 0.75;
export const SHRINK_DURATION = 3000;
/** 크기가 바뀌는 데 걸리는 시간(ms)과 한 번에 바꾸는 배율 단위. 이 단위마다 물리 원을 새로 만든다 */
export const RESIZE_RAMP_TIME = 300;
export const RESIZE_STEP = 0.05;

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
  [Skills.AntiGravity]: '🎈 둥실!',
  [Skills.Magnet]: '🧲 자석!',
  [Skills.Giant]: '🐘 거대화!',
  [Skills.Shrink]: '🐜 축소!',
};
/** 스킬 이름이 떠 있는 시간(ms) */
export const SKILL_LABEL_DURATION = 800;

/** 역전 알림 배너: 떠 있는 시간, 배너가 사라진 뒤 다음 배너까지 최소 간격, 시작 직후 배너를 띄우지 않는 시간 (ms) */
export const BANNER_DURATION = 1500;
export const BANNER_COOLDOWN = 2000;
export const BANNER_START_DELAY = 3000;

/** 효과음: 전체 볼륨(0 ~ 1), 같은 종류 효과음 사이 최소 간격(ms) */
export const SOUND_VOLUME = 0.15;
export const SOUND_MIN_INTERVAL = 100;

/** 맵 'Pinball': 범퍼 반지름·탄성, 아래쪽 회전 막대 속도(라디안/초) */
export const PINBALL_BUMPER_RADIUS = 0.6;
export const PINBALL_BUMPER_RESTITUTION = 0.8;
export const PINBALL_SPINNER_SPEED = 2.5;

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
      antiGravity: '#d6336c',
      magnet: '#c0392b',
      giant: '#b8860b',
      shrink: '#2e8b57',
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
      antiGravity: '#ff9ecb',
      magnet: '#ff6b6b',
      giant: '#ffd54f',
      shrink: '#7ee08a',
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
