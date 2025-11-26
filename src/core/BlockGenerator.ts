// BlockGenerator - Handles block generation with weighted randomization
// Implements F (Favorable), R (Random), S (Standard), A (Ad Continue) modes

import { BlockColor, BLOCK_COLORS, GenerationMode, FIGURE_UNLOCK } from '../data/constants';
import { FIGURES, BlockShape } from '../data/figures';
import { SCENARIOS, getWeight, getWeightsForDrop } from '../data/config';
import { Block, createBlock } from './Block';
import { Grid, GridCell } from './Grid';
import { weightedRandom, clone2DArray } from '../utils/math';

export class BlockGenerator {
  private dropCount: number = 0;
  private lastThreeShapeIds: string[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.dropCount = 0;
    this.lastThreeShapeIds = [];
  }

  // Get current drop number
  public getDropCount(): number {
    return this.dropCount;
  }

  // Increment drop count (call after placing a block)
  public incrementDrop(): void {
    this.dropCount++;
  }

  // Get the scenario mode for current drop
  public getCurrentScenario(): GenerationMode {
    if (this.dropCount < 1) return 'F';
    if (this.dropCount > 40) return 'S';
    return SCENARIOS[this.dropCount - 1] || 'S';
  }

  // Get available figures based on current drop count
  public getAvailableFigures(): BlockShape[] {
    const { initialCount, unlockThreshold, unlockRate, unlockInterval } = FIGURE_UNLOCK;

    let count = initialCount;

    if (this.dropCount > unlockThreshold) {
      const extraUnlocks = Math.floor((this.dropCount - unlockThreshold) / unlockInterval);
      count = Math.min(initialCount + extraUnlocks * unlockRate, FIGURES.length);
    }

    return FIGURES.slice(0, count);
  }

  // Generate 3 blocks for a turn
  public generateThree(grid: Grid): Block[] {
    const blocks: Block[] = [];
    const scenario = this.getCurrentScenario();

    for (let i = 0; i < 3; i++) {
      let block: Block;

      if (scenario === 'A') {
        // Ad continue mode: 2 single blocks + 1 favorable
        if (i < 2) {
          const singleShape = FIGURES.find(f => f.id === 'Iv1');
          block = createBlock(singleShape || FIGURES[0]);
        } else {
          block = this.generateFavorable(grid);
        }
      } else if (scenario === 'F') {
        // Favorable mode - AI assisted
        block = this.generateFavorable(grid);
      } else {
        // Random/Standard mode
        block = this.generateRandom();
      }

      blocks.push(block);
      this.trackBlock(block.shape.id);
    }

    return blocks;
  }

  // Generate a single random block
  public generateRandom(): Block {
    const available = this.getAvailableFigures();
    const dropIndex = Math.min(Math.max(this.dropCount, 1), 40);

    // Get weights for current drop
    const weights: number[] = [];
    const validFigures: BlockShape[] = [];

    for (let i = 0; i < available.length; i++) {
      const weight = getWeight(i, dropIndex);

      // Skip if weight is 0 or was used recently
      if (weight > 0 && !this.lastThreeShapeIds.includes(available[i].id)) {
        weights.push(weight);
        validFigures.push(available[i]);
      }
    }

    // If no valid figures (shouldn't happen), fall back to any available
    if (validFigures.length === 0) {
      const fallbackIndex = Math.floor(Math.random() * available.length);
      return createBlock(available[fallbackIndex]);
    }

    // Weighted random selection
    const selected = weightedRandom(validFigures, weights);
    return createBlock(selected || validFigures[0]);
  }

