# Block Puzzle Game - TypeScript + Canvas Migration Plan

## Executive Summary

Migration of "Блоки и точка" from Godot 4.3 to pure TypeScript + HTML5 Canvas. The new version will maintain core gameplay mechanics while modernizing the visual design for a more polished look.

---

## 1. Current System Analysis

### 1.1 Core Game Parameters

| Parameter | Value |
|-----------|-------|
| Grid Size | 8x8 cells |
| Cell Size | 56px (grid), 28px (drop area) |
| Viewport | 540x960 (9:16 mobile portrait) |
| Block Colors | 7 (Red, Orange, Yellow, Green, LightBlue, Blue, Violet) |
| Block Shapes | 128 unique figures |
| Blocks Per Turn | 3 |

### 1.2 Block Shape Data Structure

Current Godot format (from CSV):
```
Figure ID | Block Count | Coordinates (x,y pairs)
Iv5       | 5          | (0,0), (0,1), (0,2), (0,3), (0,4)  // Vertical line of 5
O4        | 4          | (0,0), (1,0), (0,1), (1,1)         // 2x2 square
T12       | 4          | (0,0), (1,0), (2,0), (1,1)         // T-shape
```

TypeScript target format:
```typescript
interface BlockShape {
  id: string;
  cells: [number, number][];  // [x, y] relative coordinates
  blockCount: number;
}
```

### 1.3 Generation Algorithms

**Mode F (Favorable):** AI-assisted selection
- Evaluates all figures at all 64 grid positions
- Scores based on: lines completed, block count, figure weight
- Selects optimal figure for player success
- Used in early game (drops 1-2, 4-40 mostly)

**Mode R (Random):** Weighted random selection
- Uses cumulative weight table from config
- O(n) selection algorithm
- Prevents last 3 blocks from repeating

**Mode S (Standard):** Default random (same as R)

**Mode A (Ad Continue):** 2x Iv1 (single) + 1x Favorable block

### 1.4 Scoring System

```typescript
const LINE_POINTS = {
  1: 10,
  2: 30,
  3: 60,
  4: 100,
  5: 150,
  6: 210,  // 6+ = 35 per line
};

// Base points = cells in placed block
// Combo multiplier = streak + 1 (minimum 2x)
// Combo continues if within 3 moves of last combo
// Field clear bonus = +300 points
```

### 1.5 Visual Effects Summary

| Effect | Duration | Description |
|--------|----------|-------------|
| Block placement | 0.3s | Scale 1.3→1.0 with bounce ease |
| Line clear stagger | 0.05s/block | Chain reaction delay |
| Block destruction | 0.1s | Fade + scale down |
| Combo notification | 0.6s | Rise 60px + wiggle + fade |
| Heart pulse | 0.2s/cycle | 95%-105% scale at 2000+ pts |
| Shadow preview | Real-time | 50% opacity block preview |
| Line highlight | Real-time | 80-95% opacity texture swap |

---

## 2. TypeScript Architecture

### 2.1 Project Structure

```
blocks_typescript/
├── src/
│   ├── index.ts                 # Entry point
│   ├── Game.ts                  # Main game controller
│   ├── core/
│   │   ├── Grid.ts              # 8x8 grid management
│   │   ├── Block.ts             # Block shape & rendering
│   │   ├── BlockGenerator.ts    # Generation algorithms
│   │   └── ScoreManager.ts      # Score & combo logic
│   ├── rendering/
│   │   ├── Renderer.ts          # Main canvas renderer
│   │   ├── GridRenderer.ts      # Grid cell rendering
│   │   ├── BlockRenderer.ts     # Block rendering with shadows
│   │   ├── EffectsRenderer.ts   # Particles, glows, animations
│   │   └── UIRenderer.ts        # Score, combo, buttons
│   ├── input/
│   │   ├── InputManager.ts      # Mouse/touch handling
│   │   └── DragDropManager.ts   # Block dragging logic
│   ├── effects/
│   │   ├── AnimationManager.ts  # Tween/animation system
│   │   ├── ParticleSystem.ts    # Particle effects
│   │   └── ScreenShake.ts       # Camera shake effect
│   ├── ui/
│   │   ├── HomeScreen.ts        # Start screen
│   │   ├── GameOverModal.ts     # Game over UI
│   │   └── ComboNotification.ts # Combo text popups
│   ├── data/
│   │   ├── figures.ts           # Block shape definitions
│   │   ├── config.ts            # Weight tables & scenarios
│   │   └── constants.ts         # Game constants
│   └── utils/
│       ├── math.ts              # Math utilities
│       ├── colors.ts            # Color definitions
│       └── easing.ts            # Easing functions
├── assets/
│   ├── images/                  # Block textures, VFX sprites
│   ├── audio/                   # Sound effects
│   └── fonts/                   # Custom fonts
├── public/
│   └── index.html               # HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite bundler config
└── MIGRATION_PLAN.md
```

