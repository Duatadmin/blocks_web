// DragDropManager - Handles block dragging and dropping
// Matches the Godot implementation logic

import { Block } from '../core/Block';
import { getShapeBounds } from '../data/figures';
import { Grid } from '../core/Grid';
import { Point, pointInRect, Rect, clamp } from '../utils/math';
import { CELL_SIZE, CELL_SIZE_DROP, VIEWPORT_WIDTH, GRID_SIZE } from '../data/constants';
import { InputManager, InputEvent } from './InputManager';
import { Renderer, DragState, HighlightedCell } from '../rendering/Renderer';

export interface DragDropCallbacks {
  onDragStart?: (block: Block, slotIndex: number) => void;
  onDragMove?: (dragState: DragState) => void;
  onDrop?: (block: Block, gridPos: Point, slotIndex: number) => void;
  onDragCancel?: (block: Block, slotIndex: number) => void;
}

export class DragDropManager {
  private grid: Grid;
  private renderer: Renderer;
  private inputManager: InputManager;
  private callbacks: DragDropCallbacks;

  private dropBlocks: (Block | null)[] = [null, null, null];
  private currentDrag: DragState | null = null;
  private dragSlotIndex: number = -1;
  private highlightedCells: HighlightedCell[] = [];

  // Drag offset - calculated when drag starts
  // Block's bottom-center at touch point, then offset 2 cells above
  private dragOffset: Point = { x: 0, y: 0 };

  // Pre-calculated cell boundaries for optimized grid snapping
  private cellBoundariesX: number[] = [];
  private cellBoundariesY: number[] = [];

  // Cache for last calculated grid position to avoid redundant calculations
  private lastCalculatedGridPos: Point | null = null;
  private lastValidityCheck: boolean = false;

  constructor(
    grid: Grid,
    renderer: Renderer,
    inputManager: InputManager,
    callbacks: DragDropCallbacks = {}
  ) {
    this.grid = grid;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this.callbacks = callbacks;

    // Pre-calculate cell boundaries
    this.initializeCellBoundaries();

    this.inputManager.onInput(this.handleInput);
  }

  private initializeCellBoundaries(): void {
    // Pre-calculate cell boundaries for optimized grid position calculations
    // Boundary is at the midpoint between cells (50% threshold for snapping)
    this.cellBoundariesX = [];
    this.cellBoundariesY = [];

    for (let i = 0; i <= GRID_SIZE; i++) {
      const boundary = i * CELL_SIZE - CELL_SIZE * 0.5;
      this.cellBoundariesX.push(boundary);
      this.cellBoundariesY.push(boundary);
    }
  }

  public setBlocks(blocks: (Block | null)[]): void {
    this.dropBlocks = [...blocks];
  }

  public getBlocks(): (Block | null)[] {
    return this.dropBlocks;
  }

  public getDragState(): DragState | null {
    return this.currentDrag;
  }

  public getHighlightedCells(): HighlightedCell[] {
    return this.highlightedCells;
  }

