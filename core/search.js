/**
 * Search utility — full-text search across saved entries
 * Complementare a Storage.search() in core/storage.js
 */

import Sanitize from '../utils/sanitize.js';

const Search = {
  /**
   * @param {string} query - Search query
   * @param {Object[]} entries - Array of entries to search
   * @returns {Object[]} - Filtered entries ranked by relevance
   */
  search: (query, entries) => {
    if (!query || !query.trim()) return entries;
    const q = Sanitize.text(query).toLowerCase();
    if (!q) return entries;

    return entries
      .map(entry => ({
        entry,
        score: calculateScore(entry, q)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);
  }
};

/**
 * Calculate relevance score for an entry
 */
function calculateScore(entry, query) {
  let score = 0;
  const qParts = query.split(' ');

  qParts.forEach(part => {
    if (entry.prompt.toLowerCase().includes(part)) score += 3;
    if (entry.response.toLowerCase().includes(part)) score += 1;
    if (entry.tags.some(t => t.toLowerCase().includes(part))) score += 2;
    if (entry.platform.toLowerCase().includes(part)) score += 0.5;
  });

  return score;
}

export default Search;
