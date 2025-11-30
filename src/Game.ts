// Main Game Controller
// Orchestrates all game systems

import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, CELL_SIZE, GRID_SIZE, BLOCKS_PER_TURN, SCREEN_SHAKE, ANIMATION, BlockColor, BLOCK_COLORS, INTRO_ANIMATION, GAME_OVER_ANIMATION, GAME_OVER_FLOW, GAME_OVER_LAYOUT, COLORS } from './data/constants';
import { easeOutBack, easeInQuad } from './utils/easing';
import { Grid } from './core/Grid';
import { Block } from './core/Block';
import { BlockGenerator } from './core/BlockGenerator';
import { ScoreManager, ComboResult } from './core/ScoreManager';
import { Renderer, RenderState, DragState, HighlightedCell } from './rendering/Renderer';
import { InputManager, InputEvent } from './input/InputManager';
import { DragDropManager } from './input/DragDropManager';
import { AnimationManager, ScreenShake } from './effects/AnimationManager';
import { ParticleSystem } from './rendering/ParticleSystem';
import { LineGlowManager } from './effects/LineGlowVFX';
import { Point, pointInRect } from './utils/math';
import { loadComboFont, loadScoreFont } from './utils/fontLoader';

export type GameState =
  | 'loading'
  | 'home'
  | 'playing'
  | 'paused'
  | 'gameover_animating'     // Fill animation in progress
  | 'gameover_overlay'       // "No more space" text showing
  | 'gameover_continue'      // Continue modal showing
  | 'gameover_ad'            // Ad placeholder showing
  | 'gameover_clearing'      // Clearing shadow blocks after continue
  | 'gameover_screen'        // Final game over screen
  | 'animating';

interface ComboNotification {
  comboNumber: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  starburstScale: number;
  rotation: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

interface GameOverState {
  overlayOpacity: number;
  previewBlocks: Block[];
  continueModalOpacity: number;
  continueModalScale: number;
  adOpacity: number;
  titleY: number;
  titleOpacity: number;
  displayedScore: number;
  targetScore: number;
  bestScore: number;
  isNewHighScore: boolean;
  showNewHighScoreBadge: boolean;
  badgeScale: number;
  badgeOpacity: number;
  confetti: ConfettiParticle[];
  burstConfetti: ConfettiParticle[];
  confettiPhase: 'burst' | 'falling' | 'none';
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState = 'loading';
  private previousState: GameState = 'loading';
  private lastTime: number = 0;
  private readyCallbacks: (() => void)[] = [];

  // Game scale for responsive sizing
  private scale: number = 1;
  // Device pixel ratio for high-DPI (retina) display support
  private dpr: number = 1;

  // Core systems
  private grid!: Grid;
  private blockGenerator!: BlockGenerator;
  private scoreManager!: ScoreManager;
  private renderer!: Renderer;
  private inputManager!: InputManager;
  private dragDropManager!: DragDropManager;
  private animationManager!: AnimationManager;
  private screenShake!: ScreenShake;
  private particleSystem!: ParticleSystem;
  private lineGlowManager!: LineGlowManager;

  // Game state
  private dropBlocks: (Block | null)[] = [null, null, null];
  private comboNotification: ComboNotification | null = null;
  private isNewHighScore: boolean = false;
  private lastPlacedBlockCenter: Point | null = null;
  private displayedScore: number = 0;  // Animated score for display
  private heartPulsePhase: number = 0;  // 0 to 2π for combo heart pulsing

  // Game over flow state
  private gameOverState: GameOverState | null = null;
  private hasContinued: boolean = false;  // Only allow continue once per game
  private shadowCells: Map<string, { scale: number; alpha: number; color: BlockColor }> = new Map();

  // Cell animations for line clearing - stores color at animation start to avoid stale reads
  private animatingCells: Map<string, { scale: number; opacity: number; rotation: number; color: BlockColor }> = new Map();

  // Cell animations for intro and game over animations
  private introAnimCells: Map<string, { scale: number; alpha: number; color: BlockColor }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
  }

  public init(): void {
    // Initialize all systems
    this.grid = new Grid();
    this.blockGenerator = new BlockGenerator();
    this.scoreManager = new ScoreManager();
    this.renderer = new Renderer(this.ctx, this.dpr);
    this.inputManager = new InputManager(this.canvas);
    this.animationManager = new AnimationManager();
    this.screenShake = new ScreenShake();
    this.particleSystem = new ParticleSystem();
    // Initialize line glow manager with board geometry
    const gridOrigin = this.renderer.getGridOrigin();
    this.lineGlowManager = new LineGlowManager(
      { x: gridOrigin.x, y: gridOrigin.y, width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE },
      CELL_SIZE
    );

    // Lazy load fonts (async, will be ready when needed)
    loadComboFont();
    loadScoreFont();

    // Lazy load header image (async, will be ready by home screen display)
    this.renderer.loadHeaderImage();

    // Load crown image for high score badge
    this.renderer.loadCrownImage();

    // Load heart image for combo indicator
    this.renderer.loadHeartImage();

    // Set up drag drop manager with callbacks
    this.dragDropManager = new DragDropManager(
      this.grid,
      this.renderer,
      this.inputManager,
      {
        onDragStart: this.onDragStart.bind(this),
        onDragMove: this.onDragMove.bind(this),
        onDrop: this.onDrop.bind(this),
        onDragCancel: this.onDragCancel.bind(this),
      }
    );

    // Set up canvas sizing
    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());

