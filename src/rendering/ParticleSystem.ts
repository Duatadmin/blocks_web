// Canvas-based Particle System for block destruction effects

import { PARTICLES, COLORS, BlockColor } from '../data/constants';
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
  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Use additive blending for glow effect
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      if (!p.active) continue;

      const lifeRatio = p.life / p.maxLife;

      // Fade out opacity
      const opacity = lifeRatio * 0.7; // 70% max opacity

      // Current scale (shrinks over time)
      const currentScale = p.scale * (0.5 + lifeRatio * 0.5);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(currentScale, currentScale);

      // Draw particle (simple square)
      const size = 20; // Base particle size
      ctx.fillStyle = p.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);

      ctx.restore();
    }

    ctx.restore();
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
}
