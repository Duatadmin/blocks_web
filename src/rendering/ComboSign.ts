// ComboSign - Premium 6-layer 3D text renderer for combo notifications
// Renders "Combo X" with shadow blob, extrusion, outline, bevel fill, and gloss

import { getComboFontFamily } from '../utils/fontLoader';
import { imageDataRGBA } from 'stackblur-canvas';

// ============================================================================
// Public Types
// ============================================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColorScheme {
  fillLight: string;
  fillMid: string;
  fillDark: string;
  outline: string;
  extrude: string;
  shadow: string;
  glow?: string;
}

export interface ComboSignOptions {
  comboText?: string;
  value: number;
  centerX: number;
  centerY: number;
  baseFontSize: number;
  wordColorScheme?: ColorScheme;
  numberColorScheme?: ColorScheme;
  scale?: number;
  opacity?: number;
}

// ============================================================================
// Default Color Schemes
// ============================================================================

export const DEFAULT_WORD_COLORS: ColorScheme = {
  fillLight: '#F6FFFF',
  fillMid: '#BEE7FF',
  fillDark: '#7DD4FF',
  outline: '#1255E5',
  extrude: '#0732A0',
  shadow: 'rgba(0, 10, 40, 0.7)',
};

export const DEFAULT_NUMBER_COLORS: ColorScheme = {
  fillLight: '#FFE87C',
  fillMid: '#FFC83B',
  fillDark: '#FFAA1E',
  outline: '#1255E5',
  extrude: '#0732A0',
  shadow: 'rgba(0, 10, 40, 0.7)',
  glow: 'rgba(255, 220, 120, 0.9)',
};

// ============================================================================
// Geometric Constants (as multipliers of baseFontSize S)
// ============================================================================

const LAYOUT = {
  NUMBER_SCALE: 1.25,           // Number is 25% larger than word
  NUMBER_NUDGE_Y: 0.04,         // Number nudged down slightly
  GAP: 0.25,                    // Gap between word and number
  LETTER_SPACING: 0.04,         // Letter spacing for word (4% of S)
};

const SHADOW = {
  STROKE_WIDTH: 0.5,            // Thick stroke to fill counters
  BLUR_RADIUS: 0.20,            // Blur radius
  OFFSET_Y: 0.10,               // Downward offset
};

const EXTRUDE = {
  OFFSET_Y: 0.08,               // Downward offset
  OPACITY: 0.9,
};

const OUTLINE = {
  WORD_WIDTH: 0.14,             // Stroke width for word
  NUMBER_WIDTH: 0.16,           // Stroke width for number
};

const BEVEL = {
  INNER_HIGHLIGHT_WIDTH: 0.06,  // Inner highlight stroke width
  INNER_HIGHLIGHT_ALPHA: 0.7,   // Inner highlight opacity
  BOTTOM_SHADOW_ALPHA: 0.18,    // Bottom shadow opacity
};

const GLOSS = {
  TOP_ALPHA: 0.18,
  MID_ALPHA: 0.08,
  HEIGHT: 0.35,                 // Gloss covers top 35%
};

const GLOW = {
  RADIUS_MULT: 1.5,             // Glow radius relative to number height
  INNER_ALPHA: 0.6,
  MID_ALPHA: 0.3,
};

// ============================================================================
// ComboSignCache - Pre-renders sprites for performance
// ============================================================================

interface CachedSprite {
  canvas: OffscreenCanvas;
  width: number;                // Canvas width (includes padding)
  height: number;               // Canvas height (includes padding)
  textWidth: number;            // Actual text width (for layout)
  baseline: number;             // Y offset to baseline within sprite
}

export class ComboSignCache {
  private wordCache: Map<string, CachedSprite> = new Map();
  private numberCache: Map<string, CachedSprite> = new Map();
  private dpr: number;

  constructor(dpr: number = 1) {
    this.dpr = dpr;
  }

  /**
   * Get or create a cached sprite for the word (e.g., "Combo")
   */
  public getWordSprite(
    text: string,
    fontSize: number,
    colors: ColorScheme
  ): CachedSprite {
    const key = `${text}_${fontSize}`;
    let sprite = this.wordCache.get(key);

    if (!sprite) {
      sprite = this.prerenderWord(text, fontSize, colors);
      this.wordCache.set(key, sprite);
    }

    return sprite;
  }

  /**
   * Get or create a cached sprite for the number (includes glow)
   */
  public getNumberSprite(
    value: number,
    fontSize: number,
    colors: ColorScheme
  ): CachedSprite {
    const key = `${value}_${fontSize}`;
    let sprite = this.numberCache.get(key);

    if (!sprite) {
      sprite = this.prerenderNumber(value.toString(), fontSize, colors);
      this.numberCache.set(key, sprite);
    }

    return sprite;
  }

