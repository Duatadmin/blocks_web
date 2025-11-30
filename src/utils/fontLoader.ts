// Lazy font loader - loads custom fonts asynchronously

export const COMBO_FONT_FAMILY = 'TikTokSansCondensed';
export const SCORE_FONT_FAMILY = 'Montserrat';

let comboFontLoaded = false;
let comboFontLoading = false;
let scoreFontLoaded = false;
let scoreFontLoading = false;

// Promise for combo font loading (used by prewarm)
let comboFontPromise: Promise<void> | null = null;

/**
 * Lazy load the combo notification font.
 * Call this during game init - it loads async and doesn't block.
 * Returns a promise that resolves when font is loaded (or fails).
 */
export function loadComboFont(): Promise<void> {
  if (comboFontLoaded) return Promise.resolve();
  if (comboFontPromise) return comboFontPromise;

  comboFontLoading = true;

  const font = new FontFace(
    COMBO_FONT_FAMILY,
    'url(/assets/fonts/TikTokSans36pt-ExtraBoldItalic.otf)'
  );

  comboFontPromise = font.load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont);
      comboFontLoaded = true;
      console.log('Combo font loaded');
    })
    .catch((err) => {
      console.warn('Failed to load combo font, using fallback:', err);
    })
    .finally(() => {
      comboFontLoading = false;
    });

  return comboFontPromise;
}

/**
 * Get the font family string for combo notifications.
 * Returns the custom font if loaded, otherwise falls back to system fonts.
 */
export function getComboFontFamily(): string {
  if (comboFontLoaded) {
    return `'${COMBO_FONT_FAMILY}', sans-serif`;
  }
  return 'Inter, sans-serif';
}

/**
 * Lazy load the score display font.
 * Call this during game init - it loads async and doesn't block.
 */
export function loadScoreFont(): void {
  if (scoreFontLoaded || scoreFontLoading) return;

  scoreFontLoading = true;

  const font = new FontFace(
    SCORE_FONT_FAMILY,
    'url(/assets/fonts/Montserrat-Bold.ttf)'
  );

  font.load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont);
      scoreFontLoaded = true;
      console.log('Score font loaded');
    })
    .catch((err) => {
      console.warn('Failed to load score font, using fallback:', err);
    })
    .finally(() => {
      scoreFontLoading = false;
    });
}

/**
 * Get the font family string for score displays.
 * Returns the custom font if loaded, otherwise falls back to system fonts.
 */
export function getScoreFontFamily(): string {
  if (scoreFontLoaded) {
    return `'${SCORE_FONT_FAMILY}', Inter, sans-serif`;
  }
  return 'Inter, sans-serif';
}