### 2.2 Core Classes

#### Game.ts - Main Controller
```typescript
class Game {
  private grid: Grid;
  private blockGenerator: BlockGenerator;
  private scoreManager: ScoreManager;
  private renderer: Renderer;
  private inputManager: InputManager;
  private animationManager: AnimationManager;

  private dropBlocks: Block[];        // 3 blocks in drop area
  private currentDrag: DragState | null;
  private gameState: 'home' | 'playing' | 'gameover';

  public start(): void;
  public update(deltaTime: number): void;
  public render(): void;
}
```

#### Grid.ts - Grid Management
```typescript
class Grid {
  private cells: (BlockCell | null)[][];  // 8x8
  private readonly size = 8;
  private readonly cellSize = 56;

  public canPlace(shape: BlockShape, gridPos: Point): boolean;
  public place(shape: BlockShape, gridPos: Point, color: BlockColor): PlacementResult;
  public getCompletableLines(shape: BlockShape, gridPos: Point): number[];
  public clearLines(lines: number[]): ClearResult;
  public hasValidMoves(blocks: Block[]): boolean;
  public screenToGrid(screenPos: Point): Point | null;
}
```

#### BlockGenerator.ts - Generation Logic
```typescript
class BlockGenerator {
  private figures: BlockShape[];
  private weights: number[][];          // [figureIndex][dropIndex]
  private scenarios: GenerationMode[];  // F, R, S, A per drop
  private lastThreeBlocks: string[];    // Prevent repetition
  private dropCount: number;

  public generateThree(): Block[];
  public generateFavorable(grid: Grid): Block;
  public generateRandom(): Block;
  private getAvailableFigures(): BlockShape[];
  private selectWeightedRandom(figures: BlockShape[]): BlockShape;
  private evaluatePlacement(figure: BlockShape, grid: Grid): number;
}
```

### 2.3 Rendering Architecture

Using double-buffered canvas with layered rendering:

```typescript
class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Render layers (back to front)
  public render(state: GameState): void {
    this.clear();
    this.renderBackground();
    this.renderGrid(state.grid);
    this.renderHighlights(state.highlights);
    this.renderPlacedBlocks(state.grid);
    this.renderDropArea(state.dropBlocks);
    this.renderDragPreview(state.dragState);
    this.renderEffects(state.effects);
    this.renderUI(state.score, state.combo);
  }
}
```

---

## 3. Feature Implementation Details

### 3.1 Drag & Drop System

```typescript
interface DragState {
  block: Block;
  originIndex: number;           // 0, 1, or 2 in drop area
  screenPosition: Point;         // Current touch/mouse position
  gridPosition: Point | null;    // Snapped grid position (if valid)
  offset: Point;                 // Touch offset from block center
}

// Drag offset: 2 cells above touch, centered horizontally
const DRAG_OFFSET_Y = -2 * CELL_SIZE;

// Update loop:
1. Get touch/mouse position
2. Apply offset for better visibility
3. Convert to grid coordinates
4. Validate placement
5. Update shadow preview
6. Calculate completable lines for highlight
```

### 3.2 Shadow/Preview System

When dragging:
```typescript
// Shadow block rendered at 50% opacity
// Shows exactly where block will be placed
// Updates in real-time during drag

renderShadowPreview(block: Block, gridPos: Point): void {
  this.ctx.globalAlpha = 0.5;
  for (const [x, y] of block.shape.cells) {
    this.renderCell(gridPos.x + x, gridPos.y + y, block.color);
  }
  this.ctx.globalAlpha = 1.0;
}
```

