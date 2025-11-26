// Main Game Controller
// Orchestrates all game systems

import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, CELL_SIZE, GRID_SIZE, BLOCKS_PER_TURN, SCREEN_SHAKE, ANIMATION } from './data/constants';
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

  // Cell animations for line clearing
  private animatingCells: Map<string, { scale: number; opacity: number; rotation: number }> = new Map();

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

  private startGame(): void {
    // Reset all systems
    this.grid.reset();
    this.blockGenerator.reset();
    this.scoreManager.reset();
    this.isNewHighScore = false;
    this.comboNotification = null;
    this.animatingCells.clear();

    // Generate initial blocks
    this.generateNewBlocks();

    this.state = 'playing';
  }

  private generateNewBlocks(): void {
    const newBlocks = this.blockGenerator.generateThree(this.grid);
    this.dropBlocks = newBlocks;
    this.dragDropManager.setBlocks(this.dropBlocks);
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
      // No lines cleared, just process placement points
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

    // Get cells to clear
    const cellsToClear = this.grid.getCellsToClear(lineIndices);

    // Calculate center of placed block for direction
    const centerX = placedCells.reduce((sum, p) => sum + p.x, 0) / placedCells.length;
    const centerY = placedCells.reduce((sum, p) => sum + p.y, 0) / placedCells.length;

    // Determine cascade direction based on placement position
    const placementOnLeft = centerX < GRID_SIZE / 2;

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

      // Get cell color before it's cleared
      const gridCell = this.grid.getCell(cell.x, cell.y);
      const cellColor = gridCell?.color || 'Red';

      // Calculate screen position for particle emission
      const screenX = gridOrigin.x + cell.x * CELL_SIZE + CELL_SIZE / 2;
      const screenY = gridOrigin.y + cell.y * CELL_SIZE + CELL_SIZE / 2;

      // Particle direction based on cascade
      const particleDir = {
        x: placementOnLeft ? 1 : -1,
        y: -0.5  // Slightly upward
      };

      // Schedule particle emission when this cell starts animating
      setTimeout(() => {
        this.particleSystem.emit(screenX, screenY, {
          color: cellColor,
          direction: particleDir,
        });
      }, i * staggerDelay);

      animPromises.push(new Promise((resolve) => {
        this.animationManager.animateCellClear(
          (scale, opacity, rotation) => {
            this.animatingCells.set(key, { scale, opacity, rotation });
          },
          i * staggerDelay,
          () => {
            this.animatingCells.delete(key);
            resolve();
          }
        );
      }));
    }

    // Wait for all animations to complete
    await Promise.all(animPromises);

    // Actually clear the cells from grid
    this.grid.clearLines(lineIndices);

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

  private gameOver(): void {
    this.state = 'gameover';
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
    const state: RenderState = {
      grid: this.grid,
      dropBlocks: this.dropBlocks,
      dragState: this.dragDropManager.getDragState(),
      highlightedCells: this.dragDropManager.getHighlightedCells(),
      score: this.scoreManager.getScore(),
      highScore: this.scoreManager.getHighScore(),
      comboStreak: this.scoreManager.getComboStreak(),
    };

    this.renderer.render(state);

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
      const cell = this.grid.getCell(x, y);
      if (cell && cell.occupied && cell.color) {
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

        this.renderer.renderBlock(screenX, screenY, CELL_SIZE, cell.color, anim.opacity);

        this.ctx.restore();
      }
    });
  }
}
