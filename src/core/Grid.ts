// Grid - Core game grid management
// 8x8 grid that handles block placement, line detection, and clearing

import { GRID_SIZE, CELL_SIZE, BlockColor } from '../data/constants';
import { BlockShape, getShapeBounds } from '../data/figures';
import { Point, create2DArray, clone2DArray } from '../utils/math';

export interface GridCell {
  occupied: boolean;
  color: BlockColor | null;
}

export interface PlacementResult {
  success: boolean;
  cellsPlaced: Point[];
  linesCompleted: number[];  // Row indices 0-7, column indices 8-15
  pointsFromPlacement: number;
}

export interface LineInfo {
  index: number;      // 0-7 for rows, 8-15 for columns
  isRow: boolean;
  cells: Point[];
}

export class Grid {
  private cells: GridCell[][];
  private readonly size = GRID_SIZE;

  // Performance optimization: track occupied count per row/column
  // Allows O(1) line completion check instead of O(n) iteration
  private rowCounts: Uint8Array;
  private colCounts: Uint8Array;

  constructor() {
    this.cells = this.createEmptyGrid();
    this.rowCounts = new Uint8Array(GRID_SIZE);
    this.colCounts = new Uint8Array(GRID_SIZE);
  }

  private createEmptyGrid(): GridCell[][] {
    return create2DArray(this.size, this.size, { occupied: false, color: null });
  }

  // Reset the grid to empty state
  public reset(): void {
    this.cells = this.createEmptyGrid();
    this.rowCounts.fill(0);
    this.colCounts.fill(0);
  }

  // Get cell at position
  public getCell(x: number, y: number): GridCell | null {
    if (!this.isValidPosition(x, y)) return null;
    return this.cells[y][x];
  }

  // Check if position is within grid bounds
  public isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  // Check if a cell is occupied
  public isOccupied(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    return cell ? cell.occupied : true; // Out of bounds = occupied
  }

  // Check if a block shape can be placed at the given grid position
  // Uses normalized coordinates (shape starts at 0,0)
  public canPlace(shape: BlockShape, gridPos: Point): boolean {
    const bounds = getShapeBounds(shape);

    for (const [dx, dy] of shape.cells) {
      // Normalize coordinates
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = gridPos.x + normalizedX;
      const y = gridPos.y + normalizedY;

      // Check bounds
      if (!this.isValidPosition(x, y)) {
        return false;
      }

      // Check if cell is already occupied
      if (this.cells[y][x].occupied) {
        return false;
      }
    }
    return true;
  }

  // Place a block on the grid
  // Uses normalized coordinates (shape starts at 0,0)
  public place(shape: BlockShape, gridPos: Point, color: BlockColor): PlacementResult {
    if (!this.canPlace(shape, gridPos)) {
      return {
        success: false,
        cellsPlaced: [],
        linesCompleted: [],
        pointsFromPlacement: 0,
      };
    }

    const bounds = getShapeBounds(shape);
    const cellsPlaced: Point[] = [];

    // Place all cells of the shape
    for (const [dx, dy] of shape.cells) {
      // Normalize coordinates
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = gridPos.x + normalizedX;
      const y = gridPos.y + normalizedY;
      this.cells[y][x] = { occupied: true, color };
      // Update row/column counts for O(1) line completion check
      this.rowCounts[y]++;
      this.colCounts[x]++;
      cellsPlaced.push({ x, y });
    }

    // Check for completed lines
    const linesCompleted = this.findCompletedLines();

    return {
      success: true,
      cellsPlaced,
      linesCompleted,
      pointsFromPlacement: shape.blockCount,
    };
  }

  // Find all completed lines (rows and columns)
  // OPTIMIZED: Uses O(1) count lookup instead of O(n) iteration per line
  public findCompletedLines(): number[] {
    const completed: number[] = [];

    // Check rows (indices 0-7) - O(1) per row using counts
    for (let y = 0; y < this.size; y++) {
      if (this.rowCounts[y] === this.size) {
        completed.push(y);
      }
    }

    // Check columns (indices 8-15) - O(1) per column using counts
    for (let x = 0; x < this.size; x++) {
      if (this.colCounts[x] === this.size) {
        completed.push(x + this.size);
      }
    }

    return completed;
  }

