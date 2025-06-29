/**
 * @fileoverview Base class for all field handlers with common functionality.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Base class for all field handlers that provides common functionality
 * for interacting with form fields. This abstract class implements shared
 * behaviors and requires subclasses to implement specific handling logic.
 * 
 * @abstract
 * @class
 */
class FieldHandlerBase {
  /**
   * Creates a new field handler with required dependencies
   * 
   * @param {Object} dependencies - Dependency injection container
   * @param {CacheManager} dependencies.cacheManager - For managing Q&A cache
   * @param {GeminiClient} dependencies.geminiClient - For AI-powered answers
   * @param {ErrorHandler} dependencies.errorHandler - For error handling
   * @param {Object} dependencies.config - Configuration options
   */
  constructor(dependencies) {
    if (new.target === FieldHandlerBase) {
      throw new Error('FieldHandlerBase is an abstract class and cannot be instantiated directly');
    }
    
    this.dependencies = dependencies || {};
    this.cacheManager = dependencies.cacheManager;
    this.geminiClient = dependencies.geminiClient;
    this.errorHandler = dependencies.errorHandler;
    this.config = dependencies.config || {};
    
    // Default delay values if not specified in config
    this.delays = this.config.delays || {
      afterField: 100
    };
    
    this._logPrefix = '[EasyApplyPlugin][FieldHandler]';
  }
  
  /**
   * Handle a field by filling it with an appropriate value.
   * This method must be implemented by subclasses.
   * 
   * @abstract
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {*} [value=null] - Optional value to use (if null, will be determined)
   * @returns {Promise<boolean>} - Whether handling was successful
   * @throws {Error} If not implemented by subclass
   */
  async handle(field, label, value = null) {
    throw new Error('Method handle() must be implemented by subclass');
  }
  
  /**
   * Determines if this handler can handle the given field
   * This method should be implemented by subclasses.
   * 
   * @abstract
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    throw new Error('Method canHandle() must be implemented by subclass');
  }
  
  /**
   * Get a value for the field, trying multiple sources in priority order:
   * 1. Provided value
   * 2. Cache
   * 3. Gemini API
   * 4. Default value
   * 
   * @protected
   * @param {string} label - The field label
   * @param {Object} options - Options for controlling value retrieval
   * @param {*} [options.providedValue=null] - Value explicitly provided
   * @param {boolean} [options.isCountry=false] - Whether this is a country field
   * @param {boolean} [options.isCity=false] - Whether this is a city field
   * @param {boolean} [options.isPhone=false] - Whether this is a phone field
   * @param {boolean} [options.isExperience=false] - Whether this is an experience field
   * @returns {Promise<string|null>} - The value to use or null if none available
   */
  async _getFieldValue(label, options = {}) {
    const {
      providedValue = null,
      isCountry = false,
      isCity = false,
      isPhone = false,
      isExperience = false,
      optionsList = null,
      isRadioGroup = false,
      isConsent = false
    } = options;
    
    // 1. Use provided value if available
    if (providedValue !== null) {
      this._log(`Using provided value for "${label}": "${providedValue}"`);
      return providedValue;
    }
    
    // 2. Try cache manager if available
    if (this.cacheManager) {
      const cachedValue = await this.cacheManager.getValue(label, {
        isCountry,
        isCity,
        isPhone,
        isExperience
      });
      
      if (cachedValue) {
        this._log(`Using cached value for "${label}": "${cachedValue}"`);
        return cachedValue;
      }
    }
    
    // 3. Try Gemini API if available
    if (this.geminiClient) {
      try {
        const geminiValue = await this.geminiClient.getValue(label, {
          isCountry,
          isCity,
          isPhone,
          isExperience,
          isConsent,
          optionsList,
          isRadioGroup
        });
        
        if (geminiValue) {
          this._log(`Using Gemini value for "${label}": "${geminiValue}"`);
          
          // Save to cache for future use if cache manager available
          if (this.cacheManager) {
            this.cacheManager.setValue(label, geminiValue, {
              isCountry,
              isCity,
              isPhone,
              isExperience
            });
          }
          
          return geminiValue;
        }
      } catch (error) {
        this._logError(`Error getting value from Gemini for "${label}":`, error);
      }
    }
    
    // 4. Use default values as last resort
    let defaultValue = null;
    
    if (isCountry) {
      defaultValue = this.config.defaults?.defaultCountry || "India";
    } else if (isCity) {
      defaultValue = this.config.defaults?.defaultCity || "Bengaluru";
    } else if (isPhone) {
      defaultValue = this.config.defaults?.defaultPhoneNumber || "8860753300";
    } else if (isExperience) {
      defaultValue = this.config.defaultExperienceYears?.toString() || "4";
    } else if (isRadioGroup && optionsList && optionsList.length > 0) {
      // For radio groups with options, use a more intelligent fallback
      // Try to find an option that indicates positive response
      const positiveOption = optionsList.find(opt => 
        opt.toLowerCase() === 'yes' || 
        opt.toLowerCase().includes('agree') ||
        opt.toLowerCase().includes('accept')
      );
      defaultValue = positiveOption || optionsList[0];
    } else {
      defaultValue = "Yes"; // Generic fallback
    }
    
    this._log(`Using default value for "${label}": "${defaultValue}"`);
    return defaultValue;
  }
  