  public clearSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < 3) {
      this.dropBlocks[slotIndex] = null;
    }
  }

  private handleInput = (event: InputEvent): void => {
    switch (event.type) {
      case 'down':
        this.handlePointerDown(event.position);
        break;
      case 'move':
        this.handlePointerMove(event.position);
        break;
      case 'up':
        this.handlePointerUp(event.position);
        break;
      case 'cancel':
        this.handlePointerCancel();
        break;
    }
  };

  private handlePointerDown(position: Point): void {
    // Check if pointer is on any block in drop area
    for (let i = 0; i < 3; i++) {
      const block = this.dropBlocks[i];
      if (!block) continue;

      const bounds = this.renderer.getDropBlockBounds(block, i);

      // Add touch margin (one block cell around the block)
      const touchMargin = CELL_SIZE_DROP;
      const expandedBounds: Rect = {
        x: bounds.x - touchMargin,
        y: bounds.y - touchMargin,
        width: bounds.width + touchMargin * 2,
        height: bounds.height + touchMargin * 2,
      };

      if (pointInRect(position, expandedBounds)) {
        this.startDrag(block, i, position);
        return;
      }
    }
  }

  private startDrag(block: Block, slotIndex: number, touchPosition: Point): void {
    this.dragSlotIndex = slotIndex;

    // Reset cache
    this.lastCalculatedGridPos = null;
    this.lastValidityCheck = false;

    // Calculate the actual size of the block at grid cell size
    // Uses normalized bounds (width/height based on min-max span)
    const bounds = getShapeBounds(block.shape);
    const actualWidth = bounds.width * CELL_SIZE;
    const actualHeight = bounds.height * CELL_SIZE;

    // Calculate drag offset:
    // Block's bottom-center at touch point, then offset 2 cells above
    const verticalOffset = -2 * CELL_SIZE;
    this.dragOffset = {
      x: -actualWidth / 2,
      y: -actualHeight + verticalOffset,
    };

    // Calculate initial drag position (top-left of dragging visual)
    const dragPosition: Point = {
      x: touchPosition.x + this.dragOffset.x,
      y: touchPosition.y + this.dragOffset.y,
    };

    // Calculate grid position from the dragging visual position
    const gridPos = this.getGridPositionFromVisual(dragPosition);
    const isValid = gridPos !== null && this.grid.canPlace(block.shape, gridPos);

    this.currentDrag = {
      block,
      screenPosition: dragPosition,
      gridPosition: gridPos,
      isValidPlacement: isValid,
    };

    // Update highlights
    this.updateHighlights();

    this.callbacks.onDragStart?.(block, slotIndex);
  }

  private handlePointerMove(position: Point): void {
    if (!this.currentDrag) return;

    // Calculate drag position (top-left of dragging visual)
    const dragPosition: Point = {
      x: position.x + this.dragOffset.x,
      y: position.y + this.dragOffset.y,
    };

    // Calculate grid position from the dragging visual position
    const gridPos = this.getGridPositionFromVisual(dragPosition);

    // Skip processing if grid position hasn't changed
    if (
      this.lastCalculatedGridPos &&
      gridPos &&
      gridPos.x === this.lastCalculatedGridPos.x &&
      gridPos.y === this.lastCalculatedGridPos.y
    ) {
      // Just update screen position
      this.currentDrag = {
        ...this.currentDrag,
        screenPosition: dragPosition,
      };
      this.callbacks.onDragMove?.(this.currentDrag);
      return;
    }

    this.lastCalculatedGridPos = gridPos;

    const isValid = gridPos !== null && this.grid.canPlace(this.currentDrag.block.shape, gridPos);
    this.lastValidityCheck = isValid;

    this.currentDrag = {
      ...this.currentDrag,
      screenPosition: dragPosition,
      gridPosition: gridPos,
      isValidPlacement: isValid,
    };

    // Update highlights
    this.updateHighlights();

    this.callbacks.onDragMove?.(this.currentDrag);
  }

  private handlePointerUp(position: Point): void {
    if (!this.currentDrag) return;

    const { block, gridPosition, isValidPlacement } = this.currentDrag;
    const slotIndex = this.dragSlotIndex;

    if (gridPosition && isValidPlacement) {
      // Valid drop - notify callback
      this.callbacks.onDrop?.(block, gridPosition, slotIndex);
    } else {
      // Invalid drop - return to slot
      this.callbacks.onDragCancel?.(block, slotIndex);
    }

    // Clear drag state
    this.currentDrag = null;
    this.dragSlotIndex = -1;
    this.highlightedCells = [];
    this.lastCalculatedGridPos = null;
  }

  private handlePointerCancel(): void {
    if (!this.currentDrag) return;

    const { block } = this.currentDrag;
    const slotIndex = this.dragSlotIndex;

    this.callbacks.onDragCancel?.(block, slotIndex);

    this.currentDrag = null;
    this.dragSlotIndex = -1;
    this.highlightedCells = [];
    this.lastCalculatedGridPos = null;
  }

  // Get grid position from the top-left of the dragging visual
  // Uses pre-calculated boundaries for optimized snapping
  private getGridPositionFromVisual(visualPos: Point): Point | null {
    const gridOrigin = this.renderer.getGridOrigin();

    // Convert to grid-local coordinates
    const localX = visualPos.x - gridOrigin.x;
    const localY = visualPos.y - gridOrigin.y;

    // Use boundary-based grid position calculation (matches Godot logic)
    let gridX = 0;
    let gridY = 0;

    // Find which cell we're in by checking boundaries
    for (let i = 0; i < this.cellBoundariesX.length - 1; i++) {
      if (localX >= this.cellBoundariesX[i]) {
        gridX = i;
      } else {
        break;
      }
    }

    for (let i = 0; i < this.cellBoundariesY.length - 1; i++) {
      if (localY >= this.cellBoundariesY[i]) {
        gridY = i;
      } else {
        break;
      }
    }

    // Clamp to valid grid range
    gridX = clamp(gridX, 0, GRID_SIZE - 1);
    gridY = clamp(gridY, 0, GRID_SIZE - 1);

    return { x: gridX, y: gridY };
  }

  private updateHighlights(): void {
    this.highlightedCells = [];

    if (!this.currentDrag || !this.currentDrag.gridPosition || !this.currentDrag.isValidPlacement) {
      return;
    }

    const { block, gridPosition } = this.currentDrag;

    // Get lines that would complete
    const completableLines = this.grid.getCompletableLines(block.shape, gridPosition);

    if (completableLines.length === 0) return;

    const isCombo = completableLines.length >= 3;

    // Get all cells in completable lines
    for (const lineIndex of completableLines) {
      const cells = this.grid.getLineCells(lineIndex);
      for (const cell of cells) {
        // Avoid duplicates
        if (!this.highlightedCells.some(h => h.x === cell.x && h.y === cell.y)) {
          // Check if this cell is empty or occupied
          const gridCell = this.grid.getCell(cell.x, cell.y);
          const isEmpty = !gridCell || !gridCell.occupied;

          this.highlightedCells.push({
            x: cell.x,
            y: cell.y,
            color: block.color,
            isCombo,
            isEmpty,
          });
        }
      }
    }
  }

  public isDragging(): boolean {
    return this.currentDrag !== null;
  }

  public destroy(): void {
    // InputManager cleanup is handled separately
  }
}
