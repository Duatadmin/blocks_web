// Lazy font loader - loads custom fonts asynchronously

export const COMBO_FONT_FAMILY = 'TikTokSans';

let comboFontLoaded = false;
let comboFontLoading = false;

/**
 * Lazy load the combo notification font.
 * Call this during game init - it loads async and doesn't block.
 */
export function loadComboFont(): void {
  if (comboFontLoaded || comboFontLoading) return;

  comboFontLoading = true;

  const font = new FontFace(
    COMBO_FONT_FAMILY,
    'url(/assets/fonts/TikTokSans_18pt-SemiBold.ttf)'
  );

  font.load()
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