### 3.3 Line Highlight System

```typescript
// When dragging over valid position:
// 1. Calculate which lines would complete
// 2. Highlight those cells with block's color at 80-95% opacity
// 3. For 3+ lines, use golden glow effect

highlightCompletableLines(lines: number[], blockColor: BlockColor): void {
  const opacity = lines.length >= 3 ? 0.995 : 0.95;
  const glowColor = lines.length >= 3 ? GOLD_COLOR : null;

  for (const line of lines) {
    const cells = this.getLineCells(line);
    for (const cell of cells) {
      this.renderHighlightedCell(cell, blockColor, opacity, glowColor);
    }
  }
}
```

### 3.4 Line Clear Animation

```typescript
async clearLines(lines: number[]): Promise<void> {
  const cellsToClear = this.getCellsFromLines(lines);
  const staggerDelay = 50;  // ms between each cell

  // Sort cells by distance from placement position
  cellsToClear.sort((a, b) => distanceFromPlacement(a) - distanceFromPlacement(b));

  // Animate each cell with stagger
  for (let i = 0; i < cellsToClear.length; i++) {
    setTimeout(() => {
      this.animateCell(cellsToClear[i], {
        scale: { from: 1, to: 0 },
        opacity: { from: 1, to: 0 },
        duration: 100,
        easing: 'easeOutQuad'
      });
      this.spawnParticles(cellsToClear[i], 4);  // 4 directional particles
    }, i * staggerDelay);
  }

  // Shake camera based on line count
  this.screenShake(lines.length * 3, 300);

  await delay(cellsToClear.length * staggerDelay + 100);
  this.removeCells(cellsToClear);
}
```

### 3.5 Particle System

```typescript
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  color: string;
}

class ParticleSystem {
  private particles: Particle[] = [];

  spawn(position: Point, direction: 'up' | 'down' | 'left' | 'right', color: string): void {
    const angle = DIRECTION_ANGLES[direction] + randomRange(-5, 5) * DEG_TO_RAD;
    const speed = randomRange(30, 80);

    this.particles.push({
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.3,
      scale: randomRange(0.1, 0.3),
      color
    });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;  // Gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }
}
```

### 3.6 Combo System

```typescript
class ComboManager {
  private currentMove = 0;
  private lastComboMove = -10;
  private streak = 0;

  onLinesCleared(lineCount: number): ComboResult {
    this.currentMove++;

    if (lineCount === 0) return null;

    // Check if within combo window (3 moves)
    if (this.currentMove - this.lastComboMove <= 3) {
      this.streak++;
    } else {
      this.streak = 1;
    }

    this.lastComboMove = this.currentMove;

    return {
      multiplier: Math.max(2, this.streak + 1),
      isCombo: this.streak > 1,
      message: this.getComboMessage(lineCount, this.streak)
    };
  }

  private getComboMessage(lines: number, streak: number): string {
    if (streak > 1) return `x${streak + 1} COMBO!`;
    const messages = ['', 'Good!', 'Excellent!', 'Magnificent!', 'Super!', 'Outstanding!'];
    return messages[Math.min(lines, 5)];
  }
}
```

---

## 4. Data Migration

### 4.1 Figure Data (figures.ts)

Convert from CSV to TypeScript:

```typescript
export const FIGURES: BlockShape[] = [
  { id: 'Iv5', blockCount: 5, cells: [[0,0], [0,1], [0,2], [0,3], [0,4]] },
  { id: 'Ig5', blockCount: 5, cells: [[0,0], [1,0], [2,0], [3,0], [4,0]] },
  { id: 'J12', blockCount: 4, cells: [[0,0], [1,0], [2,0], [0,1]] },
  { id: 'L6',  blockCount: 4, cells: [[0,0], [0,1], [1,1], [2,1]] },
  // ... 128 total figures
];
```

### 4.2 Weight Configuration (config.ts)

