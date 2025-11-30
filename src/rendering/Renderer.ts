// Main Renderer - Handles all canvas rendering operations

import { imageDataRGBA } from 'stackblur-canvas';
import {
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  GRID_SIZE,
  CELL_SIZE,
  CELL_SIZE_DROP,
  COLORS,
  BlockColor,
  HIGHLIGHT,
  COMBO_NOTIFICATION,
  HOME_SCREEN,
  GAME_OVER_LAYOUT,
} from '../data/constants';
import { Grid, GridCell } from '../core/Grid';
import { Block } from '../core/Block';
import { getShapeBounds } from '../data/figures';
import { Point } from '../utils/math';
import { lighten, darken, toRgba } from '../utils/colors';
import { getComboFontFamily } from '../utils/fontLoader';
import { BlockSpriteCache } from './BlockSpriteCache';
import { drawComboSign, DEFAULT_WORD_COLORS, DEFAULT_NUMBER_COLORS, getNumberCenterX } from './ComboSign';

// Interface for objects with .has() method (both Map and Set support this)
interface HasMethod {
  has(key: string): boolean;
}

export interface RenderState {
  grid: Grid;
  dropBlocks: (Block | null)[];
  dragState: DragState | null;
  highlightedCells: HighlightedCell[];
  highlightedPositions: Set<string>;  // Cached Set of highlighted positions for O(1) lookups
  animatingCells: HasMethod;  // Map or Set with .has() method - keys of cells being animated ("x,y")
  score: number;
  highScore: number;
  comboStreak: number;
  heartPulsePhase: number;  // 0 to 2π for pulsing animation
}

export interface DragState {
  block: Block;
  screenPosition: Point;
  gridPosition: Point | null;
  isValidPlacement: boolean;
}

export interface HighlightedCell {
  x: number;
  y: number;
  color: BlockColor;
  isCombo: boolean;
  isEmpty: boolean;  // True if cell is empty (will be filled by placement)
}

