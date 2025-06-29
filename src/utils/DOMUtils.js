/**
 * @fileoverview Utility class for safely handling DOM operations with proper exception handling
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * DOMUtils provides safe methods for DOM operations with proper error handling
 * 
 * @class
 */
class DOMUtils {
  /**
   * Creates a new DOMUtils instance
   * 
   * @param {ErrorHandler} [errorHandler] - Optional error handler to use
   */
  constructor(errorHandler = null) {
    this.errorHandler = errorHandler;
    this._logPrefix = '[EasyApplyPlugin][DOMUtils]';
  }

  /**
   * Safely query for an element
   * 
   * @param {string} selector - CSS selector to query
   * @param {Element|Document} [context=document] - Context to query within
   * @param {string} [operationName='query selector'] - Name of the operation for error logging
   * @returns {Element|null} - Found element or null
   */
  querySelector(selector, context = document, operationName = 'query selector') {
    try {
      if (!selector) {
        this._logError(`Empty selector provided for ${operationName}`, null, true);
        return null;
      }
      
      if (!context) {
        this._logError(`Invalid context for ${operationName} with selector: ${selector}`, null, true);
        return null;
      }
      
      return context.querySelector(selector);
    } catch (error) {
      this._logError(`Error in ${operationName} with selector: ${selector}`, error);
      return null;
    }
  }

  /**
   * Safely query for multiple elements
   * 
   * @param {string} selector - CSS selector to query
   * @param {Element|Document} [context=document] - Context to query within
   * @param {string} [operationName='query selector all'] - Name of the operation for error logging
   * @returns {Array<Element>} - Array of found elements or empty array
   */
  querySelectorAll(selector, context = document, operationName = 'query selector all') {
    try {
      if (!selector) {
        this._logError(`Empty selector provided for ${operationName}`, null, true);
        return [];
      }
      
      if (!context) {
        this._logError(`Invalid context for ${operationName} with selector: ${selector}`, null, true);
        return [];
      }
      
      const elements = context.querySelectorAll(selector);
      return elements ? Array.from(elements) : [];
    } catch (error) {
      this._logError(`Error in ${operationName} with selector: ${selector}`, error);
      return [];
    }
  }

  /**
   * Check if an element exists
   * 
   * @param {string} selector - CSS selector to check
   * @param {Element|Document} [context=document] - Context to query within
   * @returns {boolean} - Whether the element exists
   */
  elementExists(selector, context = document) {
    return this.querySelector(selector, context, 'element exists check') !== null;
  }

  /**
   * Check if an element is visible
   * 
   * @param {Element} element - Element to check
   * @returns {boolean} - Whether the element is visible
   */
  isElementVisible(element) {
    try {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             element.offsetWidth > 0 &&
             element.offsetHeight > 0;
    } catch (error) {
      this._logError('Error checking element visibility', error);
      return false;
    }
  }

  /**
   * Find elements by text content
   * 
   * @param {string} text - Text to search for
   * @param {string} [elementType='*'] - Type of element to search for
   * @param {Element|Document} [context=document] - Context to search within
   * @param {boolean} [exactMatch=false] - Whether to require an exact match
   * @returns {Array<Element>} - Array of found elements or empty array
   */
  findElementsByText(text, elementType = '*', context = document, exactMatch = false) {
    try {
      if (!text) {
        this._logError('Empty text provided for findElementsByText', null, true);
        return [];
      }
      
      const searchText = text.toLowerCase();
      const elements = this.querySelectorAll(elementType, context, 'find elements by text');
      
      return elements.filter(el => {
        try {
          const elText = el.textContent && el.textContent.trim().toLowerCase();
          if (!elText) return false;
          
          return exactMatch ? elText === searchText : elText.includes(searchText);
        } catch (err) {
          return false;
        }
      });
    } catch (error) {
      this._logError(`Error finding elements with text: ${text}`, error);
      return [];
    }
  }

  /**
   * Wait for an element to appear in the DOM
   * 
   * @param {string} selector - CSS selector to wait for
   * @param {Object} [options] - Options for waiting
   * @param {number} [options.timeout=10000] - Maximum time to wait in ms
   * @param {number} [options.interval=100] - Polling interval in ms
   * @param {Element|Document} [options.context=document] - Context to query within
   * @param {boolean} [options.visible=false] - Whether to wait for the element to be visible
   * @returns {Promise<Element|null>} - Found element or null
   */
  waitForElement(selector, options = {}) {
    const {
      timeout = 10000,
      interval = 100,
      context = document,
      visible = false
    } = options;
    
    return new Promise((resolve) => {
      try {
        // First check if the element already exists
        const element = this.querySelector(selector, context, 'wait for element');
        if (element && (!visible || this.isElementVisible(element))) {
          resolve(element);
          return;
        }
        
        // If not, set up a polling interval
        let elapsed = 0;
        const timer = setInterval(() => {
          try {
            const element = this.querySelector(selector, context, 'wait for element (polling)');
            if (element && (!visible || this.isElementVisible(element))) {
              clearInterval(timer);
              resolve(element);
              return;
            }
            
            elapsed += interval;
            if (elapsed >= timeout) {
              clearInterval(timer);
              this._logError(`Timeout waiting for element: ${selector}`, null, true);
              resolve(null);
            }
          } catch (error) {
            clearInterval(timer);
            this._logError(`Error in waitForElement polling for ${selector}`, error);
            resolve(null);
          }
        }, interval);
      } catch (error) {
        this._logError(`Error setting up waitForElement for ${selector}`, error);
        resolve(null);
      }
    });
  }

