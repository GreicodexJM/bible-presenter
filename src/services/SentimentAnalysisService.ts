// Sentiment analysis service for Bible verses
export enum EmotionalTone {
  PEACEFUL = 'peaceful',
  TRIUMPHANT = 'triumphant',
  REFLECTIVE = 'reflective',
  INTENSE = 'intense',
  HOPEFUL = 'hopeful',
  NEUTRAL = 'neutral'
}

export interface SentimentResult {
  primaryTone: EmotionalTone;
  confidence: number;
  secondaryTones: EmotionalTone[];
}

export class SentimentAnalysisService {
  // Keywords categorized by emotional tone
  private static readonly TONE_KEYWORDS: Record<string, string[]> = {
    [EmotionalTone.PEACEFUL]: [
      'rest', 'peace', 'quiet', 'gentle', 'still', 'calm', 'serene', 'tranquil',
      'comfort', 'soothe', 'ease', 'relief', 'blessed', 'mercy', 'grace',
      'shepherd', 'green pastures', 'still waters', 'restoreth', 'soul'
    ],
    [EmotionalTone.TRIUMPHANT]: [
      'rejoice', 'praise', 'victory', 'glory', 'celebrate', 'triumph', 'joy',
      'shout', 'sing', 'hallelujah', 'amen', 'blessed', 'exalt', 'lift up',
      'magnify', 'honor', 'worship', 'thanksgiving', 'jubilant', 'triumphant'
    ],
    [EmotionalTone.REFLECTIVE]: [
      'meditate', 'wisdom', 'understanding', 'seek', 'consider', 'ponder',
      'think', 'contemplate', 'discern', 'knowledge', 'insight', 'learn',
      'teach', 'instruct', 'counsel', 'advice', 'proverbs', 'wisdom', 'understanding'
    ],
    [EmotionalTone.INTENSE]: [
      'mighty', 'power', 'wrath', 'battle', 'thunder', 'lightning', 'fire',
      'storm', 'earthquake', 'quake', 'shake', 'fear', 'tremble', 'dread',
      'anger', 'fury', 'judgment', 'vengeance', 'destroy', 'overthrow'
    ],
    [EmotionalTone.HOPEFUL]: [
      'hope', 'salvation', 'light', 'promise', 'faith', 'trust', 'believe',
      'eternal', 'everlasting', 'forever', 'covenant', 'redeem', 'deliver',
      'save', 'rescue', 'heal', 'restore', 'revive', 'renew', 'bless'
    ],
    [EmotionalTone.NEUTRAL]: [
      'and', 'the', 'of', 'to', 'in', 'that', 'it', 'with', 'for', 'on', 'by', 'at'
    ]
  };

  /**
   * Analyzes the emotional tone of a Bible verse
   */
  analyzeVerse(text: string): SentimentResult {
    const lowerText = text.toLowerCase();
    const wordCount = lowerText.split(/\s+/).length;

    if (wordCount === 0) {
      return {
        primaryTone: EmotionalTone.NEUTRAL,
        confidence: 0,
        secondaryTones: []
      };
    }

    const scores: Record<EmotionalTone, number> = {
      [EmotionalTone.PEACEFUL]: 0,
      [EmotionalTone.TRIUMPHANT]: 0,
      [EmotionalTone.REFLECTIVE]: 0,
      [EmotionalTone.INTENSE]: 0,
      [EmotionalTone.HOPEFUL]: 0,
      [EmotionalTone.NEUTRAL]: 0
    };

    // Count keyword matches for each tone
    Object.entries(SentimentAnalysisService.TONE_KEYWORDS).forEach(([tone, keywords]) => {
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          scores[tone as EmotionalTone] += matches.length;
        }
      });
    });

    // Calculate weighted scores (normalize by word count and keyword weight)
    const weightedScores = Object.entries(scores).map(([tone, score]) => {
      const weight = tone === EmotionalTone.NEUTRAL ? 0.1 : 1.0; // Reduce neutral weight
      return {
        tone: tone as EmotionalTone,
        score: (score / wordCount) * weight
      };
    });

    // Sort by score descending
    weightedScores.sort((a, b) => b.score - a.score);

    const primaryTone = weightedScores[0].tone;
    const primaryScore = weightedScores[0].score;

    // Get secondary tones (scores > 0.1)
    const secondaryTones = weightedScores
      .slice(1)
      .filter(item => item.score > 0.1)
      .map(item => item.tone);

    return {
      primaryTone,
      confidence: Math.min(primaryScore, 1.0), // Cap at 1.0
      secondaryTones: secondaryTones.slice(0, 2) // Max 2 secondary tones
    };
  }

  /**
   * Batch analyze multiple verses for performance
   */
  analyzeVerses(verses: string[]): SentimentResult[] {
    return verses.map(verse => this.analyzeVerse(verse));
  }
}
