// InputManager - Handles mouse and touch input

import { Point } from '../utils/math';

export type InputEventType = 'down' | 'move' | 'up' | 'cancel';

export interface InputEvent {
  type: InputEventType;
  position: Point;
  timestamp: number;
}

export type InputCallback = (event: InputEvent) => void;

export class InputManager {
  private canvas: HTMLCanvasElement;
  private scale: number = 1;
  private callbacks: InputCallback[] = [];
  private isPointerDown: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  public setScale(scale: number): void {
    this.scale = scale;
  }

  public onInput(callback: InputCallback): void {
    this.callbacks.push(callback);
  }

  public removeCallback(callback: InputCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  private emit(event: InputEvent): void {
    for (const callback of this.callbacks) {
      callback(event);
    }
  }

  private getPosition(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale,
      y: (clientY - rect.top) / this.scale,
    };
  }

  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });

    // Prevent context menu on long press
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleMouseDown = (e: MouseEvent): void => {
    this.isPointerDown = true;
    const position = this.getPosition(e.clientX, e.clientY);
    this.emit({ type: 'down', position, timestamp: Date.now() });
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isPointerDown) return;
    const position = this.getPosition(e.clientX, e.clientY);
    this.emit({ type: 'move', position, timestamp: Date.now() });
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    const position = this.getPosition(e.clientX, e.clientY);
    this.emit({ type: 'up', position, timestamp: Date.now() });
  };

  private handleMouseLeave = (e: MouseEvent): void => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    const position = this.getPosition(e.clientX, e.clientY);
    this.emit({ type: 'cancel', position, timestamp: Date.now() });
  };

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.isPointerDown = true;
      const touch = e.touches[0];
      const position = this.getPosition(touch.clientX, touch.clientY);
      this.emit({ type: 'down', position, timestamp: Date.now() });
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length > 0 && this.isPointerDown) {
      const touch = e.touches[0];
      const position = this.getPosition(touch.clientX, touch.clientY);
      this.emit({ type: 'move', position, timestamp: Date.now() });
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.isPointerDown) {
      this.isPointerDown = false;
      // Use changedTouches for the final position
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const position = this.getPosition(touch.clientX, touch.clientY);
        this.emit({ type: 'up', position, timestamp: Date.now() });
      }
    }
  };

  private handleTouchCancel = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.isPointerDown) {
      this.isPointerDown = false;
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const position = this.getPosition(touch.clientX, touch.clientY);
        this.emit({ type: 'cancel', position, timestamp: Date.now() });
      }
    }
  };

  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
    this.callbacks = [];
  }
}
