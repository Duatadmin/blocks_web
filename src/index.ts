// Block Puzzle Game - TypeScript + Canvas
// Entry point

import { Game } from './Game';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loading = document.getElementById('loading');

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Initialize game
  const game = new Game(canvas);

  // Hide loading screen when game is ready
  game.onReady(() => {
    if (loading) {
      loading.classList.add('hidden');
    }
  });

  // Start the game
  game.init();
});
