/**
 * Sanitization utility — single point of entry for all user input
 * CLAUDE.md rule 4: tutto l'input utente passa da qui prima di essere salvato
 */

const Sanitize = {
  text: (text) => {
    if (typeof text !== 'string') return '';
    // Primary XSS defense: output always via .textContent — never innerHTML.
    // This regex is secondary defense for control chars and HTML tags.
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, 100000);
  },

  tags: (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags
      .slice(0, 20)
      .map(tag => Sanitize.text(tag).trim())
      .filter(tag => tag.length > 0 && tag.length <= 50);
  },

  url: (url) => {
    if (typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return parsed.href;
    } catch {
      return '';
    }
  }
};

export default Sanitize;