  /**
   * Clear all cached sprites (call on DPR change)
   */
  public clear(): void {
    this.wordCache.clear();
    this.numberCache.clear();
  }

  private prerenderWord(
    text: string,
    fontSize: number,
    colors: ColorScheme
  ): CachedSprite {
    // Calculate canvas size with padding for shadow/blur
    const padding = fontSize * (SHADOW.BLUR_RADIUS + SHADOW.OFFSET_Y + 0.1);
    const { width: textWidth, height: textHeight } = this.measureText(text, fontSize, true); // Apply letter spacing

    const canvasWidth = textWidth + padding * 2;
    const canvasHeight = textHeight + padding * 2;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const physicalWidth = Math.ceil(canvasWidth * this.dpr);
    const physicalHeight = Math.ceil(canvasHeight * this.dpr);

    const canvas = new OffscreenCanvas(physicalWidth, physicalHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);

    // Render all layers
    this.renderTextLayers(ctx, text, centerX, centerY, fontSize, colors, false);

    return {
      canvas,
      width: canvasWidth,
      height: canvasHeight,
      textWidth,
      baseline: centerY,
    };
  }

  private prerenderNumber(
    text: string,
    fontSize: number,
    colors: ColorScheme
  ): CachedSprite {
    // Number has larger font and glow, needs more padding
    const effectiveFontSize = fontSize * LAYOUT.NUMBER_SCALE;
    const glowRadius = effectiveFontSize * GLOW.RADIUS_MULT;
    const padding = Math.max(
      glowRadius,
      effectiveFontSize * (SHADOW.BLUR_RADIUS + SHADOW.OFFSET_Y + 0.1)
    );

    const { width: textWidth, height: textHeight } = this.measureText(
      text,
      effectiveFontSize
    );

    const canvasWidth = textWidth + padding * 2;
    const canvasHeight = textHeight + padding * 2;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const physicalWidth = Math.ceil(canvasWidth * this.dpr);
    const physicalHeight = Math.ceil(canvasHeight * this.dpr);

    const canvas = new OffscreenCanvas(physicalWidth, physicalHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);

    // Render glow first (Layer 0)
    if (colors.glow) {
      this.renderGlow(ctx, centerX, centerY, glowRadius, colors.glow);
    }

    // Render all text layers
    this.renderTextLayers(ctx, text, centerX, centerY, effectiveFontSize, colors, true);

    return {
      canvas,
      width: canvasWidth,
      height: canvasHeight,
      textWidth,
      baseline: centerY,
    };
  }

  private measureText(text: string, fontSize: number, applyLetterSpacing: boolean = false): { width: number; height: number } {
    // Use a temporary canvas for measurement
    const tempCanvas = new OffscreenCanvas(1, 1);
    const ctx = tempCanvas.getContext('2d')!;
    ctx.font = `${fontSize}px ${getComboFontFamily()}`;

    // Apply letter spacing if requested (for word measurements)
    if (applyLetterSpacing) {
      const letterSpacing = fontSize * LAYOUT.LETTER_SPACING;
      (ctx as any).letterSpacing = `${letterSpacing}px`;
    }

    const metrics = ctx.measureText(text);

    return {
      width: metrics.width,
      height: fontSize * 1.2, // Approximate line height
    };
  }

  // ============================================================================
  // Layer Rendering Functions
  // ============================================================================

