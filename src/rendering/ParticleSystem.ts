// Canvas-based Particle System for block destruction effects

import { PARTICLES, COLORS, BlockColor, LINE_CLEAR_SPARKS } from '../data/constants';
import { lighten } from '../utils/colors';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  rotation: number;
  angularVelocity: number;
  color: string;
  active: boolean;
}

export interface ParticleEmitConfig {
  count?: number;
  color: BlockColor | string;
  direction?: { x: number; y: number };  // Normalized direction vector
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private poolSize: number = 100;

  constructor() {
    // Pre-allocate particle pool
    for (let i = 0; i < this.poolSize; i++) {
      this.particles.push(this.createInactiveParticle());
    }
  }

  private createInactiveParticle(): Particle {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      scale: 0,
      rotation: 0,
      angularVelocity: 0,
      color: '#ffffff',
      active: false,
    };
  }

  private getInactiveParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    // Pool exhausted, create new particle
    const newParticle = this.createInactiveParticle();
    this.particles.push(newParticle);
    return newParticle;
  }

  // Emit particles at a position
  public emit(x: number, y: number, config: ParticleEmitConfig): void {
    const count = config.count ?? PARTICLES.burstCount;
    const baseColor = typeof config.color === 'string'
      ? config.color
      : COLORS[config.color];

    // Direction defaults to upward
    const dir = config.direction ?? { x: 0, y: -1 };
    const spreadAngle = PARTICLES.spreadAngle * (Math.PI / 180);
    const spreadVariance = PARTICLES.spreadVariance * (Math.PI / 180);

    for (let i = 0; i < count; i++) {
      const particle = this.getInactiveParticle();
      if (!particle) continue;

      // Calculate direction with spread
      const baseAngle = Math.atan2(dir.y, dir.x);
      const spreadOffset = (Math.random() - 0.5) * spreadAngle;
      const varianceOffset = (Math.random() - 0.5) * spreadVariance;
      const angle = baseAngle + spreadOffset + varianceOffset;

      // Random velocity within range
      const speed = PARTICLES.minVelocity + Math.random() * (PARTICLES.maxVelocity - PARTICLES.minVelocity);

      // Random lifetime with variance
      const lifetimeVariance = PARTICLES.lifetimeVariance * (Math.random() * 2 - 1);
      const lifetime = PARTICLES.lifetime + lifetimeVariance;

      // Random scale
      const scale = PARTICLES.minScale + Math.random() * (PARTICLES.maxScale - PARTICLES.minScale);

      // Brighten color slightly (120% brightness)
      const brightenedColor = lighten(baseColor, 20);

      // Initialize particle
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = lifetime;
      particle.maxLife = lifetime;
      particle.scale = scale;
      particle.rotation = Math.random() * Math.PI * 2;
      particle.angularVelocity = (Math.random() - 0.5) * 10; // Random spin
      particle.color = brightenedColor;
      particle.active = true;
    }
  }

  // Update all particles
  public update(deltaTime: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;

      // Update life
      p.life -= deltaTime;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Apply gravity
      p.vy += PARTICLES.gravity * deltaTime;

      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;

      // Update rotation
      p.rotation += p.angularVelocity * deltaTime;
    }
  }

  // Render all active particles
  // OPTIMIZED: Batches particles by color to minimize fillStyle changes
  // Uses relative transforms (save/translate/rotate/scale/restore) to compose with existing transforms
  public render(ctx: CanvasRenderingContext2D): void {
    // Group active particles by color to minimize fillStyle changes
    const byColor = new Map<string, Particle[]>();
    for (const p of this.particles) {
      if (!p.active) continue;
      const existing = byColor.get(p.color);
      if (existing) {
        existing.push(p);
      } else {
        byColor.set(p.color, [p]);
      }
    }

    // Skip if no active particles
    if (byColor.size === 0) return;

    const size = 20; // Base particle size
    const halfSize = size / 2;

    // Render particles batched by color
    for (const [color, particles] of byColor) {
      ctx.fillStyle = color;

      for (const p of particles) {
        const lifeRatio = p.life / p.maxLife;
        const opacity = lifeRatio * 0.7; // 70% max opacity
        const currentScale = p.scale * (0.5 + lifeRatio * 0.5);

        // Use relative transforms to properly compose with existing transforms (e.g., screen shake)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(currentScale, currentScale);

        // Draw particle centered at origin
        ctx.fillRect(-halfSize, -halfSize, size, size);

        ctx.restore();
      }
    }
  }

  // Check if any particles are active
  public hasActiveParticles(): boolean {
    return this.particles.some(p => p.active);
  }

  // Clear all particles
  public clear(): void {
    for (const p of this.particles) {
      p.active = false;
    }
  }

  // Get count of active particles (for debugging)
  public getActiveCount(): number {
    return this.particles.filter(p => p.active).length;
  }

  // Emit spark particles for line clear effect
  // Sparks spray perpendicular to the line direction
  public emitSparks(
    x: number,
    y: number,
    lineDirection: 'horizontal' | 'vertical',
    color?: string
  ): void {
    const count = LINE_CLEAR_SPARKS.SPARK_COUNT;
    const baseColor = color || COLORS.Gold;
    const brightenedColor = lighten(baseColor, 30);

    for (let i = 0; i < count; i++) {
      const particle = this.getInactiveParticle();
      if (!particle) continue;

      // Spray perpendicular to line direction
      // For horizontal line: spray up/down
      // For vertical line: spray left/right
      let angle: number;
      if (lineDirection === 'horizontal') {
        // Spray mostly up/down with some randomness
        angle = (Math.random() > 0.5 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.5;
      } else {
        // Spray mostly left/right with some randomness
        angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * Math.PI * 0.5;
      }

      const velocity = LINE_CLEAR_SPARKS.SPARK_VELOCITY * (0.8 + Math.random() * 0.4);
      const scale = LINE_CLEAR_SPARKS.SPARK_SCALE_MIN +
        Math.random() * (LINE_CLEAR_SPARKS.SPARK_SCALE_MAX - LINE_CLEAR_SPARKS.SPARK_SCALE_MIN);

      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.life = LINE_CLEAR_SPARKS.SPARK_LIFETIME;
      particle.maxLife = LINE_CLEAR_SPARKS.SPARK_LIFETIME;
      particle.scale = scale;
      particle.rotation = Math.random() * Math.PI * 2;
      particle.angularVelocity = (Math.random() - 0.5) * 15;
      particle.color = brightenedColor;
      particle.active = true;
    }
  }
}
