// Main Game Controller
// Orchestrates all game systems

import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, CELL_SIZE, GRID_SIZE, BLOCKS_PER_TURN, SCREEN_SHAKE, ANIMATION, BlockColor, BLOCK_COLORS, INTRO_ANIMATION, GAME_OVER_ANIMATION } from './data/constants';
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
import { Point, pointInRect } from './utils/math';

export type GameState = 'loading' | 'home' | 'playing' | 'paused' | 'gameover' | 'animating';

interface ComboNotification {
  message: string;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
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

  // Game state
  private dropBlocks: (Block | null)[] = [null, null, null];
  private comboNotification: ComboNotification | null = null;
  private isNewHighScore: boolean = false;

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
    this.renderer = new Renderer(this.ctx);
    this.inputManager = new InputManager(this.canvas);
    this.animationManager = new AnimationManager();
    this.screenShake = new ScreenShake();
    this.particleSystem = new ParticleSystem();

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

    const targetAspect = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
    const containerAspect = containerWidth / containerHeight;

    if (containerAspect > targetAspect) {
      this.scale = containerHeight / VIEWPORT_HEIGHT;
    } else {
      this.scale = containerWidth / VIEWPORT_WIDTH;
    }

    const canvasWidth = VIEWPORT_WIDTH * this.scale;
    const canvasHeight = VIEWPORT_HEIGHT * this.scale;

    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;

    // Update input manager scale
    this.inputManager?.setScale(this.scale);
  }

  private handleGlobalInput(event: InputEvent): void {
    if (event.type !== 'up') return;

    if (this.state === 'home') {
      this.startGame();
    } else if (this.state === 'gameover') {
      // Check if clicked play again button
      const buttonBounds = this.renderer.getPlayAgainButtonBounds();
      if (pointInRect(event.position, buttonBounds)) {
        this.startGame();
      }
    }
  }

  private async startGame(): Promise<void> {
    // Reset all systems
    this.grid.reset();
    this.blockGenerator.reset();
    this.scoreManager.reset();
    this.isNewHighScore = false;
    this.comboNotification = null;
    this.animatingCells.clear();
    this.introAnimCells.clear();

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

    // Start screen shake
    const shakeIntensity = SCREEN_SHAKE.baseStrength + lineIndices.length * SCREEN_SHAKE.strengthPerLine;
    this.screenShake.shake(shakeIntensity, SCREEN_SHAKE.duration);

    // Animate each cell with stagger
    const staggerDelay = ANIMATION.lineClearStagger;
    const animPromises: Promise<void>[] = [];
    const gridOrigin = this.renderer.getGridOrigin();

    for (let i = 0; i < cellsToClear.length; i++) {
      const cell = cellsToClear[i];
      const key = `${cell.x},${cell.y}`;

      // Get color from animatingCells (already stored above)
      const cellColor = this.animatingCells.get(key)!.color;

      // Calculate screen position for particle emission
      const screenX = gridOrigin.x + cell.x * CELL_SIZE + CELL_SIZE / 2;
      const screenY = gridOrigin.y + cell.y * CELL_SIZE + CELL_SIZE / 2;

      // Particle direction based on cascade (opposite direction for "spray out" effect)
      const particleDir = {
        x: placementOnLeft ? 1 : -1,
        y: -0.5  // Slightly upward
      };

      // Track if particles have been emitted for this cell
      let particlesEmitted = false;

      animPromises.push(new Promise((resolve) => {
        this.animationManager.animateCellClear(
          (scale, opacity, rotation) => {
            // Emit particles on FIRST callback (when animation actually starts after stagger)
            if (!particlesEmitted) {
              particlesEmitted = true;
              this.particleSystem.emit(screenX, screenY, {
                color: cellColor,
                direction: particleDir,
              });
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

  private showComboNotification(result: ComboResult): void {
    if (!result.message) return;

    const gridOrigin = this.renderer.getGridOrigin();
    const startY = gridOrigin.y + (GRID_SIZE * CELL_SIZE) / 2;

    this.comboNotification = {
      message: result.message,
      y: startY,
      scale: 1,
      opacity: 1,
      rotation: 0,
    };

    this.animationManager.animateComboNotification(
      (y, scale, opacity, rotation) => {
        if (this.comboNotification) {
          this.comboNotification.y = y;
          this.comboNotification.scale = scale;
          this.comboNotification.opacity = opacity;
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
    this.state = 'animating';

    // Play game over fill animation
    await this.playGameOverAnimation();

    this.state = 'gameover';
  }

  // ========== GAME OVER ANIMATION ==========

  private async playGameOverAnimation(): Promise<void> {
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

    // Wait before showing game over screen
    await this.animationManager.wait(GAME_OVER_ANIMATION.WAIT_BEFORE_MODAL);
  }

  private fillGameOverCell(col: number, row: number): void {
    const key = `go_${col},${row}`;  // Prefix to avoid collision with intro
    const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

    // Add to intro cells (reusing same map) with initial state
    this.introAnimCells.set(key, { scale: 0, alpha: 0, color });

    // Animate to 25% opacity only
    this.animationManager.tween({
      from: 0,
      to: 1,
      duration: GAME_OVER_ANIMATION.CELL_DURATION,
      easing: easeOutBack,
      onUpdate: (value) => {
        const cell = this.introAnimCells.get(key);
        if (cell) {
          cell.scale = value;
          cell.alpha = value * GAME_OVER_ANIMATION.FINAL_ALPHA;  // Max 0.25
        }
      },
    });
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

      case 'gameover':
        this.renderGameplay();
        this.renderer.renderGameOver(
          this.scoreManager.getScore(),
          this.scoreManager.getHighScore(),
          this.isNewHighScore
        );
        break;
    }

    this.ctx.restore();
  }

  private renderGameplay(): void {
    // Create set of animating cell keys to skip in normal grid render
    const animatingCellKeys = new Set(this.animatingCells.keys());

    const state: RenderState = {
      grid: this.grid,
      dropBlocks: this.dropBlocks,
      dragState: this.dragDropManager.getDragState(),
      highlightedCells: this.dragDropManager.getHighlightedCells(),
      animatingCellKeys,
      score: this.scoreManager.getScore(),
      highScore: this.scoreManager.getHighScore(),
      comboStreak: this.scoreManager.getComboStreak(),
    };

    this.renderer.render(state);

    // Render intro/game over animation cells
    this.renderIntroAnimCells();

    // Render animating cells (being cleared)
    this.renderAnimatingCells();

    // Render particles (on top of blocks)
    this.particleSystem.render(this.ctx);

    // Render combo notification
    if (this.comboNotification) {
      this.renderer.renderComboNotification(
        this.comboNotification.message,
        this.comboNotification.y,
        this.comboNotification.scale,
        this.comboNotification.opacity,
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
}
