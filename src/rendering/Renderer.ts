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
} from '../data/constants';
import { Grid, GridCell } from '../core/Grid';
import { Block } from '../core/Block';
import { getShapeBounds } from '../data/figures';
import { Point } from '../utils/math';
import { lighten, darken, toRgba } from '../utils/colors';

export interface RenderState {
  grid: Grid;
  dropBlocks: (Block | null)[];
  dragState: DragState | null;
  highlightedCells: HighlightedCell[];
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

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;

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

  // Clear the canvas
  public clear(): void {
    this.ctx.fillStyle = COLORS.Background;
    this.ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Render the complete game state
  public render(state: RenderState): void {
    this.clear();
    this.renderScore(state.score, state.highScore);
    this.renderGridContainer();
    this.renderGrid(state.grid);
    this.renderHighlights(state.highlightedCells);
    this.renderGridBlocks(state.grid);
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

    // Crown icon above "BEST" label
    this.renderCrown(rightX - 30, labelY - 22, 18);

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

  // Render an empty cell (subtle, nearly invisible)
  private renderEmptyCell(x: number, y: number, size: number): void {
    const padding = 2;
    const innerSize = size - padding * 2;
    const radius = 6;
    const ctx = this.ctx;

    // Cell background - very subtle
    ctx.fillStyle = COLORS.GridCell;
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.fill();

    // Very subtle inner shadow (much more minimal)
    const gradient = ctx.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.06)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = gradient;
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.fill();

    // Subtle cell border for grid structure
    ctx.strokeStyle = COLORS.GridCellBorder;
    ctx.lineWidth = 0.5;
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.stroke();
  }

  // Render highlighted cells (lines that would complete)
  private renderHighlights(cells: HighlightedCell[]): void {
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

    // Render destruction borders on top
    this.renderDestructionBorders(cells, isCombo);
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
  private renderDestructionBorders(cells: HighlightedCell[], isCombo: boolean): void {
    if (cells.length === 0) return;

    const ctx = this.ctx;
    const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));

    // Get border color based on combo state
    const borderColor = isCombo ? COLORS.Gold : cells[0]?.color ? COLORS[cells[0].color] : COLORS.Gold;

    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 4;

    // Draw borders only on outer edges
    for (const cell of cells) {
      const screenX = this.gridOriginX + cell.x * CELL_SIZE;
      const screenY = this.gridOriginY + cell.y * CELL_SIZE;
      const padding = 2;

      // Check each edge - draw border if neighbor is not in the set
      // Top edge
      if (!cellSet.has(`${cell.x},${cell.y - 1}`)) {
        ctx.beginPath();
        ctx.moveTo(screenX + padding, screenY + padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + padding);
        ctx.stroke();
      }

      // Bottom edge
      if (!cellSet.has(`${cell.x},${cell.y + 1}`)) {
        ctx.beginPath();
        ctx.moveTo(screenX + padding, screenY + CELL_SIZE - padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + CELL_SIZE - padding);
        ctx.stroke();
      }

      // Left edge
      if (!cellSet.has(`${cell.x - 1},${cell.y}`)) {
        ctx.beginPath();
        ctx.moveTo(screenX + padding, screenY + padding);
        ctx.lineTo(screenX + padding, screenY + CELL_SIZE - padding);
        ctx.stroke();
      }

      // Right edge
      if (!cellSet.has(`${cell.x + 1},${cell.y}`)) {
        ctx.beginPath();
        ctx.moveTo(screenX + CELL_SIZE - padding, screenY + padding);
        ctx.lineTo(screenX + CELL_SIZE - padding, screenY + CELL_SIZE - padding);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Render blocks placed on the grid
  private renderGridBlocks(grid: Grid): void {
    grid.forEachCell((x, y, cell) => {
      if (cell.occupied && cell.color) {
        const screenX = this.gridOriginX + x * CELL_SIZE;
        const screenY = this.gridOriginY + y * CELL_SIZE;
        this.renderBlock(screenX, screenY, CELL_SIZE, cell.color, 1.0);
      }
    });
  }

  // Render a single block with modern styling (matte finish with inner grid lines)
  public renderBlock(x: number, y: number, size: number, color: BlockColor, opacity: number = 1.0): void {
    const colorHex = COLORS[color];
    const padding = 2;
    const innerSize = size - padding * 2;
    const radius = 6;
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Enhanced drop shadow (stronger 3D effect)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    // Main block gradient (slightly flatter for matte look)
    const gradient = ctx.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, lighten(colorHex, 10));
    gradient.addColorStop(0.5, colorHex);
    gradient.addColorStop(1, darken(colorHex, 12));

    ctx.fillStyle = gradient;
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.fill();

    // Reset shadow for rest of drawing
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Inner grid lines (texture effect) - moderate visibility 22% opacity
    const gridLineColor = toRgba(darken(colorHex, 30), 0.22);
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;

    const innerX = x + padding;
    const innerY = y + padding;

    // Horizontal lines at 33% and 66%
    ctx.beginPath();
    ctx.moveTo(innerX + 4, innerY + innerSize * 0.33);
    ctx.lineTo(innerX + innerSize - 4, innerY + innerSize * 0.33);
    ctx.moveTo(innerX + 4, innerY + innerSize * 0.66);
    ctx.lineTo(innerX + innerSize - 4, innerY + innerSize * 0.66);
    ctx.stroke();

    // Vertical lines at 33% and 66%
    ctx.beginPath();
    ctx.moveTo(innerX + innerSize * 0.33, innerY + 4);
    ctx.lineTo(innerX + innerSize * 0.33, innerY + innerSize - 4);
    ctx.moveTo(innerX + innerSize * 0.66, innerY + 4);
    ctx.lineTo(innerX + innerSize * 0.66, innerY + innerSize - 4);
    ctx.stroke();

    // Subtle top highlight (matte - reduced from 0.35 to 0.15)
    const highlightGradient = ctx.createLinearGradient(x, y + padding, x, y + size * 0.25);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGradient;
    this.roundRect(x + padding, y + padding, innerSize, innerSize * 0.35, radius);
    ctx.fill();

    // Inner border highlight (subtle)
    ctx.strokeStyle = toRgba(lighten(colorHex, 25), 0.35);
    ctx.lineWidth = 1;
    this.roundRect(x + padding + 1, y + padding + 1, innerSize - 2, innerSize - 2, radius - 1);
    ctx.stroke();

    // Bottom edge darkening
    const bottomGradient = ctx.createLinearGradient(x, y + size * 0.75, x, y + size - padding);
    bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');

    ctx.fillStyle = bottomGradient;
    this.roundRect(x + padding, y + padding, innerSize, innerSize, radius);
    ctx.fill();

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

  // Render combo notification
  public renderComboNotification(
    message: string,
    y: number,
    scale: number = 1.0,
    opacity: number = 1.0,
    rotation: number = 0
  ): void {
    if (!message) return;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.translate(VIEWPORT_WIDTH / 2, y);
    this.ctx.rotate(rotation);
    this.ctx.scale(scale, scale);

    // Text shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetY = 2;

    this.ctx.fillStyle = message.includes('COMBO') ? COLORS.Gold : COLORS.TextPrimary;
    this.ctx.font = 'bold 48px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, 0, 0);

    this.ctx.restore();
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
    this.clear();

    // Title with text shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = COLORS.TextPrimary;
    ctx.font = 'bold 56px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLOCK', VIEWPORT_WIDTH / 2, 170);
    ctx.fillText('PUZZLE', VIEWPORT_WIDTH / 2, 235);
    ctx.restore();

    // High score with crown
    if (highScore > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;

      // Crown icon
      this.renderCrown(VIEWPORT_WIDTH / 2 - 80, 295, 28);

      ctx.fillStyle = COLORS.Gold;
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText(highScore.toLocaleString(), VIEWPORT_WIDTH / 2 + 20, 310);
      ctx.restore();
    }

    // Preview grid with container
    this.renderGridPreviewContainer();

    // Tap to start with pulsing hint
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = COLORS.TextSecondary;
    ctx.font = '22px Inter, sans-serif';
    ctx.fillText('Tap to Start', VIEWPORT_WIDTH / 2, 850);
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

  // Get play again button bounds for hit testing
  public getPlayAgainButtonBounds(): { x: number; y: number; width: number; height: number } {
    const modalWidth = 420;
    const modalHeight = 380;
    const modalY = (VIEWPORT_HEIGHT - modalHeight) / 2;
    const buttonWidth = 220;
    const buttonHeight = 56;

    return {
      x: (VIEWPORT_WIDTH - buttonWidth) / 2,
      y: modalY + 285,
      width: buttonWidth,
      height: buttonHeight,
    };
  }
}