  /**
   * Dispatch an event on a field
   * 
   * @protected
   * @param {HTMLElement} field - The field to dispatch the event on
   * @param {string} eventName - The name of the event to dispatch
   * @returns {boolean} - Whether the event was successfully dispatched
   */
  _dispatchEvent(field, eventName) {
    if (!field) return false;
    
    try {
      field.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));
      return true;
    } catch (error) {
      this._logError(`Error dispatching ${eventName} event:`, error);
      return false;
    }
  }
  
  /**
   * Wait for a specified amount of time
   * 
   * @protected
   * @param {number} ms - The number of milliseconds to wait
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Check if a field is visible and can be interacted with
   * 
   * @protected
   * @param {HTMLElement} field - The field to check
   * @returns {boolean} - Whether the field is visible
   */
  _isElementVisible(field) {
    if (!field) return false;
    if (!field.isConnected) return false;
    
    const style = window.getComputedStyle(field);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    // Check if field has zero dimensions, but exclude radio/checkboxes which might be styled with zero size
    if (field.offsetWidth === 0 || field.offsetHeight === 0) {
      if (!(field.tagName === 'INPUT' && (field.type === 'radio' || field.type === 'checkbox'))) {
        return false;
      }
    }
    
    // Check if any parent is hidden
    let parent = field.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
        return false;
      }
      parent = parent.parentElement;
    }
    
    return true;
  }
  
  /**
   * Check if a field is blank/empty
   * 
   * @protected
   * @param {HTMLElement} field - The field to check
   * @returns {boolean} - Whether the field is blank
   */
  _isFieldBlank(field) {
    const fieldType = field.type ? field.type.toLowerCase() : field.tagName.toLowerCase();
    
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      return !field.checked;
    } else if (fieldType === 'select-one' || fieldType === 'select') {
      return field.selectedIndex === -1 || 
             field.value === '' || 
             (field.options[field.selectedIndex] && 
              (field.options[field.selectedIndex].text.toLowerCase().includes('select') || 
               field.options[field.selectedIndex].text.trim() === '' ||
               field.options[field.selectedIndex].disabled));
    } else {
      return !field.value || field.value.trim() === '';
    }
  }
  
  /**
   * Get the error message for a field, if any
   * 
   * @protected
   * @param {HTMLElement} field - The field to check for errors
   * @returns {string|null} - The error message or null if no error
   */
  _getFieldErrorMessage(field) {
    // Delegate to error handler if available
    if (this.errorHandler) {
      return this.errorHandler.getErrorMessage(field);
    }
    
    // Fallback implementation if no error handler
    if (!field) return null;
    
    try {
      // Find container elements that might contain error messages
      const containers = [];
      
      // Use closest to find common parent containers
      if (field.closest) {
        const possibleContainers = [
          field.closest('.form-element'),
          field.closest('.form-section__grouping'),
          field.closest('.form-item'),
          field.closest('fieldset')
        ];
        
        for (const container of possibleContainers) {
          if (container) containers.push(container);
        }
      }
      
      // Common error selectors
      const errorSelectors = [
        '[id$="-error"]',
        '.inline-feedback',
        '.inline-feedback__message',
        '[role="alert"]',
        '.form-error-tooltip',
        '.msg-error',
        '[data-test-error-messages]'
      ];
      
      // Check each container for error elements
      for (const container of containers) {
        for (const selector of errorSelectors) {
          const errorElements = container.querySelectorAll(selector);
          
          for (const errorEl of errorElements) {
            if (errorEl && this._isElementVisible(errorEl) && errorEl.innerText.trim()) {
              return errorEl.innerText.trim();
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      this._logError('Error checking for field error message:', error);
      return null;
    }
  }
  
  /**
   * Log an informational message
   * 
   * @protected
   * @param {string} message - The message to log
   */
  _log(message) {
    console.log(`${this._logPrefix} ${message}`);
  }
  
  /**
   * Log an error message
   * 
   * @protected
   * @param {string} message - The error message
   * @param {Error} [error] - Optional error object
   */
  _logError(message, error) {
    console.error(`${this._logPrefix} ${message}`, error || '');
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = FieldHandlerBase;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.FieldHandlerBase = FieldHandlerBase;
}