import './localization';
import { initMapSelector } from './mapSelector';
import options from './options';
import { Roulette } from './roulette';

const roulette = new Roulette();

(window as any).roulette = roulette;

// index.html 이 초기화할 때 부른다.
// 원작자의 맵 공유마당 서버는 쓰지 않으므로 맵 브라우저(서버 통신)는 끈다. 기본 맵만 쓴다.
(window as any).initMapSelector = (onMapChange: () => void, toast: (key: string) => void) =>
  initMapSelector({ roulette, apiBase: '', onMapChange, toast, mapBrowser: false });

(window as any).options = options;

// index.html 의 시작 버튼이 부른다. 광고 없이 녹화 준비가 끝나면 바로 시작한다
(window as any).ads = {
  beginRound(onStart: () => void) {
    roulette.startRecording().then(onStart);
  },
  showResult() {},
};
