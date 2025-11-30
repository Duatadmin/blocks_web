// LineGlowVFX - Animated rounded rectangle outline for line destruction
// Grows from small to full size with glow, then fades out

import { Rect } from '../utils/math';
import { LINE_GLOW_VFX, GRID_SIZE } from '../data/constants';

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number): number {
  return t * t;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Linearly interpolate between two rectangles.
 */
function lerpRect(r1: Rect, r2: Rect, t: number): Rect {
  return {
    x: r1.x + (r2.x - r1.x) * t,
    y: r1.y + (r2.y - r1.y) * t,
    width: r1.width + (r2.width - r1.width) * t,
    height: r1.height + (r2.height - r1.height) * t,
  };
}

/**
 * Convert hex color to rgba string.
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw a rounded rectangle stroke.
 */
function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.stroke();
}

/**
 * Draw a filled rounded rectangle.
 */
function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.fill();
}

// ============================================================================
// MAIN LINE GLOW CLASS
// ============================================================================

/**
 * Single line glow effect - animated rounded rectangle outline.
 */
export class LineGlow {
  private readonly rect1: Rect;  // Small starting rectangle
  private readonly rect4: Rect;  // Full line rectangle
  private readonly duration: number;
  private readonly isHorizontal: boolean;

  private age: number = 0;
  private _isFinished: boolean = false;

  constructor(
    lineIndex: number,  // 0-7 for rows, 8-15 for columns
    boardRect: Rect,
    cellSize: number
  ) {
    this.duration = LINE_GLOW_VFX.DURATION;
    this.isHorizontal = lineIndex < GRID_SIZE;

    // Calculate full line rectangle (rect4) - narrower than full cell
    if (this.isHorizontal) {
      // Horizontal line (row clear) - narrower height, full width
      const rowIndex = lineIndex;
      const finalHeight = cellSize * LINE_GLOW_VFX.FINAL_WIDTH_RATIO;
      const offsetY = (cellSize - finalHeight) / 2;
      this.rect4 = {
        x: boardRect.x,
        y: boardRect.y + rowIndex * cellSize + offsetY,
        width: boardRect.width,
        height: finalHeight,
      };
    } else {
      // Vertical line (column clear) - narrower width, full height
      const colIndex = lineIndex - GRID_SIZE;
      const finalWidth = cellSize * LINE_GLOW_VFX.FINAL_WIDTH_RATIO;
      const offsetX = (cellSize - finalWidth) / 2;
      this.rect4 = {
        x: boardRect.x + colIndex * cellSize + offsetX,
        y: boardRect.y,
        width: finalWidth,
        height: boardRect.height,
      };
    }

    // Calculate small starting rectangle (rect1) - centered in rect4
    const initialWidthRatio = LINE_GLOW_VFX.INITIAL_WIDTH_RATIO;
    const initialHeightRatio = LINE_GLOW_VFX.INITIAL_HEIGHT_RATIO;

    const startWidth = this.rect4.width * initialWidthRatio;
    const startHeight = this.rect4.height * initialHeightRatio;

    this.rect1 = {
      x: this.rect4.x + (this.rect4.width - startWidth) / 2,
      y: this.rect4.y + (this.rect4.height - startHeight) / 2,
      width: startWidth,
      height: startHeight,
    };
  }

  get isFinished(): boolean {
    return this._isFinished;
  }

