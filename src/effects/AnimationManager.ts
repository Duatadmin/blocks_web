// AnimationManager - Handles all game animations

import { EasingFunction, getEasing, easeOutQuad, easeOutBack, easeInQuad, easeInBack } from '../utils/easing';
import { lerp } from '../utils/math';
import { COMBO_NOTIFICATION } from '../data/constants';

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

  // Combo notification animation with zoom-in, pulsing starburst, and rotation
  public animateComboNotification(
    onUpdate: (y: number, scale: number, opacity: number, starburstScale: number, rotation: number) => void,
    startY: number,
    onComplete?: () => void
  ): void {
    const {
      ZOOM_IN_DURATION,
      HOLD_DURATION,
      FADE_DURATION,
      PULSE_SPEED,
      PULSE_MIN_SCALE,
      PULSE_MAX_SCALE,
      INITIAL_SCALE,
      STARBURST_ROTATION_DEGREES,
    } = COMBO_NOTIFICATION;

    let y = startY;
    let scale = INITIAL_SCALE;
    let opacity = 1;
    let animationStartTime = this.currentTime;
    const totalDuration = ZOOM_IN_DURATION + HOLD_DURATION + FADE_DURATION;

    // Helper to calculate pulsing starburst scale based on time
    const getStarburstScale = (): number => {
      const elapsed = (this.currentTime - animationStartTime) / 1000; // Convert to seconds
      const pulsePhase = Math.sin(elapsed * PULSE_SPEED * Math.PI * 2);
      // Map -1...1 to PULSE_MIN_SCALE...PULSE_MAX_SCALE
      return lerp(PULSE_MIN_SCALE, PULSE_MAX_SCALE, (pulsePhase + 1) / 2);
    };

    // Helper to calculate continuous rotation (0 → ROTATION_DEGREES over full animation)
    const getRotation = (): number => {
      const elapsed = this.currentTime - animationStartTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      return progress * STARBURST_ROTATION_DEGREES * (Math.PI / 180); // Convert to radians
    };

    // Phase 1: Zoom-in (0 - ZOOM_IN_DURATION)
    this.tween({
      from: INITIAL_SCALE,
      to: 1.0,
      duration: ZOOM_IN_DURATION,
      easing: easeOutBack, // Bouncy overshoot effect
      onUpdate: (value) => {
        scale = value;
        onUpdate(y, scale, opacity, getStarburstScale(), getRotation());
      },
    });

    // Phase 2: Hold (ZOOM_IN_DURATION - ZOOM_IN_DURATION + HOLD_DURATION)
    this.tween({
      from: 0,
      to: 1,
      duration: HOLD_DURATION,
      delay: ZOOM_IN_DURATION,
      onUpdate: () => {
        // Scale stays at 1.0, just update starburst pulse and rotation
        onUpdate(y, 1.0, opacity, getStarburstScale(), getRotation());
      },
    });

    // Phase 3: Fade out (ZOOM_IN_DURATION + HOLD_DURATION - end)
    this.tween({
      from: 0,
      to: 1,
      duration: FADE_DURATION,
      delay: ZOOM_IN_DURATION + HOLD_DURATION,
      easing: easeInQuad,
      onUpdate: (progress) => {
        opacity = 1 - progress;
        scale = 1 - progress * 0.2; // Slight shrink during fade
        // Shrink starburst to 0 so it disappears with the text
        const starburstScale = getStarburstScale() * (1 - progress);
        onUpdate(y, scale, opacity, starburstScale, getRotation());
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