```typescript
// Scenario modes per drop (1-40)
export const SCENARIOS: GenerationMode[] = [
  'F', 'F', 'S', 'F', 'F', 'F', 'F', 'F', 'F', 'F',  // Drops 1-10
  'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F',  // Drops 11-20
  // ...
];

// Weight table: WEIGHTS[figureIndex][dropIndex]
export const WEIGHTS: number[][] = [
  // Iv5: [drop1, drop2, drop3, ...]
  [0, 0, 10, 10, 45, 45, 60, 60, 60, 60, 5, 5, ...],
  // Ig5
  [0, 0, 10, 10, 45, 45, 60, 60, 60, 60, 5, 5, ...],
  // ...
];
```

### 4.3 Constants (constants.ts)

```typescript
export const GRID_SIZE = 8;
export const CELL_SIZE = 56;
export const CELL_SIZE_DROP = 28;  // 50% in drop area
export const GRID_SPACING = 0;
export const VIEWPORT_WIDTH = 540;
export const VIEWPORT_HEIGHT = 960;

export const COLORS = {
  Red: '#e53935',
  Orange: '#fb8c00',
  Yellow: '#fdd835',
  Green: '#43a047',
  LightBlue: '#29b6f6',
  Blue: '#1e88e5',
  Violet: '#8e24aa',
  Gold: '#ffd700',
  Background: '#1c2546',
  GridCell: '#2a3456',
};

export const ANIMATION = {
  blockPlaceDuration: 300,
  lineClearStagger: 50,
  blockDestroyDuration: 100,
  comboNotificationDuration: 600,
  heartPulseDuration: 200,
};
```

---

## 5. Visual Design Improvements

### 5.1 Modern Block Design

Current: Simple beveled texture with border
New design suggestions:
- Rounded corners (8px radius)
- Subtle inner glow
- Soft drop shadow (4px blur, 20% opacity)
- Gradient fill (lighter top, darker bottom)
- Glass/glossy highlight

```typescript
renderModernBlock(x: number, y: number, color: string): void {
  const gradient = this.ctx.createLinearGradient(x, y, x, y + CELL_SIZE);
  gradient.addColorStop(0, lighten(color, 20));
  gradient.addColorStop(1, darken(color, 10));

  // Drop shadow
  this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
  this.ctx.shadowBlur = 4;
  this.ctx.shadowOffsetY = 2;

  // Rounded rect with gradient
  this.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
  this.ctx.fillStyle = gradient;
  this.ctx.fill();

  // Inner highlight
  this.ctx.shadowColor = 'transparent';
  const highlight = this.ctx.createLinearGradient(x, y, x, y + CELL_SIZE/3);
  highlight.addColorStop(0, 'rgba(255,255,255,0.3)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  this.ctx.fillStyle = highlight;
  this.ctx.fill();
}
```

### 5.2 Grid Design

- Dark background (#0d1321)
- Subtle grid lines with low opacity
- Empty cells with soft inner shadow
- Rounded corners on grid container
- Ambient glow around active grid

### 5.3 UI Improvements

- Modern sans-serif font (Inter, Poppins)
- Score counter with animated number transitions
- Combo text with scale + rotation animation
- Frosted glass modal backgrounds
- Smooth screen transitions

### 5.4 Effect Enhancements

- Particle trails during drag
- Glow pulse on valid placement
- Screen flash on large combos
- Satisfying "pop" animation on line clear
- Confetti on high scores

---

## 6. Implementation Phases

### Phase 1: Core Foundation (Week 1)
- [ ] Project setup (Vite + TypeScript)
- [ ] Canvas renderer setup
- [ ] Game loop implementation
- [ ] Grid data structure
- [ ] Block shape definitions
- [ ] Basic grid rendering

### Phase 2: Gameplay Mechanics (Week 2)
- [ ] Block generation (Random mode)
- [ ] Drag & drop system
- [ ] Placement validation
- [ ] Line detection algorithm
- [ ] Line clearing (no animation)
- [ ] Basic scoring

### Phase 3: Visual Polish (Week 3)
- [ ] Modern block rendering
- [ ] Shadow/preview system
- [ ] Line highlighting
- [ ] Placement animations
- [ ] Line clear animations
- [ ] Particle system

### Phase 4: Advanced Features (Week 4)
- [ ] Favorable mode (F) generation
- [ ] Combo system
- [ ] Combo notifications
- [ ] Screen shake
- [ ] Heart pulse animation
- [ ] Sound effects

### Phase 5: UI & Screens (Week 5)
- [ ] Home screen
- [ ] Game over modal
- [ ] Score persistence (localStorage)
- [ ] Settings menu
- [ ] Responsive scaling
- [ ] Touch input optimization

### Phase 6: Polish & Testing (Week 6)
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] Bug fixes
- [ ] Final visual polish

