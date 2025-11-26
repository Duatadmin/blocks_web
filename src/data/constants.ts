// Game Constants - Migrated from Godot project

export const GRID_SIZE = 8;
export const CELL_SIZE = 56;
export const CELL_SIZE_DROP = 28; // 50% scale in drop area
export const GRID_SPACING = 0;

export const VIEWPORT_WIDTH = 540;
export const VIEWPORT_HEIGHT = 960;

export const BLOCKS_PER_TURN = 3;

// Drag offset: block appears 2 cells above touch point
export const DRAG_OFFSET_Y = -2 * CELL_SIZE;

// Animation durations (ms)
export const ANIMATION = {
  blockPlaceDuration: 300,
  blockPlaceBounceScale: 1.3,
  lineClearStagger: 50,
  blockDestroyDuration: 100,
  comboNotificationDuration: 600,
  comboRiseDistance: 60,
  heartPulseDuration: 200,
  heartPulseThreshold: 2000, // Score threshold to start pulsing
  gameOverFillDelay: 50, // Per row
  gameOverOverlayDuration: 2000,
};

// Scoring
export const SCORE = {
  linePoints: {
    1: 10,
    2: 30,
    3: 60,
    4: 100,
    5: 150,
  } as Record<number, number>,
  linePointsPerLine: 35, // For 6+ lines
  fieldClearBonus: 300,
  comboWindow: 3, // Moves within which combo continues
};

// Particle system
export const PARTICLES = {
  burstCount: 4,
  minVelocity: 30,
  maxVelocity: 80,
  lifetime: 0.3,
  lifetimeVariance: 0.2,
  gravity: 150,
  spreadAngle: 60, // degrees
  spreadVariance: 5, // degrees
  minScale: 0.1,
  maxScale: 0.3,
};

// Screen shake
export const SCREEN_SHAKE = {
  baseStrength: 3,
  strengthPerLine: 2, // Additional shake per line
  duration: 300,
};

// Block colors
export type BlockColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'LightBlue' | 'Blue' | 'Violet';

export const BLOCK_COLORS: BlockColor[] = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'LightBlue',
  'Blue',
  'Violet',
];

// Color values (can be used for CSS or canvas)
export const COLORS = {
  // Block colors
  Red: '#e53935',
  Orange: '#fb8c00',
  Yellow: '#fdd835',
  Green: '#43a047',
  LightBlue: '#29b6f6',
  Blue: '#1e88e5',
  Violet: '#8e24aa',

  // UI colors
  Background: '#4A6FA5',      // Vibrant blue (fallback)
  BackgroundTop: '#4A6FA5',   // Gradient top color
  BackgroundBottom: '#314F7A', // Gradient bottom color
  GridBackground: '#2D3A5C',  // Dark blue container
  GridCell: '#374A70',        // Slightly lighter empty cells
  GridCellBorder: '#4A5A80',  // Subtle cell borders

  // Effect colors
  Gold: '#ffd700',
  ComboGold: 'rgba(255, 230, 0, 1)',
  Success: '#00ff4c',
  Error: '#ff3333',

  // Text
  TextPrimary: '#ffffff',
  TextSecondary: '#a0a0a0',
  TextMuted: '#606060',

  // Shadows & glows
  ShadowDark: 'rgba(0, 0, 0, 0.3)',
  GlowWhite: 'rgba(255, 255, 255, 0.3)',
  GlowGold: 'rgba(255, 215, 0, 0.5)',
};

// Highlight opacities
export const HIGHLIGHT = {
  normalOpacity: 0.95,
  comboOpacity: 0.995, // For 3+ lines
  emptyCellMultiplier: 0.5, // Empty cells at 50% of above
  shadowOpacity: 0.5,
  borderSize: 2,
  glowSize: 4,
};

// Z-index layers (for conceptual ordering)
export const Z_INDEX = {
  gridBackground: 0,
  glowEffects: 1,
  blocks: 2,
  borders: 10,
  particles: 11,
  dragging: 15,
  ui: 20,
  modal: 30,
};

// Combo messages
export const COMBO_MESSAGES: Record<number, string> = {
  1: '', // No message for single line
  2: 'Good!',
  3: 'Excellent!',
  4: 'Magnificent!',
  5: 'Super!',
  6: 'Outstanding!',
};

// Combo font sizes
export const COMBO_FONT_SIZES: Record<string, number> = {
  'x2-5': 48,
  'x6-10': 54,
  'x11-49': 60,
  'x50+': 70,
};

// Generation modes
export type GenerationMode = 'F' | 'R' | 'S' | 'A';

// Figure unlock progression
export const FIGURE_UNLOCK = {
  initialCount: 42, // First 42 figures available from start
  unlockThreshold: 40, // After drop 40, start unlocking more
  unlockRate: 5, // Unlock 5 more figures per 10 drops
  unlockInterval: 10, // Every 10 drops
  maxFigures: 47, // Maximum figures eventually available (adjustable)
};

// Touch/input
export const INPUT = {
  tapThreshold: 10, // pixels - movement less than this is a tap
  dragThreshold: 5, // pixels - movement more than this starts drag
};