  /**
   * Update animation.
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    if (this._isFinished) return;

    this.age += dt;

    if (this.age >= this.duration) {
      this._isFinished = true;
    }
  }

  /**
   * Draw the glow effect.
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this._isFinished) return;

    const t = Math.min(this.age / this.duration, 1);

    // --- Geometry interpolation (0 - 0.8) ---
    const growPhase = Math.min(t / 0.8, 1);
    const u = easeOutCubic(growPhase);
    let currentRect = lerpRect(this.rect1, this.rect4, u);

    // --- Fade phase (0.8 - 1.0) ---
    const fadePhase = t < 0.8 ? 0 : (t - 0.8) / 0.2;
    const v = Math.min(fadePhase, 1);
    const fade = 1 - easeInQuad(v);

    // Optional: slight shrink during fade (10%)
    if (fadePhase > 0) {
      const shrink = 1 - 0.1 * easeInQuad(v);
      const centerX = currentRect.x + currentRect.width / 2;
      const centerY = currentRect.y + currentRect.height / 2;
      currentRect = {
        x: centerX - (currentRect.width * shrink) / 2,
        y: centerY - (currentRect.height * shrink) / 2,
        width: currentRect.width * shrink,
        height: currentRect.height * shrink,
      };
    }

    // --- Calculate alphas ---
    // During growth (0-0.8): ramp up
    // During fade (0.8-1.0): fade out
    let fillAlpha: number;
    let strokeAlpha: number;
    let glowAlpha: number;

    if (t < 0.8) {
      // Ramp up during growth
      const rampProgress = t / 0.8;
      fillAlpha = LINE_GLOW_VFX.FILL_ALPHA * rampProgress;
      strokeAlpha = 0.15 * rampProgress;  // 50% reduction from 0.3
      glowAlpha = 0.5 * rampProgress;
    } else {
      // Fade out
      fillAlpha = LINE_GLOW_VFX.FILL_ALPHA * fade;
      strokeAlpha = 0.15 * fade;  // 50% reduction from 0.3
      glowAlpha = 0.5 * fade;
    }

    // --- Calculate line width ---
    const lineWidth = LINE_GLOW_VFX.LINE_WIDTH_MIN +
      (LINE_GLOW_VFX.LINE_WIDTH_MAX - LINE_GLOW_VFX.LINE_WIDTH_MIN) * u;

    // --- Calculate corner radius ---
    const cornerRadius = Math.min(currentRect.width, currentRect.height) *
      LINE_GLOW_VFX.CORNER_RADIUS_RATIO;

    // --- Draw ---
    ctx.save();

    // 1. Draw filled rectangle with semi-transparent interior (the halo effect)
    ctx.shadowColor = hexToRgba(LINE_GLOW_VFX.GLOW_COLOR, glowAlpha);
    ctx.shadowBlur = LINE_GLOW_VFX.GLOW_BLUR;
    ctx.fillStyle = hexToRgba(LINE_GLOW_VFX.FILL_COLOR, fillAlpha);
    fillRoundedRect(
      ctx,
      currentRect.x,
      currentRect.y,
      currentRect.width,
      currentRect.height,
      cornerRadius
    );

    // 2. Draw stroke outline on top
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = hexToRgba(LINE_GLOW_VFX.STROKE_COLOR, strokeAlpha);
    strokeRoundedRect(
      ctx,
      currentRect.x,
      currentRect.y,
      currentRect.width,
      currentRect.height,
      cornerRadius
    );

    ctx.restore();
  }
}

// ============================================================================
// MANAGER CLASS
// ============================================================================

/**
 * Manages multiple LineGlow instances.
 */
export class LineGlowManager {
  private glows: LineGlow[] = [];
  private readonly boardRect: Rect;
  private readonly cellSize: number;

  constructor(boardRect: Rect, cellSize: number) {
    this.boardRect = boardRect;
    this.cellSize = cellSize;
  }

  /**
   * Spawn glow effects for the specified line indices.
   * @param lineIndices - Array of line indices (0-7 for rows, 8-15 for columns)
   */
  spawnForLines(lineIndices: number[]): void {
    for (const lineIndex of lineIndices) {
      this.glows.push(new LineGlow(lineIndex, this.boardRect, this.cellSize));
    }
  }

  /**
   * Update all active glows and remove finished ones.
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    for (const glow of this.glows) {
      glow.update(dt);
    }
    this.glows = this.glows.filter(glow => !glow.isFinished);
  }

  /**
   * Draw all active glows.
   */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const glow of this.glows) {
      glow.draw(ctx);
    }
  }

  /**
   * Check if any glows are currently active.
   */
  hasActiveGlows(): boolean {
    return this.glows.length > 0;
  }

  /**
   * Clear all active glows immediately.
   */
  clear(): void {
    this.glows = [];
  }
}
