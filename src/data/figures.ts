// Block Figure Definitions - Converted from figures.csv
// Each figure has an id, block count, and cells array of [x, y] coordinates

export interface BlockShape {
  id: string;
  blockCount: number;
  cells: [number, number][];
}

export const FIGURES: BlockShape[] = [
  // Index 1: Iv5 - Vertical line of 5
  { id: 'Iv5', blockCount: 5, cells: [[0,0], [0,1], [0,2], [0,3], [0,4]] },

  // Index 2: Ig5 - Horizontal line of 5
  { id: 'Ig5', blockCount: 5, cells: [[0,0], [1,0], [2,0], [3,0], [4,0]] },

  // Index 3: J12 - J-shape rotated
  { id: 'J12', blockCount: 4, cells: [[0,0], [1,0], [2,0], [0,1]] },

  // Index 4: L6 - L-shape
  { id: 'L6', blockCount: 4, cells: [[0,0], [0,1], [1,1], [2,1]] },

  // Index 5: J3 - J-shape variant
  { id: 'J3', blockCount: 4, cells: [[0,0], [0,1], [0,2], [1,2]] },

  // Index 6: L9 - L-shape variant
  { id: 'L9', blockCount: 4, cells: [[1,0], [1,1], [1,2], [0,2]] },

  // Index 7: L12 - L-shape variant
  { id: 'L12', blockCount: 4, cells: [[0,0], [1,0], [2,0], [2,1]] },

  // Index 8: J6 - J-shape variant
  { id: 'J6', blockCount: 4, cells: [[2,0], [0,1], [1,1], [2,1]] },

  // Index 9: L3 - L-shape variant
  { id: 'L3', blockCount: 4, cells: [[0,0], [1,0], [0,1], [0,2]] },

  // Index 10: J9 - J-shape variant
  { id: 'J9', blockCount: 4, cells: [[0,0], [1,0], [1,1], [1,2]] },

  // Index 11: LL9 - Large L-shape
  { id: 'LL9', blockCount: 5, cells: [[2,0], [2,1], [0,2], [1,2], [2,2]] },

  // Index 12: LL6 - Large L-shape variant
  { id: 'LL6', blockCount: 5, cells: [[0,0], [0,1], [0,2], [1,2], [2,2]] },

  // Index 13: LL12 - Large L-shape variant
  { id: 'LL12', blockCount: 5, cells: [[0,0], [1,0], [2,0], [2,1], [2,2]] },

  // Index 14: LL3 - Large L-shape variant
  { id: 'LL3', blockCount: 5, cells: [[0,0], [1,0], [2,0], [0,1], [0,2]] },

  // Index 15: Iv2 - Vertical line of 2
  { id: 'Iv2', blockCount: 2, cells: [[0,0], [0,1]] },

  // Index 16: Ig2 - Horizontal line of 2
  { id: 'Ig2', blockCount: 2, cells: [[0,0], [1,0]] },

  // Index 17: Iv3 - Vertical line of 3
  { id: 'Iv3', blockCount: 3, cells: [[0,0], [0,1], [0,2]] },

  // Index 18: Ig3 - Horizontal line of 3
  { id: 'Ig3', blockCount: 3, cells: [[0,0], [1,0], [2,0]] },

  // Index 19: Ov - Vertical 2x3 rectangle
  { id: 'Ov', blockCount: 6, cells: [[0,0], [1,0], [0,1], [1,1], [0,2], [1,2]] },

  // Index 20: Og - Horizontal 3x2 rectangle
  { id: 'Og', blockCount: 6, cells: [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1]] },

  // Index 21: O4 - 2x2 square
  { id: 'O4', blockCount: 4, cells: [[0,0], [1,0], [0,1], [1,1]] },

  // Index 22: T12 - T-shape pointing down
  { id: 'T12', blockCount: 4, cells: [[0,0], [1,0], [2,0], [1,1]] },

  // Index 23: T6 - T-shape pointing left
  { id: 'T6', blockCount: 4, cells: [[1,0], [0,1], [1,1], [2,1]] },

  // Index 24: T3 - T-shape pointing right
  { id: 'T3', blockCount: 4, cells: [[0,0], [0,1], [1,1], [0,2]] },

  // Index 25: T9 - T-shape pointing up
  { id: 'T9', blockCount: 4, cells: [[1,0], [0,1], [1,1], [1,2]] },

  // Index 26: /2 - Diagonal 2 (forward slash)
  { id: '/2', blockCount: 2, cells: [[0,0], [1,1]] },

  // Index 27: \2 - Diagonal 2 (backslash)
  { id: '\\2', blockCount: 2, cells: [[1,0], [0,1]] },

  // Index 28: r9 - Small corner
  { id: 'r9', blockCount: 3, cells: [[1,0], [0,1], [1,1]] },

  // Index 29: r3 - Small corner variant
  { id: 'r3', blockCount: 3, cells: [[0,0], [1,0], [0,1]] },

  // Index 30: r12 - Small corner variant
  { id: 'r12', blockCount: 3, cells: [[0,0], [1,0], [1,1]] },

  // Index 31: r6 - Small corner variant
  { id: 'r6', blockCount: 3, cells: [[0,0], [0,1], [1,1]] },

  // Index 32: Iv1 - Single block
  { id: 'Iv1', blockCount: 1, cells: [[0,0]] },

  // Index 33: Iv4 - Vertical line of 4
  { id: 'Iv4', blockCount: 4, cells: [[0,0], [0,1], [0,2], [0,3]] },

  // Index 34: Ig4 - Horizontal line of 4
  { id: 'Ig4', blockCount: 4, cells: [[0,0], [1,0], [2,0], [3,0]] },

  // Index 35: O9 - 3x3 square
  { id: 'O9', blockCount: 9, cells: [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1], [0,2], [1,2], [2,2]] },

  // Index 36: Sv - S-shape horizontal
  { id: 'Sv', blockCount: 4, cells: [[0,0], [1,0], [1,1], [2,1]] },

  // Index 37: Zv - Z-shape horizontal
  { id: 'Zv', blockCount: 4, cells: [[1,0], [2,0], [0,1], [1,1]] },

  // Index 38: Sg - S-shape vertical
  { id: 'Sg', blockCount: 4, cells: [[1,0], [0,1], [1,1], [0,2]] },

  // Index 39: Zg - Z-shape vertical
  { id: 'Zg', blockCount: 4, cells: [[0,0], [0,1], [1,1], [1,2]] },

  // Index 40: /3 - Diagonal 3 (forward slash)
  { id: '/3', blockCount: 3, cells: [[0,0], [1,1], [2,2]] },

  // Index 41: \3 - Diagonal 3 (backslash)
  { id: '\\3', blockCount: 3, cells: [[2,0], [1,1], [0,2]] },

  // Index 42: H9 - H variant
  { id: 'H9', blockCount: 5, cells: [[1,0], [2,0], [1,1], [0,2], [1,2]] },

  // Index 43: H3 - H variant
  { id: 'H3', blockCount: 5, cells: [[0,0], [1,0], [1,1], [1,2], [2,2]] },

  // Index 44: H12 - H variant
  { id: 'H12', blockCount: 5, cells: [[2,0], [2,1], [1,1], [0,1], [0,2]] },

  // Index 45: H6 - H variant
  { id: 'H6', blockCount: 5, cells: [[0,0], [0,1], [1,1], [2,1], [2,2]] },

  // Index 46: U12 - U-shape variant
  { id: 'U12', blockCount: 5, cells: [[0,0], [1,0], [2,0], [0,1], [2,1]] },

  // Index 47: U6 - U-shape variant
  { id: 'U6', blockCount: 5, cells: [[0,0], [2,0], [0,1], [1,1], [2,1]] },

  // Index 48: U3 - U-shape variant
  { id: 'U3', blockCount: 5, cells: [[0,0], [1,0], [0,1], [0,2], [1,2]] },

  // Index 49: U9 - U-shape variant
  { id: 'U9', blockCount: 5, cells: [[0,0], [1,0], [1,1], [0,2], [1,2]] },

  // Index 50: X - Plus/cross shape
  { id: 'X', blockCount: 5, cells: [[1,0], [0,1], [1,1], [2,1], [1,2]] },

  // Index 51: II3 - Separated blocks
  { id: 'II3', blockCount: 6, cells: [[0,0], [1,0], [2,0], [0,2], [1,2], [2,2]] },

  // Index 52: II6 - Separated blocks variant
  { id: 'II6', blockCount: 6, cells: [[0,0], [2,0], [0,1], [2,1], [0,2], [2,2]] },

  // Index 53: O1 - Ring with gap
  { id: 'O1', blockCount: 7, cells: [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2]] },

  // Index 54: O5 - Ring with gap variant
  { id: 'O5', blockCount: 7, cells: [[0,0], [1,0], [0,1], [2,1], [0,2], [1,2], [2,2]] },

  // Index 55: O7 - Ring with gap variant
  { id: 'O7', blockCount: 7, cells: [[1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]] },

  // Index 56: O11 - Ring with gap variant
  { id: 'O11', blockCount: 7, cells: [[0,0], [1,0], [2,0], [0,1], [2,1], [1,2], [2,2]] },

  // Index 57: II31 - Separated blocks variant
  { id: 'II31', blockCount: 4, cells: [[0,0], [0,1], [2,1], [0,2]] },

  // Index 58: II61 - Separated blocks variant
  { id: 'II61', blockCount: 4, cells: [[1,0], [0,2], [1,2], [2,2]] },

  // Index 59: II9 - Separated blocks variant
  { id: 'II9', blockCount: 4, cells: [[2,0], [0,1], [2,1], [2,2]] },

  // Index 60: II12 - Separated blocks variant
  { id: 'II12', blockCount: 4, cells: [[0,0], [1,0], [2,0], [1,2]] },

  // Index 61: XX - X spread
  { id: 'XX', blockCount: 5, cells: [[0,0], [2,0], [1,1], [0,2], [2,2]] },

  // Index 62: X0X - Large X
  { id: 'X0X', blockCount: 5, cells: [[0,0], [3,0], [1,1], [2,1], [1,2], [2,2], [0,3], [3,3]] },

  // Index 63: XoX - Corner X
  { id: 'XoX', blockCount: 5, cells: [[0,0], [3,0], [0,3], [3,3]] },

  // Index 64: XxX - Large diagonal X
  { id: 'XxX', blockCount: 5, cells: [[0,0], [4,0], [1,1], [3,1], [2,2], [1,3], [3,3], [0,4], [4,4]] },

  // Index 65: Ov1 - Rectangle with tail
  { id: 'Ov1', blockCount: 7, cells: [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1], [3,2]] },

  // Index 66: Ov5 - Rectangle with tail variant
  { id: 'Ov5', blockCount: 7, cells: [[3,0], [0,1], [1,1], [2,1], [0,2], [1,2], [2,2]] },

  // Index 67: Ov7 - Rectangle with tail variant
  { id: 'Ov7', blockCount: 7, cells: [[0,0], [1,1], [2,1], [3,1], [1,2], [2,2], [3,2]] },

  // Index 68: Ov11 - Rectangle with tail variant
  { id: 'Ov11', blockCount: 7, cells: [[0,2], [1,0], [2,0], [3,0], [1,1], [2,1], [3,1]] },

  // Index 69: Og1 - Vertical rectangle with tail
  { id: 'Og1', blockCount: 7, cells: [[0,0], [1,0], [0,1], [1,1], [0,2], [1,2], [2,3]] },

  // Index 70: Og5 - Vertical rectangle with tail variant
  { id: 'Og5', blockCount: 7, cells: [[2,0], [0,1], [1,1], [0,2], [1,2], [0,3], [1,3]] },

  // Index 71: Og7 - Vertical rectangle with tail variant
  { id: 'Og7', blockCount: 7, cells: [[0,0], [1,1], [2,1], [1,2], [2,2], [1,3], [2,3]] },

  // Index 72: Og11 - Vertical rectangle with tail variant
  { id: 'Og11', blockCount: 7, cells: [[1,0], [2,0], [1,1], [2,1], [1,2], [2,2], [0,3]] },

  // Index 73: Ov-1 - L-shape 5 blocks
  { id: 'Ov-1', blockCount: 5, cells: [[0,0], [1,0], [0,1], [1,1], [0,2]] },

  // Index 74: Ov-4 - L-shape 5 blocks variant
  { id: 'Ov-4', blockCount: 5, cells: [[0,0], [0,1], [1,1], [0,2], [1,2]] },

  // Index 75: Ov-7 - L-shape 5 blocks variant
  { id: 'Ov-7', blockCount: 5, cells: [[1,0], [0,1], [1,1], [0,2], [1,2]] },

  // Index 76: Ov-11 - L-shape 5 blocks variant
  { id: 'Ov-11', blockCount: 5, cells: [[0,0], [1,0], [0,1], [1,1], [1,2]] },

  // Index 77: Og-1 - L-shape 5 blocks horizontal
  { id: 'Og-1', blockCount: 5, cells: [[0,0], [1,0], [2,0], [0,1], [1,1]] },

  // Index 78: Og-4 - L-shape 5 blocks horizontal variant
  { id: 'Og-4', blockCount: 5, cells: [[0,0], [1,0], [0,1], [1,1], [2,1]] },

  // Index 79: Og-7 - L-shape 5 blocks horizontal variant
  { id: 'Og-7', blockCount: 5, cells: [[1,0], [2,0], [0,1], [1,1], [2,1]] },

  // Index 80: Og-11 - L-shape 5 blocks horizontal variant
  { id: 'Og-11', blockCount: 5, cells: [[0,0], [1,0], [2,0], [1,1], [2,1]] },

  // Index 81: b3 - Spaced horizontal 3
  { id: 'b3', blockCount: 3, cells: [[0,0], [2,0], [4,0]] },

  // Index 82: b3v - Spaced vertical 3
  { id: 'b3v', blockCount: 3, cells: [[0,0], [0,2], [0,4]] },

  // Index 83: b4 - Spaced square
  { id: 'b4', blockCount: 4, cells: [[0,0], [2,0], [0,2], [2,2]] },

  // Index 84: b2 - Spaced horizontal 2
  { id: 'b2', blockCount: 2, cells: [[0,0], [2,0]] },

  // Index 85: b2v - Spaced vertical 2
  { id: 'b2v', blockCount: 2, cells: [[0,0], [0,2]] },

  // Index 86: b2x - Spaced diagonal
  { id: 'b2x', blockCount: 2, cells: [[0,0], [2,2]] },

  // Index 87: b2xv - Spaced diagonal variant
  { id: 'b2xv', blockCount: 2, cells: [[2,0], [0,2]] },

  // Index 88: r-7 - Complex corner
  { id: 'r-7', blockCount: 4, cells: [[0,0], [2,1], [1,2], [2,2]] },

  // Index 89: r-1 - Complex corner variant
  { id: 'r-1', blockCount: 4, cells: [[0,0], [1,0], [0,1], [2,2]] },

  // Index 90: r-11 - Complex corner variant
  { id: 'r-11', blockCount: 4, cells: [[1,0], [2,0], [2,1], [0,2]] },

  // Index 91: r-5 - Complex corner variant
  { id: 'r-5', blockCount: 4, cells: [[2,0], [0,1], [0,2], [1,2]] },

  // Index 92: Tv3 - T-shape extended
  { id: 'Tv3', blockCount: 5, cells: [[0,0], [1,0], [2,0], [3,0], [3,1]] },

  // Index 93: Tv6 - T-shape extended variant
  { id: 'Tv6', blockCount: 5, cells: [[0,0], [1,0], [2,0], [3,0], [0,1]] },

  // Index 94: Tv9 - T-shape extended variant
  { id: 'Tv9', blockCount: 5, cells: [[3,0], [0,1], [1,1], [2,1], [3,1]] },

  // Index 95: Tv12 - T-shape extended variant
  { id: 'Tv12', blockCount: 5, cells: [[0,0], [0,1], [1,1], [2,1], [3,1]] },

  // Index 96: Tg3 - T-shape vertical extended
  { id: 'Tg3', blockCount: 5, cells: [[0,0], [0,1], [0,2], [0,3], [1,3]] },

  // Index 97: Tg6 - T-shape vertical extended variant
  { id: 'Tg6', blockCount: 5, cells: [[1,0], [1,1], [1,2], [1,3], [0,3]] },

  // Index 98: Tg9 - T-shape vertical extended variant
  { id: 'Tg9', blockCount: 5, cells: [[0,0], [1,0], [0,1], [0,2], [0,3]] },

  // Index 99: Tg12 - T-shape vertical extended variant
  { id: 'Tg12', blockCount: 5, cells: [[0,0], [1,0], [1,1], [1,2], [1,3]] },

  // Index 100: M3 - M-shape variant
  { id: 'M3', blockCount: 6, cells: [[0,0], [1,0], [2,0], [3,0], [1,1], [2,1]] },

  // Index 101: M6 - M-shape variant
  { id: 'M6', blockCount: 6, cells: [[1,0], [2,0], [0,1], [1,1], [2,1], [3,1]] },

  // Index 102: M9 - M-shape vertical
  { id: 'M9', blockCount: 6, cells: [[0,0], [0,1], [1,1], [0,2], [1,2], [0,3]] },

  // Index 103: M12 - M-shape vertical variant
  { id: 'M12', blockCount: 6, cells: [[1,0], [0,1], [1,1], [0,2], [1,2], [1,3]] },

  // Index 104: P3 - P-shape variant
  { id: 'P3', blockCount: 6, cells: [[0,0], [0,1], [0,2], [1,2], [0,3], [1,3]] },

  // Index 105: P9 - P-shape variant
  { id: 'P9', blockCount: 6, cells: [[2,0], [3,0], [0,1], [1,1], [2,1], [3,1]] },

  // Index 106: P6 - P-shape variant
  { id: 'P6', blockCount: 6, cells: [[0,0], [1,0], [0,1], [1,1], [1,2], [1,3]] },

  // Index 107: P12 - P-shape variant
  { id: 'P12', blockCount: 6, cells: [[0,0], [1,0], [2,0], [3,0], [0,1], [1,1]] },

  // Index 108: OO - Ring shape
  { id: 'OO', blockCount: 8, cells: [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]] },

  // Index 109: A12 - Arrow variant
  { id: 'A12', blockCount: 5, cells: [[0,0], [2,0], [0,1], [2,1], [1,2]] },

  // Index 110: A9 - Arrow variant
  { id: 'A9', blockCount: 5, cells: [[1,0], [2,0], [0,1], [1,2], [2,2]] },

  // Index 111: A6 - Arrow variant
  { id: 'A6', blockCount: 5, cells: [[1,0], [0,1], [2,1], [0,2], [2,2]] },

  // Index 112: A3 - Arrow variant
  { id: 'A3', blockCount: 5, cells: [[0,0], [1,0], [2,1], [0,2], [1,2]] },

  // Index 113: Hv - H-shape horizontal
  { id: 'Hv', blockCount: 7, cells: [[0,0], [2,0], [0,1], [1,1], [2,1], [0,2], [2,2]] },

  // Index 114: Hg - H-shape vertical
  { id: 'Hg', blockCount: 7, cells: [[0,0], [1,0], [2,0], [1,1], [0,2], [1,2], [2,2]] },

  // Index 115: >3 - Arrow 3 right
  { id: '>3', blockCount: 3, cells: [[0,0], [1,1], [0,2]] },

  // Index 116: >12 - Arrow top
  { id: '>12', blockCount: 3, cells: [[0,0], [2,0], [1,1]] },

  // Index 117: >6 - Arrow left
  { id: '>6', blockCount: 3, cells: [[1,0], [0,1], [2,1]] },

  // Index 118: >9 - Arrow bottom
  { id: '>9', blockCount: 3, cells: [[1,0], [0,1], [1,2]] },

  // Index 119: >0 - Diamond
  { id: '>0', blockCount: 4, cells: [[1,0], [0,1], [2,1], [1,2]] },

  // Index 120: O98 - Ring variant
  { id: 'O98', blockCount: 6, cells: [[0,0], [1,0], [2,0], [1,1], [0,2], [2,2]] },

  // Index 121: O99 - Ring variant
  { id: 'O99', blockCount: 6, cells: [[0,0], [2,0], [1,1], [2,1], [0,2], [2,2]] },

  // Index 122: O97 - Ring variant
  { id: 'O97', blockCount: 6, cells: [[0,0], [2,0], [0,1], [1,1], [0,2], [2,2]] },

  // Index 123: O96 - Ring variant
  { id: 'O96', blockCount: 6, cells: [[0,0], [2,0], [1,1], [0,2], [1,2], [2,2]] },

  // Index 124: II111 - Separated L
  { id: 'II111', blockCount: 5, cells: [[0,0], [2,0], [0,1], [0,2]] },

  // Index 125: II222 - Separated L variant
  { id: 'II222', blockCount: 5, cells: [[0,0], [0,2], [1,2], [2,2]] },

  // Index 126: II333 - Separated L variant
  { id: 'II333', blockCount: 5, cells: [[2,0], [2,1], [0,2], [2,2]] },

  // Index 127: II444 - Separated L variant
  { id: 'II444', blockCount: 5, cells: [[0,0], [1,0], [2,0], [2,2]] },

  // Index 128: II555 - Separated blocks
  { id: 'II555', blockCount: 5, cells: [[0,0], [1,0], [0,2], [1,2]] },

  // Index 129: II777 - Separated blocks variant
  { id: 'II777', blockCount: 5, cells: [[0,0], [2,0], [0,1], [2,1]] },
];

// Create a map for quick lookup by ID
export const FIGURE_MAP: Map<string, BlockShape> = new Map(
  FIGURES.map(f => [f.id, f])
);

// Get figure by ID
export function getFigure(id: string): BlockShape | undefined {
  return FIGURE_MAP.get(id);
}

// Get figure by index (0-based)
export function getFigureByIndex(index: number): BlockShape | undefined {
  return FIGURES[index];
}

// Calculate bounding box of a shape (with min offsets for normalization)
export function getShapeBounds(shape: BlockShape): { width: number; height: number; minX: number; minY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of shape.cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    minX,
    minY
  };
}
