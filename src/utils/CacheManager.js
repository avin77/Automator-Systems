/**
 * @fileoverview Utility class for managing question/answer cache.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * CacheManager is responsible for storing and retrieving cached answers
 * for form questions, including similarity matching for partial matches.
 * 
 * @class
 */
class CacheManager {
  /**
   * Creates a new cache manager
   * 
   * @param {Object} initialCache - Initial cache data
   */
  constructor(initialCache) {
    this.cache = initialCache || {};
    this._logPrefix = '[EasyApplyPlugin][CacheManager]';
  }
  
  /**
   * Get a value from the cache
   * 
   * @param {string} key - The question/key to look up
   * @param {Object} options - Options for controlling value retrieval
   * @param {boolean} [options.isCountry=false] - Whether this is a country field
   * @param {boolean} [options.isCity=false] - Whether this is a city field
   * @param {boolean} [options.isPhone=false] - Whether this is a phone field
   * @param {boolean} [options.isExperience=false] - Whether this is an experience field
   * @returns {string|null} - The cached value or null if not found
   */
  async getValue(key, options = {}) {
    const {
      isCountry = false,
      isCity = false,
      isPhone = false,
      isExperience = false
    } = options;
    
    // Try exact match first
    if (this.cache[key]) {
      this._log(`Cache hit for "${key}": "${this.cache[key]}"`);
      return this.cache[key];
    }
    
    // Try normalized key (lowercase, trimmed)
    const normalizedKey = key.toLowerCase().trim();
    for (const cacheKey in this.cache) {
      if (cacheKey.toLowerCase().trim() === normalizedKey) {
        this._log(`Cache hit with normalized key for "${key}": "${this.cache[cacheKey]}"`);
        return this.cache[cacheKey];
      }
    }
    
    // For specific field types, try to find by type
    if (isCountry) {
      const countryValue = this._findValueByType('country');
      if (countryValue) {
        this._log(`Cache hit by type (country) for "${key}": "${countryValue}"`);
        return countryValue;
      }
    }
    
    if (isCity) {
      const cityValue = this._findValueByType('city');
      if (cityValue) {
        this._log(`Cache hit by type (city) for "${key}": "${cityValue}"`);
        return cityValue;
      }
    }
    
    if (isPhone) {
      const phoneValue = this._findValueByType('phone');
      if (phoneValue) {
        this._log(`Cache hit by type (phone) for "${key}": "${phoneValue}"`);
        return phoneValue;
      }
    }
    
    // Try to find similar questions
    const similarQuestions = this.findSimilarQuestions(key);
    if (similarQuestions.length > 0) {
      const bestMatch = similarQuestions[0];
      this._log(`Cache hit with similar question for "${key}": "${bestMatch.question}" (similarity: ${bestMatch.similarity})`);
      return this.cache[bestMatch.question];
    }
    
    this._log(`No cache hit for "${key}"`);
    return null;
  }
  
  /**
   * Set a value in the cache
   * 
   * @param {string} key - The question/key to store
   * @param {string} value - The value to store
   * @param {Object} options - Options for controlling value storage
   * @param {boolean} [options.isCountry=false] - Whether this is a country field
   * @param {boolean} [options.isCity=false] - Whether this is a city field
   * @param {boolean} [options.isPhone=false] - Whether this is a phone field
   */
  setValue(key, value, options = {}) {
    const {
      isCountry = false,
      isCity = false,
      isPhone = false
    } = options;
    
    // Store the value
    this.cache[key] = value;
    this._log(`Cached value for "${key}": "${value}"`);
    
    // For specific field types, also store by type
    if (isCountry) {
      this.cache['__fieldtype_country'] = value;
    }
    
    if (isCity) {
      this.cache['__fieldtype_city'] = value;
    }
    
    if (isPhone) {
      this.cache['__fieldtype_phone'] = value;
    }
    
    // Save to chrome.storage if available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ qaCache: this.cache });
    }
  }
  
  /**
   * Find questions in the cache that are similar to the given question
   * 
   * @param {string} question - The question to find similar matches for
   * @param {number} [threshold=0.7] - Similarity threshold (0-1)
   * @returns {Array<Object>} - Array of {question, similarity} objects
   */
  findSimilarQuestions(question, threshold = 0.7) {
    const results = [];
    const normalizedQuestion = question.toLowerCase().trim();
    
    for (const cacheKey in this.cache) {
      // Skip special keys
      if (cacheKey.startsWith('__fieldtype_')) continue;
      
      const normalizedCacheKey = cacheKey.toLowerCase().trim();
      const similarity = this._stringSimilarity(normalizedQuestion, normalizedCacheKey);
      
      if (similarity >= threshold) {
        results.push({
          question: cacheKey,
          similarity
        });
      }
    }
    
    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results;
  }
  
  /**
   * Find a value in the cache by field type
   * 
   * @private
   * @param {string} type - The field type (country, city, phone)
   * @returns {string|null} - The cached value or null if not found
   */
  _findValueByType(type) {
    return this.cache[`__fieldtype_${type}`] || null;
  }
  
  /**
   * Calculate string similarity between two strings
   * 
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  _stringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    // Check for substring
    if (str1.includes(str2) || str2.includes(str1)) {
      const minLength = Math.min(str1.length, str2.length);
      const maxLength = Math.max(str1.length, str2.length);
      return minLength / maxLength;
    }
    
    // Calculate Levenshtein distance
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }
  
  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    console.log(`${this._logPrefix} ${message}`);
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = CacheManager;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.CacheManager = CacheManager;
} 