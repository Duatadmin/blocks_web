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
  minVelocity: 8,       // 100% more slower (was 15)
  maxVelocity: 20,      // 100% more slower (was 40)
  lifetime: 0.3,
  lifetimeVariance: 0.2,
  gravity: 150,
  spreadAngle: 60, // degrees
  spreadVariance: 5, // degrees
  minScale: 0.4,        // 100% more bigger (was 0.2)
  maxScale: 1.2,        // 100% more bigger (was 0.6)
};

// Screen shake
export const SCREEN_SHAKE = {
  baseStrength: 0.75,      // Reduced to 25% (was 3)
  strengthPerLine: 0.5,    // Reduced to 25% (was 2)
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
  GridBackground: '#1a2744',  // Darker navy container
  GridCell: '#1e2d4a',        // Very subtle cell color
  GridCellBorder: 'rgba(255, 255, 255, 0.08)',  // Nearly invisible

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

// Intro animation (game start)
export const INTRO_ANIMATION = {
  ROW_DELAY: 70,            // 0.07s between rows
  CELL_DURATION: 140,       // 0.14s per cell animation
  WAIT_AFTER_FILL: 350,     // 0.35s wait after grid is filled
  WAIT_AFTER_CLEAR: 210,    // 0.21s wait after grid is cleared
};

// Game over animation
export const GAME_OVER_ANIMATION = {
  ROW_DELAY: 50,            // 0.05s between rows (faster than intro)
  CELL_DURATION: 100,       // 0.1s per cell
  FINAL_ALPHA: 0.25,        // 25% opacity for shadow blocks
  WAIT_BEFORE_MODAL: 150,   // 0.15s before showing modal
};

// Game over flow timing
export const GAME_OVER_FLOW = {
  // "No more space" overlay
  OVERLAY_DURATION: 2000,       // 2 seconds total
  OVERLAY_FADE_IN: 300,
  OVERLAY_FADE_OUT: 300,

  // Continue modal
  MODAL_SCALE_IN: 300,
  MODAL_INITIAL_SCALE: 0.8,

  // Ad placeholder
  AD_DURATION: 2000,            // 2 seconds
  AD_FADE_IN: 300,
  AD_FADE_OUT: 300,

  // Shadow clear animation (after continue)
  SHADOW_CLEAR_ROW_DELAY: 100,
  SHADOW_CLEAR_CELL_DURATION: 200,

  // Game over screen animations
  TITLE_DROP_DURATION: 500,
  SCORE_COUNT_DURATION: 1500,
  HIGH_SCORE_BADGE_DELAY: 500,
  HIGH_SCORE_BADGE_SCALE_DURATION: 300,
};

// Game over UI layout
export const GAME_OVER_LAYOUT = {
  // "No more space" overlay
  OVERLAY_Y_OFFSET: 254,        // From center
  OVERLAY_BG_HEIGHT: 168,
  OVERLAY_FONT_SIZE: 36,
  OVERLAY_BG_OPACITY: 0.8,

  // Continue modal
  MODAL_WIDTH: 400,
  MODAL_HEIGHT: 380,
  MODAL_RADIUS: 24,
  MODAL_TITLE_FONT_SIZE: 28,
  BLOCK_PREVIEW_SIZE: 70,
  BLOCK_PREVIEW_CELL_SIZE: 16,

  // Buttons (shared)
  BUTTON_WIDTH: 180,
  BUTTON_HEIGHT: 48,
  BUTTON_RADIUS: 12,

  // Game over screen
  SCREEN_TITLE_Y: 200,
  SCREEN_TITLE_FONT_SIZE: 52,
  SCREEN_SCORE_Y: 350,
  SCREEN_SCORE_FONT_SIZE: 72,
  SCREEN_BEST_Y: 420,
  SCREEN_BADGE_Y: 490,
  SCREEN_PLAY_BUTTON_Y: 600,
  SCREEN_HOME_BUTTON_Y: 680,
};

// Modal animation
export const MODAL_ANIMATION = {
  SHOW_DURATION: 300,       // 0.3s
  HIDE_DURATION: 200,       // 0.2s
  INITIAL_SCALE: 0.8,
};

// Combo notification styling - 3-Layer Text System
export const COMBO_NOTIFICATION = {
  // Text sizing
  COMBO_FONT_SIZE: 42,
  NUMBER_FONT_SIZE: 56,
  STROKE_WIDTH: 5,

  // 3-Layer colors for "Combo" text
  COMBO_STROKE_COLOR: '#2D4A7C',      // Layer 1: Dark blue outer stroke
  COMBO_FILL_COLOR: '#7BC4E8',        // Layer 2: Light cyan fill
  COMBO_HIGHLIGHT_COLOR: '#FFFFFF',   // Layer 3: White inner highlight

  // 3-Layer colors for Number
  NUMBER_STROKE_COLOR: '#2D4A7C',     // Layer 1: Dark blue outer stroke
  NUMBER_FILL_TOP: '#FFE55C',         // Layer 2: Gold gradient top
  NUMBER_FILL_BOTTOM: '#F5C518',      // Layer 2: Gold gradient bottom
  NUMBER_HIGHLIGHT_COLOR: '#FFFDE7',  // Layer 3: Light yellow highlight

  // Starburst VFX - Enhanced rays
  STARBURST_RAYS: 7,                  // Reduced from 12 (14 total with doubles)
  STARBURST_INNER_RADIUS: 12,         // Slightly larger core
  STARBURST_OUTER_RADIUS: 50,         // Reduced from 60
  STARBURST_COLOR: 'rgba(255, 255, 255, 0.9)',

  // Dual-layer glow
  STARBURST_CORE_RADIUS: 35,          // Bright core radius
  STARBURST_HALO_RADIUS: 50,          // Soft halo radius (smaller)
  STARBURST_CORE_OPACITY: 0.9,        // Bright white core
  STARBURST_HALO_OPACITY: 0.35,       // Soft warm halo

  // Ray variation
  STARBURST_RAY_OPACITY: 0.5,         // Base ray opacity
  STARBURST_RAY_LENGTH_VAR: 0.35,     // ±35% length variation
  STARBURST_RAY_OPACITY_VAR: 0.25,    // ±0.25 opacity variation
  STARBURST_HERO_RAYS: 3,             // Number of "hero" longer rays

  // Glow offset
  STARBURST_GLOW_OFFSET_Y: 5,         // Offset down 5px for "light from below"

  // Animation params
  STARBURST_GLOW_LAYER_OPACITY: 0.3,  // Soft background glow
  STARBURST_GLOW_LAYER_RADIUS: 60,    // Background glow radius (smaller)
  STARBURST_ROTATION_DEGREES: 10,     // Total rotation over animation

  // Animation timing
  ZOOM_IN_DURATION: 150,
  HOLD_DURATION: 600,                 // 50% longer (was 400ms)
  FADE_DURATION: 250,
  PULSE_SPEED: 2,                     // 50% slower (was 4)
  PULSE_MIN_SCALE: 0.9,               // Reduced amplitude (was 0.8)
  PULSE_MAX_SCALE: 1.1,               // Reduced amplitude (was 1.2)
  INITIAL_SCALE: 0.3,
};

// Line glow VFX - Animated rounded rectangle outline for line destruction
export const LINE_GLOW_VFX = {
  // Timing
  DURATION: 0.45,             // Total animation duration in seconds

  // Colors - Warm yellow/cream theme (original)
  STROKE_COLOR: '#FFE8A0',    // Light warm yellow/cream
  GLOW_COLOR: '#FFF5C8',      // Brighter yellow for glow
  FILL_COLOR: '#FFF5C8',      // Same as glow for inner fill

  // Line dimensions
  LINE_WIDTH_MIN: 1,          // Starting line width (px)
  LINE_WIDTH_MAX: 2,          // Peak line width (px)

  // Corner radius (less rounded, not pill-like)
  CORNER_RADIUS_RATIO: 0.15,  // Subtle rounded corners

  // Glow settings
  GLOW_BLUR: 20,              // Shadow blur radius for glow effect

  // Rectangle size ratios
  INITIAL_WIDTH_RATIO: 0.6,   // Starting width ratio
  INITIAL_HEIGHT_RATIO: 0.6,  // Starting height ratio
  FINAL_WIDTH_RATIO: 0.8,     // Final width (don't expand to full cell)
  FINAL_HEIGHT_RATIO: 1.0,    // Final height (full length of line)

  // Opacity settings
  FILL_ALPHA: 0.0625,         // Inner fill opacity (75% reduction from 0.25)
};

// Spark particles emitted during cell destruction (used by ParticleSystem)
export const LINE_CLEAR_SPARKS = {
  SPARK_COUNT: 4,             // Sparks per cell destruction
  SPARK_VELOCITY: 60,         // Spark velocity in pixels/sec
  SPARK_LIFETIME: 0.2,        // Spark lifetime in seconds
  SPARK_SCALE_MIN: 0.90,      // Min spark scale (200% bigger)
  SPARK_SCALE_MAX: 1.50,      // Max spark scale (200% bigger)
};

// Home screen styling
export const HOME_SCREEN = {
  // Title styling (3-layer like combo)
  TITLE_FONT_SIZE: 52,
  TITLE_STROKE_COLOR: '#2D4A7C',
  TITLE_FILL_TOP: '#FFE55C',
  TITLE_FILL_BOTTOM: '#F5C518',
  TITLE_HIGHLIGHT_COLOR: '#FFFDE7',
  TITLE_STROKE_WIDTH: 4,

  // High score badge
  BADGE_BG: 'rgba(0, 0, 0, 0.25)',
  BADGE_RADIUS: 16,
  BADGE_PADDING_X: 20,
  BADGE_PADDING_Y: 10,

  // Start button
  BUTTON_WIDTH: 200,
  BUTTON_HEIGHT: 56,
  BUTTON_RADIUS: 28,
  BUTTON_GRADIENT_TOP: '#5CBF60',
  BUTTON_GRADIENT_BOTTOM: '#3DA441',
  BUTTON_STROKE_COLOR: '#2D8A31',
  BUTTON_STROKE_WIDTH: 3,
  BUTTON_TEXT_COLOR: '#FFFFFF',
  BUTTON_FONT_SIZE: 24,
};
