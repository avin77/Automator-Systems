/**
 * @fileoverview Enhanced job detection for LinkedIn
 * Provides robust job card detection and information extraction
 * Uses advanced selector engine to reliably find jobs across LinkedIn UI changes
 * @author EasyApplyPlugin Team
 * @version 2.0.0
 */

/**
 * Enhanced job detector with improved reliability and logging
 */
class JobDetectorV2 {
  /**
   * Create a new JobDetectorV2
   * @param {Object} [errorHandler] - Error handler for logging
   * @param {Object} [config] - Configuration object
   */
  constructor(errorHandler, config = {}) {
    this.errorHandler = errorHandler;
    this.logPrefix = '[JobDetector]';
    this.config = config;
    
    // Initialize selector engine if available
    if (typeof DOMSelectorEngine === 'function') {
      this.selectorEngine = new DOMSelectorEngine(errorHandler);
    }
    
    // Get selectors
    this.selectors = typeof LinkedInSelectors !== 'undefined' ? 
      LinkedInSelectors : {};
      
    // Initialize debug flags
    this.debugMode = config?.debug?.jobDetection || false;
  }

  /**
   * Get all job cards from the current page
   * 
   * @param {boolean} [debug=false] - Whether to log detailed debug info
   * @returns {Array<Element>} - List of job cards
   */
  getJobCards(debug = false) {
    return this._safeExecute(() => {
      this._log('Searching for job cards...', true);
      const jobCards = [];
      
      // STRATEGY 1: Find job card wrappers directly and get their parent li elements
      this._log('Strategy 1: Find job card wrappers and get parent li', debug);
      const wrapperSelector = this.selectors.jobCards?.wrapper?.class || '.job-card-job-posting-card-wrapper';
      
      let wrappers;
      if (this.selectorEngine) {
        wrappers = this.selectorEngine.querySelectorAll(wrapperSelector, document, debug);
      } else {
        wrappers = document.querySelectorAll(wrapperSelector);
      }
      
      if (wrappers && wrappers.length > 0) {
        this._log(`Found ${wrappers.length} job card wrappers`, true);
        
        // Get the parent li elements - these are the actual job cards
        const validCards = Array.from(wrappers)
          .map(wrapper => wrapper.closest('li'))
          .filter(Boolean);
          
        this._log(`Found ${validCards.length} valid parent li elements`, true);
        
        // Add unique cards only
        const seenIds = new Set();
        validCards.forEach(card => {
          // Use data-job-id or other unique identifier if available
          const jobId = card.getAttribute('data-job-id') || card.id || card.outerHTML.substring(0, 100);
          if (!seenIds.has(jobId)) {
            seenIds.add(jobId);
            jobCards.push(card);
          }
        });
        
        if (jobCards.length > 0) {
          this._log(`Returning ${jobCards.length} unique job cards from strategy 1`, true);
          return jobCards;
        }
      }
      
      // STRATEGY 2: Find job container and get li elements
      this._log('Strategy 2: Find job containers and get list items', debug);
      const containerSelectors = this.selectors.jobCards?.wrapper?.listContainers || [
        '.jobs-search-results-list',
        '.jobs-search-results__list',
        'ul[class*="scaffold-layout__list"]'
      ];
      
      let container;
      if (this.selectorEngine) {
        container = this.selectorEngine.querySelector(containerSelectors, document, debug);
      } else {
        // Try each selector
        for (const selector of containerSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            container = el;
            break;
          }
        }
      }
      
      if (container) {
        this._log(`Found job container: ${container.tagName}${container.className ? '.' + container.className.split(' ')[0] : ''}`, true);
        
        // Get li elements within container
        const listItems = container.querySelectorAll('li');
        
        if (listItems && listItems.length > 0) {
          this._log(`Found ${listItems.length} list items in container`, true);
          
          // Filter to only items that contain job cards
          const validItems = Array.from(listItems).filter(li => {
            return li.querySelector(wrapperSelector) !== null;
          });
          
          if (validItems.length > 0) {
            this._log(`Found ${validItems.length} valid job cards in container`, true);
            return validItems;
          }
        }
      }
      
      // STRATEGY 3: Last resort - find any list items with job content
      this._log('Strategy 3: Last resort - find any list items with job content', debug);
      const allListItems = document.querySelectorAll('li');
      this._log(`Found ${allListItems.length} total list items on page`, debug);
      
      const possibleJobCards = Array.from(allListItems).filter(li => {
        if (!li.textContent || li.textContent.trim() === '') return false;
        
        // Check if it contains a job card wrapper
        if (li.querySelector(wrapperSelector)) return true;
        
        // Check if it has job-related attributes
        if (li.hasAttribute('data-job-id')) return true;
        
        // Check if it has a job-related link
        if (li.querySelector('a[href*="jobs"]')) return true;
        
        return false;
      });
      
      if (possibleJobCards.length > 0) {
        this._log(`Fallback: Found ${possibleJobCards.length} possible job cards from all list items`, true);
        return possibleJobCards;
      }
      
      this._log('No job cards found with any method', true);
      return [];
    }, 'Error getting job cards', []);
  }

  /**
   * Get all Easy Apply job cards
   * 
   * @param {boolean} includeAllNonApplied - Whether to include all non-applied jobs if no Easy Apply jobs found
   * @returns {Array<Element>} - List of job cards with Easy Apply
   */
  getEasyApplyJobCards(includeAllNonApplied = false) {
    const allCards = this.getJobCards(this.debugMode);
    
    if (allCards.length === 0) {
      this._log('No job cards found to filter for Easy Apply', true);
      return [];
    }
    
    this._log(`Checking ${allCards.length} job cards for Easy Apply label...`, true);
    
    const easyApplyCards = [];
    const alreadyAppliedCards = [];
    const nonEasyApplyCards = [];
    
    for (const card of allCards) {
      // First check if already applied
      const isApplied = this.isJobAlreadyApplied(card);
      
      if (isApplied) {
        alreadyAppliedCards.push(card);
        this._log('Found already applied job, skipping', this.debugMode);
        continue; // Skip already applied jobs
      }
      
      // Then check if it's an Easy Apply job
      if (this.hasEasyApplyLabel(card)) {
        easyApplyCards.push(card);
        this._log('Found Easy Apply job', this.debugMode);
      } else {
        nonEasyApplyCards.push(card);
        this._log('Found non-Easy Apply job', this.debugMode);
      }
    }
    
    this._log(`Found ${easyApplyCards.length} Easy Apply job cards out of ${allCards.length} total cards`, true);
    this._log(`Already applied to ${alreadyAppliedCards.length} jobs`, true);
    this._log(`Non-Easy Apply jobs: ${nonEasyApplyCards.length}`, true);
    
    // If no Easy Apply cards found but includeAllNonApplied is true, return all non-applied cards
    if (easyApplyCards.length === 0 && includeAllNonApplied && nonEasyApplyCards.length > 0) {
      this._log(`No Easy Apply jobs found, but returning ${nonEasyApplyCards.length} non-applied jobs as fallback`, true);
      return nonEasyApplyCards;
    }
    
    // If no Easy Apply cards found, log more details for debugging
    if (easyApplyCards.length === 0) {
      if (alreadyAppliedCards.length > 0) {
        this._log(`All jobs are either already applied to (${alreadyAppliedCards.length}) or not Easy Apply (${nonEasyApplyCards.length})`, true);
      }
      
      if (nonEasyApplyCards.length > 0 && this.debugMode) {
        this._log('No Easy Apply jobs detected. Checking HTML structure of first non-applied job card:', true);
        const firstCard = nonEasyApplyCards[0];
        if (firstCard) {
          const cardHtml = firstCard.outerHTML.substring(0, 500) + '...'; // Log first 500 chars
          this._log(`First non-applied job card HTML snippet: ${cardHtml}`, true);
        }
      }
    }
    
    return easyApplyCards;
  }

  /**
   * Check if a job card has the "Easy Apply" label
   * 
   * @param {Element} card - Job card element
   * @returns {boolean} - Whether the job card has the Easy Apply label
   */
  hasEasyApplyLabel(card) {
    return this._safeExecute(() => {
      if (!card) return false;
      
      // First ensure this is a job card by checking for the wrapper
      const wrapperSelector = this.selectors.jobCards?.wrapper?.class || '.job-card-job-posting-card-wrapper';
      const jobWrapper = card.querySelector(wrapperSelector);
      
      if (!jobWrapper) {
        this._log('Not a valid job card (no wrapper found)', this.debugMode);
        return false;
      }
      
      // Method 1: Check footer items for "Easy Apply" text
      const footerItemsSelectors = this.selectors.jobCards?.status?.easyApplyContainers || [
        '.job-card-job-posting-card-wrapper__footer-items li',
        'ul[class*="footer-items"] li'
      ];
      
      let footerItems;
      if (this.selectorEngine) {
        footerItems = this.selectorEngine.querySelectorAll(footerItemsSelectors, card, this.debugMode);
      } else {
        // Try each selector
        footerItems = [];
        for (const selector of Array.isArray(footerItemsSelectors) ? footerItemsSelectors : [footerItemsSelectors]) {
          const items = card.querySelectorAll(selector);
          if (items.length > 0) {
            footerItems = Array.from(items);
            break;
          }
        }
      }
      
      const easyApplyText = this.selectors.jobCards?.status?.easyApplyText || 'easy apply';
      
      for (const item of footerItems) {
        try {
          const itemText = item.textContent?.trim().toLowerCase();
          if (itemText && itemText.includes(easyApplyText)) {
            this._log('Found Easy Apply in footer item', this.debugMode);
            return true;
          }
          
          // Check for LinkedIn logo which is often next to "Easy Apply"
          const iconSelectors = this.selectors.jobCards?.status?.linkedInIcon || [
            'svg[class*="linkedin-bug"]',
            'svg[data-test-icon="linkedin-bug-color-small"]'
          ];
          
          let hasIcon = false;
          if (this.selectorEngine) {
            hasIcon = this.selectorEngine.querySelector(iconSelectors, item, false) !== null;
          } else {
            for (const selector of Array.isArray(iconSelectors) ? iconSelectors : [iconSelectors]) {
              if (item.querySelector(selector)) {
                hasIcon = true;
                break;
              }
            }
          }
          
          if (hasIcon && itemText && itemText.includes(easyApplyText)) {
            this._log('Found Easy Apply with LinkedIn logo', this.debugMode);
            return true;
          }
        } catch (error) {
          // Ignore errors when checking individual items
        }
      }
      
      // Method 2: Fall back to checking the card text content
      const cardText = card.textContent?.trim().toLowerCase();
      if (cardText && cardText.includes(easyApplyText)) {
        this._log('Found Easy Apply in card text', this.debugMode);
        
        // To make this more reliable, we should check if it's in a small text node
        // likely to be a button or label, not just anywhere in the text
        const textNodes = this._getTextNodes(card);
        
        for (const node of textNodes) {
          const nodeText = node.textContent.trim().toLowerCase();
          if (nodeText.includes(easyApplyText) && nodeText.length < 50) {
            this._log('Found Easy Apply in a likely button/label text node', this.debugMode);
            return true;
          }
        }
      }
      
      return false;
    }, 'Error checking for Easy Apply label', false);
  }

  /**
   * Check if a job is already applied to
   * 
   * @param {Element} card - Job card element
   * @returns {boolean} - Whether the job is already applied to
   */
  isJobAlreadyApplied(card) {
    return this._safeExecute(() => {
      if (!card) return false;
      
      // First ensure this is a job card by checking for the wrapper
      const wrapperSelector = this.selectors.jobCards?.wrapper?.class || '.job-card-job-posting-card-wrapper';
      const jobWrapper = card.querySelector(wrapperSelector);
      
      if (!jobWrapper) {
        return false;
      }
      
      // Method 1: Check footer items for applied status text
      const footerItemsSelectors = this.selectors.jobCards?.status?.easyApplyContainers || [
        '.job-card-job-posting-card-wrapper__footer-items li',
        'ul[class*="footer-items"] li'
      ];
      
      let footerItems;
      if (this.selectorEngine) {
        footerItems = this.selectorEngine.querySelectorAll(footerItemsSelectors, card, this.debugMode);
      } else {
        // Try each selector
        footerItems = [];
        for (const selector of Array.isArray(footerItemsSelectors) ? footerItemsSelectors : [footerItemsSelectors]) {
          const items = card.querySelectorAll(selector);
          if (items.length > 0) {
            footerItems = Array.from(items);
            break;
          }
        }
      }
      
      const appliedStatusText = this.selectors.jobCards?.status?.appliedStatusText || 
        ['applied', 'application submitted', 'viewed'];
      
      for (const item of footerItems) {
        try {
          const itemText = item.textContent?.trim().toLowerCase();
          if (!itemText) continue;
          
          // Check if item has any of the applied status texts
          for (const statusText of appliedStatusText) {
            if (itemText.includes(statusText)) {
              this._log(`Found "${statusText}" status in footer item`, this.debugMode);
              return true;
            }
          }
          
          // Check if it has a bold class which often indicates status
          const isBold = 
            item.classList.contains('t-bold') || 
            window.getComputedStyle(item).fontWeight >= 600;
            
          if (isBold) {
            this._log(`Found bold footer item with text: "${itemText}"`, this.debugMode);
            
            // Likely a status indicator, check if it's any of our applied status texts
            for (const statusText of appliedStatusText) {
              if (itemText.includes(statusText)) {
                this._log(`Found "${statusText}" in bold footer item`, this.debugMode);
                return true;
              }
            }
          }
        } catch (error) {
          // Ignore errors when checking individual items
        }
      }
      
      // Method 2: Check for application status classes
      const appliedStatusClasses = this.selectors.jobCards?.status?.appliedStatusClasses || [
        '.t-bold',
        '[class*="applied-status"]',
        '[class*="application-status"]'
      ];
      
      let statusElements;
      if (this.selectorEngine) {
        statusElements = this.selectorEngine.querySelectorAll(appliedStatusClasses, card, this.debugMode);
      } else {
        // Try each selector
        statusElements = [];
        for (const selector of Array.isArray(appliedStatusClasses) ? appliedStatusClasses : [appliedStatusClasses]) {
          const elements = card.querySelectorAll(selector);
          if (elements.length > 0) {
            statusElements = Array.from(elements);
            break;
          }
        }
      }
      
      for (const element of statusElements) {
        const elementText = element.textContent?.trim().toLowerCase();
        if (!elementText) continue;
        
        // Check if element text contains any applied status text
        for (const statusText of appliedStatusText) {
          if (elementText.includes(statusText)) {
            this._log(`Found "${statusText}" in element with applied status class`, this.debugMode);
            return true;
          }
        }
      }
      
      return false;
    }, 'Error checking if job already applied', false);
  }

  /**
   * Get job info from a card
   * 
   * @param {Element} card - Job card element
   * @returns {Object} - Job title, company, location
   */
  getJobCardInfo(card) {
    return this._safeExecute(() => {
      if (!card) return {};
      
      // Ensure this is a job card
      const wrapperSelector = this.selectors.jobCards?.wrapper?.class || '.job-card-job-posting-card-wrapper';
      const jobWrapper = card.querySelector(wrapperSelector);
      
      if (!jobWrapper) {
        return {};
      }
      
      // Get title
      const titleSelectors = this.selectors.jobCards?.content?.title || [
        '.job-card-job-posting-card-wrapper__title strong',
        '.artdeco-entity-lockup__title',
        'h3'
      ];
      
      let titleElement;
      if (this.selectorEngine) {
        titleElement = this.selectorEngine.querySelector(titleSelectors, card, this.debugMode);
      } else {
        for (const selector of Array.isArray(titleSelectors) ? titleSelectors : [titleSelectors]) {
          const element = card.querySelector(selector);
          if (element) {
            titleElement = element;
            break;
          }
        }
      }
      
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Get company
      const companySelectors = this.selectors.jobCards?.content?.company || [
        '.artdeco-entity-lockup__subtitle',
        '.job-card-job-posting-card-wrapper__content .artdeco-entity-lockup__subtitle'
      ];
      
      let companyElement;
      if (this.selectorEngine) {
        companyElement = this.selectorEngine.querySelector(companySelectors, card, this.debugMode);
      } else {
        for (const selector of Array.isArray(companySelectors) ? companySelectors : [companySelectors]) {
          const element = card.querySelector(selector);
          if (element) {
            companyElement = element;
            break;
          }
        }
      }
      
      const company = companyElement ? companyElement.textContent.trim() : '';
      
      // Get location
      const locationSelectors = this.selectors.jobCards?.content?.location || [
        '.artdeco-entity-lockup__caption',
        '.job-card-job-posting-card-wrapper__content .artdeco-entity-lockup__caption'
      ];
      
      let locationElement;
      if (this.selectorEngine) {
        locationElement = this.selectorEngine.querySelector(locationSelectors, card, this.debugMode);
      } else {
        for (const selector of Array.isArray(locationSelectors) ? locationSelectors : [locationSelectors]) {
          const element = card.querySelector(selector);
          if (element) {
            locationElement = element;
            break;
          }
        }
      }
      
      const location = locationElement ? locationElement.textContent.trim() : '';
      
      // Get job ID if available
      const jobId = card.getAttribute('data-job-id') || '';
      
      // Check if it's an Easy Apply job
      const isEasyApply = this.hasEasyApplyLabel(card);
      
      // Check if already applied
      const isApplied = this.isJobAlreadyApplied(card);
      
      return {
        title,
        company,
        location,
        jobId,
        isEasyApply,
        isApplied
      };
    }, 'Error getting job card info', {});
  }

  /**
   * Get the next page button
   * 
   * @param {Function} isElementVisible - Function to check if element is visible
   * @returns {Element|null} - The next page button or null
   */
  getNextPageButton(isElementVisible) {
    return this._safeExecute(() => {
      // Method 1: Find pagination container and get the next page button
      const paginationSelectors = this.selectors.pagination?.container || [
        '.jobs-search-pagination__pages',
        '.artdeco-pagination__pages',
        'ul[class*="pagination"]'
      ];
      
      let pagination;
      if (this.selectorEngine) {
        pagination = this.selectorEngine.querySelector(paginationSelectors, document, this.debugMode);
      } else {
        for (const selector of Array.isArray(paginationSelectors) ? paginationSelectors : [paginationSelectors]) {
          const element = document.querySelector(selector);
          if (element) {
            pagination = element;
            break;
          }
        }
      }
      
      if (pagination) {
        // Find active page indicator
        const activeIndicatorSelectors = this.selectors.pagination?.activeIndicator || [
          'button[aria-current="page"]',
          '.jobs-search-pagination__indicator-button--active',
          'li.active',
          'li.selected'
        ];
        
        let activeIndicator;
        if (this.selectorEngine) {
          activeIndicator = this.selectorEngine.querySelector(activeIndicatorSelectors, pagination, this.debugMode);
        } else {
          for (const selector of Array.isArray(activeIndicatorSelectors) ? activeIndicatorSelectors : [activeIndicatorSelectors]) {
            const element = pagination.querySelector(selector);
            if (element) {
              activeIndicator = element;
              break;
            }
          }
        }
        
        if (activeIndicator) {
          // Find parent li of active indicator
          const parentLi = activeIndicator.closest('li');
          
          if (parentLi) {
            // Get next sibling li
            const nextLi = parentLi.nextElementSibling;
            
            if (nextLi && isElementVisible(nextLi)) {
              // Find button in next li
              const nextButton = nextLi.querySelector('button');
              
              if (nextButton && isElementVisible(nextButton)) {
                this._log('Found next page button using pagination container', true);
                return nextButton;
              }
            }
          }
        }
      }
      
      // Method 2: Look for next button directly
      const nextButtonSelectors = this.selectors.pagination?.nextButton || [
        'button[aria-label="Next"]',
        'button.artdeco-pagination__button--next'
      ];
      
      let nextButton;
      if (this.selectorEngine) {
        nextButton = this.selectorEngine.querySelector(nextButtonSelectors, document, this.debugMode);
      } else {
        for (const selector of Array.isArray(nextButtonSelectors) ? nextButtonSelectors : [nextButtonSelectors]) {
          const element = document.querySelector(selector);
          if (element && isElementVisible(element)) {
            nextButton = element;
            break;
          }
        }
      }
      
      if (nextButton) {
        this._log('Found next page button directly', true);
        return nextButton;
      }
      
      // Method 3: Look for buttons with "Next" text
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        if (!isElementVisible(btn)) continue;
        
        const btnText = btn.textContent?.trim().toLowerCase();
        if (btnText === 'next') {
          this._log('Found next page button by text content', true);
          return btn;
        }
        
        // Check aria-label
        const ariaLabel = btn.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.toLowerCase() === 'next') {
          this._log('Found next page button by aria-label', true);
          return btn;
        }
      }
      
      this._log('No next page button found', true);
      return null;
    }, 'Error getting next page button', null);
  }

  /**
   * Get all text nodes within an element
   * 
   * @private
   * @param {Element} element - Element to get text nodes from
   * @returns {Text[]} - Array of text nodes
   */
  _getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      { acceptNode: node => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes;
  }

  /**
   * Safely execute a function with error handling
   * 
   * @private
   * @param {Function} fn - Function to execute
   * @param {string} errorMessage - Error message if function fails
   * @param {*} fallbackValue - Value to return if function fails
   * @returns {*} - Result of function or fallback value
   */
  _safeExecute(fn, errorMessage, fallbackValue) {
    try {
      return fn();
    } catch (error) {
      this._logError(errorMessage, error);
      return fallbackValue;
    }
  }

  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   * @param {boolean} [force=false] - Whether to log even if not in debug mode
   */
  _log(message, force = false) {
    if (!force && !this.debugMode) return;
    
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
  module.exports = JobDetectorV2;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.JobDetectorV2 = JobDetectorV2;
} 