/**
 * @fileoverview Utility class for handling errors consistently across the application
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * ErrorHandler provides methods for consistent error handling and logging
 * throughout the application.
 * 
 * @class
 */
class ErrorHandler {
  /**
   * Creates a new ErrorHandler instance
   * 
   * @param {string} moduleName - Name of the module using this handler
   */
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.logPrefix = `[EasyApplyPlugin][${moduleName}]`;
  }

  /**
   * Log an error with consistent formatting
   * 
   * @param {string} message - Error message
   * @param {Error|string} [error] - Error object or string
   * @param {boolean} [silent=false] - Whether to suppress console output
   * @returns {string} - Formatted error message
   */
  logError(message, error, silent = false) {
    const errorMsg = error instanceof Error ? 
      `${error.message}\n${error.stack}` : 
      (error || '');
    
    const fullMessage = `${this.logPrefix} ${message} ${errorMsg}`;
    
    if (!silent) {
      console.error(fullMessage);
    }
    
    return fullMessage;
  }

  /**
   * Log an informational message
   * 
   * @param {string} message - Message to log
   * @param {boolean} [silent=false] - Whether to suppress console output
   * @returns {string} - Formatted message
   */
  logInfo(message, silent = false) {
    const fullMessage = `${this.logPrefix} ${message}`;
    
    if (!silent) {
      console.log(fullMessage);
    }
    
    return fullMessage;
  }

  /**
   * Safely execute a function with error handling
   * 
   * @param {Function} fn - Function to execute
   * @param {string} errorMessage - Message to log if an error occurs
   * @param {*} defaultValue - Value to return if an error occurs
   * @returns {*} - Result of the function or defaultValue if an error occurs
   */
  safeExecute(fn, errorMessage, defaultValue = null) {
    try {
      return fn();
    } catch (error) {
      this.logError(errorMessage, error);
      return defaultValue;
    }
  }

  /**
   * Safely query the DOM for an element
   * 
   * @param {string} selector - CSS selector
   * @param {Element} [parent=document] - Parent element to query from
   * @returns {Element|null} - The found element or null
   */
  safeQuerySelector(selector, parent = document) {
    return this.safeExecute(
      () => parent.querySelector(selector),
      `Error querying selector: ${selector}`,
      null
    );
  }

  /**
   * Safely query the DOM for multiple elements
   * 
   * @param {string} selector - CSS selector
   * @param {Element} [parent=document] - Parent element to query from
   * @returns {Array<Element>} - Array of found elements or empty array
   */
  safeQuerySelectorAll(selector, parent = document) {
    return this.safeExecute(
      () => Array.from(parent.querySelectorAll(selector)),
      `Error querying all with selector: ${selector}`,
      []
    );
  }

  /**
   * Get error message associated with a form field
   * 
   * @param {HTMLElement} field - The form field to check for errors
   * @returns {string|null} - Error message if found, null otherwise
   */
  getErrorMessage(field) {
    try {
      if (!field) return null;
      
      // Check for aria-describedby which often points to error message elements
      const errorId = field.getAttribute('aria-describedby');
      if (errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement && errorElement.textContent.trim()) {
          return errorElement.textContent.trim();
        }
      }
      
      // Check for error messages near the field
      const parent = field.closest('.form-group, .field-container, .input-container') || field.parentElement;
      if (parent) {
        // Common error message selectors
        const errorSelectors = [
          '.error-message',
          '.field-error',
          '.form-error',
          '.invalid-feedback',
          '[role="alert"]',
          '.artdeco-inline-feedback--error',
          '.fb-dash-form-element__error-text'
        ];
        
        for (const selector of errorSelectors) {
          const errorElement = parent.querySelector(selector);
          if (errorElement && errorElement.textContent.trim()) {
            return errorElement.textContent.trim();
          }
        }
      }
      
      // Check if the field itself has invalid styling
      if (field.classList.contains('is-invalid') || 
          field.classList.contains('invalid') || 
          field.classList.contains('error') ||
          field.getAttribute('aria-invalid') === 'true') {
        return "Field has invalid styling";
      }
      
      return null;
    } catch (error) {
      this.logError("Error checking for field error message", error, true);
      return null;
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = ErrorHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
} 