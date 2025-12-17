import type { BibleAPIResponse } from '../types';

// Bible service
export class BibleService {
  private translationData: any = null;

  loadTranslation(data: any): void {
    this.translationData = data;
  }

  async getVerse(book: string, chapter: number, verse: number): Promise<BibleAPIResponse | null> {
    // Try local data first
    try {
      if (this.translationData) {
        // Check for array-based structure (new format)
        if (Array.isArray(this.translationData.books)) {
          const bookData = this.translationData.books.find((b: any) => b.name.toUpperCase().startsWith(book.toUpperCase()) );
          if (bookData) {
            const chapterData = bookData.chapters.find((c: any) => c.chapter === chapter);
            if (chapterData) {
              const verseData = chapterData.verses.find((v: any) => v.verse === verse);
              if (verseData) {
                return {
                  reference: `${bookData.name} ${chapter}:${verse}`,
                  verses: [{
                    book: book.toUpperCase(),
                    chapter: chapter,
                    verse: verse,
                    text: verseData.text
                  }],
                  text: verseData.text,
                  translation_id: this.translationData.metadata?.abbreviation || 'KJV',
                  translation_name: this.translationData.metadata?.name || this.translationData.translation || 'King James Version',
                  translation_note: this.translationData.metadata?.description || ''
                };
              }
            }
          }
        } 
        // Fallback to object-based structure (old format)
        else {
          const bookData = this.translationData.books[book.toUpperCase()];
          if (bookData && bookData.chapters[chapter] && bookData.chapters[chapter][verse]) {
            return {
              reference: `${book.toUpperCase()} ${chapter}:${verse}`,
              verses: [{
                book: book.toUpperCase(),
                chapter: chapter,
                verse: verse,
                text: bookData.chapters[chapter][verse]
              }],
              text: bookData.chapters[chapter][verse],
              translation_id: this.translationData.metadata?.abbreviation,
              translation_name: this.translationData.metadata?.name,
              translation_note: this.translationData.metadata?.description
            };
          }
        }
      }
    } catch (error) {
      console.error('Bible API error:', error);
    }
    return null;
  }

  parseReference(input: string): { book: string; chapter: number; verse: number } | null {
    // Match patterns like "GEN 1:1", "gen 1:1", "Genesis 1:1", etc.
    const match = input.trim().match(/^([A-Za-z\s]+)\s*(\d+)?:?(\d+)?$/);
    if (!match) return null;

    const [, book, chapter, verse] = match;
    return {
      book: book.trim(),
      chapter: parseInt(chapter??1),
      verse: parseInt(verse??1)
    };
  }
}