  // Get which lines would be completed if a shape was placed
  // Uses normalized coordinates (shape starts at 0,0)
  // OPTIMIZED: Uses row/column counts instead of cloning the entire grid
  public getCompletableLines(shape: BlockShape, gridPos: Point): number[] {
    if (!this.canPlace(shape, gridPos)) {
      return [];
    }

    const bounds = getShapeBounds(shape);

    // Track how many new cells would be added to each row/column
    // Using small typed arrays on stack instead of cloning 64-cell grid
    const rowAdditions = new Uint8Array(this.size);
    const colAdditions = new Uint8Array(this.size);

    // Count shape cells per row and column
    for (const [dx, dy] of shape.cells) {
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = gridPos.x + normalizedX;
      const y = gridPos.y + normalizedY;
      rowAdditions[y]++;
      colAdditions[x]++;
    }

    const completed: number[] = [];

    // Check only rows that would receive new cells
    for (let y = 0; y < this.size; y++) {
      if (rowAdditions[y] > 0) {
        // Row would be complete if current count + new cells = grid size
        if (this.rowCounts[y] + rowAdditions[y] === this.size) {
          completed.push(y);
        }
      }
    }

    // Check only columns that would receive new cells
    for (let x = 0; x < this.size; x++) {
      if (colAdditions[x] > 0) {
        // Column would be complete if current count + new cells = grid size
        if (this.colCounts[x] + colAdditions[x] === this.size) {
          completed.push(x + this.size);
        }
      }
    }

    return completed;
  }

  // Get cells that belong to a line index
  public getLineCells(lineIndex: number): Point[] {
    const cells: Point[] = [];

    if (lineIndex < this.size) {
      // Row
      const y = lineIndex;
      for (let x = 0; x < this.size; x++) {
        cells.push({ x, y });
      }
    } else {
      // Column
      const x = lineIndex - this.size;
      for (let y = 0; y < this.size; y++) {
        cells.push({ x, y });
      }
    }

    return cells;
  }

  // Get all cells that would be cleared for given line indices
  public getCellsToClear(lineIndices: number[]): Point[] {
    const cellSet = new Set<string>();
    const cells: Point[] = [];

    for (const lineIndex of lineIndices) {
      const lineCells = this.getLineCells(lineIndex);
      for (const cell of lineCells) {
        const key = `${cell.x},${cell.y}`;
        if (!cellSet.has(key)) {
          cellSet.add(key);
          cells.push(cell);
        }
      }
    }

    return cells;
  }

  // Clear a single cell at given position
  public clearCell(x: number, y: number): void {
    if (this.isValidPosition(x, y) && this.cells[y][x].occupied) {
      this.cells[y][x] = { occupied: false, color: null };
      // Update row/column counts
      this.rowCounts[y]--;
      this.colCounts[x]--;
    }
  }

  // Clear cells at given positions
  public clearCells(cells: Point[]): void {
    for (const { x, y } of cells) {
      this.clearCell(x, y);
    }
  }

  // Clear completed lines and return cleared cells
  public clearLines(lineIndices: number[]): Point[] {
    const cellsToClear = this.getCellsToClear(lineIndices);
    this.clearCells(cellsToClear);
    return cellsToClear;
  }

  // Check if the grid is completely empty
  public isEmpty(): boolean {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.cells[y][x].occupied) {
          return false;
        }
      }
    }
    return true;
  }

  // Check if the grid is completely full
  public isFull(): boolean {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.cells[y][x].occupied) {
          return false;
        }
      }
    }
    return true;
  }

  // Count occupied cells
  public getOccupiedCount(): number {
    let count = 0;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.cells[y][x].occupied) {
          count++;
        }
      }
    }
    return count;
  }

  // Check if ANY of the given blocks can be placed anywhere
  public hasValidMoves(shapes: BlockShape[]): boolean {
    for (const shape of shapes) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (this.canPlace(shape, { x, y })) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Convert screen position to grid position
  public screenToGrid(screenX: number, screenY: number, gridOriginX: number, gridOriginY: number): Point | null {
    const localX = screenX - gridOriginX;
    const localY = screenY - gridOriginY;

    const gridX = Math.floor(localX / CELL_SIZE);
    const gridY = Math.floor(localY / CELL_SIZE);

    if (this.isValidPosition(gridX, gridY)) {
      return { x: gridX, y: gridY };
    }
    return null;
  }

  // Convert grid position to screen position (top-left of cell)
  public gridToScreen(gridX: number, gridY: number, gridOriginX: number, gridOriginY: number): Point {
    return {
      x: gridOriginX + gridX * CELL_SIZE,
      y: gridOriginY + gridY * CELL_SIZE,
    };
  }

  // Get a copy of the grid state (for AI evaluation)
  public getState(): GridCell[][] {
    return clone2DArray(this.cells);
  }

  // Set grid state (for AI evaluation)
  public setState(state: GridCell[][]): void {
    this.cells = clone2DArray(state);
    // Recalculate row/column counts from the new state
    this.recalculateCounts();
  }

  // Recalculate row/column counts from current cell state
  private recalculateCounts(): void {
    this.rowCounts.fill(0);
    this.colCounts.fill(0);
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.cells[y][x].occupied) {
          this.rowCounts[y]++;
          this.colCounts[x]++;
        }
      }
    }
  }

  // Get grid size
  public getSize(): number {
    return this.size;
  }

  // Iterate over all cells (for rendering)
  public forEachCell(callback: (x: number, y: number, cell: GridCell) => void): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        callback(x, y, this.cells[y][x]);
      }
    }
  }
}
