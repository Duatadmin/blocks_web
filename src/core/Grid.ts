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

  constructor() {
    this.cells = this.createEmptyGrid();
  }

  private createEmptyGrid(): GridCell[][] {
    return create2DArray(this.size, this.size, { occupied: false, color: null });
  }

  // Reset the grid to empty state
  public reset(): void {
    this.cells = this.createEmptyGrid();
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
  public findCompletedLines(): number[] {
    const completed: number[] = [];

    // Check rows (indices 0-7)
    for (let y = 0; y < this.size; y++) {
      let rowComplete = true;
      for (let x = 0; x < this.size; x++) {
        if (!this.cells[y][x].occupied) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        completed.push(y); // Row index
      }
    }

    // Check columns (indices 8-15)
    for (let x = 0; x < this.size; x++) {
      let colComplete = true;
      for (let y = 0; y < this.size; y++) {
        if (!this.cells[y][x].occupied) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) {
        completed.push(x + this.size); // Column index offset by grid size
      }
    }

    return completed;
  }

  // Get which lines would be completed if a shape was placed
  // Uses normalized coordinates (shape starts at 0,0)
  public getCompletableLines(shape: BlockShape, gridPos: Point): number[] {
    if (!this.canPlace(shape, gridPos)) {
      return [];
    }

    const bounds = getShapeBounds(shape);

    // Create a temporary copy of the grid
    const tempCells = clone2DArray(this.cells);

    // Temporarily place the shape (with normalized coordinates)
    for (const [dx, dy] of shape.cells) {
      const normalizedX = dx - bounds.minX;
      const normalizedY = dy - bounds.minY;
      const x = gridPos.x + normalizedX;
      const y = gridPos.y + normalizedY;
      tempCells[y][x] = { occupied: true, color: null };
    }

    const completed: number[] = [];

    // Check rows
    for (let y = 0; y < this.size; y++) {
      let rowComplete = true;
      for (let x = 0; x < this.size; x++) {
        if (!tempCells[y][x].occupied) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        completed.push(y);
      }
    }

    // Check columns
    for (let x = 0; x < this.size; x++) {
      let colComplete = true;
      for (let y = 0; y < this.size; y++) {
        if (!tempCells[y][x].occupied) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) {
        completed.push(x + this.size);
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
    if (this.isValidPosition(x, y)) {
      this.cells[y][x] = { occupied: false, color: null };
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
