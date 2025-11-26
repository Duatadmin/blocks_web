// ScoreManager - Handles scoring and combo system

import { SCORE, COMBO_MESSAGES } from '../data/constants';

export interface ComboResult {
  basePoints: number;
  linePoints: number;
  comboMultiplier: number;
  totalPoints: number;
  isCombo: boolean;
  comboStreak: number;
  message: string;
  isFieldClear: boolean;
  fieldClearBonus: number;
}

export class ScoreManager {
  private score: number = 0;
  private highScore: number = 0;
  private currentMove: number = 0;
  private lastComboMove: number = -10;
  private comboStreak: number = 0;

  constructor() {
    this.loadHighScore();
  }

  public reset(): void {
    this.score = 0;
    this.currentMove = 0;
    this.lastComboMove = -10;
    this.comboStreak = 0;
  }

  public getScore(): number {
    return this.score;
  }

  public getHighScore(): number {
    return this.highScore;
  }

  public getComboStreak(): number {
    return this.comboStreak;
  }

  // Calculate points for line clears
  public calculateLinePoints(lineCount: number): number {
    if (lineCount <= 0) return 0;
    if (lineCount <= 5) {
      return SCORE.linePoints[lineCount] || 0;
    }
    // 6+ lines: 35 per line
    return lineCount * SCORE.linePointsPerLine;
  }

  // Process a block placement and return combo result
  public processPlacement(
    cellsPlaced: number,
    linesCleared: number,
    isFieldClear: boolean = false
  ): ComboResult {
    this.currentMove++;

    const basePoints = cellsPlaced;
    const linePoints = this.calculateLinePoints(linesCleared);

    // Determine if this continues a combo
    let comboMultiplier = 1;
    let isCombo = false;

    if (linesCleared > 0) {
      // Check if within combo window
      if (this.currentMove - this.lastComboMove <= SCORE.comboWindow) {
        this.comboStreak++;
        isCombo = true;
      } else {
        this.comboStreak = 1;
      }

      this.lastComboMove = this.currentMove;
      comboMultiplier = Math.max(2, this.comboStreak + 1);
    } else {
      // No lines cleared, but don't reset combo yet (within window)
      if (this.currentMove - this.lastComboMove > SCORE.comboWindow) {
        this.comboStreak = 0;
      }
      comboMultiplier = 1;
    }

    // Calculate field clear bonus
    const fieldClearBonus = isFieldClear ? SCORE.fieldClearBonus : 0;

    // Calculate total points
    let totalPoints = basePoints;
    if (linesCleared > 0) {
      totalPoints += linePoints * (isCombo ? comboMultiplier : 1);
    }
    totalPoints += fieldClearBonus;

    // Add to score
    this.score += totalPoints;

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    // Get message
    const message = this.getMessage(linesCleared, this.comboStreak, isCombo);

    return {
      basePoints,
      linePoints,
      comboMultiplier: isCombo ? comboMultiplier : 1,
      totalPoints,
      isCombo,
      comboStreak: this.comboStreak,
      message,
      isFieldClear,
      fieldClearBonus,
    };
  }

  // Get the display message for a line clear
  private getMessage(linesCleared: number, streak: number, isCombo: boolean): string {
    if (linesCleared === 0) return '';

    if (isCombo && streak > 1) {
      return `x${streak + 1} COMBO!`;
    }

    return COMBO_MESSAGES[Math.min(linesCleared, 6)] || '';
  }

  // Load high score from localStorage
  private loadHighScore(): void {
    try {
      const saved = localStorage.getItem('blockPuzzle_highScore');
      if (saved) {
        this.highScore = parseInt(saved, 10) || 0;
      }
    } catch {
      // localStorage not available
      this.highScore = 0;
    }
  }

  // Save high score to localStorage
  private saveHighScore(): void {
    try {
      localStorage.setItem('blockPuzzle_highScore', this.highScore.toString());
    } catch {
      // localStorage not available
    }
  }

  // Check if heart should pulse (score threshold)
  public shouldHeartPulse(): boolean {
    return this.score >= 2000;
  }

  // Get heart pulse speed multiplier based on combo
  public getHeartPulseSpeed(): number {
    if (this.comboStreak <= 1) return 1.0;
    return 1.0 + (this.comboStreak - 1) * 0.02; // +2% per combo level
  }
}
