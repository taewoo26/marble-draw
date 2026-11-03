interface ShapeColor {
  outline: string;
  fill: string;
  bloom: string;
  bloomRadius: number;
}

export interface ColorTheme {
  background: string;
  marbleLightness: number;
  marbleWinningBorder: string;
  skillColor: string;
  /** 새 스킬(부스터, 자리 바꾸기, 얼음, 반중력, 자석) 이펙트 색 */
  skillColors: {
    boost: string;
    swap: string;
    freeze: string;
    antiGravity: string;
    magnet: string;
  };
  coolTimeIndicator: string;
  entity: {
    box: ShapeColor;
    circle: ShapeColor;
    polyline: ShapeColor;
  };
  rankStroke: string;
  minimapBackground: string;
  minimapViewport: string;
  winnerText: string;
  winnerOutline: string;
  winnerBackground: string;
}
