// Math utilities

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Inverse linear interpolation
export function invLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a);
}

// Remap a value from one range to another
export function remap(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const t = invLerp(fromMin, fromMax, value);
  return lerp(toMin, toMax, t);
}

// Random number between min and max (inclusive)
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Random integer between min and max (inclusive)
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Distance between two points
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance squared (faster for comparisons)
export function distanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

// Check if a point is inside a rectangle
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

// Degrees to radians
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Radians to degrees
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

// Normalize an angle to [0, 2*PI)
export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

// Weighted random selection from an array
export function weightedRandom<T>(items: T[], weights: number[]): T | undefined {
  if (items.length === 0 || items.length !== weights.length) {
    return undefined;
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return undefined;
  }

  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

// Shuffle array in place (Fisher-Yates)
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Create a 2D array filled with a value
export function create2DArray<T>(rows: number, cols: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

// Deep clone a 2D array
export function clone2DArray<T>(array: T[][]): T[][] {
  return array.map(row => [...row]);
}