    // Set up click handler for home/gameover screens
    this.inputManager.onInput(this.handleGlobalInput.bind(this));

    // Start game loop
    this.state = 'home';
    this.notifyReady();
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  public onReady(callback: () => void): void {
    if (this.state !== 'loading') {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  private notifyReady(): void {
    for (const cb of this.readyCallbacks) {
      cb();
    }
    this.readyCallbacks = [];
  }

  private setupCanvas(): void {
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Get device pixel ratio for high-DPI (retina) display support
    this.dpr = window.devicePixelRatio || 1;

    const targetAspect = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
    const containerAspect = containerWidth / containerHeight;

    if (containerAspect > targetAspect) {
      this.scale = containerHeight / VIEWPORT_HEIGHT;
    } else {
      this.scale = containerWidth / VIEWPORT_WIDTH;
    }

    const cssWidth = VIEWPORT_WIDTH * this.scale;
    const cssHeight = VIEWPORT_HEIGHT * this.scale;

    // Set canvas resolution to physical pixels (crisp on high-DPI displays)
    this.canvas.width = cssWidth * this.dpr;
    this.canvas.height = cssHeight * this.dpr;

    // Set CSS size to logical pixels
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    // Scale context to account for DPR - all drawing uses logical coordinates
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Update input manager scale
    this.inputManager?.setScale(this.scale);

    // Invalidate renderer caches when canvas size changes (they depend on DPR)
    this.renderer?.invalidateCaches();
  }

  private handleGlobalInput(event: InputEvent): void {
    if (event.type !== 'up') return;

    if (this.state === 'home') {
      this.startGame();
    } else if (this.state === 'gameover_continue') {
      this.handleContinueModalInput(event.position);
    } else if (this.state === 'gameover_screen') {
      this.handleGameOverScreenInput(event.position);
    }
  }

  private handleContinueModalInput(pos: Point): void {
    const continueBtn = this.renderer.getContinueButtonBounds();
    const noThanksBtn = this.renderer.getNoThanksButtonBounds();

    if (pointInRect(pos, continueBtn)) {
      // User wants to continue - show ad
      this.showAdPlaceholder();
    } else if (pointInRect(pos, noThanksBtn)) {
      // User declines - go to game over screen
      this.showGameOverScreen();
    }
  }

  private handleGameOverScreenInput(pos: Point): void {
    const playAgainBtn = this.renderer.getPlayAgainButtonBounds();

    if (pointInRect(pos, playAgainBtn)) {
      this.startGame();
    }
  }

  private goToHome(): void {
    this.state = 'home';
    this.gameOverState = null;
    this.shadowCells.clear();
    this.introAnimCells.clear();
  }

  private async startGame(): Promise<void> {
    // Reset all systems
    this.grid.reset();
    this.blockGenerator.reset();
    this.scoreManager.reset();
    this.isNewHighScore = false;
    this.displayedScore = 0;
    this.comboNotification = null;
    this.animatingCells.clear();
    this.introAnimCells.clear();

    // Reset game over flow state
    this.gameOverState = null;
    this.hasContinued = false;
    this.shadowCells.clear();

    // Play intro animation BEFORE generating blocks
    this.state = 'animating';
    await this.playIntroAnimation();

    // Generate initial blocks
    this.generateNewBlocks();

    this.state = 'playing';
  }

  private generateNewBlocks(): void {
    const newBlocks = this.blockGenerator.generateThree(this.grid);
    this.dropBlocks = newBlocks;
    this.dragDropManager.setBlocks(this.dropBlocks);
  }

  // ========== INTRO ANIMATION ==========

  private async playIntroAnimation(): Promise<void> {
    // Phase 1: Fill rows bottom-to-top
    for (let row = GRID_SIZE - 1; row >= 0; row--) {
      this.fillIntroRow(row);
      await this.animationManager.wait(INTRO_ANIMATION.ROW_DELAY);
    }

    // Wait after fill
    await this.animationManager.wait(INTRO_ANIMATION.WAIT_AFTER_FILL);

    // Phase 2: Clear rows top-to-bottom
    for (let row = 0; row < GRID_SIZE; row++) {
      this.clearIntroRow(row);
      await this.animationManager.wait(INTRO_ANIMATION.ROW_DELAY);
    }

    // Wait after clear
    await this.animationManager.wait(INTRO_ANIMATION.WAIT_AFTER_CLEAR);

    // Cleanup
    this.introAnimCells.clear();
  }

  private fillIntroRow(row: number): void {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${col},${row}`;
      const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

      // Add to intro cells with initial state
      this.introAnimCells.set(key, { scale: 0, alpha: 0, color });

      // Animate scale and alpha to 1
      this.animationManager.tween({
        from: 0,
        to: 1,
        duration: INTRO_ANIMATION.CELL_DURATION,
        easing: easeOutBack,  // Bouncy overshoot
        onUpdate: (value) => {
          const cell = this.introAnimCells.get(key);
          if (cell) {
            cell.scale = value;
            cell.alpha = value;
          }
        },
      });
    }
  }

  private clearIntroRow(row: number): void {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${col},${row}`;

      this.animationManager.tween({
        from: 1,
        to: 0,
        duration: INTRO_ANIMATION.CELL_DURATION,
        easing: easeInQuad,  // Accelerate out
        onUpdate: (value) => {
          const cell = this.introAnimCells.get(key);
          if (cell) {
            cell.scale = value;
            cell.alpha = value;
          }
        },
        onComplete: () => {
          this.introAnimCells.delete(key);
        },
      });
    }
  }

  // Drag & Drop Callbacks
  private onDragStart(block: Block, slotIndex: number): void {
    // Block is being picked up
  }

  private onDragMove(dragState: DragState): void {
    // Block is being dragged
  }

  private onDrop(block: Block, gridPos: Point, slotIndex: number): void {
    // Place block on grid
    const result = this.grid.place(block.shape, gridPos, block.color);

    if (!result.success) {
      // Shouldn't happen if validation is correct
      return;
    }

    // Calculate center of placed block cells (for combo notification positioning)
    const avgX = result.cellsPlaced.reduce((sum, c) => sum + c.x, 0) / result.cellsPlaced.length;
    const avgY = result.cellsPlaced.reduce((sum, c) => sum + c.y, 0) / result.cellsPlaced.length;
    this.lastPlacedBlockCenter = { x: avgX, y: avgY };

    // Clear the slot
    this.dropBlocks[slotIndex] = null;
    this.dragDropManager.setBlocks(this.dropBlocks);

    // Increment drop count
    this.blockGenerator.incrementDrop();

    // Handle line clearing
    if (result.linesCompleted.length > 0) {
      this.handleLineClear(result.linesCompleted, result.cellsPlaced);
    } else {
      // No lines cleared - clear highlights immediately and process placement
      this.dragDropManager.clearHighlights();
      this.scoreManager.processPlacement(result.pointsFromPlacement, 0, false);
      this.animateScoreChange();
      this.checkGameState();
    }
  }

  private onDragCancel(block: Block, slotIndex: number): void {
    // Block returned to slot - nothing to do
  }

  private async handleLineClear(lineIndices: number[], placedCells: Point[]): Promise<void> {
    this.previousState = this.state;
    this.state = 'animating';

    // CRITICAL: Clear highlights IMMEDIATELY at start of line clear
    // Highlights were for preview - now we transition to destruction animation
    // If we don't clear them, they render full-size blocks underneath the shrinking animation!
    this.dragDropManager.clearHighlights();

    // Get cells to clear
    const cellsToClear = this.grid.getCellsToClear(lineIndices);

    // Simplified direction logic (matching Godot): use leftmost placed cell position
    const minPlacedX = Math.min(...placedCells.map(p => p.x));
    const placementOnLeft = minPlacedX < GRID_SIZE / 2;

    // Sort cells for directional cascade (Godot-style)
    // If placed on left: cascade left→right (ascending x, then y)
    // If placed on right: cascade right→left (descending x, then y)
    cellsToClear.sort((a, b) => {
      if (placementOnLeft) {
        // Left to right cascade
        if (a.x !== b.x) return a.x - b.x;
        return a.y - b.y;
      } else {
        // Right to left cascade
        if (a.x !== b.x) return b.x - a.x;
        return a.y - b.y;
      }
    });

    // CRITICAL: Add ALL cells to animatingCells IMMEDIATELY with initial visible state
    // This ensures they're skipped in renderGridBlocks from the very start,
    // preventing "animation on top of static blocks" issue
    for (const cell of cellsToClear) {
      const key = `${cell.x},${cell.y}`;
      const gridCell = this.grid.getCell(cell.x, cell.y);
      const cellColor: BlockColor = gridCell?.color || 'Red';
      this.animatingCells.set(key, { scale: 1, opacity: 1, rotation: 0, color: cellColor });
    }

    // Determine if this is a combo (2+ lines = golden beam)
    const isCombo = lineIndices.length >= 2;
    const gridOrigin = this.renderer.getGridOrigin();

    // Spawn glow VFX for each cleared line (disabled - looks poor)
    // Line indices: 0-7 = rows (horizontal), 8-15 = columns (vertical)
    // this.lineGlowManager.spawnForLines(lineIndices);

    // Start screen shake
    const shakeIntensity = SCREEN_SHAKE.baseStrength + lineIndices.length * SCREEN_SHAKE.strengthPerLine;
    this.screenShake.shake(shakeIntensity, SCREEN_SHAKE.duration);

    // Block destruction starts immediately with the beam (no delay)

    // Animate each cell with stagger
    const staggerDelay = ANIMATION.lineClearStagger;
    const animPromises: Promise<void>[] = [];

    for (let i = 0; i < cellsToClear.length; i++) {
      const cell = cellsToClear[i];
      const key = `${cell.x},${cell.y}`;

      // Get color from animatingCells (already stored above)
      const cellColor = this.animatingCells.get(key)!.color;

      // Calculate screen position for particle emission
      const screenX = gridOrigin.x + cell.x * CELL_SIZE + CELL_SIZE / 2;
      const screenY = gridOrigin.y + cell.y * CELL_SIZE + CELL_SIZE / 2;

      // Determine beam direction for this cell (for spark spray)
      // Find which line this cell belongs to
      let beamDirection: 'horizontal' | 'vertical' = 'horizontal';
      for (const lineIndex of lineIndices) {
        const isRow = lineIndex < GRID_SIZE;
        if (isRow && cell.y === lineIndex) {
          beamDirection = 'horizontal';
          break;
        } else if (!isRow && cell.x === lineIndex - GRID_SIZE) {
          beamDirection = 'vertical';
          break;
        }
      }

      // Track if particles have been emitted for this cell
      let particlesEmitted = false;

      animPromises.push(new Promise((resolve) => {
        this.animationManager.animateCellClear(
          (scale, opacity, rotation) => {
            // Emit spark particles on FIRST callback (when animation actually starts after stagger)
            if (!particlesEmitted) {
              particlesEmitted = true;
              // Use emitSparks for beam effect (perpendicular spray)
              this.particleSystem.emitSparks(
                screenX,
                screenY,
                beamDirection,
                isCombo ? COLORS.Gold : COLORS[cellColor]
              );
            }
            // Update animation state (cell is ALREADY in animatingCells from initial loop)
            this.animatingCells.set(key, { scale, opacity, rotation, color: cellColor });
          },
          i * staggerDelay,
          () => {
            // Clear THIS cell when ITS animation completes
            this.grid.clearCell(cell.x, cell.y);
            this.animatingCells.delete(key);
            resolve();
          }
        );
      }));
    }

    // Wait for all animations to complete
    await Promise.all(animPromises);

    // Note: cells are now cleared individually in callbacks above, no bulk clearLines() needed

    // Check for field clear
    const isFieldClear = this.grid.isEmpty();

    // Process scoring
    const comboResult = this.scoreManager.processPlacement(
      placedCells.length,
      lineIndices.length,
      isFieldClear
    );

    // Animate score count-up
    this.animateScoreChange();

    // Update high score flag
    if (this.scoreManager.getScore() === this.scoreManager.getHighScore() &&
        this.scoreManager.getHighScore() > 0) {
      this.isNewHighScore = true;
    }

    // Show combo notification
    this.showComboNotification(comboResult);

    // Return to playing state
    this.state = 'playing';
    this.checkGameState();
  }

  // Animate the displayed score counting up to the actual score
  private animateScoreChange(): void {
    const targetScore = this.scoreManager.getScore();
    const pointsToAdd = targetScore - this.displayedScore;

    if (pointsToAdd <= 0) return;

    // Scale duration with points (min 150ms, max 400ms)
    const duration = Math.min(400, Math.max(150, pointsToAdd * 3));

    this.animationManager.tween({
      from: this.displayedScore,
      to: targetScore,
      duration,
      onUpdate: (value) => {
        this.displayedScore = Math.floor(value);
      },
    });
  }

  private showComboNotification(result: ComboResult): void {
    // Only show for combos (2+ consecutive line clears)
    if (result.comboStreak < 1) return;

    const gridOrigin = this.renderer.getGridOrigin();

    // Position combo sign at the last placed block location
    let startX = VIEWPORT_WIDTH / 2;  // Default center
    let startY = gridOrigin.y + (GRID_SIZE * CELL_SIZE) / 2;  // Default center

    if (this.lastPlacedBlockCenter) {
      // Clamp grid X to columns 1-6 to prevent rendering off-screen
      const clampedGridX = Math.max(1, Math.min(6, this.lastPlacedBlockCenter.x));
      startX = gridOrigin.x + clampedGridX * CELL_SIZE + CELL_SIZE / 2;
      startY = gridOrigin.y + this.lastPlacedBlockCenter.y * CELL_SIZE + CELL_SIZE / 2;
    }

    // Combo number is streak + 1 (first combo shows "Combo 2")
    const comboNumber = result.comboStreak + 1;

    this.comboNotification = {
      comboNumber,
      x: startX,
      y: startY,
      scale: 0.3,  // Start small for zoom-in
      opacity: 1,
      starburstScale: 1,
      rotation: 0,
    };

    this.animationManager.animateComboNotification(
      (y, scale, opacity, starburstScale, rotation) => {
        if (this.comboNotification) {
          this.comboNotification.y = y;
          this.comboNotification.scale = scale;
          this.comboNotification.opacity = opacity;
          this.comboNotification.starburstScale = starburstScale;
          this.comboNotification.rotation = rotation;
        }
      },
      startY,
      () => {
        this.comboNotification = null;
      }
    );
  }

  private checkGameState(): void {
    // Check if need new blocks
    const hasBlocks = this.dropBlocks.some(b => b !== null);
    if (!hasBlocks) {
      this.generateNewBlocks();
    }

    // Check for valid moves
    const activeBlocks = this.dropBlocks.filter((b): b is Block => b !== null);
    const shapesToCheck = activeBlocks.map(b => b.shape);

    if (!this.grid.hasValidMoves(shapesToCheck)) {
      this.gameOver();
    }
  }

  private async gameOver(): Promise<void> {
    this.state = 'gameover_animating';

    // Check for new high score
    this.isNewHighScore = this.scoreManager.getScore() > this.scoreManager.getHighScore();

    // Initialize game over state
    this.gameOverState = {
      overlayOpacity: 0,
      previewBlocks: [],
      continueModalOpacity: 0,
      continueModalScale: GAME_OVER_FLOW.MODAL_INITIAL_SCALE,
      adOpacity: 0,
      titleY: -100,
      titleOpacity: 0,
      displayedScore: 0,
      targetScore: this.scoreManager.getScore(),
      bestScore: this.scoreManager.getHighScore(),
      isNewHighScore: this.isNewHighScore,
      showNewHighScoreBadge: false,
      badgeScale: 0,
      badgeOpacity: 0,
      confetti: [],
      burstConfetti: [],
      confettiPhase: 'none',
    };

    // Phase 1: Fill animation
    await this.playGameOverAnimation();

    // Phase 2: Show "No more space" overlay
    this.state = 'gameover_overlay';
    await this.showNoMoreSpaceOverlay();

    // Phase 3: Show continue modal or go directly to game over screen
    if (!this.hasContinued) {
      this.state = 'gameover_continue';
      await this.showContinueModal();
      // Wait for user input (handled in handleGlobalInput)
    } else {
      // Already used continue - go directly to game over screen
      await this.showGameOverScreen();
    }
  }

  // ========== GAME OVER ANIMATION ==========

  private async playGameOverAnimation(): Promise<void> {
    // Clear shadow cells for fresh start
    this.shadowCells.clear();

    // Fill empty cells from bottom to top
    for (let row = GRID_SIZE - 1; row >= 0; row--) {
      let filledAny = false;

      for (let col = 0; col < GRID_SIZE; col++) {
        // Only fill empty cells (no block placed there)
        if (!this.grid.getCell(col, row)) {
          filledAny = true;
          this.fillGameOverCell(col, row);
        }
      }

      if (filledAny) {
        await this.animationManager.wait(GAME_OVER_ANIMATION.ROW_DELAY);
      }
    }

    // Wait before showing overlay
    await this.animationManager.wait(GAME_OVER_ANIMATION.WAIT_BEFORE_MODAL);
  }

  private fillGameOverCell(col: number, row: number): void {
    const key = `${col},${row}`;
    const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

    // Add to shadow cells with initial state
    this.shadowCells.set(key, { scale: 0, alpha: 0, color });

    // Animate to 25% opacity
    this.animationManager.tween({
      from: 0,
      to: 1,
      duration: GAME_OVER_ANIMATION.CELL_DURATION,
      easing: easeOutBack,
      onUpdate: (value) => {
        const cell = this.shadowCells.get(key);
        if (cell) {
          cell.scale = value;
          cell.alpha = value * GAME_OVER_ANIMATION.FINAL_ALPHA;  // Max 0.25
        }
      },
    });
  }

  // ========== NO MORE SPACE OVERLAY ==========

  private async showNoMoreSpaceOverlay(): Promise<void> {
    const { OVERLAY_DURATION, OVERLAY_FADE_IN, OVERLAY_FADE_OUT } = GAME_OVER_FLOW;

    // Fade in
    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: 0,
        to: 1,
        duration: OVERLAY_FADE_IN,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.overlayOpacity = value;
          }
        },
        onComplete: resolve,
      });
    });

    // Hold
    await this.animationManager.wait(OVERLAY_DURATION - OVERLAY_FADE_IN - OVERLAY_FADE_OUT);

    // Fade out
    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: 1,
        to: 0,
        duration: OVERLAY_FADE_OUT,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.overlayOpacity = value;
          }
        },
        onComplete: resolve,
      });
    });
  }

  // ========== CONTINUE MODAL ==========

  private async showContinueModal(): Promise<void> {
    // Generate preview blocks for continue option
    const previewBlocks = this.blockGenerator.generateAdContinue(this.grid);

    if (this.gameOverState) {
      this.gameOverState.previewBlocks = previewBlocks;
    }

    // Animate modal in
    const { MODAL_SCALE_IN, MODAL_INITIAL_SCALE } = GAME_OVER_FLOW;

    await Promise.all([
      new Promise<void>((resolve) => {
        this.animationManager.tween({
          from: 0,
          to: 1,
          duration: MODAL_SCALE_IN,
          onUpdate: (value) => {
            if (this.gameOverState) {
              this.gameOverState.continueModalOpacity = value;
            }
          },
          onComplete: resolve,
        });
      }),
      new Promise<void>((resolve) => {
        this.animationManager.tween({
          from: MODAL_INITIAL_SCALE,
          to: 1,
          duration: MODAL_SCALE_IN,
          easing: easeOutBack,
          onUpdate: (value) => {
            if (this.gameOverState) {
              this.gameOverState.continueModalScale = value;
            }
          },
          onComplete: resolve,
        });
      }),
    ]);

    // Wait for user input (handled in handleGlobalInput)
  }

  // ========== AD PLACEHOLDER ==========

  private async showAdPlaceholder(): Promise<void> {
    this.state = 'gameover_ad';

    const { AD_DURATION, AD_FADE_IN, AD_FADE_OUT } = GAME_OVER_FLOW;

    // Fade in
    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: 0,
        to: 1,
        duration: AD_FADE_IN,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.adOpacity = value;
          }
        },
        onComplete: resolve,
      });
    });

    // Hold (simulating ad)
    await this.animationManager.wait(AD_DURATION - AD_FADE_IN - AD_FADE_OUT);

    // Fade out
    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: 1,
        to: 0,
        duration: AD_FADE_OUT,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.adOpacity = value;
          }
        },
        onComplete: resolve,
      });
    });

    // After ad, continue game
    await this.continueAfterAd();
  }

  // ========== CONTINUE AFTER AD ==========

  private async continueAfterAd(): Promise<void> {
    this.state = 'gameover_clearing';
    this.hasContinued = true;

    // Get the preview blocks before clearing state
    const newBlocks = this.gameOverState?.previewBlocks || [];

    // Clear shadow blocks with animation
    await this.clearShadowBlocksAnimation();

    // Give player the new blocks
    this.dropBlocks = newBlocks;
    this.dragDropManager.setBlocks(this.dropBlocks);

    // Reset game over state
    this.gameOverState = null;

    // Return to playing
    this.state = 'playing';
  }

  private async clearShadowBlocksAnimation(): Promise<void> {
    const { SHADOW_CLEAR_ROW_DELAY, SHADOW_CLEAR_CELL_DURATION } = GAME_OVER_FLOW;

    // Clear from top to bottom (reverse of fill)
    for (let row = 0; row < GRID_SIZE; row++) {
      let clearedAny = false;

      for (let col = 0; col < GRID_SIZE; col++) {
        const key = `${col},${row}`;
        if (this.shadowCells.has(key)) {
          clearedAny = true;
          this.animateShadowClear(key, SHADOW_CLEAR_CELL_DURATION);
        }
      }

      if (clearedAny) {
        await this.animationManager.wait(SHADOW_CLEAR_ROW_DELAY);
      }
    }

    // Final cleanup - wait for last row animations to complete
    await this.animationManager.wait(SHADOW_CLEAR_CELL_DURATION);
    this.shadowCells.clear();
  }

  private animateShadowClear(key: string, duration: number): void {
    this.animationManager.tween({
      from: 1,
      to: 0,
      duration,
      easing: easeInQuad,
      onUpdate: (value) => {
        const cell = this.shadowCells.get(key);
        if (cell) {
          cell.scale = value;
          cell.alpha = value * GAME_OVER_ANIMATION.FINAL_ALPHA;
        }
      },
      onComplete: () => {
        this.shadowCells.delete(key);
      },
    });
  }

  // ========== GAME OVER SCREEN ==========

  private async showGameOverScreen(): Promise<void> {
    this.state = 'gameover_screen';

    // Update best score in state (high score is auto-saved by ScoreManager during gameplay)
    if (this.gameOverState) {
      this.gameOverState.bestScore = this.scoreManager.getHighScore();
      // Initialize burst confetti from bottom corners
      this.gameOverState.burstConfetti = this.createBurstConfetti(60);
      this.gameOverState.confettiPhase = 'burst';
      this.gameOverState.confetti = [];
    }

    const { TITLE_DROP_DURATION, SCORE_COUNT_DURATION, HIGH_SCORE_BADGE_DELAY, HIGH_SCORE_BADGE_SCALE_DURATION } = GAME_OVER_FLOW;

    // Animate title drop
    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: -100,
        to: GAME_OVER_LAYOUT.SCREEN_TITLE_Y,
        duration: TITLE_DROP_DURATION,
        easing: easeOutBack,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.titleY = value;
            this.gameOverState.titleOpacity = 1;
          }
        },
        onComplete: resolve,
      });
    });

    // Animate score count-up
    const targetScore = this.gameOverState?.targetScore || 0;
    const countDuration = Math.min(SCORE_COUNT_DURATION, Math.max(500, targetScore * 2));

    await new Promise<void>((resolve) => {
      this.animationManager.tween({
        from: 0,
        to: targetScore,
        duration: countDuration,
        onUpdate: (value) => {
          if (this.gameOverState) {
            this.gameOverState.displayedScore = Math.floor(value);
          }
        },
        onComplete: resolve,
      });
    });

    // Show new high score badge if applicable
    if (this.isNewHighScore && this.gameOverState) {
      await this.animationManager.wait(HIGH_SCORE_BADGE_DELAY);

      this.gameOverState.showNewHighScoreBadge = true;

      await new Promise<void>((resolve) => {
        this.animationManager.tween({
          from: 0,
          to: 1,
          duration: HIGH_SCORE_BADGE_SCALE_DURATION,
          easing: easeOutBack,
          onUpdate: (value) => {
            if (this.gameOverState) {
              this.gameOverState.badgeScale = value;
              this.gameOverState.badgeOpacity = value;
            }
          },
          onComplete: resolve,
        });
      });
    }

    // Screen is now showing - start falling confetti after burst settles
    setTimeout(() => {
      if (this.gameOverState && this.state === 'gameover_screen') {
        this.gameOverState.confettiPhase = 'falling';
        this.gameOverState.confetti = this.createConfettiParticles(40);
      }
    }, 2000);  // Wait for burst to settle before starting falling confetti
  }

  // Confetti colors matching the reference (colorful squares)
  private static readonly CONFETTI_COLORS = [
    '#FFD700',  // Gold/Yellow
    '#FF6B6B',  // Red/Coral
    '#4ECDC4',  // Teal/Cyan
    '#45B7D1',  // Light Blue
    '#96E6A1',  // Light Green
    '#DDA0DD',  // Plum/Pink
    '#F7DC6F',  // Light Yellow
  ];

  private createConfettiParticles(count: number): ConfettiParticle[] {
    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * VIEWPORT_WIDTH,
        y: -20 - Math.random() * 200,  // Start above screen, staggered
        vx: (Math.random() - 0.5) * 30,  // Slight horizontal drift
        vy: 40 + Math.random() * 40,  // Fall speed
        color: Game.CONFETTI_COLORS[Math.floor(Math.random() * Game.CONFETTI_COLORS.length)],
        size: 4 + Math.random() * 6,  // 4-10px squares
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 4,  // Rotation speed
      });
    }
    return particles;
  }

  // Create burst confetti that shoots up from bottom corners (V-shape fountain)
  private createBurstConfetti(count: number): ConfettiParticle[] {
    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < count; i++) {
      // Alternate between left and right corners
      const fromLeft = i % 2 === 0;
      const startX = fromLeft ? 0 : VIEWPORT_WIDTH;
      const startY = VIEWPORT_HEIGHT;

      // Shoot upward at angle (toward center-top)
      const baseAngle = fromLeft ? -Math.PI * 0.35 : -Math.PI * 0.65;  // -63° or -117°
      const angleVariance = (Math.random() - 0.5) * 0.5;  // ±~14°
      const angle = baseAngle + angleVariance;

      const speed = 500 + Math.random() * 300;  // Fast initial burst

      particles.push({
        x: startX + (fromLeft ? Math.random() * 30 : -Math.random() * 30),
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Game.CONFETTI_COLORS[Math.floor(Math.random() * Game.CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 6,  // 5-11px squares
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,  // Faster rotation for burst
      });
    }
    return particles;
  }

  private updateConfetti(deltaTime: number): void {
    if (!this.gameOverState) return;

    // Update burst confetti (apply gravity, no recycling - let them fall off)
    if (this.gameOverState.burstConfetti && this.gameOverState.burstConfetti.length > 0) {
      for (const p of this.gameOverState.burstConfetti) {
        p.vy += 600 * deltaTime;  // Gravity
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.rotation += p.rotationSpeed * deltaTime;
      }
      // Remove particles that fell off screen
      this.gameOverState.burstConfetti = this.gameOverState.burstConfetti.filter(
        p => p.y < VIEWPORT_HEIGHT + 50
      );
    }

    // Update falling confetti (existing logic with recycling)
    if (this.gameOverState.confettiPhase === 'falling' && this.gameOverState.confetti) {
      for (const p of this.gameOverState.confetti) {
        // Update position
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.rotation += p.rotationSpeed * deltaTime;

        // Wrap around horizontally
        if (p.x < -10) p.x = VIEWPORT_WIDTH + 10;
        if (p.x > VIEWPORT_WIDTH + 10) p.x = -10;

        // Reset particles that fall off the bottom
        if (p.y > VIEWPORT_HEIGHT + 20) {
          p.y = -20 - Math.random() * 50;
          p.x = Math.random() * VIEWPORT_WIDTH;
          p.vx = (Math.random() - 0.5) * 30;
          p.vy = 40 + Math.random() * 40;
        }
      }
    }
  }

  private gameLoop(time: number): void {
    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private update(deltaTime: number): void {
    // Update animation manager
    this.animationManager.update(deltaTime);

    // Update screen shake
    this.screenShake.update(deltaTime);

    // Update particle system
    this.particleSystem.update(deltaTime);

    // Update line glow effects (expects seconds)
    this.lineGlowManager.update(deltaTime);

    // Update combo heart pulse phase (base 2Hz, speed scales with combo tier)
    const comboStreak = this.scoreManager.getComboStreak();
    if (comboStreak >= 1) {
      const tier = Math.min(9, Math.floor((comboStreak - 1) / 3));
      const speedMultipliers = [0.26, 0.31, 0.36, 0.42, 0.47, 0.52, 0.57, 0.62, 0.68, 0.78];
      const baseFrequency = 2 * Math.PI * 2;  // 2Hz base = 2 pulses per second
      this.heartPulsePhase += deltaTime * baseFrequency * speedMultipliers[tier];
      if (this.heartPulsePhase > Math.PI * 2) {
        this.heartPulsePhase -= Math.PI * 2;
      }
    }

    // Update confetti on game over screen
    if (this.state === 'gameover_screen') {
      this.updateConfetti(deltaTime);
    }
  }

  private render(): void {
    // Apply screen shake offset
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    this.ctx.translate(this.screenShake.offsetX, this.screenShake.offsetY);

    switch (this.state) {
      case 'home':
        this.renderer.renderHomeScreen(this.scoreManager.getHighScore());
        break;

      case 'playing':
      case 'animating':
        this.renderGameplay();
        break;

      case 'gameover_animating':
      case 'gameover_clearing':
        this.renderGameplay();
        this.renderShadowCells();
        break;

      case 'gameover_overlay':
        this.renderGameplay();
        this.renderShadowCells();
        if (this.gameOverState) {
          this.renderer.renderNoMoreSpaceOverlay(this.gameOverState.overlayOpacity);
        }
        break;

      case 'gameover_continue':
        this.renderGameplay();
        this.renderShadowCells();
        if (this.gameOverState) {
          this.renderer.renderContinueModal(
            this.gameOverState.previewBlocks,
            this.gameOverState.continueModalOpacity,
            this.gameOverState.continueModalScale
          );
        }
        break;

      case 'gameover_ad':
        this.renderGameplay();
        this.renderShadowCells();
        if (this.gameOverState) {
          this.renderer.renderAdPlaceholder(this.gameOverState.adOpacity);
        }
        break;

      case 'gameover_screen':
        this.renderGameplay();
        this.renderShadowCells();
        if (this.gameOverState) {
          this.renderer.renderGameOverScreen(this.gameOverState);
        }
        break;
    }

    this.ctx.restore();
  }

  private renderGameplay(): void {
    // Pass animatingCells Map directly - Map.has() works same as Set.has()
    // This avoids creating a new Set from keys every frame

    const state: RenderState = {
      grid: this.grid,
      dropBlocks: this.dropBlocks,
      dragState: this.dragDropManager.getDragState(),
      highlightedCells: this.dragDropManager.getHighlightedCells(),
      highlightedPositions: this.dragDropManager.getHighlightedPositionsSet(),
      animatingCells: this.animatingCells,
      score: this.displayedScore,
      highScore: this.scoreManager.getHighScore(),
      comboStreak: this.scoreManager.getComboStreak(),
      heartPulsePhase: this.heartPulsePhase,
    };

    this.renderer.render(state);

    // Render particles (under blocks/effects)
    this.particleSystem.render(this.ctx);

    // Render intro/game over animation cells
    this.renderIntroAnimCells();

    // Render line glow effects (after grid, before animating cells)
    this.lineGlowManager.draw(this.ctx);

    // Render animating cells (being cleared)
    this.renderAnimatingCells();

    // Render combo notification
    if (this.comboNotification) {
      this.renderer.renderComboNotification(
        this.comboNotification.comboNumber,
        this.comboNotification.x,
        this.comboNotification.y,
        this.comboNotification.scale,
        this.comboNotification.opacity,
        this.comboNotification.starburstScale,
        this.comboNotification.rotation
      );
    }
  }

  private renderAnimatingCells(): void {
    const gridOrigin = this.renderer.getGridOrigin();

    this.animatingCells.forEach((anim, key) => {
      const [x, y] = key.split(',').map(Number);
      const screenX = gridOrigin.x + x * CELL_SIZE;
      const screenY = gridOrigin.y + y * CELL_SIZE;

      this.ctx.save();
      this.ctx.globalAlpha = anim.opacity;

      // Transform from center: scale + rotation
      const centerX = screenX + CELL_SIZE / 2;
      const centerY = screenY + CELL_SIZE / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(anim.rotation);
      this.ctx.scale(anim.scale, anim.scale);
      this.ctx.translate(-centerX, -centerY);

      // Use stored color (not re-read from grid - cell may already be cleared)
      this.renderer.renderBlock(screenX, screenY, CELL_SIZE, anim.color, anim.opacity);

      this.ctx.restore();
    });
  }

  private renderIntroAnimCells(): void {
    const gridOrigin = this.renderer.getGridOrigin();

    this.introAnimCells.forEach((anim, key) => {
      // Parse key (handle both "x,y" and "go_x,y" formats for game over)
      const cleanKey = key.replace('go_', '');
      const [x, y] = cleanKey.split(',').map(Number);

      const screenX = gridOrigin.x + x * CELL_SIZE;
      const screenY = gridOrigin.y + y * CELL_SIZE;

      this.ctx.save();
      this.ctx.globalAlpha = anim.alpha;

      // Transform from center for scale
      const centerX = screenX + CELL_SIZE / 2;
      const centerY = screenY + CELL_SIZE / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(anim.scale, anim.scale);
      this.ctx.translate(-centerX, -centerY);

      this.renderer.renderBlock(screenX, screenY, CELL_SIZE, anim.color, anim.alpha);

      this.ctx.restore();
    });
  }

  private renderShadowCells(): void {
    const gridOrigin = this.renderer.getGridOrigin();

    this.shadowCells.forEach((cell, key) => {
      const [x, y] = key.split(',').map(Number);

      const screenX = gridOrigin.x + x * CELL_SIZE;
      const screenY = gridOrigin.y + y * CELL_SIZE;

      this.ctx.save();
      this.ctx.globalAlpha = cell.alpha;

      // Transform from center for scale
      const centerX = screenX + CELL_SIZE / 2;
      const centerY = screenY + CELL_SIZE / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(cell.scale, cell.scale);
      this.ctx.translate(-centerX, -centerY);

      this.renderer.renderBlock(screenX, screenY, CELL_SIZE, cell.color, cell.alpha);

      this.ctx.restore();
    });
  }
}
