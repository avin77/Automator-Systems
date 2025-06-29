/**
 * @fileoverview Class for detecting and interacting with LinkedIn job elements.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * JobDetector is responsible for finding job elements on LinkedIn.
 * 
 * @class
 */
class JobDetector {
  /**
   * Creates a new job detector
   */
  constructor() {
    // Create an error handler for this module
    if (typeof ErrorHandler === 'function') {
      this.errorHandler = new ErrorHandler('JobDetector');
    } else {
      // Fallback if ErrorHandler is not available
      this._logPrefix = '[EasyApplyPlugin][JobDetector]';
    }
    
    // Create a DOM utils instance
    if (typeof DOMUtils === 'function') {
      this.domUtils = new DOMUtils(this.errorHandler);
    } else {
      this._log('DOMUtils not available, using direct DOM operations');
    }
    
    // Verify that LinkedInSelectors is available
    if (typeof LinkedInSelectors === 'undefined') {
      this._logError('LinkedInSelectors not found! Modal detection may not work correctly.');
    } else {
      this._log('Using centralized LinkedInSelectors for element detection');
    }
  }

  /**
   * Check if an Easy Apply modal is visible on the page
   * 
   * @returns {boolean} - Whether a modal is visible
   */
  isModalVisible() {
    try {
      // Get selectors from LinkedInSelectors if available
      let modalSelectors = [];
      let contentSelectors = [];
      let progressIndicator = '.artdeco-completeness-meter-linear__progress-element';
      
      // Use centralized selectors if available
      if (typeof LinkedInSelectors !== 'undefined' && LinkedInSelectors.easyApplyModal) {
        modalSelectors = LinkedInSelectors.easyApplyModal.modalSelectors || [];
        contentSelectors = LinkedInSelectors.easyApplyModal.contentSelectors || [];
        progressIndicator = LinkedInSelectors.easyApplyModal.progressIndicator || progressIndicator;
      } else {
        // Log warning if selectors aren't available
        this._logError('LinkedInSelectors not available, using fallback selectors');
      }
      
      // Check each modal selector
      if (modalSelectors.length > 0) {
        for (const selector of modalSelectors) {
          const elements = this.domUtils ? 
            this.domUtils.querySelectorAll(selector) : 
            document.querySelectorAll(selector);
            
          if (elements && elements.length > 0) {
            // Check if any of the found elements are visible
            for (const element of elements) {
              if (this.domUtils ? 
                  this.domUtils.isElementVisible(element) : 
                  this._isElementVisible(element)) {
                this._log(`Modal detected using selector: ${selector}`);
                return true;
              }
            }
          }
        }
      }
      
      // Check content-based selectors as fallback
      if (contentSelectors.length > 0) {
        for (const selector of contentSelectors) {
          const elements = this.domUtils ? 
            this.domUtils.querySelectorAll(selector) : 
            document.querySelectorAll(selector);
            
          if (elements && elements.length > 0) {
            // Check if any of the found elements are visible
            for (const element of elements) {
              if (this.domUtils ? 
                  this.domUtils.isElementVisible(element) : 
                  this._isElementVisible(element)) {
                this._log(`Modal detected using content selector: ${selector}`);
                return true;
              }
            }
          }
        }
      }
      
      // Additional check for specific modal content
      const progressIndicators = this.domUtils ? 
        this.domUtils.querySelectorAll(progressIndicator) : 
        document.querySelectorAll(progressIndicator);
        
      if (progressIndicators && progressIndicators.length > 0) {
        for (const indicator of progressIndicators) {
          if (this.domUtils ? 
              this.domUtils.isElementVisible(indicator) : 
              this._isElementVisible(indicator)) {
            this._log('Modal detected via progress indicator');
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      this._logError('Error checking if modal is visible:', error);
      // Default to false if there's an error
      return false;
    }
  }
  
  /**
   * Check if an element is visible
   * 
   * @private
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} - Whether the element is visible
   */
  _isElementVisible(element) {
    try {
      if (!element) return false;
      
      // Check if element exists in DOM
      if (!document.body.contains(element)) return false;
      
      // Check computed style
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      
      // Check dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }
      
      // Check if element is within viewport
      const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      const viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
      
      // Element must have some part visible in viewport
      if (rect.bottom < 0 || rect.top > viewHeight || rect.right < 0 || rect.left > viewWidth) {
        return false;
      }
      
      return true;
    } catch (error) {
      this._logError('Error checking element visibility:', error);
      return false;
    }
  }
  
  /**
   * Log a message with the module prefix
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    if (this.errorHandler) {
      this.errorHandler.log(message);
    } else {
      console.log(`${this._logPrefix} ${message}`);
    }
  }
  
  /**
   * Log an error with the module prefix
   * 
   * @private
   * @param {string} message - The error message
   * @param {Error} [error] - The error object
   */
  _logError(message, error) {
    if (this.errorHandler) {
      this.errorHandler.error(message, error);
    } else {
      console.error(`${this._logPrefix} ${message}`, error);
    }
  }
} 