  /**
   * Layer 0: Global glow (number only)
   */
  private renderGlow(
    ctx: OffscreenCanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    color: string
  ): void {
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.4, this.adjustAlpha(color, GLOW.MID_ALPHA));
    gradient.addColorStop(1, 'rgba(255, 220, 120, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render all text layers (1-5)
   */
  private renderTextLayers(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    colors: ColorScheme,
    isNumber: boolean
  ): void {
    const fontFamily = getComboFontFamily();
    const font = `${fontSize}px ${fontFamily}`;

    // Apply letter spacing for words (not numbers)
    if (!isNumber) {
      const letterSpacing = fontSize * LAYOUT.LETTER_SPACING;
      (ctx as any).letterSpacing = `${letterSpacing}px`;
    } else {
      (ctx as any).letterSpacing = '0px';
    }

    // Layer 1: Shadow blob (with counter-fill)
    this.renderShadowBlob(ctx, text, x, y, fontSize, colors.shadow, font);

    // Layer 2: 3D extrude
    this.renderExtrude(ctx, text, x, y, fontSize, colors.extrude, font);

    // Layer 3: Outline stroke
    const outlineWidth = fontSize * (isNumber ? OUTLINE.NUMBER_WIDTH : OUTLINE.WORD_WIDTH);
    this.renderOutline(ctx, text, x, y, outlineWidth, colors.outline, font);

    // Layer 4: Bevel fill (gradient + inner highlight + bottom shadow)
    this.renderBevelFill(ctx, text, x, y, fontSize, colors, isNumber, font);

    // Layer 5: Front gloss
    this.renderGloss(ctx, text, x, y, fontSize, font);
  }

  /**
   * Layer 1: Soft shadow blob beneath text
   * Uses StackBlur for consistent blur effect across all browsers (including Safari/iOS)
   */
  private renderShadowBlob(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    shadowColor: string,
    font: string
  ): void {
    const offsetY = fontSize * SHADOW.OFFSET_Y;
    const blurRadius = Math.round(fontSize * SHADOW.BLUR_RADIUS * this.dpr);
    const strokeWidth = fontSize * SHADOW.STROKE_WIDTH;

    // Create temp canvas for shadow (will be blurred independently)
    const canvas = ctx.canvas;
    const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.scale(this.dpr, this.dpr);

    // Draw shadow text to temp canvas
    tempCtx.font = font;
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';

    // Copy letter spacing from main context if set
    if ((ctx as any).letterSpacing) {
      (tempCtx as any).letterSpacing = (ctx as any).letterSpacing;
    }

    // Draw thick stroke first (fills counters in letters like 4, 6, 8, 9, 0)
    tempCtx.strokeStyle = shadowColor;
    tempCtx.lineWidth = strokeWidth;
    tempCtx.lineJoin = 'round';
    tempCtx.lineCap = 'round';
    tempCtx.strokeText(text, x, y + offsetY);

    // Draw fill on top to define glyph shape
    tempCtx.fillStyle = shadowColor;
    tempCtx.fillText(text, x, y + offsetY);

    // Apply StackBlur to the temp canvas (works on all browsers including Safari!)
    if (blurRadius > 0) {
      const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      imageDataRGBA(imageData, 0, 0, canvas.width, canvas.height, blurRadius);
      tempCtx.putImageData(imageData, 0, 0);
    }

    // Composite blurred shadow back to main canvas
    ctx.drawImage(tempCanvas, 0, 0, canvas.width / this.dpr, canvas.height / this.dpr);
  }

  /**
   * Layer 2: 3D extrude effect
   */
  private renderExtrude(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    extrudeColor: string,
    font: string
  ): void {
    const offsetY = fontSize * EXTRUDE.OFFSET_Y;

    ctx.save();
    ctx.globalAlpha = EXTRUDE.OPACITY;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = extrudeColor;
    ctx.fillText(text, x, y + offsetY);
    ctx.restore();
  }

  /**
   * Layer 3: Main outline stroke
   */
  private renderOutline(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    strokeWidth: number,
    strokeColor: string,
    font: string
  ): void {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
    ctx.restore();
  }

  /**
   * Layer 4: Bevel fill with gradient, inner highlight, and bottom shadow
   */
  private renderBevelFill(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    colors: ColorScheme,
    isNumber: boolean,
    font: string
  ): void {
    const halfHeight = fontSize / 2;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 4a: Main gradient fill (vertical)
    // Top 15%: fillMid, Middle 60%: fillLight, Bottom 25%: fillMid/fillDark mix
    const gradient = ctx.createLinearGradient(x, y - halfHeight, x, y + halfHeight);
    gradient.addColorStop(0, colors.fillMid);
    gradient.addColorStop(0.15, colors.fillMid);
    gradient.addColorStop(0.20, colors.fillLight);
    gradient.addColorStop(0.75, colors.fillLight);
    gradient.addColorStop(0.80, colors.fillMid);
    gradient.addColorStop(1, colors.fillDark);

    ctx.fillStyle = gradient;
    ctx.fillText(text, x, y);

    // 4b: Inner highlight (top-left edge shine)
    const highlightColor = isNumber
      ? `rgba(255, 247, 197, ${BEVEL.INNER_HIGHLIGHT_ALPHA})`
      : `rgba(255, 255, 255, ${BEVEL.INNER_HIGHLIGHT_ALPHA})`;

    const highlightGradient = ctx.createLinearGradient(
      x, y - halfHeight,
      x, y - halfHeight * 0.3
    );
    highlightGradient.addColorStop(0, highlightColor);
    highlightGradient.addColorStop(0.5, this.adjustAlpha(highlightColor, 0.3));
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGradient;
    ctx.fillText(text, x, y);

    // 4c: Bottom inner shadow
    const shadowGradient = ctx.createLinearGradient(
      x, y + halfHeight * 0.4,  // Start 70% down
      x, y + halfHeight
    );
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGradient.addColorStop(1, `rgba(0, 0, 0, ${BEVEL.BOTTOM_SHADOW_ALPHA})`);

    ctx.fillStyle = shadowGradient;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /**
   * Layer 5: Front gloss overlay
   */
  private renderGloss(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    font: string
  ): void {
    const halfHeight = fontSize / 2;
    const glossHeight = fontSize * GLOSS.HEIGHT;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // White → transparent vertical gradient over top portion
    const glossGradient = ctx.createLinearGradient(
      x, y - halfHeight,
      x, y - halfHeight + glossHeight
    );
    glossGradient.addColorStop(0, `rgba(255, 255, 255, ${GLOSS.TOP_ALPHA})`);
    glossGradient.addColorStop(0.5, `rgba(255, 255, 255, ${GLOSS.MID_ALPHA})`);
    glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = glossGradient;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /**
   * Helper: Adjust alpha of an rgba color string
   */
  private adjustAlpha(color: string, alpha: number): string {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    return color;
  }
}

// ============================================================================
// Main Public API
// ============================================================================

// Singleton cache instance (created on first use)
let globalCache: ComboSignCache | null = null;

/**
 * Get or create the global ComboSignCache
 */
export function getComboSignCache(dpr: number = 1): ComboSignCache {
  if (!globalCache || globalCache['dpr'] !== dpr) {
    globalCache = new ComboSignCache(dpr);
  }
  return globalCache;
}

/**
 * Draw the complete combo sign centered at the given position
 */
export function drawComboSign(
  ctx: CanvasRenderingContext2D,
  opts: ComboSignOptions
): void {
  const {
    comboText = 'Combo',
    value,
    centerX,
    centerY,
    baseFontSize,
    wordColorScheme = DEFAULT_WORD_COLORS,
    numberColorScheme = DEFAULT_NUMBER_COLORS,
    scale = 1,
    opacity = 1,
  } = opts;

  // Get DPR from canvas context
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  const cache = getComboSignCache(dpr);

  // Get cached sprites
  const wordSprite = cache.getWordSprite(comboText, baseFontSize, wordColorScheme);
  const numberSprite = cache.getNumberSprite(value, baseFontSize, numberColorScheme);

  // Calculate layout using actual text widths (not canvas widths which include padding)
  const gap = baseFontSize * LAYOUT.GAP;
  const totalTextWidth = wordSprite.textWidth + gap + numberSprite.textWidth;

  // Calculate center positions for the text itself
  const wordTextCenterX = centerX - totalTextWidth / 2 + wordSprite.textWidth / 2;
  const numberTextCenterX = centerX + totalTextWidth / 2 - numberSprite.textWidth / 2;
  const numberNudgeY = baseFontSize * LAYOUT.NUMBER_NUDGE_Y;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Apply scale transform around center
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  // Draw word sprite (canvas is centered on the text, so offset by half canvas width)
  ctx.drawImage(
    wordSprite.canvas,
    wordTextCenterX - wordSprite.width / 2,
    centerY - wordSprite.baseline,
    wordSprite.width,
    wordSprite.height
  );

  // Draw number sprite
  ctx.drawImage(
    numberSprite.canvas,
    numberTextCenterX - numberSprite.width / 2,
    centerY - numberSprite.baseline + numberNudgeY,
    numberSprite.width,
    numberSprite.height
  );

  ctx.restore();
}

/**
 * Get the center X position of the number in a combo sign.
 * Used to position the starburst VFX behind the number.
 */
export function getNumberCenterX(
  comboText: string,
  value: number,
  centerX: number,
  baseFontSize: number
): number {
  const dpr = window.devicePixelRatio || 1;
  const cache = getComboSignCache(dpr);

  const wordSprite = cache.getWordSprite(comboText, baseFontSize, DEFAULT_WORD_COLORS);
  const numberSprite = cache.getNumberSprite(value, baseFontSize, DEFAULT_NUMBER_COLORS);

  const gap = baseFontSize * LAYOUT.GAP;
  const totalTextWidth = wordSprite.textWidth + gap + numberSprite.textWidth;

  return centerX + totalTextWidth / 2 - numberSprite.textWidth / 2;
}

/**
 * Clear the combo sign cache (call on window resize/DPR change)
 */
export function clearComboSignCache(): void {
  if (globalCache) {
    globalCache.clear();
    globalCache = null;
  }
}
