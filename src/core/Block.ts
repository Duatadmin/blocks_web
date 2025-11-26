// Block - Represents a draggable block piece

import { BlockColor, BLOCK_COLORS } from '../data/constants';
import { BlockShape, getShapeBounds } from '../data/figures';
import { Point } from '../utils/math';

export interface Block {
  shape: BlockShape;
  color: BlockColor;
  id: number;  // Unique identifier for this block instance
}

let blockIdCounter = 0;

// Create a new block with a random color
export function createBlock(shape: BlockShape, color?: BlockColor): Block {
  return {
    shape,
    color: color ?? BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
    id: ++blockIdCounter,
  };
}

// Get the bounding box dimensions of a block
export function getBlockBounds(block: Block): { width: number; height: number } {
  const bounds = getShapeBounds(block.shape);
  return { width: bounds.width, height: bounds.height };
}

// Get all cell positions of a block when placed at a grid position (using normalized coordinates)
export function getBlockCells(block: Block, gridPos: Point): Point[] {
  const bounds = getShapeBounds(block.shape);
  return block.shape.cells.map(([dx, dy]) => ({
    x: gridPos.x + (dx - bounds.minX),
    y: gridPos.y + (dy - bounds.minY),
  }));
}

// Get the center offset of a block shape (for drag positioning)
export function getBlockCenter(block: Block, cellSize: number): Point {
  const bounds = getShapeBounds(block.shape);
  return {
    x: (bounds.width * cellSize) / 2,
    y: (bounds.height * cellSize) / 2,
  };
}

// Calculate the visual size of a block in pixels
export function getBlockPixelSize(block: Block, cellSize: number): { width: number; height: number } {
  const bounds = getShapeBounds(block.shape);
  return {
    width: bounds.width * cellSize,
    height: bounds.height * cellSize,
  };
}
