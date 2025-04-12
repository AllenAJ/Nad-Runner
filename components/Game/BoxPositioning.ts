interface BoxConfig {
  width: number;
  height: number;
  topCount: number;
  bottomCount: number;
  gapSize: number;
}

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateBoxPositions(
  boxConfig: BoxConfig,
  canvasWidth: number,
  canvasHeight: number,
  arrangement: 'split_gap' | 'default'
): Position[] {
  const positions: Position[] = [];

  switch (arrangement) {
    case 'split_gap':
      const { topCount, gapSize } = boxConfig;
      const totalHeight = boxConfig.height * topCount + gapSize * (topCount - 1);
      const startY = (canvasHeight - totalHeight) / 2;

      // Position the stacked boxes with gaps
      for (let i = 0; i < topCount; i++) {
        positions.push({
          x: canvasWidth / 4,
          y: startY + i * (boxConfig.height + gapSize),
          width: boxConfig.width,
          height: boxConfig.height
        });
      }

      // Position the bottom box
      positions.push({
        x: (canvasWidth * 3) / 4,
        y: canvasHeight - boxConfig.height - 10, // 10px padding from bottom
        width: boxConfig.width,
        height: boxConfig.height
      });
      break;

    default:
      // Default arrangement - single column centered
      const verticalSpacing = 10;
      const totalBoxes = boxConfig.topCount + boxConfig.bottomCount;
      const totalStackHeight = boxConfig.height * totalBoxes + verticalSpacing * (totalBoxes - 1);
      const defaultStartY = (canvasHeight - totalStackHeight) / 2;

      for (let i = 0; i < totalBoxes; i++) {
        positions.push({
          x: canvasWidth / 2 - boxConfig.width / 2,
          y: defaultStartY + i * (boxConfig.height + verticalSpacing),
          width: boxConfig.width,
          height: boxConfig.height
        });
      }
      break;
  }

  return positions;
} 