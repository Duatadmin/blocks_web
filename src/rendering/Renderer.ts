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

export interface RenderState {
  grid: Grid;
  dropBlocks: (Block | null)[];
  dragState: DragState | null;
  highlightedCells: HighlightedCell[];
  animatingCellKeys: Set<string>;  // Keys of cells being animated ("x,y") - skip in normal render
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

  // Clear the canvas with gradient background
  public clear(): void {
    // Vertical gradient per design spec
    const gradient = this.ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
    gradient.addColorStop(0, COLORS.BackgroundTop);
    gradient.addColorStop(1, COLORS.BackgroundBottom);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Render the complete game state
  public render(state: RenderState): void {
    this.clear();
    this.renderScore(state.score, state.highScore);
    this.renderGridContainer();
    this.renderGrid(state.grid);
    this.renderHighlights(state.highlightedCells);
    this.renderGridBlocks(state.grid, state.highlightedCells, state.animatingCellKeys);
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
  private renderGridBlocks(
    grid: Grid,
    highlightedCells: HighlightedCell[] = [],
    animatingCellKeys: Set<string> = new Set()
  ): void {
    // Create set of highlighted positions to skip (they're rendered with new color in renderHighlights)
    const highlightedPositions = new Set(
      highlightedCells.map(c => `${c.x},${c.y}`)
    );

    grid.forEachCell((x, y, cell) => {
      const key = `${x},${y}`;

      // Skip cells that are highlighted - they're already rendered with the dragged block's color
      if (highlightedPositions.has(key)) {
        return;
      }

      // Skip cells that are animating - they're rendered separately in renderAnimatingCells
      if (animatingCellKeys.has(key)) {
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
  public renderBlock(x: number, y: number, size: number, color: BlockColor, opacity: number = 1.0): void {
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

  // Render combo notification with styled text and starburst VFX
  public renderComboNotification(
    comboNumber: number,
    y: number,
    scale: number = 1.0,
    opacity: number = 1.0,
    starburstScale: number = 1.0,
    rotation: number = 0
  ): void {
    if (comboNumber < 2) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(VIEWPORT_WIDTH / 2, y);
    ctx.scale(scale, scale);

    // Measure text widths for positioning
    const comboText = 'Combo';
    const numberText = comboNumber.toString();

    ctx.font = `italic bold ${COMBO_NOTIFICATION.COMBO_FONT_SIZE}px ${getComboFontFamily()}`;
    const comboWidth = ctx.measureText(comboText).width;

    ctx.font = `italic bold ${COMBO_NOTIFICATION.NUMBER_FONT_SIZE}px ${getComboFontFamily()}`;
    const numberWidth = ctx.measureText(numberText).width;

    const gap = 8;
    const totalWidth = comboWidth + gap + numberWidth;
    const comboX = -totalWidth / 2 + comboWidth / 2;
    const numberX = totalWidth / 2 - numberWidth / 2;

    // 1. Draw starburst VFX behind number (with pulsing scale, opacity, and rotation)
    this.drawStarburst(numberX, 0, starburstScale, opacity, rotation);

    // 2. Draw "Combo" text (3-layer: dark blue stroke, cyan fill, white highlight)
    this.drawStyledText(
      comboText,
      comboX,
      0,
      COMBO_NOTIFICATION.COMBO_FONT_SIZE,
      COMBO_NOTIFICATION.COMBO_FILL_COLOR,        // Layer 2: Cyan fill
      COMBO_NOTIFICATION.COMBO_STROKE_COLOR,      // Layer 1: Dark blue stroke
      COMBO_NOTIFICATION.COMBO_HIGHLIGHT_COLOR    // Layer 3: White highlight
    );

    // 3. Draw number (3-layer: dark blue stroke, gold gradient fill, light yellow highlight)
    this.drawStyledText(
      numberText,
      numberX,
      0,
      COMBO_NOTIFICATION.NUMBER_FONT_SIZE,
      { top: COMBO_NOTIFICATION.NUMBER_FILL_TOP, bottom: COMBO_NOTIFICATION.NUMBER_FILL_BOTTOM },
      COMBO_NOTIFICATION.NUMBER_STROKE_COLOR,     // Layer 1: Dark blue stroke
      COMBO_NOTIFICATION.NUMBER_HIGHLIGHT_COLOR   // Layer 3: Light yellow highlight
    );

    ctx.restore();
  }

  // Draw starburst rays effect - soft glow with WHITE rays
  private drawStarburst(x: number, y: number, pulseScale: number, opacity: number = 1, rotation: number = 0): void {
    const ctx = this.ctx;
    const rays = COMBO_NOTIFICATION.STARBURST_RAYS;
    const innerRadius = COMBO_NOTIFICATION.STARBURST_INNER_RADIUS * pulseScale;
    const outerRadius = COMBO_NOTIFICATION.STARBURST_OUTER_RADIUS * pulseScale;
    const glowRadius = COMBO_NOTIFICATION.STARBURST_GLOW_LAYER_RADIUS * pulseScale;
    const rayOpacity = COMBO_NOTIFICATION.STARBURST_RAY_OPACITY;
    const glowOpacity = COMBO_NOTIFICATION.STARBURST_GLOW_LAYER_OPACITY;

    ctx.save();
    ctx.translate(x, y);

    // LAYER 1: Soft radial glow halo (drawn BEFORE rays, no rotation)
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glowGradient.addColorStop(0, `rgba(255, 255, 255, ${glowOpacity * opacity})`);
    glowGradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowOpacity * 0.5 * opacity})`);
    glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Apply rotation for rays only
    ctx.rotate(rotation);

    // LAYER 2: Soft rays with reduced opacity
    // Create gradient with 50% reduced opacity values
    const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${rayOpacity * opacity})`);
    gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.30 * opacity})`);
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${0.125 * opacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;

    // Draw alternating long and short rays (wider for softer appearance)
    for (let i = 0; i < rays * 2; i++) {
      const angle = (i * Math.PI) / rays;
      const isLong = i % 2 === 0;
      const rayLength = isLong ? outerRadius : outerRadius * 0.6;
      const rayWidth = isLong ? 0.20 : 0.12;  // Wider rays for softer look (was 0.12 : 0.06)

      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle - rayWidth) * innerRadius,
        Math.sin(angle - rayWidth) * innerRadius
      );
      ctx.lineTo(
        Math.cos(angle) * rayLength,
        Math.sin(angle) * rayLength
      );
      ctx.lineTo(
        Math.cos(angle + rayWidth) * innerRadius,
        Math.sin(angle + rayWidth) * innerRadius
      );
      ctx.closePath();
      ctx.fill();
    }

    // LAYER 3: Center glow circle (no rotation needed)
    ctx.rotate(-rotation); // Reset rotation for center glow
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius * 2.5);
    centerGradient.addColorStop(0, `rgba(255, 255, 255, ${0.45 * opacity})`);  // 50% of 0.9
    centerGradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.25 * opacity})`); // 50% of 0.5
    centerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 2.5, 0, Math.PI * 2);
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
    this.clear();

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