---

## 7. Technical Decisions

### 7.1 Build Tool: Vite
- Fast HMR for development
- TypeScript support out of box
- Easy production builds
- Modern ES modules

### 7.2 No Framework
- Pure TypeScript + Canvas
- Maximum control over rendering
- Minimal bundle size
- No framework overhead

### 7.3 Asset Loading
- Preload all images before game start
- Audio with Web Audio API
- Asset manifest for loading screen

### 7.4 State Management
- Simple class-based state
- No external state library
- GameState object passed to renderer

### 7.5 Animation System
- Custom tween engine
- RequestAnimationFrame loop
- Easing functions library
- Promise-based async animations

---

## 8. File Conversion Checklist

### From Godot:

| Source File | Target | Status |
|-------------|--------|--------|
| csv/figures.csv | src/data/figures.ts | Pending |
| csv/configs.csv | src/data/config.ts | Pending |
| scripts/game/GridManager.gd | src/core/Grid.ts | Pending |
| scripts/game/BlockManager.gd | src/core/BlockGenerator.ts | Pending |
| scripts/game/MainGameplay.gd | src/Game.ts | Pending |
| scripts/game/SimpleVFXManager.gd | src/effects/*.ts | Pending |
| scripts/ui/ComboNotification.gd | src/ui/ComboNotification.ts | Pending |
| assets_new/TetrominoBlock/*.png | assets/images/ or CSS gradients | Pending |

---

## 9. Testing Strategy

### Unit Tests
- Grid placement validation
- Line detection algorithm
- Block generation randomness
- Score calculations
- Combo logic

### Integration Tests
- Full game flow
- Drag & drop interaction
- Animation sequences

### Manual Testing
- Touch input on mobile
- Various screen sizes
- Performance profiling
- Browser compatibility

---

## 10. Performance Considerations

### Rendering Optimization
- Dirty rect rendering (only update changed areas)
- Object pooling for particles
- Pre-render static elements to off-screen canvas
- Batch similar draw calls

### Memory Management
- Reuse animation objects
- Clear completed particles
- Limit particle count
- Efficient event listeners

### Mobile Optimization
- Touch event handling (passive listeners)
- Reduced particle count on mobile
- Lower resolution canvas option
- Efficient touch-to-grid conversion

---

## Appendix A: Block Shape Reference

Complete list of 128 figures with visual representation:

```
Iv5: █     Ig5: █████   J12: ███   L6: █      O4: ██
     █                       █        ███         ██
     █
     █
     █

T12: ███   Sv:  ██     Zv: ██     O9: ███    X:  █
      █        ██         ██         ███       ███
                                     ███        █
```

(See figures.csv for complete list)

---

## Appendix B: Color Palette

```
Block Colors:
- Red:       #e53935 / rgb(229, 57, 53)
- Orange:    #fb8c00 / rgb(251, 140, 0)
- Yellow:    #fdd835 / rgb(253, 216, 53)
- Green:     #43a047 / rgb(67, 160, 71)
- LightBlue: #29b6f6 / rgb(41, 182, 246)
- Blue:      #1e88e5 / rgb(30, 136, 229)
- Violet:    #8e24aa / rgb(142, 36, 170)

UI Colors:
- Background:    #0d1321
- Grid BG:       #1c2546
- Grid Cell:     #2a3456
- Text Primary:  #ffffff
- Text Secondary:#a0a0a0
- Gold/Combo:    #ffd700
- Success:       #00ff4c
- Error:         #ff3333
```

---

This plan provides a comprehensive roadmap for migrating the block puzzle game to TypeScript + Canvas while modernizing the visual design.
