// BlockSpriteCache - Pre-renders block sprites for performance optimization
// Reduces per-block render from 5 canvas operations to 1 drawImage

import { BlockColor, BLOCK_COLORS, COLORS, CELL_SIZE, CELL_SIZE_DROP } from '../data/constants';
import { lighten, darken } from '../utils/colors';

// Size configurations for pre-rendering
const SPRITE_SIZES = [CELL_SIZE, CELL_SIZE_DROP, 16]; // Grid, drop area, preview

export class BlockSpriteCache {
  private sprites: Map<string, OffscreenCanvas> = new Map();
  // Device pixel ratio for high-DPI (retina) display support
  private dpr: number;

  constructor(dpr: number = 1) {
    this.dpr = dpr;
    // Lazy initialization - sprites are created on first use, not at startup
    // This speeds up initial page load
  }

  // Get or create a sprite for the given color and size
  private getOrCreateSprite(color: BlockColor, size: number): OffscreenCanvas | null {
    // Only cache sprites for known sizes
    if (!SPRITE_SIZES.includes(size)) {
      return null;
    }

    const key = `${color}_${size}`;
    let sprite = this.sprites.get(key);

    if (!sprite) {
      sprite = this.prerenderBlock(color, size);
      this.sprites.set(key, sprite);
    }

    return sprite;
  }

  private prerenderBlock(color: BlockColor, size: number): OffscreenCanvas {
    // Create at physical resolution for crisp rendering on high-DPI displays
    const physicalSize = size * this.dpr;
    const canvas = new OffscreenCanvas(physicalSize, physicalSize);
    const ctx = canvas.getContext('2d')!;

    // Scale context so drawing code uses logical coordinates
    ctx.scale(this.dpr, this.dpr);

    const colorHex = COLORS[color];
    const borderWidth = 1;
    const radius = 2;
    const bevelWidth = size * 0.08;

    // 1. DARK BORDER (fills entire cell, creates connected look)
    ctx.fillStyle = darken(colorHex, 45);
    this.roundRect(ctx, 0, 0, size, size, radius);
    ctx.fill();

    // Inner block area (inside the border)
    const innerX = borderWidth;
    const innerY = borderWidth;
    const innerSize = size - borderWidth * 2;

    // 2. BASE LAYER for bevel (bottom-right shadow)
    ctx.fillStyle = darken(colorHex, 25);
    this.roundRect(ctx, innerX, innerY, innerSize, innerSize, Math.max(0, radius - 1));
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
      ctx,
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

    return canvas;
  }

  private roundRect(
    ctx: OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
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

  // Draw a cached block sprite (lazy-creates sprite on first use)
  public drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: BlockColor,
    opacity: number = 1.0
  ): boolean {
    const sprite = this.getOrCreateSprite(color, size);

    if (!sprite) {
      // Size not supported - return false to fall back to direct rendering
      return false;
    }

    // Draw physical-resolution sprite at logical size (DPR transform handles scaling)
    if (opacity < 1.0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(sprite, x, y, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, x, y, size, size);
    }

    return true;
  }

  // Check if a sprite exists for the given size
  public hasSprite(size: number): boolean {
    return SPRITE_SIZES.includes(size);
  }
}
