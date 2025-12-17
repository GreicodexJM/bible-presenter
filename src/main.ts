import { Presenter3D } from './core/Presenter3D';

// Initialize the game
const game = new Presenter3D();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.dispose();
});