// Grid container padding
const GRID_CONTAINER_PADDING = 12;
const GRID_CONTAINER_RADIUS = 16;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private gridOriginX: number;
  private gridOriginY: number;
  private dropAreaY: number;
  private containerX: number;
  private containerY: number;
  private containerWidth: number;
  private containerHeight: number;
  // Device pixel ratio for high-DPI (retina) display support
  private dpr: number;
  // Pre-rendered block sprites for performance
  private blockSpriteCache: BlockSpriteCache;
  // Cached gradient-only background (for home screen, game over) - rendered once
  private gradientCache: OffscreenCanvas | null = null;
  // Cached full background (gradient + container + grid lines) - rendered once
  private backgroundCache: OffscreenCanvas | null = null;
  // Cached starburst with blur (for combo notification) - rendered once
  private starburstCache: OffscreenCanvas | null = null;
  private starburstSize: number = 0;
  // Header image for home screen
  private headerImage: HTMLImageElement | null = null;
  // Crown image for high score badge
  private crownImage: HTMLImageElement | null = null;
  // Heart image for combo indicator
  private heartImage: HTMLImageElement | null = null;
  // Offscreen canvas for heart tinting (pre-allocated at max size)
  private heartTintCanvas: OffscreenCanvas;
  private heartTintCanvasSize: number;  // Cached size for reuse

  constructor(ctx: CanvasRenderingContext2D, dpr: number = 1) {
    this.ctx = ctx;
    this.dpr = dpr;
    // Initialize sprite cache for pre-rendered blocks (with DPR for crisp sprites)
    this.blockSpriteCache = new BlockSpriteCache(dpr);

    // Calculate container position (centered horizontally)
    const gridWidth = GRID_SIZE * CELL_SIZE;
    const gridHeight = GRID_SIZE * CELL_SIZE;
    this.containerWidth = gridWidth + GRID_CONTAINER_PADDING * 2;
    this.containerHeight = gridHeight + GRID_CONTAINER_PADDING * 2;
    this.containerX = (VIEWPORT_WIDTH - this.containerWidth) / 2;
    this.containerY = 160; // Top area for score, container below

    // Grid origin is inside the container
    this.gridOriginX = this.containerX + GRID_CONTAINER_PADDING;
    this.gridOriginY = this.containerY + GRID_CONTAINER_PADDING;

    // Drop area below grid container
    this.dropAreaY = this.containerY + this.containerHeight + 40;

    // Pre-allocate heart tint canvas at fixed max size (avoids first-render allocation)
    const maxHeartSize = 96 * 1.15;  // heartSize * maxPulseScale
    this.heartTintCanvasSize = Math.ceil(maxHeartSize * this.dpr);
    this.heartTintCanvas = new OffscreenCanvas(this.heartTintCanvasSize, this.heartTintCanvasSize);
  }

  public getGridOrigin(): Point {
    return { x: this.gridOriginX, y: this.gridOriginY };
  }

  public getDropAreaY(): number {
    return this.dropAreaY;
  }

  // Load header image for home screen
  public loadHeaderImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.headerImage = img;
        resolve();
      };
      img.onerror = reject;
      img.src = '/assets/png/alpha_v1.png';
    });
  }

  // Load crown image for high score badge
  public loadCrownImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.crownImage = img;
        resolve();
      };
      img.onerror = reject;
      img.src = '/assets/png/crown.png';
    });
  }

  // Load heart image for combo indicator
  public loadHeartImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.heartImage = img;
        resolve();
      };
      img.onerror = reject;
      img.src = '/assets/png/Heart.png';
    });
  }

  // Initialize gradient-only cache (for home screen, game over)
  private initializeGradientCache(): void {
    if (this.gradientCache) return;

    // Create at physical resolution for crisp rendering on high-DPI displays
    this.gradientCache = new OffscreenCanvas(VIEWPORT_WIDTH * this.dpr, VIEWPORT_HEIGHT * this.dpr);
    const ctx = this.gradientCache.getContext('2d')!;

    // Scale context so drawing code uses logical coordinates
    ctx.scale(this.dpr, this.dpr);

    // Gradient background only
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
    gradient.addColorStop(0, COLORS.BackgroundTop);
    gradient.addColorStop(1, COLORS.BackgroundBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Initialize full background cache (gradient + container + grid lines)
  // Called once - for gameplay screens
  private initializeBackgroundCache(): void {
    if (this.backgroundCache) return;

    // Ensure gradient cache exists first
    this.initializeGradientCache();

    // Create at physical resolution for crisp rendering on high-DPI displays
    this.backgroundCache = new OffscreenCanvas(VIEWPORT_WIDTH * this.dpr, VIEWPORT_HEIGHT * this.dpr);
    const ctx = this.backgroundCache.getContext('2d')!;

    // 1. Copy gradient from gradient cache (both are at physical resolution)
    ctx.drawImage(this.gradientCache!, 0, 0);

    // Scale context so drawing code uses logical coordinates
    ctx.scale(this.dpr, this.dpr);

    // 2. Grid container with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = COLORS.GridBackground;
    this.roundRectOffscreen(ctx, this.containerX, this.containerY, this.containerWidth, this.containerHeight, GRID_CONTAINER_RADIUS);
    ctx.fill();
    ctx.restore();

    // Container border
    ctx.strokeStyle = darken(COLORS.GridBackground, 15);
    ctx.lineWidth = 2;
    this.roundRectOffscreen(ctx, this.containerX, this.containerY, this.containerWidth, this.containerHeight, GRID_CONTAINER_RADIUS);
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRectOffscreen(ctx, this.containerX + 1, this.containerY + 1, this.containerWidth - 2, this.containerHeight - 2, GRID_CONTAINER_RADIUS - 1);
    ctx.stroke();

    // 3. Grid lines (empty cells)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const screenX = this.gridOriginX + x * CELL_SIZE;
        const screenY = this.gridOriginY + y * CELL_SIZE;
        ctx.strokeRect(screenX + 0.5, screenY + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }

  // Helper for roundRect on offscreen canvas
  private roundRectOffscreen(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Clear the canvas with gradient only (for home screen, game over)
  // OPTIMIZED: Uses pre-rendered offscreen canvas
  public clearGradientOnly(): void {
    if (!this.gradientCache) {
      this.initializeGradientCache();
    }
    // Draw physical-resolution cache to logical coordinates (DPR transform handles scaling)
    this.ctx.drawImage(this.gradientCache!, 0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Clear the canvas with full cached background (gradient + grid container + grid lines)
  // OPTIMIZED: Uses pre-rendered offscreen canvas instead of re-creating gradient
  public clear(): void {
    // Initialize cache on first call
    if (!this.backgroundCache) {
      this.initializeBackgroundCache();
    }

    // Draw physical-resolution cache to logical coordinates (DPR transform handles scaling)
    this.ctx.drawImage(this.backgroundCache!, 0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Invalidate cached backgrounds (call when DPR changes, e.g., on resize)
  public invalidateCaches(): void {
    this.gradientCache = null;
    this.backgroundCache = null;
  }

  // Render the complete game state
  // OPTIMIZED: Background (gradient, container, grid lines) is now cached
  public render(state: RenderState): void {
    // Draw cached background (gradient + container + grid lines) - single drawImage
    this.clear();
    // renderGridContainer() and renderGrid() are now part of cached background
    this.renderScore(state.score, state.highScore, state.comboStreak, state.heartPulsePhase);
    this.renderHighlights(state.highlightedCells, state.highlightedPositions);
    this.renderGridBlocks(state.grid, state.highlightedPositions, state.animatingCells);
    this.renderDropArea(state.dropBlocks, state.dragState);
    this.renderDragPreview(state.dragState);
  }

  // Render the grid container with rounded corners and border
  private renderGridContainer(): void {
    const ctx = this.ctx;

    // Container shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Container background
    ctx.fillStyle = COLORS.GridBackground;
    this.roundRect(
      this.containerX,
      this.containerY,
      this.containerWidth,
      this.containerHeight,
      GRID_CONTAINER_RADIUS
    );
    ctx.fill();
    ctx.restore();

    // Container border (subtle darker outline)
    ctx.strokeStyle = darken(COLORS.GridBackground, 15);
    ctx.lineWidth = 2;
    this.roundRect(
      this.containerX,
      this.containerY,
      this.containerWidth,
      this.containerHeight,
      GRID_CONTAINER_RADIUS
    );
    ctx.stroke();

    // Inner highlight (top edge)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRect(
      this.containerX + 1,
      this.containerY + 1,
      this.containerWidth - 2,
      this.containerHeight - 2,
      GRID_CONTAINER_RADIUS - 1
    );
    ctx.stroke();
  }

  // Render score display - new layout matching target design
  private renderScore(score: number, highScore: number, comboStreak: number, heartPulsePhase: number): void {
    const ctx = this.ctx;
    const crownSize = 22;
    const gap = 8;

    // === TOP-LEFT: High Score with Crown ===
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const highScoreX = 30;
    const highScoreY = 45;

    // Draw crown icon
    this.renderCrown(highScoreX, highScoreY - crownSize / 2, crownSize);

    // High score value (after crown)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.Gold;
    ctx.font = 'bold 28px Montserrat, Inter, sans-serif';
    ctx.fillText(highScore.toLocaleString(), highScoreX + crownSize + gap, highScoreY);
    ctx.restore();

    // === COMBO HEART (behind score) ===
    this.renderComboHeart(comboStreak, heartPulsePhase);

    // === CENTER: Current Score (large) ===
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 56px Montserrat, Inter, sans-serif';
    ctx.fillText(score.toLocaleString(), VIEWPORT_WIDTH / 2, 100);
    ctx.restore();
  }

  // Render a crown icon using PNG image
  private renderCrown(x: number, y: number, size: number): void {
    if (this.crownImage) {
      // Draw the crown image scaled to the requested size
      this.ctx.drawImage(this.crownImage, x, y, size, size);
    }
  }

  // Combo heart color tiers (10 tiers, changes every 3 combos)
  private static readonly HEART_COLORS = [
    '#FF69B4',  // Tier 0 (combo 1-3):   Pink
    '#FF1493',  // Tier 1 (combo 4-6):   Hot pink
    '#FF0000',  // Tier 2 (combo 7-9):   Red
    '#FF4500',  // Tier 3 (combo 10-12): Orange-red
    '#FF8C00',  // Tier 4 (combo 13-15): Orange
    '#FFD700',  // Tier 5 (combo 16-18): Gold
    '#FFFF00',  // Tier 6 (combo 19-21): Yellow
    '#ADFF2F',  // Tier 7 (combo 22-24): Lime
    '#FFFFFF',  // Tier 8 (combo 25-27): White/Glow
    '#FFFFFF',  // Tier 9 (combo 28+):   White/Glow
  ];

  // Pulse speed multipliers per tier (30% faster than previous)
  private static readonly HEART_PULSE_SPEEDS = [
    0.26, 0.31, 0.36, 0.42, 0.47, 0.52, 0.57, 0.62, 0.68, 0.78
  ];

  // Render combo heart with color tinting behind the score
  private renderComboHeart(comboStreak: number, pulsePhase: number): void {
    if (!this.heartImage || comboStreak < 1) return;

    const ctx = this.ctx;
    const heartSize = 96;  // 20% bigger than original 80
    const centerX = VIEWPORT_WIDTH / 2;
    const centerY = 100;  // Same Y as score

    // Calculate tier (0-9) based on combo streak
    const tier = Math.min(9, Math.floor((comboStreak - 1) / 3));
    const tintColor = Renderer.HEART_COLORS[tier];

    // Calculate pulse scale (0.92 to 1.15) - min is 20% smaller than max
    const pulseScale = 1.035 + Math.sin(pulsePhase) * 0.115;
    const scaledSize = heartSize * pulseScale;

    // Position centered
    const x = centerX - scaledSize / 2;
    const y = centerY - scaledSize / 2;

    ctx.save();

    // Use pre-allocated offscreen canvas (no size check, fixed at max size)
    const offCtx = this.heartTintCanvas.getContext('2d')!;
    offCtx.clearRect(0, 0, this.heartTintCanvasSize, this.heartTintCanvasSize);
    offCtx.scale(this.dpr, this.dpr);

    // Draw heart at full opacity
    offCtx.drawImage(this.heartImage, 0, 0, scaledSize, scaledSize);

    // Apply color tint using source-atop (single fill, no second drawImage needed)
    offCtx.globalCompositeOperation = 'source-atop';
    offCtx.fillStyle = tintColor;
    offCtx.fillRect(0, 0, scaledSize, scaledSize);

    // Reset for next use
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw the tinted heart to main canvas with slight transparency
    ctx.globalAlpha = 0.7;
    ctx.drawImage(
      this.heartTintCanvas,
      0, 0, scaledSize * this.dpr, scaledSize * this.dpr,  // Source: only the heart portion
      x, y, scaledSize, scaledSize
    );
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // Get pulse speed multiplier for a combo streak
  public static getHeartPulseSpeed(comboStreak: number): number {
    if (comboStreak < 1) return 1.0;
    const tier = Math.min(9, Math.floor((comboStreak - 1) / 3));
    return Renderer.HEART_PULSE_SPEEDS[tier];
  }

  // Render the grid background
  private renderGrid(grid: Grid): void {
    const size = grid.getSize();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const screenX = this.gridOriginX + x * CELL_SIZE;
        const screenY = this.gridOriginY + y * CELL_SIZE;

        // Draw cell background
        this.renderEmptyCell(screenX, screenY, CELL_SIZE);
      }
    }
  }

  // Render an empty cell (very subtle grid lines only)
  private renderEmptyCell(x: number, y: number, size: number): void {
    // Very subtle grid lines only - no filled rectangles
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  // Render highlighted cells (lines that would complete)
  private renderHighlights(cells: HighlightedCell[], positionsSet: Set<string>): void {
    if (cells.length === 0) return;

    // Check if this is a combo (3+ lines worth of cells, roughly 24+ cells for 3 lines)
    const isCombo = cells.some(c => c.isCombo);

    // Render combo glow background first (behind blocks)
    if (isCombo) {
      this.renderComboGlow(cells);
    }

    // Render highlighted blocks
    for (const cell of cells) {
      const screenX = this.gridOriginX + cell.x * CELL_SIZE;
      const screenY = this.gridOriginY + cell.y * CELL_SIZE;

      if (cell.isEmpty) {
        // Empty cells get a subtle colored fill (50% of normal opacity)
        this.renderEmptyCellHighlight(screenX, screenY, cell.color, cell.isCombo);
      } else {
        // Occupied cells render as full blocks
        const opacity = cell.isCombo ? HIGHLIGHT.comboOpacity : HIGHLIGHT.normalOpacity;
        this.renderBlock(screenX, screenY, CELL_SIZE, cell.color, opacity);
      }
    }

    // Render destruction borders on top - pass cached Set to avoid re-creating it
    this.renderDestructionBorders(cells, positionsSet, isCombo);
  }

  // Render golden glow behind cells for 3+ line combos
  private renderComboGlow(cells: HighlightedCell[]): void {
    const ctx = this.ctx;
    ctx.save();

    for (const cell of cells) {
      const screenX = this.gridOriginX + cell.x * CELL_SIZE;
      const screenY = this.gridOriginY + cell.y * CELL_SIZE;
      const padding = 3;

      // Golden glow background
      ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.2)';
      ctx.shadowBlur = 8;
      this.roundRect(
        screenX - padding,
        screenY - padding,
        CELL_SIZE + padding * 2,
        CELL_SIZE + padding * 2,
        8
      );
      ctx.fill();
    }

    ctx.restore();
  }

  // Render highlight for empty cells (50% opacity colored rectangle)
  private renderEmptyCellHighlight(x: number, y: number, color: BlockColor, isCombo: boolean): void {
    const ctx = this.ctx;
    const padding = 2;
    const innerSize = CELL_SIZE - padding * 2;
    const radius = 6;

    // Calculate opacity (50% of normal highlight)
    const baseOpacity = isCombo ? HIGHLIGHT.comboOpacity : HIGHLIGHT.normalOpacity;
    const opacity = baseOpacity * HIGHLIGHT.emptyCellMultiplier;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Fill with block color
    ctx.fillStyle = COLORS[color];
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.fill();

    // Subtle inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    this.roundRect(x + padding + 1, y + padding + 1, innerSize - 2, innerSize - 2, radius - 1);
    ctx.stroke();

    ctx.restore();
  }

  // Render glowing borders around cells that will be cleared
  // OPTIMIZED: Uses pre-cached Set and batches all border lines into single path
  private renderDestructionBorders(cells: HighlightedCell[], cellSet: Set<string>, isCombo: boolean): void {
    if (cells.length === 0) return;

    const ctx = this.ctx;
    // cellSet is now pre-computed in DragDropManager - no allocation here

    // Get border color based on combo state
    const borderColor = isCombo ? COLORS.Gold : cells[0]?.color ? COLORS[cells[0].color] : COLORS.Gold;

    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 4;

    // Batch all border lines into a single path for better performance
    ctx.beginPath();

    // Draw borders only on outer edges
    for (const cell of cells) {
      const screenX = this.gridOriginX + cell.x * CELL_SIZE;
      const screenY = this.gridOriginY + cell.y * CELL_SIZE;
      const padding = 2;

      // Check each edge - draw border if neighbor is not in the set
      // Top edge
      if (!cellSet.has(`${cell.x},${cell.y - 1}`)) {
        ctx.moveTo(screenX + padding, screenY + padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + padding);
      }

      // Bottom edge
      if (!cellSet.has(`${cell.x},${cell.y + 1}`)) {
        ctx.moveTo(screenX + padding, screenY + CELL_SIZE - padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + CELL_SIZE - padding);
      }

      // Left edge
      if (!cellSet.has(`${cell.x - 1},${cell.y}`)) {
        ctx.moveTo(screenX + padding, screenY + padding);
        ctx.lineTo(screenX + padding, screenY + CELL_SIZE - padding);
      }

      // Right edge
      if (!cellSet.has(`${cell.x + 1},${cell.y}`)) {
        ctx.moveTo(screenX + CELL_SIZE - padding, screenY + padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + CELL_SIZE - padding);
      }
    }

    // Single stroke call for all borders
    ctx.stroke();
    ctx.restore();
  }

  // Render blocks placed on the grid
  private renderGridBlocks(
    grid: Grid,
    highlightedPositions: Set<string> = new Set(),
    animatingCells: HasMethod = new Set()
  ): void {
    // highlightedPositions is now pre-computed and cached in DragDropManager
    // This avoids creating a new Set + array.map() every frame

    grid.forEachCell((x, y, cell) => {
      const key = `${x},${y}`;

      // Skip cells that are highlighted - they're already rendered with the dragged block's color
      if (highlightedPositions.has(key)) {
        return;
      }

      // Skip cells that are animating - they're rendered separately in renderAnimatingCells
      if (animatingCells.has(key)) {
        return;
      }

      if (cell.occupied && cell.color) {
        const screenX = this.gridOriginX + x * CELL_SIZE;
        const screenY = this.gridOriginY + y * CELL_SIZE;
        this.renderBlock(screenX, screenY, CELL_SIZE, cell.color, 1.0);
      }
    });
  }

  // Render a single block with dark border for solid connected look
  // OPTIMIZED: Uses pre-rendered sprites for standard sizes (56px, 28px, 16px)
  public renderBlock(x: number, y: number, size: number, color: BlockColor, opacity: number = 1.0): void {
    // Try to use cached sprite first (1 drawImage vs 5 fill operations)
    if (this.blockSpriteCache.drawBlock(this.ctx, x, y, size, color, opacity)) {
      return;
    }

    // Fallback to direct rendering for non-standard sizes (e.g., scaled animations)
    this.renderBlockDirect(x, y, size, color, opacity);
  }

  // Direct block rendering for non-standard sizes (not cached)
  private renderBlockDirect(x: number, y: number, size: number, color: BlockColor, opacity: number): void {
    const colorHex = COLORS[color];
    const borderWidth = 1;               // Dark border width
    const radius = 2;                    // Nearly square corners
    const bevelWidth = size * 0.08;      // Bevel edge width
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = opacity;

    // 1. DARK BORDER (fills entire cell, creates connected look)
    ctx.fillStyle = darken(colorHex, 45);
    this.roundRect(x, y, size, size, radius);
    ctx.fill();

    // Inner block area (inside the border)
    const innerX = x + borderWidth;
    const innerY = y + borderWidth;
    const innerSize = size - borderWidth * 2;

    // 2. BASE LAYER for bevel (bottom-right shadow)
    ctx.fillStyle = darken(colorHex, 25);
    this.roundRect(innerX, innerY, innerSize, innerSize, Math.max(0, radius - 1));
    ctx.fill();

    // 3. TOP-LEFT HIGHLIGHT (bright bevel edge)
    ctx.fillStyle = lighten(colorHex, 30);
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(innerX + innerSize, innerY);
    ctx.lineTo(innerX + innerSize - bevelWidth, innerY + bevelWidth);
    ctx.lineTo(innerX + bevelWidth, innerY + bevelWidth);
    ctx.lineTo(innerX + bevelWidth, innerY + innerSize - bevelWidth);
    ctx.lineTo(innerX, innerY + innerSize);
    ctx.closePath();
    ctx.fill();

    // 4. FLAT CENTER (main block color)
    ctx.fillStyle = colorHex;
    this.roundRect(
      innerX + bevelWidth,
      innerY + bevelWidth,
      innerSize - bevelWidth * 2,
      innerSize - bevelWidth * 2,
      0
    );
    ctx.fill();

    // 5. Subtle top shine
    const shineHeight = (innerSize - bevelWidth * 2) * 0.25;
    const shineGradient = ctx.createLinearGradient(
      innerX + bevelWidth, innerY + bevelWidth,
      innerX + bevelWidth, innerY + bevelWidth + shineHeight
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGradient;
    ctx.fillRect(
      innerX + bevelWidth,
      innerY + bevelWidth,
      innerSize - bevelWidth * 2,
      shineHeight
    );

    ctx.restore();
  }

  // Render the drop area with 3 block slots
  private renderDropArea(blocks: (Block | null)[], dragState: DragState | null): void {
    const slotWidth = VIEWPORT_WIDTH / 3;

    for (let i = 0; i < 3; i++) {
      const block = blocks[i];
      const slotCenterX = slotWidth * i + slotWidth / 2;

      // Skip if this block is being dragged
      if (dragState && block && dragState.block.id === block.id) {
        continue;
      }

      if (block) {
        this.renderDropBlock(block, slotCenterX, this.dropAreaY);
      }
    }
  }

  // Render a block in the drop area
  private renderDropBlock(block: Block, centerX: number, topY: number): void {
    const bounds = getShapeBounds(block.shape);
    const blockWidth = bounds.width * CELL_SIZE_DROP;
    const blockHeight = bounds.height * CELL_SIZE_DROP;

    const startX = centerX - blockWidth / 2;
    const startY = topY;

    for (const [dx, dy] of block.shape.cells) {
      // Normalize coordinates by subtracting minX/minY
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = startX + normalizedX * CELL_SIZE_DROP;
      const y = startY + normalizedY * CELL_SIZE_DROP;
      this.renderBlock(x, y, CELL_SIZE_DROP, block.color, 1.0);
    }
  }

  // Get drop block bounds for hit testing
  public getDropBlockBounds(block: Block, slotIndex: number): { x: number; y: number; width: number; height: number } {
    const slotWidth = VIEWPORT_WIDTH / 3;
    const slotCenterX = slotWidth * slotIndex + slotWidth / 2;

    const bounds = getShapeBounds(block.shape);
    const blockWidth = bounds.width * CELL_SIZE_DROP;
    const blockHeight = bounds.height * CELL_SIZE_DROP;

    return {
      x: slotCenterX - blockWidth / 2,
      y: this.dropAreaY,
      width: blockWidth,
      height: blockHeight,
    };
  }

  // Render drag preview (shadow on grid + floating block)
  private renderDragPreview(dragState: DragState | null): void {
    if (!dragState) return;

    const { block, screenPosition, gridPosition, isValidPlacement } = dragState;
    const bounds = getShapeBounds(block.shape);

    // Render shadow on grid if valid position
    if (gridPosition && isValidPlacement) {
      this.ctx.globalAlpha = HIGHLIGHT.shadowOpacity;
      for (const [dx, dy] of block.shape.cells) {
        // Normalize coordinates by subtracting minX/minY
        const normalizedX = dx - bounds.minX;
        const normalizedY = dy - bounds.minY;
        const x = this.gridOriginX + (gridPosition.x + normalizedX) * CELL_SIZE;
        const y = this.gridOriginY + (gridPosition.y + normalizedY) * CELL_SIZE;
        this.renderBlock(x, y, CELL_SIZE, block.color, 0.5);
      }
      this.ctx.globalAlpha = 1.0;
    }

    // Render floating block at its position
    // screenPosition is the TOP-LEFT of the block (matching Godot's dragging_visual.global_position)
    // Add slight scale and shadow for "lifted" effect
    this.ctx.save();

    for (const [dx, dy] of block.shape.cells) {
      // Normalize coordinates by subtracting minX/minY
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = screenPosition.x + normalizedX * CELL_SIZE;
      const y = screenPosition.y + normalizedY * CELL_SIZE;
      this.renderBlock(x, y, CELL_SIZE, block.color, isValidPlacement ? 1.0 : 0.6);
    }

    this.ctx.restore();
  }

  // Render combo notification with premium 6-layer 3D text effect
  public renderComboNotification(
    comboNumber: number,
    x: number,
    y: number,
    scale: number = 1.0,
    opacity: number = 1.0,
    starburstScale: number = 1.0,
    rotation: number = 0
  ): void {
    if (comboNumber < 2) return;

    // Calculate actual number center position (accounts for text widths and gap)
    const numberCenterX = getNumberCenterX('Combo', comboNumber, x, COMBO_NOTIFICATION.COMBO_FONT_SIZE);

    // Draw starburst BEHIND the NUMBER at its actual center
    this.drawStarburst(numberCenterX, y, starburstScale, opacity, rotation);

    // Draw text on top using 6-layer ComboSign renderer
    drawComboSign(this.ctx, {
      comboText: 'Combo',
      value: comboNumber,
      centerX: x,
      centerY: y,
      baseFontSize: COMBO_NOTIFICATION.COMBO_FONT_SIZE,
      wordColorScheme: DEFAULT_WORD_COLORS,
      numberColorScheme: DEFAULT_NUMBER_COLORS,
      scale,
      opacity,
    });
  }

  /**
   * Pre-render starburst to OffscreenCanvas with StackBlur applied.
   * Cached for performance - blur is applied once, not every frame.
   */
  private initializeStarburstCache(): void {
    if (this.starburstCache) return;

    const rays = COMBO_NOTIFICATION.STARBURST_RAYS;
    const coreRadius = COMBO_NOTIFICATION.STARBURST_CORE_RADIUS;
    const haloRadius = COMBO_NOTIFICATION.STARBURST_HALO_RADIUS;
    const outerRadius = COMBO_NOTIFICATION.STARBURST_OUTER_RADIUS;
    const innerRadius = COMBO_NOTIFICATION.STARBURST_INNER_RADIUS;

    // Canvas size with padding for blur spread
    const blurPadding = 20;
    const maxRadius = Math.max(haloRadius, outerRadius * 1.35); // Account for hero rays
    const size = (maxRadius + blurPadding) * 2;
    this.starburstSize = size;

    const physicalSize = Math.ceil(size * this.dpr);
    const canvas = new OffscreenCanvas(physicalSize, physicalSize);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);

    // Center point
    const cx = size / 2;
    const cy = size / 2;

    ctx.translate(cx, cy);

    // Use additive blending for all glow layers
    ctx.globalCompositeOperation = 'lighter';

    // LAYER 1: Outer golden halo
    const haloGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
    haloGradient.addColorStop(0, `rgba(255, 220, 100, ${COMBO_NOTIFICATION.STARBURST_HALO_OPACITY})`);
    haloGradient.addColorStop(0.4, `rgba(255, 220, 100, ${COMBO_NOTIFICATION.STARBURST_HALO_OPACITY * 0.4})`);
    haloGradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(0, 0, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // LAYER 2: Rays with variation (no rotation - will be applied at draw time)
    const seed = 42;
    let randomState = seed;
    const seededRandom = (): number => {
      randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
      return randomState / 0x7fffffff;
    };

    const heroCount = COMBO_NOTIFICATION.STARBURST_HERO_RAYS;
    const heroIndices = new Set<number>();
    for (let i = 0; i < heroCount; i++) {
      heroIndices.add(Math.floor(seededRandom() * rays * 2));
    }

    const lengthVar = COMBO_NOTIFICATION.STARBURST_RAY_LENGTH_VAR;
    const opacityVar = COMBO_NOTIFICATION.STARBURST_RAY_OPACITY_VAR;
    const baseRayOpacity = COMBO_NOTIFICATION.STARBURST_RAY_OPACITY;

    for (let i = 0; i < rays * 2; i++) {
      const isHero = heroIndices.has(i);
      const isLong = i % 2 === 0;

      const baseAngle = (i * Math.PI) / rays;
      const angleOffset = (seededRandom() - 0.5) * 0.15;
      const angle = baseAngle + angleOffset;

      const baseLengthMult = isLong ? 1.0 : 0.55;
      const lengthMult = baseLengthMult + (seededRandom() - 0.5) * 2 * lengthVar;
      const rayLength = outerRadius * (isHero ? lengthMult * 1.35 : lengthMult);

      let rayOpacity = baseRayOpacity + (seededRandom() - 0.5) * 2 * opacityVar;
      rayOpacity = isHero ? Math.min(rayOpacity * 1.4, 0.85) : rayOpacity;
      rayOpacity = Math.max(0.2, Math.min(0.85, rayOpacity));

      const rayWidth = isLong ? 0.18 : 0.10;
      const finalWidth = isHero ? rayWidth * 1.3 : rayWidth;

      const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, rayLength);
      gradient.addColorStop(0, `rgba(255, 235, 150, ${rayOpacity})`);
      gradient.addColorStop(0.4, `rgba(255, 235, 150, ${rayOpacity * 0.5})`);
      gradient.addColorStop(0.7, `rgba(255, 235, 150, ${rayOpacity * 0.15})`);
      gradient.addColorStop(1, 'rgba(255, 235, 150, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle - finalWidth) * innerRadius,
        Math.sin(angle - finalWidth) * innerRadius
      );
      ctx.lineTo(
        Math.cos(angle) * rayLength,
        Math.sin(angle) * rayLength
      );
      ctx.lineTo(
        Math.cos(angle + finalWidth) * innerRadius,
        Math.sin(angle + finalWidth) * innerRadius
      );
      ctx.closePath();
      ctx.fill();
    }

    // LAYER 3: Bright core bloom
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${COMBO_NOTIFICATION.STARBURST_CORE_OPACITY})`);
    coreGradient.addColorStop(0.35, `rgba(255, 255, 255, 0.5)`);
    coreGradient.addColorStop(0.7, `rgba(255, 255, 255, 0.15)`);
    coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // Apply StackBlur for soft dreamy effect (works on all browsers including Safari!)
    const blurRadius = Math.round(6 * this.dpr);
    const imageData = ctx.getImageData(0, 0, physicalSize, physicalSize);
    imageDataRGBA(imageData, 0, 0, physicalSize, physicalSize, blurRadius);
    ctx.putImageData(imageData, 0, 0);

    this.starburstCache = canvas;
  }

  // Draw starburst from cached texture with transforms
  /**
   * Pre-initialize starburst cache during game init (avoids first-combo spike)
   */
  public prewarmStarburstCache(): void {
    this.initializeStarburstCache();
  }

  private drawStarburst(x: number, y: number, pulseScale: number, opacity: number = 1, rotation: number = 0): void {
    // Initialize cache on first use (fallback if prewarm wasn't called)
    if (!this.starburstCache) {
      this.initializeStarburstCache();
    }

    const ctx = this.ctx;
    const offsetY = COMBO_NOTIFICATION.STARBURST_GLOW_OFFSET_Y;
    const glowY = y + offsetY;
    const size = this.starburstSize;

    ctx.save();

    // Position at glow center
    ctx.translate(x, glowY);
    // Apply rotation
    ctx.rotate(rotation);
    // Apply pulse scale
    ctx.scale(pulseScale, pulseScale);
    // Apply opacity
    ctx.globalAlpha = opacity;
    // Use additive blending for glow effect
    ctx.globalCompositeOperation = 'lighter';

    // Draw cached starburst centered at origin
    ctx.drawImage(
      this.starburstCache!,
      -size / 2, -size / 2,
      size, size
    );

    ctx.restore();
  }

  // Draw styled text with 3-layer system: stroke -> fill -> highlight
  private drawStyledText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fillColor: string | { top: string; bottom: string },
    strokeColor: string,
    highlightColor: string,
    strokeWidth: number = COMBO_NOTIFICATION.STROKE_WIDTH,
    fontFamily: string = getComboFontFamily()
  ): void {
    const ctx = this.ctx;

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // LAYER 1: Dark blue outer stroke (creates border/depth)
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);

    // LAYER 2: Main color fill (cyan for Combo, gold gradient for number)
    if (typeof fillColor === 'object') {
      const gradient = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      gradient.addColorStop(0, fillColor.top);
      gradient.addColorStop(1, fillColor.bottom);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = fillColor;
    }
    ctx.fillText(text, x, y);

    // LAYER 3: White/light inner highlight (glossy shine on top portion)
    const highlightGradient = ctx.createLinearGradient(
      x, y - fontSize / 2,      // Start at top of text
      x, y + fontSize / 6       // Fade out ~1/3 down
    );
    highlightGradient.addColorStop(0, highlightColor);
    highlightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGradient;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  // Helper: Draw rounded rectangle path
  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  // Render home screen
  public renderHomeScreen(highScore: number): void {
    const ctx = this.ctx;
    this.clearGradientOnly();  // Use gradient only - no gameplay grid

    // Fixed layout positions (image has empty space, so don't calculate from dimensions)
    const badgeHeight = HOME_SCREEN.BADGE_PADDING_Y * 2 + 24;  // ~44px
    const badgeY = 370;  // Fixed position above grid (grid at 430)

    // Title header image
    if (this.headerImage) {
      const imgWidth = 600;  // Header image width
      const imgHeight = (this.headerImage.height / this.headerImage.width) * imgWidth;
      const imgX = (VIEWPORT_WIDTH - imgWidth) / 2;
      const imgY = 0;  // Fixed position from top
      ctx.drawImage(this.headerImage, imgX, imgY, imgWidth, imgHeight);
    }

    // High score badge
    if (highScore > 0) {
      ctx.save();
      ctx.font = `bold 22px Montserrat, Inter, sans-serif`;
      const scoreText = highScore.toLocaleString();
      const textWidth = ctx.measureText(scoreText).width;
      const crownSize = 22;
      const gap = 8;

      const badgeWidth = HOME_SCREEN.BADGE_PADDING_X * 2 + crownSize + gap + textWidth;
      const badgeX = (VIEWPORT_WIDTH - badgeWidth) / 2;

      // Badge background
      ctx.fillStyle = HOME_SCREEN.BADGE_BG;
      this.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, HOME_SCREEN.BADGE_RADIUS);
      ctx.fill();

      // Crown and score inside badge
      const contentX = badgeX + HOME_SCREEN.BADGE_PADDING_X;
      const contentY = badgeY + badgeHeight / 2;
      this.renderCrown(contentX, contentY - crownSize / 2, crownSize);

      ctx.fillStyle = COLORS.Gold;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, contentX + crownSize + gap, contentY);
      ctx.restore();
    }

    // Preview grid with container
    this.renderGridPreviewContainer();

    // START button
    const buttonX = (VIEWPORT_WIDTH - HOME_SCREEN.BUTTON_WIDTH) / 2;
    const buttonY = 820;

    // Button gradient fill
    const btnGradient = ctx.createLinearGradient(
      buttonX,
      buttonY,
      buttonX,
      buttonY + HOME_SCREEN.BUTTON_HEIGHT
    );
    btnGradient.addColorStop(0, HOME_SCREEN.BUTTON_GRADIENT_TOP);
    btnGradient.addColorStop(1, HOME_SCREEN.BUTTON_GRADIENT_BOTTOM);

    // Draw button shape
    ctx.save();
    this.roundRect(
      buttonX,
      buttonY,
      HOME_SCREEN.BUTTON_WIDTH,
      HOME_SCREEN.BUTTON_HEIGHT,
      HOME_SCREEN.BUTTON_RADIUS
    );
    ctx.fillStyle = btnGradient;
    ctx.fill();

    // Button border
    ctx.strokeStyle = HOME_SCREEN.BUTTON_STROKE_COLOR;
    ctx.lineWidth = HOME_SCREEN.BUTTON_STROKE_WIDTH;
    ctx.stroke();

    // Button text "START"
    ctx.font = `bold ${HOME_SCREEN.BUTTON_FONT_SIZE}px Montserrat, Inter, sans-serif`;
    ctx.fillStyle = HOME_SCREEN.BUTTON_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', VIEWPORT_WIDTH / 2, buttonY + HOME_SCREEN.BUTTON_HEIGHT / 2);
    ctx.restore();
  }

  // Render preview grid with container for home screen
  private renderGridPreviewContainer(): void {
    const ctx = this.ctx;
    const previewSize = 6;
    const previewCellSize = 40;
    const containerPadding = 12;
    const containerWidth = previewSize * previewCellSize + containerPadding * 2;
    const containerHeight = previewSize * previewCellSize + containerPadding * 2;
    const containerX = (VIEWPORT_WIDTH - containerWidth) / 2;
    const containerY = 430;

    // Container shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Container background
    ctx.fillStyle = COLORS.GridBackground;
    this.roundRect(containerX, containerY, containerWidth, containerHeight, 14);
    ctx.fill();
    ctx.restore();

    // Container border
    ctx.strokeStyle = darken(COLORS.GridBackground, 12);
    ctx.lineWidth = 2;
    this.roundRect(containerX, containerY, containerWidth, containerHeight, 14);
    ctx.stroke();

    // Render grid inside container
    const startX = containerX + containerPadding;
    const startY = containerY + containerPadding;

    // Draw empty cells
    for (let y = 0; y < previewSize; y++) {
      for (let x = 0; x < previewSize; x++) {
        const screenX = startX + x * previewCellSize;
        const screenY = startY + y * previewCellSize;
        this.renderEmptyCell(screenX, screenY, previewCellSize);
      }
    }

    // Add some sample blocks for visual interest
    const sampleBlocks: { x: number; y: number; color: BlockColor }[] = [
      { x: 1, y: 4, color: 'Red' },
      { x: 2, y: 4, color: 'Red' },
      { x: 3, y: 4, color: 'Red' },
      { x: 2, y: 3, color: 'Red' },
      { x: 0, y: 5, color: 'Blue' },
      { x: 1, y: 5, color: 'Blue' },
      { x: 2, y: 5, color: 'Green' },
      { x: 3, y: 5, color: 'Green' },
      { x: 4, y: 5, color: 'Green' },
      { x: 5, y: 5, color: 'Yellow' },
      { x: 4, y: 4, color: 'Yellow' },
      { x: 5, y: 4, color: 'Yellow' },
    ];

    for (const { x, y, color } of sampleBlocks) {
      const screenX = startX + x * previewCellSize;
      const screenY = startY + y * previewCellSize;
      this.renderBlock(screenX, screenY, previewCellSize, color, 0.9);
    }
  }

  // Render a preview grid for home screen
  private renderGridPreview(): void {
    const previewSize = 6;
    const previewCellSize = 40;
    const startX = (VIEWPORT_WIDTH - previewSize * previewCellSize) / 2;
    const startY = 400;

    // Draw empty cells
    for (let y = 0; y < previewSize; y++) {
      for (let x = 0; x < previewSize; x++) {
        const screenX = startX + x * previewCellSize;
        const screenY = startY + y * previewCellSize;
        this.renderEmptyCell(screenX, screenY, previewCellSize);
      }
    }

    // Add some sample blocks for visual interest
    const sampleBlocks: { x: number; y: number; color: BlockColor }[] = [
      { x: 1, y: 4, color: 'Red' },
      { x: 2, y: 4, color: 'Red' },
      { x: 3, y: 4, color: 'Red' },
      { x: 2, y: 3, color: 'Red' },
      { x: 0, y: 5, color: 'Blue' },
      { x: 1, y: 5, color: 'Blue' },
      { x: 2, y: 5, color: 'Green' },
      { x: 3, y: 5, color: 'Green' },
      { x: 4, y: 5, color: 'Green' },
      { x: 5, y: 5, color: 'Yellow' },
      { x: 4, y: 4, color: 'Yellow' },
      { x: 5, y: 4, color: 'Yellow' },
    ];

    for (const { x, y, color } of sampleBlocks) {
      const screenX = startX + x * previewCellSize;
      const screenY = startY + y * previewCellSize;
      this.renderBlock(screenX, screenY, previewCellSize, color, 0.9);
    }
  }

  // Render game over screen
  public renderGameOver(score: number, highScore: number, isNewHighScore: boolean): void {
    const ctx = this.ctx;

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // Modal background with shadow
    const modalWidth = 420;
    const modalHeight = 380;
    const modalX = (VIEWPORT_WIDTH - modalWidth) / 2;
    const modalY = (VIEWPORT_HEIGHT - modalHeight) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = COLORS.GridBackground;
    this.roundRect(modalX, modalY, modalWidth, modalHeight, 24);
    ctx.fill();
    ctx.restore();

    // Border with inner highlight
    ctx.strokeStyle = darken(COLORS.GridBackground, 15);
    ctx.lineWidth = 2;
    this.roundRect(modalX, modalY, modalWidth, modalHeight, 24);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRect(modalX + 2, modalY + 2, modalWidth - 4, modalHeight - 4, 22);
    ctx.stroke();

    // Game Over text with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 44px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', VIEWPORT_WIDTH / 2, modalY + 65);
    ctx.restore();

    // Score with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.font = 'bold 60px Montserrat, Inter, sans-serif';
    ctx.fillStyle = isNewHighScore ? COLORS.Gold : COLORS.TextPrimary;
    ctx.fillText(score.toLocaleString(), VIEWPORT_WIDTH / 2, modalY + 150);
    ctx.restore();

    // New high score indicator with crown or best score - properly centered
    if (isNewHighScore) {
      const crownSize = 24;
      const gap = 10;
      const highScoreText = 'NEW HIGH SCORE!';
      ctx.font = 'bold 22px Montserrat, Inter, sans-serif';
      const textWidth = ctx.measureText(highScoreText).width;
      const totalWidth = crownSize + gap + textWidth;
      const startX = VIEWPORT_WIDTH / 2 - totalWidth / 2;

      this.renderCrown(startX, modalY + 193, crownSize);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = COLORS.Gold;
      ctx.textAlign = 'left';
      ctx.fillText(highScoreText, startX + crownSize + gap, modalY + 208);
      ctx.restore();
    } else {
      const crownSize = 20;
      const gap = 8;
      const bestText = `Best: ${highScore.toLocaleString()}`;
      ctx.font = '20px Montserrat, Inter, sans-serif';
      const textWidth = ctx.measureText(bestText).width;
      const totalWidth = crownSize + gap + textWidth;
      const startX = VIEWPORT_WIDTH / 2 - totalWidth / 2;

      this.renderCrown(startX, modalY + 193, crownSize);

      ctx.fillStyle = COLORS.TextSecondary;
      ctx.textAlign = 'left';
      ctx.fillText(bestText, startX + crownSize + gap, modalY + 208);
    }

    // Play again button with gradient and shadow
    const buttonY = modalY + 285;
    const buttonWidth = 220;
    const buttonHeight = 56;
    const buttonX = (VIEWPORT_WIDTH - buttonWidth) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Button gradient
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    buttonGradient.addColorStop(0, lighten(COLORS.Green, 10));
    buttonGradient.addColorStop(1, darken(COLORS.Green, 10));

    ctx.fillStyle = buttonGradient;
    this.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 14);
    ctx.fill();
    ctx.restore();

    // Button border
    ctx.strokeStyle = lighten(COLORS.Green, 20);
    ctx.lineWidth = 1;
    this.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 14);
    ctx.stroke();

    // Button text
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 24px Montserrat, Inter, sans-serif';
    ctx.fillText('PLAY AGAIN', VIEWPORT_WIDTH / 2, buttonY + buttonHeight / 2);
    ctx.restore();
  }

  // Get play again button bounds for hit testing (for game over screen)
  public getPlayAgainButtonBounds(): { x: number; y: number; width: number; height: number } {
    const { BUTTON_WIDTH, BUTTON_HEIGHT, SCREEN_PLAY_BUTTON_Y } = GAME_OVER_LAYOUT;

    return {
      x: (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      y: SCREEN_PLAY_BUTTON_Y,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
  }

  // ========== NEW GAME OVER FLOW METHODS ==========

  // Render "No more space" overlay
  public renderNoMoreSpaceOverlay(opacity: number): void {
    const ctx = this.ctx;
    const { OVERLAY_Y_OFFSET, OVERLAY_BG_HEIGHT, OVERLAY_FONT_SIZE, OVERLAY_BG_OPACITY } = GAME_OVER_LAYOUT;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Semi-transparent background strip
    const bgY = VIEWPORT_HEIGHT / 2 + OVERLAY_Y_OFFSET - OVERLAY_BG_HEIGHT / 2;

    ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_BG_OPACITY})`;
    ctx.fillRect(0, bgY, VIEWPORT_WIDTH, OVERLAY_BG_HEIGHT);

    // Text
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = `bold ${OVERLAY_FONT_SIZE}px Montserrat, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No more space', VIEWPORT_WIDTH / 2, bgY + OVERLAY_BG_HEIGHT / 2);

    ctx.restore();
  }

  // Render continue modal with block preview
  public renderContinueModal(previewBlocks: Block[], opacity: number, scale: number): void {
    const ctx = this.ctx;
    const { MODAL_WIDTH, MODAL_HEIGHT, MODAL_RADIUS, MODAL_TITLE_FONT_SIZE, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS } = GAME_OVER_LAYOUT;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Center and scale the modal
    const modalX = (VIEWPORT_WIDTH - MODAL_WIDTH) / 2;
    const modalY = (VIEWPORT_HEIGHT - MODAL_HEIGHT) / 2;

    ctx.translate(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-VIEWPORT_WIDTH / 2, -VIEWPORT_HEIGHT / 2);

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // Modal background with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = COLORS.GridBackground;
    this.roundRect(modalX, modalY, MODAL_WIDTH, MODAL_HEIGHT, MODAL_RADIUS);
    ctx.fill();
    ctx.restore();

    // Modal border
    ctx.strokeStyle = darken(COLORS.GridBackground, 15);
    ctx.lineWidth = 2;
    this.roundRect(modalX, modalY, MODAL_WIDTH, MODAL_HEIGHT, MODAL_RADIUS);
    ctx.stroke();

    // Title "Continue?"
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = `bold ${MODAL_TITLE_FONT_SIZE}px Montserrat, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Continue?', VIEWPORT_WIDTH / 2, modalY + 50);

    // Subtitle
    ctx.fillStyle = COLORS.TextSecondary;
    ctx.font = '16px Montserrat, Inter, sans-serif';
    ctx.fillText('Watch an ad to get new blocks:', VIEWPORT_WIDTH / 2, modalY + 90);

    // Block preview
    this.renderBlockPreview(previewBlocks, modalY + 120);

    // Continue button (green)
    const continueY = modalY + MODAL_HEIGHT - 130;
    this.renderButton(
      (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      continueY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      'Continue',
      COLORS.Green
    );

    // "No, thanks" text button
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '18px Montserrat, Inter, sans-serif';
    ctx.fillText('No, thanks', VIEWPORT_WIDTH / 2, modalY + MODAL_HEIGHT - 40);

    ctx.restore();
  }

  // Render block preview (for continue modal)
  private renderBlockPreview(blocks: Block[], topY: number): void {
    const { BLOCK_PREVIEW_SIZE, BLOCK_PREVIEW_CELL_SIZE } = GAME_OVER_LAYOUT;
    const gap = 30;

    const totalWidth = blocks.length * BLOCK_PREVIEW_SIZE + (blocks.length - 1) * gap;
    let startX = (VIEWPORT_WIDTH - totalWidth) / 2;

    for (const block of blocks) {
      const bounds = getShapeBounds(block.shape);
      const blockWidth = bounds.width * BLOCK_PREVIEW_CELL_SIZE;
      const blockHeight = bounds.height * BLOCK_PREVIEW_CELL_SIZE;
      const offsetX = startX + (BLOCK_PREVIEW_SIZE - blockWidth) / 2;
      const offsetY = topY + (BLOCK_PREVIEW_SIZE - blockHeight) / 2;

      for (const [dx, dy] of block.shape.cells) {
        const x = offsetX + (dx - bounds.minX) * BLOCK_PREVIEW_CELL_SIZE;
        const y = offsetY + (dy - bounds.minY) * BLOCK_PREVIEW_CELL_SIZE;
        this.renderBlock(x, y, BLOCK_PREVIEW_CELL_SIZE, block.color, 1.0);
      }

      startX += BLOCK_PREVIEW_SIZE + gap;
    }
  }

  // Render reusable button
  private renderButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    color: string
  ): void {
    const ctx = this.ctx;
    const radius = GAME_OVER_LAYOUT.BUTTON_RADIUS;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Button gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, lighten(color, 10));
    gradient.addColorStop(1, darken(color, 10));

    ctx.fillStyle = gradient;
    this.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.restore();

    // Button border
    ctx.strokeStyle = lighten(color, 20);
    ctx.lineWidth = 1;
    this.roundRect(x, y, width, height, radius);
    ctx.stroke();

    // Button text
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 22px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);
    ctx.restore();
  }

  // Render ad placeholder
  public renderAdPlaceholder(opacity: number): void {
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Full screen dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // "Watching ad..." text
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 32px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Watching ad...', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);

    // Placeholder note
    ctx.font = '18px Montserrat, Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('(This is a placeholder)', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 50);

    ctx.restore();
  }

  // Render game over screen (full screen)
  public renderGameOverScreen(state: {
    titleY: number;
    titleOpacity: number;
    displayedScore: number;
    targetScore: number;
    bestScore: number;
    isNewHighScore: boolean;
    showNewHighScoreBadge: boolean;
    badgeScale: number;
    badgeOpacity: number;
    confetti?: Array<{ x: number; y: number; color: string; size: number; rotation: number }>;
    burstConfetti?: Array<{ x: number; y: number; color: string; size: number; rotation: number }>;
  }): void {
    const ctx = this.ctx;
    const {
      SCREEN_TITLE_FONT_SIZE,
      SCREEN_SCORE_Y,
      SCREEN_SCORE_FONT_SIZE,
      SCREEN_BEST_Y,
      SCREEN_BADGE_Y,
      SCREEN_PLAY_BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
    } = GAME_OVER_LAYOUT;

    // Blue gradient background (like reference)
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
    gradient.addColorStop(0, '#4A90C2');  // Lighter blue at top
    gradient.addColorStop(1, '#2B5278');  // Darker blue at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // Render burst confetti particles (behind everything)
    if (state.burstConfetti) {
      for (const particle of state.burstConfetti) {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();
      }
    }

    // Render falling confetti particles (behind everything)
    if (state.confetti) {
      for (const particle of state.confetti) {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();
      }
    }

    // "Game Over" title with animation (italic)
    ctx.save();
    ctx.globalAlpha = state.titleOpacity;
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = `italic bold ${SCREEN_TITLE_FONT_SIZE}px Montserrat, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add shadow to title
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillText('Game Over', VIEWPORT_WIDTH / 2, state.titleY);
    ctx.restore();

    // "Score" label
    ctx.save();
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 24px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Score', VIEWPORT_WIDTH / 2, SCREEN_SCORE_Y - 60);
    ctx.restore();

    // Score number with count-up
    ctx.save();
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = `bold ${SCREEN_SCORE_FONT_SIZE}px Montserrat, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(state.displayedScore.toLocaleString(), VIEWPORT_WIDTH / 2, SCREEN_SCORE_Y);
    ctx.restore();

    // "Best Score" label
    ctx.save();
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 24px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Best Score', VIEWPORT_WIDTH / 2, SCREEN_BEST_Y);
    ctx.restore();

    // Best score number (gold)
    ctx.save();
    ctx.fillStyle = COLORS.Gold;
    ctx.font = 'bold 48px Montserrat, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.bestScore.toLocaleString(), VIEWPORT_WIDTH / 2, SCREEN_BEST_Y + 45);
    ctx.restore();

    // New high score badge
    if (state.showNewHighScoreBadge && state.isNewHighScore) {
      ctx.save();
      ctx.globalAlpha = state.badgeOpacity;
      ctx.translate(VIEWPORT_WIDTH / 2, SCREEN_BADGE_Y);
      ctx.scale(state.badgeScale, state.badgeScale);

      // Badge background
      const badgeWidth = 220;
      const badgeHeight = 40;
      ctx.fillStyle = COLORS.Gold;
      this.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 20);
      ctx.fill();

      // Badge text
      ctx.fillStyle = '#1a2744';
      ctx.font = 'bold 18px Montserrat, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NEW HIGH SCORE!', 0, 0);

      ctx.restore();
    }

    // Play button with play icon (like reference)
    this.renderPlayButton(
      (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      SCREEN_PLAY_BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT
    );
  }

  // Render play button with play icon (for game over screen)
  private renderPlayButton(x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;
    const radius = 8;

    ctx.save();

    // Button background (green with gradient)
    const btnGradient = ctx.createLinearGradient(x, y, x, y + height);
    btnGradient.addColorStop(0, '#5CBF60');
    btnGradient.addColorStop(1, '#3DA441');
    ctx.fillStyle = btnGradient;
    this.roundRect(x, y, width, height, radius);
    ctx.fill();

    // Play icon (triangle)
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const iconSize = 18;

    ctx.fillStyle = COLORS.TextPrimary;
    ctx.beginPath();
    ctx.moveTo(centerX - iconSize / 2.5, centerY - iconSize / 2);
    ctx.lineTo(centerX - iconSize / 2.5, centerY + iconSize / 2);
    ctx.lineTo(centerX + iconSize / 2, centerY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Get continue button bounds (for continue modal)
  public getContinueButtonBounds(): { x: number; y: number; width: number; height: number } {
    const { MODAL_WIDTH, MODAL_HEIGHT, BUTTON_WIDTH, BUTTON_HEIGHT } = GAME_OVER_LAYOUT;
    const modalY = (VIEWPORT_HEIGHT - MODAL_HEIGHT) / 2;
    const buttonY = modalY + MODAL_HEIGHT - 130;

    return {
      x: (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      y: buttonY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
  }

  // Get "No, thanks" button bounds (for continue modal)
  public getNoThanksButtonBounds(): { x: number; y: number; width: number; height: number } {
    const { MODAL_WIDTH, MODAL_HEIGHT } = GAME_OVER_LAYOUT;
    const modalY = (VIEWPORT_HEIGHT - MODAL_HEIGHT) / 2;

    return {
      x: VIEWPORT_WIDTH / 2 - 60,
      y: modalY + MODAL_HEIGHT - 60,
      width: 120,
      height: 40,
    };
  }

  // Get home button bounds (for game over screen)
  public getHomeButtonBounds(): { x: number; y: number; width: number; height: number } {
    const { BUTTON_WIDTH, BUTTON_HEIGHT, SCREEN_HOME_BUTTON_Y } = GAME_OVER_LAYOUT;

    return {
      x: (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      y: SCREEN_HOME_BUTTON_Y,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
  }
}
