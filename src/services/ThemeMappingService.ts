import { EmotionalTone } from './SentimentAnalysisService';

// Theme mapping service that connects emotional tones to visual themes
export class ThemeMappingService {
  // Mapping of emotional tones to available theme names
  // Each tone can map to multiple themes for variety
  private static readonly TONE_TO_THEMES: Record<EmotionalTone, string[]> = {
    [EmotionalTone.PEACEFUL]: ['lake', 'forest'],
    [EmotionalTone.TRIUMPHANT]: ['sunset', 'fire'],
    [EmotionalTone.REFLECTIVE]: ['starfield', 'candle'],
    [EmotionalTone.INTENSE]: ['ocean', 'fire'],
    [EmotionalTone.HOPEFUL]: ['sunset', 'starfield'],
    [EmotionalTone.NEUTRAL]: ['default', 'lake']
  };

  // Default fallback themes
  private static readonly FALLBACK_THEMES = ['default', 'lake', 'forest'];

  // Cache for theme selections to avoid frequent changes
  private themeCache: Map<string, string> = new Map();

  /**
   * Maps an emotional tone to an appropriate theme name
   * @param tone The emotional tone detected
   * @param verseKey Optional key to cache theme selections per verse
   * @returns Theme name to load
   */
  mapToneToTheme(tone: EmotionalTone, verseKey?: string): string {
    // Check cache first for consistent experience
    if (verseKey && this.themeCache.has(verseKey)) {
      return this.themeCache.get(verseKey)!;
    }

    const availableThemes = ThemeMappingService.TONE_TO_THEMES[tone] || ThemeMappingService.FALLBACK_THEMES;

    // For variety, randomly select from available themes for this tone
    const selectedTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];

    // Cache the selection
    if (verseKey) {
      this.themeCache.set(verseKey, selectedTheme);
    }

    return selectedTheme;
  }

  /**
   * Maps an emotional tone with confidence to theme, considering fallbacks
   * @param tone Primary emotional tone
   * @param confidence Confidence score (0-1)
   * @param secondaryTones Alternative tones if primary has low confidence
   * @param verseKey Optional key for caching
   * @returns Theme name to load
   */
  mapToneToThemeWithConfidence(
    tone: EmotionalTone,
    confidence: number,
    secondaryTones: EmotionalTone[],
    verseKey?: string
  ): string {
    // If confidence is high enough, use primary tone
    if (confidence > 0.2) {
      return this.mapToneToTheme(tone, verseKey);
    }

    // If confidence is low, try secondary tones
    for (const secondaryTone of secondaryTones) {
      if (secondaryTone !== EmotionalTone.NEUTRAL) {
        return this.mapToneToTheme(secondaryTone, verseKey);
      }
    }

    // Fallback to neutral themes
    return this.mapToneToTheme(EmotionalTone.NEUTRAL, verseKey);
  }

  /**
   * Clears the theme cache (useful when changing preferences)
   */
  clearCache(): void {
    this.themeCache.clear();
  }

  /**
   * Gets all available themes for a given tone
   */
  getThemesForTone(tone: EmotionalTone): string[] {
    return ThemeMappingService.TONE_TO_THEMES[tone] || ThemeMappingService.FALLBACK_THEMES;
  }

  /**
   * Gets all available emotional tones
   */
  getAvailableTones(): EmotionalTone[] {
    return Object.values(EmotionalTone);
  }
}
