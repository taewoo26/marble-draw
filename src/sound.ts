import { SOUND_MIN_INTERVAL, SOUND_VOLUME } from './data/constants';
import options from './options';

export type SoundName = 'impact' | 'boost' | 'swap' | 'freeze' | 'goal' | 'fanfare';

/**
 * 효과음. 오디오 파일 없이 Web Audio API 로 짧은 소리를 합성한다.
 * 브라우저 정책 때문에 사용자가 클릭(Start)한 뒤 unlock() 을 불러야 소리가 난다
 */
class SoundManager {
  private _ctx: AudioContext | null = null;
  private _master: GainNode | null = null;
  /** 종류별 마지막 재생 시각(ms). 구슬이 많을 때 같은 소리가 겹치지 않게 한다 */
  private _lastPlayed = new Map<SoundName, number>();

  /** Start 클릭 처리 안에서 부른다. AudioContext 를 만들거나 다시 깨운다 */
  unlock() {
    try {
      if (!this._ctx) {
        const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!AudioCtor) return;
        this._ctx = new AudioCtor() as AudioContext;
        this._master = this._ctx.createGain();
        this._master.gain.value = SOUND_VOLUME;
        this._master.connect(this._ctx.destination);
      }
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('sound unavailable', e);
    }
  }

  play(name: SoundName) {
    const ctx = this._ctx;
    if (!options.useSound || !ctx || !this._master || ctx.state !== 'running') return;

    const now = performance.now();
    if (now - (this._lastPlayed.get(name) ?? -Infinity) < SOUND_MIN_INTERVAL) return;
    this._lastPlayed.set(name, now);

    const t = ctx.currentTime;
    switch (name) {
      case 'impact':
        // 쿵: 낮은 음이 더 낮게 떨어진다
        this._tone('sine', t, 0.25, 0.9, [140, 45]);
        this._tone('triangle', t, 0.08, 0.3, [90, 60]);
        break;
      case 'boost':
        // 슝: 빠르게 올라가는 음
        this._tone('sawtooth', t, 0.22, 0.25, [220, 1100], 1800);
        break;
      case 'swap':
        // 띠링: 짧은 두 음
        this._tone('sine', t, 0.1, 0.5, [880]);
        this._tone('sine', t + 0.08, 0.16, 0.5, [1320]);
        break;
      case 'freeze':
        // 챙: 높은 금속성 화음이 빠르게 줄어든다
        this._tone('triangle', t, 0.4, 0.4, [2093]);
        this._tone('sine', t, 0.35, 0.3, [3136]);
        this._tone('sine', t, 0.25, 0.2, [4186]);
        break;
      case 'goal':
        // 딩
        this._tone('sine', t, 0.3, 0.45, [1046]);
        break;
      case 'fanfare': {
        // 짧은 팡파레: 도-미-솔-도
        const notes = [523, 659, 784, 1046];
        notes.forEach((freq, i) => {
          const last = i === notes.length - 1;
          this._tone('square', t + i * 0.08, last ? 0.24 : 0.09, 0.22, [freq], 2500);
        });
        break;
      }
    }
  }

  /**
   * 음 하나를 낸다.
   * freqs 가 두 개면 처음 값에서 끝 값으로 미끄러진다. lowpass 를 주면 거친 파형을 부드럽게 깎는다
   */
  private _tone(
    type: OscillatorType,
    start: number,
    duration: number,
    volume: number,
    freqs: number[],
    lowpass?: number
  ) {
    const ctx = this._ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0], start);
    if (freqs.length > 1) {
      osc.frequency.exponentialRampToValueAtTime(freqs[1], start + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    let node: AudioNode = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(this._master!);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const sound = new SoundManager();
