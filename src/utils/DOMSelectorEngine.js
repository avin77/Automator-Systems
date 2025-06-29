/**
 * @fileoverview Advanced DOM selector engine
 * Provides resilient and intelligent DOM querying beyond standard querySelector
 * Handles complex selector patterns, tries alternatives, and includes detailed logging
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Enhanced DOM selector engine with fallback mechanisms and detailed logging
 */
class DOMSelectorEngine {
  /**
   * Create a new DOMSelectorEngine
   * @param {Object} errorHandler - Error handler instance for logging
   */
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.logPrefix = '[DOMSelectorEngine]';
  }

  /**
   * Query for a single element using multiple selectors with fallbacks
   * 
   * @param {string|string[]|Object} selectors - The selector(s) to use
   * @param {Element} [context=document] - The context to search within
   * @param {boolean} [logDetails=false] - Whether to log detailed information
   * @returns {Element|null} - The found element or null
   */
  querySelector(selectors, context = document, logDetails = false) {
    try {
      // Normalize context
      if (!context || !(context instanceof Element) && context !== document) {
        this._log('Invalid context, using document', logDetails);
        context = document;
      }
      
      // Convert selector to array of options to try
      const selectorOptions = this._normalizeSelectorInput(selectors);
      if (selectorOptions.length === 0) return null;
      
      // Try each selector in order
      for (const selector of selectorOptions) {
        try {
          const element = context.querySelector(selector);
          if (element) {
            if (logDetails) this._log(`Found element using selector: ${selector}`, true);
            return element;
          } else if (logDetails) {
            this._log(`No element found with selector: ${selector}`, true);
          }
        } catch (err) {
          // If the selector is invalid, log and continue to the next one
          this._log(`Invalid selector: ${selector} - ${err.message}`, logDetails);
        }
      }
      
      return null;
    } catch (error) {
      this._logError('Error in querySelector', error);
      return null;
    }
  }

  /**
   * Query for multiple elements using multiple selectors with fallbacks
   * 
   * @param {string|string[]|Object} selectors - The selector(s) to use
   * @param {Element} [context=document] - The context to search within
   * @param {boolean} [logDetails=false] - Whether to log detailed information
   * @returns {Element[]} - Array of found elements (empty if none found)
   */
  querySelectorAll(selectors, context = document, logDetails = false) {
    try {
      // Normalize context
      if (!context || !(context instanceof Element) && context !== document) {
        this._log('Invalid context, using document', logDetails);
        context = document;
      }
      
      // Convert selector to array of options to try
      const selectorOptions = this._normalizeSelectorInput(selectors);
      if (selectorOptions.length === 0) return [];
      
      // Try each selector in order
      const allResults = [];
      const seenElements = new Set(); // To prevent duplicates
      
      for (const selector of selectorOptions) {
        try {
          const elements = context.querySelectorAll(selector);
          
          if (elements.length > 0) {
            if (logDetails) this._log(`Found ${elements.length} elements using selector: ${selector}`, true);
            
            // Add unique elements to results
            Array.from(elements).forEach(el => {
              if (!seenElements.has(el)) {
                seenElements.add(el);
                allResults.push(el);
              }
            });
          } else if (logDetails) {
            this._log(`No elements found with selector: ${selector}`, true);
          }
        } catch (err) {
          // If the selector is invalid, log and continue to the next one
          this._log(`Invalid selector: ${selector} - ${err.message}`, logDetails);
        }
      }
      
      return allResults;
    } catch (error) {
      this._logError('Error in querySelectorAll', error);
      return [];
    }
  }

  /**
   * Find elements by their text content
   * 
   * @param {string} text - The text to search for
   * @param {string|string[]} tagNames - Tag name(s) to limit search to
   * @param {Element} [context=document] - The context to search within
   * @param {boolean} [exactMatch=false] - Whether to require exact text match
   * @returns {Element[]} - Array of elements containing the text
   */
  findElementsByText(text, tagNames = '*', context = document, exactMatch = false) {
    try {
      if (!text) return [];
      
      // Normalize context
      if (!context || !(context instanceof Element) && context !== document) {
        context = document;
      }
      
      // Normalize tag names to array
      const tags = Array.isArray(tagNames) ? tagNames : [tagNames];
      
      // Normalize text for comparison
      const searchText = text.toLowerCase().trim();
      const results = [];
      
      // Search for each tag
      for (const tag of tags) {
        const elements = context.querySelectorAll(tag);
        
        for (const element of elements) {
          const elementText = element.textContent.toLowerCase().trim();
          
          if ((exactMatch && elementText === searchText) || 
              (!exactMatch && elementText.includes(searchText))) {
            results.push(element);
          }
        }
      }
      
      return results;
    } catch (error) {
      this._logError('Error in findElementsByText', error);
      return [];
    }
  }

  /**
   * Check if an element contains specific text
   * 
   * @param {Element} element - Element to check
   * @param {string} text - Text to search for
   * @param {boolean} [exactMatch=false] - Whether to require exact match
   * @returns {boolean} - Whether the element contains the text
   */
  hasText(element, text, exactMatch = false) {
    try {
      if (!element || !text) return false;
      
      const elementText = element.textContent.toLowerCase().trim();
      const searchText = text.toLowerCase().trim();
      
      return exactMatch ? elementText === searchText : elementText.includes(searchText);
    } catch (error) {
      this._logError('Error in hasText', error);
      return false;
    }
  }

  /**
   * Normalize selector input to an array of selector strings
   * 
   * @private
   * @param {string|string[]|Object} selectors - Input selectors
   * @returns {string[]} - Array of selector strings
   */
  _normalizeSelectorInput(selectors) {
    // If null or undefined, return empty array
    if (selectors == null) return [];
    
    // If it's a string, return as single-item array
    if (typeof selectors === 'string') {
      return [selectors];
    }
    
    // If it's an array, return directly
    if (Array.isArray(selectors)) {
      return selectors.filter(s => typeof s === 'string');
    }
    
    // If it's an object with a 'class' property, use that
    if (typeof selectors === 'object') {
      if (selectors.class) {
        return [selectors.class];
      }
      
      // For LinkedInSelectors structure with arrays
      if (Array.isArray(selectors.buttonSelectors)) {
        return selectors.buttonSelectors;
      }
      
      if (Array.isArray(selectors.listContainers)) {
        return selectors.listContainers;
      }
    }
    
    // If we get here, we couldn't normalize the input
    return [];
  }

  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   * @param {boolean} [shouldLog=true] - Whether to actually log
   */
  _log(message, shouldLog = true) {
    if (!shouldLog) return;
    
    if (this.errorHandler) {
      this.errorHandler.logInfo(`${this.logPrefix} ${message}`);
    } else {
      console.log(`${this.logPrefix} ${message}`);
    }
  }

  /**
   * Log an error message
   * 
   * @private
   * @param {string} message - The error message
   * @param {Error} [error] - Optional error object
   */
  _logError(message, error) {
    if (this.errorHandler) {
      this.errorHandler.logError(message, error);
    } else {
      console.error(`${this.logPrefix} ${message}`, error || '');
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = DOMSelectorEngine;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.DOMSelectorEngine = DOMSelectorEngine;
} 