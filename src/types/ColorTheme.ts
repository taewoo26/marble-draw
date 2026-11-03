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
  /** 새 스킬 이펙트·말풍선 색 */
  skillColors: {
    boost: string;
    swap: string;
    freeze: string;
    antiGravity: string;
    magnet: string;
    giant: string;
    shrink: string;
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
