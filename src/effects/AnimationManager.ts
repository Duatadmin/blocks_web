// AnimationManager - Handles all game animations

import { EasingFunction, getEasing, easeOutQuad, easeOutBack, easeInQuad, easeInBack } from '../utils/easing';
import { lerp } from '../utils/math';

export interface Animation {
  id: number;
  startTime: number;
  duration: number;
  easing: EasingFunction;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
  isComplete: boolean;
}

export interface TweenConfig {
  from: number;
  to: number;
  duration: number;
  easing?: string | EasingFunction;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  delay?: number;
}

let animationIdCounter = 0;

export class AnimationManager {
  private animations: Map<number, Animation> = new Map();
  private currentTime: number = 0;

  // Update all animations
  public update(deltaTime: number): void {
    this.currentTime += deltaTime * 1000; // Convert to ms

    const completedIds: number[] = [];

    this.animations.forEach((anim, id) => {
      if (anim.isComplete) {
        completedIds.push(id);
        return;
      }

      const elapsed = this.currentTime - anim.startTime;
      if (elapsed < 0) return; // Delayed animation

      const rawProgress = Math.min(elapsed / anim.duration, 1);
      const easedProgress = anim.easing(rawProgress);

      anim.onUpdate(easedProgress);

      if (rawProgress >= 1) {
        anim.isComplete = true;
        anim.onComplete?.();
        completedIds.push(id);
      }
    });

    // Remove completed animations
    for (const id of completedIds) {
      this.animations.delete(id);
    }
  }

  // Create a simple tween animation
  public tween(config: TweenConfig): number {
    const id = ++animationIdCounter;
    const easing = typeof config.easing === 'string'
      ? getEasing(config.easing)
      : config.easing || easeOutQuad;

    const animation: Animation = {
      id,
      startTime: this.currentTime + (config.delay || 0),
      duration: config.duration,
      easing,
      onUpdate: (progress) => {
        const value = lerp(config.from, config.to, progress);
        config.onUpdate(value);
      },
      onComplete: config.onComplete,
      isComplete: false,
    };

    this.animations.set(id, animation);
    return id;
  }

  // Create a sequence of animations
  public sequence(configs: TweenConfig[]): Promise<void> {
    return new Promise((resolve) => {
      let totalDelay = 0;

      configs.forEach((config, index) => {
        const isLast = index === configs.length - 1;
        const originalComplete = config.onComplete;

        this.tween({
          ...config,
          delay: (config.delay || 0) + totalDelay,
          onComplete: () => {
            originalComplete?.();
            if (isLast) resolve();
          },
        });

        totalDelay += config.duration + (config.delay || 0);
      });

      if (configs.length === 0) resolve();
    });
  }

  // Create parallel animations
  public parallel(configs: TweenConfig[]): Promise<void> {
    if (configs.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      let completed = 0;

      configs.forEach((config) => {
        const originalComplete = config.onComplete;

        this.tween({
          ...config,
          onComplete: () => {
            originalComplete?.();
            completed++;
            if (completed === configs.length) resolve();
          },
        });
      });
    });
  }

  // Cancel an animation
  public cancel(id: number): void {
    this.animations.delete(id);
  }

  // Cancel all animations
  public cancelAll(): void {
    this.animations.clear();
  }

  // Check if any animations are running
  public isAnimating(): boolean {
    return this.animations.size > 0;
  }

  // Wait for a duration (useful in animation sequences)
  public wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tween({
        from: 0,
        to: 1,
        duration,
        onUpdate: () => {},
        onComplete: resolve,
      });
    });
  }

  // Block placement animation (scale bounce)
  public animateBlockPlacement(
    onUpdate: (scale: number) => void,
    onComplete?: () => void
  ): number {
    return this.tween({
      from: 1.3,
      to: 1.0,
      duration: 300,
      easing: easeOutBack,
      onUpdate,
      onComplete,
    });
  }

  // Line clear animation for a cell (Godot-style with BACK easing and rotation)
  public animateCellClear(
    onUpdate: (scale: number, opacity: number, rotation: number) => void,
    delay: number = 0,
    onComplete?: () => void
  ): number {
    // Random rotation direction: ±0.2 radians (±11 degrees)
    const targetRotation = (Math.random() - 0.5) * 0.4;

    return this.tween({
      from: 0,
      to: 1,
      duration: 100,
      delay,
      easing: easeInBack, // Bouncy shrink effect
      onUpdate: (progress) => {
        // Scale from 1 to 0 (full shrink)
        const scale = 1 - progress;
        // Opacity fades faster (80% of duration)
        const opacity = Math.max(0, 1 - progress * 1.25);
        // Rotation increases with progress
        const rotation = targetRotation * progress;
        onUpdate(scale, opacity, rotation);
      },
      onComplete,
    });
  }

  // Combo notification animation
  public animateComboNotification(
    onUpdate: (y: number, scale: number, opacity: number, rotation: number) => void,
    startY: number,
    onComplete?: () => void
  ): void {
    let y = startY;
    let scale = 1;
    let opacity = 1;
    let rotation = 0;

    // Rise phase (0-200ms)
    this.tween({
      from: 0,
      to: 60,
      duration: 200,
      easing: easeOutQuad,
      onUpdate: (value) => {
        y = startY - value;
        onUpdate(y, scale, opacity, rotation);
      },
    });

    // Hold phase (200-300ms) - just wiggle
    this.tween({
      from: 0,
      to: 3,
      duration: 100,
      delay: 200,
      onUpdate: (value) => {
        rotation = Math.sin(value * Math.PI * 2) * 0.1;
        onUpdate(y, scale, opacity, rotation);
      },
    });

    // Fade out phase (300-600ms)
    this.tween({
      from: 0,
      to: 1,
      duration: 300,
      delay: 300,
      easing: easeInQuad,
      onUpdate: (progress) => {
        opacity = 1 - progress;
        scale = 1 - progress * 0.5;
        onUpdate(y, scale, opacity, rotation);
      },
      onComplete,
    });
  }
}

// Screen shake effect (separate from animation manager for simplicity)
export class ScreenShake {
  private intensity: number = 0;
  private duration: number = 0;
  private elapsed: number = 0;
  public offsetX: number = 0;
  public offsetY: number = 0;

  public shake(intensity: number, duration: number): void {
    this.intensity = intensity;
    this.duration = duration;
    this.elapsed = 0;
  }

  public update(deltaTime: number): void {
    if (this.elapsed >= this.duration) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    this.elapsed += deltaTime * 1000;
    const progress = this.elapsed / this.duration;
    const currentIntensity = this.intensity * (1 - progress);

    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
  }

  public isShaking(): boolean {
    return this.elapsed < this.duration;
  }
}
