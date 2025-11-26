# Block Design System

This file contains the enhanced block rendering code to be integrated into the Renderer.

## Block Rendering Method

Replace the `renderBlock` method in `src/rendering/Renderer.ts` with:

```typescript
// Render a single block with modern styling - enhanced bevel, no grid lines per spec
public renderBlock(x: number, y: number, size: number, color: BlockColor, opacity: number = 1.0): void {
  const colorHex = COLORS[color];
  const margin = size * 0.06; // 6% inset per spec
  const innerX = x + margin;
  const innerY = y + margin;
  const innerSize = size - margin * 2;
  const radius = size * 0.12;
  const ctx = this.ctx;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Drop shadow per spec: (0, 4px) offset, 4-6px blur
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  // Main block gradient with enhanced contrast per spec (+25%, -28%)
  const gradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerSize);
  gradient.addColorStop(0, lighten(colorHex, 25));    // +25% brightness
  gradient.addColorStop(0.5, colorHex);
  gradient.addColorStop(1, darken(colorHex, 28));     // -28% brightness

  ctx.fillStyle = gradient;
  this.roundRect(innerX, innerY, innerSize, innerSize, radius);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // NO INNER GRID LINES - clean solid blocks

  // Subtle top highlight (matte finish)
  const highlightGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerSize * 0.3);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = highlightGradient;
  this.roundRect(innerX, innerY, innerSize, innerSize * 0.35, radius);
  ctx.fill();

  // Inner border highlight
  ctx.strokeStyle = toRgba(lighten(colorHex, 30), 0.3);
  ctx.lineWidth = 1;
  this.roundRect(innerX + 1, innerY + 1, innerSize - 2, innerSize - 2, radius - 1);
  ctx.stroke();

  ctx.restore();
}
```

## Required Color Utilities

Add to `src/utils/colors.ts`:

```typescript
// Lighten a hex color by a percentage (0-100)
export function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Darken a hex color by a percentage (0-100)
export function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Convert hex color to rgba string
export function toRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = (num >> 16) & 0xff;
  const G = (num >> 8) & 0xff;
  const B = num & 0xff;
  return `rgba(${R}, ${G}, ${B}, ${alpha})`;
}
```

## Design Specifications

- **Inset Margin**: 6% of cell size (blocks don't touch edges)
- **Corner Radius**: 12% of cell size
- **Drop Shadow**: (0, 4px) offset, 5px blur, rgba(0,0,0,0.45)
- **Gradient**: Top +25% brightness, middle base color, bottom -28% brightness
- **Top Highlight**: White 20% opacity gradient covering top 35%
- **Inner Border**: Lightened color at 30% opacity
- **No inner grid lines** (clean solid blocks)