  // Generate a favorable block (AI-assisted selection)
  public generateFavorable(grid: Grid): Block {
    const available = this.getAvailableFigures();
    const dropIndex = Math.min(Math.max(this.dropCount, 1), 40);

    interface Candidate {
      figure: BlockShape;
      score: number;
      weight: number;
    }

    const candidates: Candidate[] = [];
    const gridState = grid.getState();

    for (let i = 0; i < available.length; i++) {
      const figure = available[i];
      const weight = getWeight(i, dropIndex);

      // Skip single blocks in favorable mode
      if (figure.id === 'Iv1') continue;

      // Skip if weight is 0 or used recently
      if (weight <= 0 || this.lastThreeShapeIds.includes(figure.id)) continue;

      // Evaluate this figure at all possible positions
      const score = this.evaluateFigure(figure, gridState, grid.getSize());

      if (score > 0) {
        candidates.push({ figure, score, weight });
      }
    }

    // Sort by score (desc), then block count (desc), then weight (desc)
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.figure.blockCount !== a.figure.blockCount) return b.figure.blockCount - a.figure.blockCount;
      return b.weight - a.weight;
    });

    // Select top candidate or fall back to random
    if (candidates.length > 0) {
      // Add some randomness - pick from top candidates with weighted probability
      const topCandidates = candidates.slice(0, Math.min(5, candidates.length));
      const topWeights = topCandidates.map(c => c.score);
      const selected = weightedRandom(topCandidates, topWeights);
      return createBlock(selected?.figure || candidates[0].figure);
    }

    // Fallback to random if no favorable option found
    return this.generateRandom();
  }

  // Evaluate a figure's potential at all grid positions
  private evaluateFigure(figure: BlockShape, gridState: GridCell[][], gridSize: number): number {
    let bestScore = 0;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        // Check if figure can be placed at this position
        if (!this.canPlaceAt(figure, gridState, x, y, gridSize)) continue;

        // Calculate score for this placement
        const score = this.calculatePlacementScore(figure, gridState, x, y, gridSize);
        bestScore = Math.max(bestScore, score);
      }
    }

    return bestScore;
  }

  // Check if a figure can be placed at a position on a grid state
  private canPlaceAt(figure: BlockShape, gridState: GridCell[][], x: number, y: number, gridSize: number): boolean {
    for (const [dx, dy] of figure.cells) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) return false;
      if (gridState[ny][nx].occupied) return false;
    }
    return true;
  }

  // Calculate placement score for a figure at a position
  private calculatePlacementScore(
    figure: BlockShape,
    gridState: GridCell[][],
    x: number,
    y: number,
    gridSize: number
  ): number {
    // Temporarily place the figure
    const tempState = clone2DArray(gridState);
    for (const [dx, dy] of figure.cells) {
      tempState[y + dy][x + dx] = { occupied: true, color: null };
    }

    // Count completed lines
    let linesCompleted = 0;

    // Check rows
    for (let row = 0; row < gridSize; row++) {
      let complete = true;
      for (let col = 0; col < gridSize; col++) {
        if (!tempState[row][col].occupied) {
          complete = false;
          break;
        }
      }
      if (complete) linesCompleted++;
    }

    // Check columns
    for (let col = 0; col < gridSize; col++) {
      let complete = true;
      for (let row = 0; row < gridSize; row++) {
        if (!tempState[row][col].occupied) {
          complete = false;
          break;
        }
      }
      if (complete) linesCompleted++;
    }

    // Base score from lines
    const lineScores: Record<number, number> = { 1: 10, 2: 30, 3: 60, 4: 100, 5: 150 };
    let score = lineScores[linesCompleted] || (linesCompleted > 5 ? linesCompleted * 35 : 0);

    // Bonus for placing lower on the grid (fills from bottom)
    score += (gridSize - 1 - y) * 2;

    // Bonus for block count (prefer larger blocks)
    score += figure.blockCount;

    return score;
  }

  // Track recently used blocks to avoid repetition
  private trackBlock(shapeId: string): void {
    this.lastThreeShapeIds.push(shapeId);
    if (this.lastThreeShapeIds.length > 3) {
      this.lastThreeShapeIds.shift();
    }
  }

  // Generate blocks for ad continue (special mode)
  public generateAdContinue(grid: Grid): Block[] {
    const blocks: Block[] = [];

    // 2 single blocks
    const singleShape = FIGURES.find(f => f.id === 'Iv1') || FIGURES[0];
    blocks.push(createBlock(singleShape));
    blocks.push(createBlock(singleShape));

    // 1 favorable block
    blocks.push(this.generateFavorable(grid));

    return blocks;
  }
}