  /**
   * Safely get an attribute from an element
   * 
   * @param {Element} element - Element to get attribute from
   * @param {string} attributeName - Name of the attribute to get
   * @param {*} [defaultValue=null] - Default value if attribute doesn't exist
   * @returns {string|null} - Attribute value or default value
   */
  getAttribute(element, attributeName, defaultValue = null) {
    try {
      if (!element || !attributeName) return defaultValue;
      
      const value = element.getAttribute(attributeName);
      return value !== null ? value : defaultValue;
    } catch (error) {
      this._logError(`Error getting attribute ${attributeName}`, error);
      return defaultValue;
    }
  }

  /**
   * Safely set an attribute on an element
   * 
   * @param {Element} element - Element to set attribute on
   * @param {string} attributeName - Name of the attribute to set
   * @param {string} value - Value to set
   * @returns {boolean} - Whether the operation succeeded
   */
  setAttribute(element, attributeName, value) {
    try {
      if (!element || !attributeName) return false;
      
      element.setAttribute(attributeName, value);
      return true;
    } catch (error) {
      this._logError(`Error setting attribute ${attributeName}`, error);
      return false;
    }
  }

  /**
   * Safely add an event listener to an element
   * 
   * @param {Element} element - Element to add listener to
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Event handler function
   * @param {boolean|Object} [options=false] - Event listener options
   * @returns {boolean} - Whether the operation succeeded
   */
  addEventListener(element, eventType, handler, options = false) {
    try {
      if (!element || !eventType || typeof handler !== 'function') return false;
      
      element.addEventListener(eventType, handler, options);
      return true;
    } catch (error) {
      this._logError(`Error adding ${eventType} event listener`, error);
      return false;
    }
  }

  /**
   * Safely remove an event listener from an element
   * 
   * @param {Element} element - Element to remove listener from
   * @param {string} eventType - Type of event to remove
   * @param {Function} handler - Event handler function
   * @param {boolean|Object} [options=false] - Event listener options
   * @returns {boolean} - Whether the operation succeeded
   */
  removeEventListener(element, eventType, handler, options = false) {
    try {
      if (!element || !eventType || typeof handler !== 'function') return false;
      
      element.removeEventListener(eventType, handler, options);
      return true;
    } catch (error) {
      this._logError(`Error removing ${eventType} event listener`, error);
      return false;
    }
  }

  /**
   * Safely dispatch an event on an element
   * 
   * @param {Element} element - Element to dispatch event on
   * @param {string} eventType - Type of event to dispatch
   * @param {boolean} [bubbles=true] - Whether the event bubbles
   * @param {boolean} [cancelable=true] - Whether the event is cancelable
   * @returns {boolean} - Whether the operation succeeded
   */
  dispatchEvent(element, eventType, bubbles = true, cancelable = true) {
    try {
      if (!element || !eventType) return false;
      
      const event = new Event(eventType, { bubbles, cancelable });
      return element.dispatchEvent(event);
    } catch (error) {
      this._logError(`Error dispatching ${eventType} event`, error);
      return false;
    }
  }

  /**
   * Safely click an element
   * 
   * @param {Element} element - Element to click
   * @returns {boolean} - Whether the operation succeeded
   */
  click(element) {
    try {
      if (!element) return false;
      
      element.click();
      return true;
    } catch (error) {
      this._logError('Error clicking element', error);
      return false;
    }
  }

  /**
   * Log an error message
   * 
   * @private
   * @param {string} message - Error message
   * @param {Error} [error] - Error object
   * @param {boolean} [isWarning=false] - Whether this is a warning
   */
  _logError(message, error, isWarning = false) {
    if (this.errorHandler) {
      this.errorHandler.logError(message, error);
    } else {
      const fullMessage = `${this._logPrefix} ${message}`;
      if (isWarning) {
        console.warn(fullMessage, error || '');
      } else {
        console.error(fullMessage, error || '');
      }
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = DOMUtils;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.DOMUtils = DOMUtils;
} 