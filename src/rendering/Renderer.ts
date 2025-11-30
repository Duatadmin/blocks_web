// Main Renderer - Handles all canvas rendering operations

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
  }

  public getGridOrigin(): Point {
    return { x: this.gridOriginX, y: this.gridOriginY };
  }

  public getDropAreaY(): number {
    return this.dropAreaY;
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
    this.renderScore(state.score, state.highScore);
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

  // Render score display - split layout
  private renderScore(score: number, highScore: number): void {
    const ctx = this.ctx;
    const leftX = 50;
    const rightX = VIEWPORT_WIDTH - 50;
    const scoreY = 80;
    const labelY = 35;

    // === LEFT SIDE: Current Score ===
    ctx.save();
    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // "SCORE" label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.TextSecondary;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('SCORE', leftX, labelY);

    // Score value
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText(score.toLocaleString(), leftX, scoreY);
    ctx.restore();

    // === RIGHT SIDE: High Score with Crown ===
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // "BEST" label (right aligned)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.Gold;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('BEST', rightX, labelY);

    // High score value
    ctx.fillStyle = COLORS.Gold;
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText(highScore.toLocaleString(), rightX, scoreY);
    ctx.restore();
  }

  // Render a crown icon using canvas paths
  private renderCrown(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Crown shape (5-point crown)
    ctx.beginPath();
    // Base of crown
    ctx.moveTo(0, size);
    ctx.lineTo(size, size);
    // Right point
    ctx.lineTo(size, size * 0.4);
    ctx.lineTo(size * 0.8, size * 0.6);
    // Center right point
    ctx.lineTo(size * 0.65, size * 0.2);
    ctx.lineTo(size * 0.5, size * 0.5);
    // Center point (top)
    ctx.lineTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size * 0.5);
    // Center left point
    ctx.lineTo(size * 0.35, size * 0.2);
    ctx.lineTo(size * 0.2, size * 0.6);
    // Left point
    ctx.lineTo(0, size * 0.4);
    ctx.closePath();

    // Fill with gold
    ctx.fillStyle = COLORS.Gold;
    ctx.fill();

    // Add gems (small circles)
    ctx.fillStyle = '#FF6B6B'; // Ruby red
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.65, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4ECDC4'; // Teal
    ctx.beginPath();
    ctx.arc(size * 0.25, size * 0.7, size * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size * 0.75, size * 0.7, size * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

  // Draw starburst rays effect - enhanced dual-layer glow with varied rays
  private drawStarburst(x: number, y: number, pulseScale: number, opacity: number = 1, rotation: number = 0): void {
    const ctx = this.ctx;
    const rays = COMBO_NOTIFICATION.STARBURST_RAYS;

    // Scale radii with pulse
    const coreRadius = COMBO_NOTIFICATION.STARBURST_CORE_RADIUS * pulseScale;
    const haloRadius = COMBO_NOTIFICATION.STARBURST_HALO_RADIUS * pulseScale;
    const outerRadius = COMBO_NOTIFICATION.STARBURST_OUTER_RADIUS * pulseScale;
    const innerRadius = COMBO_NOTIFICATION.STARBURST_INNER_RADIUS * pulseScale;

    // Offset glow center downward for "light from below" effect
    const offsetY = COMBO_NOTIFICATION.STARBURST_GLOW_OFFSET_Y;
    const glowY = y + offsetY;

    ctx.save();
    ctx.translate(x, glowY);

    // Use shadowBlur instead of ctx.filter for Safari/iOS compatibility
    // ctx.filter = 'blur()' is NOT supported on Safari!
    ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Use additive blending for all glow layers
    ctx.globalCompositeOperation = 'lighter';

    // ========================================
    // LAYER 1: Outer golden halo (largest, softest)
    // ========================================
    const haloGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
    haloGradient.addColorStop(0, `rgba(255, 220, 100, ${COMBO_NOTIFICATION.STARBURST_HALO_OPACITY * opacity})`);
    haloGradient.addColorStop(0.4, `rgba(255, 220, 100, ${COMBO_NOTIFICATION.STARBURST_HALO_OPACITY * 0.4 * opacity})`);
    haloGradient.addColorStop(1, 'rgba(255, 220, 100, 0)');

    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(0, 0, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // ========================================
    // LAYER 2: Soft rays with variation
    // ========================================
    ctx.rotate(rotation);

    // Seeded random for consistent ray variation
    const seed = 42;
    let randomState = seed;
    const seededRandom = (): number => {
      randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
      return randomState / 0x7fffffff;
    };

    // Determine hero ray indices (2-4 longer/brighter rays)
    const heroCount = COMBO_NOTIFICATION.STARBURST_HERO_RAYS;
    const heroIndices = new Set<number>();
    for (let i = 0; i < heroCount; i++) {
      heroIndices.add(Math.floor(seededRandom() * rays * 2));
    }

    const lengthVar = COMBO_NOTIFICATION.STARBURST_RAY_LENGTH_VAR;
    const opacityVar = COMBO_NOTIFICATION.STARBURST_RAY_OPACITY_VAR;
    const baseRayOpacity = COMBO_NOTIFICATION.STARBURST_RAY_OPACITY;

    // Draw rays (rays * 2 total, alternating)
    for (let i = 0; i < rays * 2; i++) {
      const isHero = heroIndices.has(i);
      const isLong = i % 2 === 0;

      // Base angle with slight randomness
      const baseAngle = (i * Math.PI) / rays;
      const angleOffset = (seededRandom() - 0.5) * 0.15;
      const angle = baseAngle + angleOffset;

      // Ray length with variation
      const baseLengthMult = isLong ? 1.0 : 0.55;
      const lengthMult = baseLengthMult + (seededRandom() - 0.5) * 2 * lengthVar;
      const rayLength = outerRadius * (isHero ? lengthMult * 1.35 : lengthMult);

      // Ray opacity with variation
      let rayOpacity = baseRayOpacity + (seededRandom() - 0.5) * 2 * opacityVar;
      rayOpacity = isHero ? Math.min(rayOpacity * 1.4, 0.85) : rayOpacity;
      rayOpacity = Math.max(0.2, Math.min(0.85, rayOpacity)); // Clamp

      // Ray width (wider for hero rays, softer look)
      const rayWidth = isLong ? 0.18 : 0.10;
      const finalWidth = isHero ? rayWidth * 1.3 : rayWidth;

      // Create gradient from center to tip (golden rays, fades out for soft tips)
      const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, rayLength);
      gradient.addColorStop(0, `rgba(255, 235, 150, ${rayOpacity * opacity})`);
      gradient.addColorStop(0.4, `rgba(255, 235, 150, ${rayOpacity * 0.5 * opacity})`);
      gradient.addColorStop(0.7, `rgba(255, 235, 150, ${rayOpacity * 0.15 * opacity})`);
      gradient.addColorStop(1, 'rgba(255, 235, 150, 0)');

      ctx.fillStyle = gradient;

      // Draw ray as triangle (thicker, softer appearance)
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

    // Reset rotation for center glow
    ctx.rotate(-rotation);

    // ========================================
    // LAYER 3: Bright core bloom (on top)
    // ========================================
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${COMBO_NOTIFICATION.STARBURST_CORE_OPACITY * opacity})`);
    coreGradient.addColorStop(0.35, `rgba(255, 255, 255, ${0.5 * opacity})`);
    coreGradient.addColorStop(0.7, `rgba(255, 255, 255, ${0.15 * opacity})`);
    coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();

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

    // Title "BLOCK PUZZLE" with 3-layer styled text
    this.drawStyledText(
      'BLOCK',
      VIEWPORT_WIDTH / 2,
      160,
      HOME_SCREEN.TITLE_FONT_SIZE,
      { top: HOME_SCREEN.TITLE_FILL_TOP, bottom: HOME_SCREEN.TITLE_FILL_BOTTOM },
      HOME_SCREEN.TITLE_STROKE_COLOR,
      HOME_SCREEN.TITLE_HIGHLIGHT_COLOR,
      HOME_SCREEN.TITLE_STROKE_WIDTH,
      'Inter, sans-serif'
    );

    this.drawStyledText(
      'PUZZLE',
      VIEWPORT_WIDTH / 2,
      220,
      HOME_SCREEN.TITLE_FONT_SIZE,
      { top: HOME_SCREEN.TITLE_FILL_TOP, bottom: HOME_SCREEN.TITLE_FILL_BOTTOM },
      HOME_SCREEN.TITLE_STROKE_COLOR,
      HOME_SCREEN.TITLE_HIGHLIGHT_COLOR,
      HOME_SCREEN.TITLE_STROKE_WIDTH,
      'Inter, sans-serif'
    );

    // High score badge
    if (highScore > 0) {
      ctx.save();
      ctx.font = `bold 22px Inter, sans-serif`;
      const scoreText = highScore.toLocaleString();
      const textWidth = ctx.measureText(scoreText).width;
      const crownSize = 22;
      const gap = 8;

      const badgeWidth = HOME_SCREEN.BADGE_PADDING_X * 2 + crownSize + gap + textWidth;
      const badgeHeight = HOME_SCREEN.BADGE_PADDING_Y * 2 + 24;
      const badgeX = (VIEWPORT_WIDTH - badgeWidth) / 2;
      const badgeY = 275;

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
    ctx.font = `bold ${HOME_SCREEN.BUTTON_FONT_SIZE}px Inter, sans-serif`;
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
    const containerY = 390;

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
    ctx.font = 'bold 44px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', VIEWPORT_WIDTH / 2, modalY + 65);
    ctx.restore();

    // Score with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillStyle = isNewHighScore ? COLORS.Gold : COLORS.TextPrimary;
    ctx.fillText(score.toLocaleString(), VIEWPORT_WIDTH / 2, modalY + 150);
    ctx.restore();

    // New high score indicator with crown or best score - properly centered
    if (isNewHighScore) {
      const crownSize = 24;
      const gap = 10;
      const highScoreText = 'NEW HIGH SCORE!';
      ctx.font = 'bold 22px Inter, sans-serif';
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
      ctx.font = '20px Inter, sans-serif';
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
    ctx.font = 'bold 24px Inter, sans-serif';
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
    ctx.font = `bold ${OVERLAY_FONT_SIZE}px Inter, sans-serif`;
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
    ctx.font = `bold ${MODAL_TITLE_FONT_SIZE}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Continue?', VIEWPORT_WIDTH / 2, modalY + 50);

    // Subtitle
    ctx.fillStyle = COLORS.TextSecondary;
    ctx.font = '16px Inter, sans-serif';
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
    ctx.font = '18px Inter, sans-serif';
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
    ctx.font = 'bold 22px Inter, sans-serif';
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
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Watching ad...', VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);

    // Placeholder note
    ctx.font = '18px Inter, sans-serif';
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
  }): void {
    const ctx = this.ctx;
    const {
      SCREEN_TITLE_Y,
      SCREEN_TITLE_FONT_SIZE,
      SCREEN_SCORE_Y,
      SCREEN_SCORE_FONT_SIZE,
      SCREEN_BEST_Y,
      SCREEN_BADGE_Y,
      SCREEN_PLAY_BUTTON_Y,
      SCREEN_HOME_BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
    } = GAME_OVER_LAYOUT;

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    // "GAME OVER" title with animation
    ctx.save();
    ctx.globalAlpha = state.titleOpacity;
    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = `bold ${SCREEN_TITLE_FONT_SIZE}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add shadow to title
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillText('GAME OVER', VIEWPORT_WIDTH / 2, state.titleY);
    ctx.restore();

    // Score with count-up
    ctx.save();
    ctx.fillStyle = state.isNewHighScore ? COLORS.Gold : COLORS.TextPrimary;
    ctx.font = `bold ${SCREEN_SCORE_FONT_SIZE}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(state.displayedScore.toLocaleString(), VIEWPORT_WIDTH / 2, SCREEN_SCORE_Y);
    ctx.restore();

    // Best score
    ctx.fillStyle = COLORS.TextSecondary;
    ctx.font = '24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Best: ${state.bestScore.toLocaleString()}`, VIEWPORT_WIDTH / 2, SCREEN_BEST_Y);

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
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NEW HIGH SCORE!', 0, 0);

      ctx.restore();
    }

    // Play Again button
    this.renderButton(
      (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      SCREEN_PLAY_BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      'PLAY AGAIN',
      COLORS.Green
    );

    // Home button (darker/gray)
    this.renderButton(
      (VIEWPORT_WIDTH - BUTTON_WIDTH) / 2,
      SCREEN_HOME_BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      'HOME',
      '#555555'
    );
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
