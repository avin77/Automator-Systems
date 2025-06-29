/**
 * @fileoverview Utility class for detecting and extracting information from LinkedIn job listings.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * JobDetector is responsible for finding job cards, extracting job information,
 * and detecting job-related elements on LinkedIn job search pages.
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
    
    // Default selectors to use if config not available
    const defaultSelectors = {
      jobCards: {
        container: 'li',
        jobIdAttribute: '[data-job-id]',
        title: 'h3, strong, [class*="title"]',
        company: '[class*="company"], [class*="subtitle"]',
        location: '[class*="location"], [class*="caption"]',
        easyApplyText: 'easy apply',
        easyApplyContainers: 'li, [class*="footer"]',
        linkedInIcon: 'svg, [data-test-icon="linkedin-bug"]',
        listContainers: [
          '.jobs-search-results-list',
          '.jobs-search-results__list',
          '[data-test-search-results-list]',
          '.scaffold-layout__list'
        ]
      },
      easyApplyButton: {
        buttonText: 'easy apply',
        buttonSelectors: [
          '.jobs-apply-button',
          '.jobs-apply-button--top-card',
          'button[aria-label*="Easy Apply"]',
          'button.artdeco-button--primary'
        ],
        containerSelectors: [
          '.jobs-apply-button--top-card',
          '.jobs-s-apply',
          '.jobs-apply-button',
          '.job-details-jobs-unified-top-card__container'
        ]
      }
    };
    
    // Get selectors from config if available
    this.selectors = typeof LinkedInSelectors !== 'undefined' ? 
      LinkedInSelectors : defaultSelectors;
      
    // Ensure all required selector categories exist
    this.selectors.jobCards = this.selectors.jobCards || defaultSelectors.jobCards;
    this.selectors.easyApplyButton = this.selectors.easyApplyButton || defaultSelectors.easyApplyButton;
    
    // Ensure all required selectors exist within each category
    for (const key in defaultSelectors.jobCards) {
      if (!this.selectors.jobCards[key]) {
        this.selectors.jobCards[key] = defaultSelectors.jobCards[key];
      }
    }
    
    for (const key in defaultSelectors.easyApplyButton) {
      if (!this.selectors.easyApplyButton[key]) {
        this.selectors.easyApplyButton[key] = defaultSelectors.easyApplyButton[key];
      }
    }
  }
  
  /**
   * Get all job cards from the current page using a resilient approach that
   * focuses on the core structure of LinkedIn job listings
   * 
   * @returns {Array<Element>} - List of job cards
   */
  getJobCards() {
    return this.errorHandler?.safeExecute(() => {
      // Start with a simple approach - find all li elements that might be job cards
      // LinkedIn consistently uses list items for job cards, even if classes change
      const allListItems = this.domUtils ? 
        this.domUtils.querySelectorAll(this.selectors.jobCards.container) : 
        document.querySelectorAll(this.selectors.jobCards.container);
      
      if (!allListItems || allListItems.length === 0) {
        this._log('No list items found on the page');
        return [];
      }
      
      this._log(`Found ${allListItems.length} list items to analyze`);
      
      // Filter list items to those that are likely job cards
      const jobCards = Array.from(allListItems).filter(li => {
        try {
          // Check if this list item contains job-related content
          
          // Method 1: Check if it contains "Easy Apply" text
          const hasEasyApplyText = li.textContent && 
            li.textContent.toLowerCase().includes(this.selectors.jobCards.easyApplyText);
          
          // Method 2: Check if it has job-related attributes
          const hasJobId = this.domUtils ? 
            this.domUtils.querySelector(this.selectors.jobCards.jobIdAttribute, li) !== null : 
            li.querySelector(this.selectors.jobCards.jobIdAttribute) !== null;
          
          // Method 3: Check if it has common job card elements
          const hasJobTitle = this.domUtils ? 
            this.domUtils.querySelector(this.selectors.jobCards.title, li) !== null : 
            li.querySelector(this.selectors.jobCards.title) !== null;
            
          const hasCompanyName = this.domUtils ? 
            this.domUtils.querySelector(this.selectors.jobCards.company, li) !== null : 
            li.querySelector(this.selectors.jobCards.company) !== null;
          
          // Method 4: Check if it has a job link
          const hasJobLink = this.domUtils ? 
            this.domUtils.querySelector('a[href*="jobs"]', li) !== null : 
            li.querySelector('a[href*="jobs"]') !== null;
          
          // Consider it a job card if it meets multiple criteria
          return (hasJobId || hasJobLink) && (hasJobTitle || hasCompanyName || hasEasyApplyText);
        } catch (error) {
          // If any error occurs during checking, skip this item
          return false;
        }
      });
      
      this._log(`Identified ${jobCards.length} likely job cards`);
      
      // If we found no job cards with the filtering approach, try a fallback
      if (jobCards.length === 0) {
        // Look for a jobs container first
        const containerSelectors = this.selectors.jobCards.listContainers.join(', ');
        const jobsContainer = this.domUtils ? 
          this.domUtils.querySelector(containerSelectors) : 
          document.querySelector(containerSelectors);
        
        if (jobsContainer) {
          // If we found a container, get all list items within it
          const containerItems = this.domUtils ? 
            this.domUtils.querySelectorAll(this.selectors.jobCards.container, jobsContainer) : 
            jobsContainer.querySelectorAll(this.selectors.jobCards.container);
            
          this._log(`Fallback: Found ${containerItems.length} items in jobs container`);
          return Array.from(containerItems);
        }
      }
      
      return jobCards;
    }, 'Error getting job cards', []);
  }

  /**
   * Get all job cards with "Easy Apply" from the current page
   * 
   * @param {boolean} includeAllNonApplied - Whether to include all non-applied jobs if no Easy Apply jobs are found
   * @returns {Array<Element>} - List of job cards with Easy Apply
   */
  getEasyApplyJobCards(includeAllNonApplied = false) {
    const allCards = this.getJobCards();
    
    if (allCards.length === 0) {
      this._log('No job cards found to filter for Easy Apply');
      return [];
    }
    
    this._log(`Checking ${allCards.length} job cards for Easy Apply label...`);
    
    const easyApplyCards = [];
    const alreadyAppliedCards = [];
    const nonEasyApplyCards = [];
    
    for (const card of allCards) {
      // First check if already applied
      const isApplied = this.isJobAlreadyApplied(card);
      
      if (isApplied) {
        alreadyAppliedCards.push(card);
        this._log('Found already applied job, skipping');
        continue; // Skip already applied jobs
      }
      
      // Then check if it's an Easy Apply job
      if (this.hasEasyApplyLabel(card)) {
        easyApplyCards.push(card);
        this._log('Found Easy Apply job');
      } else {
        nonEasyApplyCards.push(card);
        this._log('Found non-Easy Apply job');
      }
    }
    
    this._log(`Found ${easyApplyCards.length} Easy Apply job cards out of ${allCards.length} total cards`);
    this._log(`Already applied to ${alreadyAppliedCards.length} jobs`);
    this._log(`Non-Easy Apply jobs: ${nonEasyApplyCards.length}`);
    
    // If no Easy Apply cards found but includeAllNonApplied is true, return all non-applied cards
    if (easyApplyCards.length === 0 && includeAllNonApplied && nonEasyApplyCards.length > 0) {
      this._log(`No Easy Apply jobs found, but returning ${nonEasyApplyCards.length} non-applied jobs as fallback`);
      return nonEasyApplyCards;
    }
    
    // If no Easy Apply cards found, log more details for debugging
    if (easyApplyCards.length === 0) {
      if (alreadyAppliedCards.length > 0) {
        this._log(`All jobs are either already applied to (${alreadyAppliedCards.length}) or not Easy Apply (${nonEasyApplyCards.length})`);
      }
      
      if (nonEasyApplyCards.length > 0) {
        this._log('No Easy Apply jobs detected. Checking HTML structure of first non-applied job card:');
        const firstCard = nonEasyApplyCards[0];
        if (firstCard) {
          const cardHtml = firstCard.outerHTML.substring(0, 500) + '...'; // Log first 500 chars
          this._log(`First non-applied job card HTML snippet: ${cardHtml}`);
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
    return this.errorHandler?.safeExecute(() => {
      if (!card) return false;
      
      // Method 1: Direct text content check (most reliable)
      // LinkedIn consistently includes "Easy Apply" text in the job card
      const cardText = card.textContent && card.textContent.trim().toLowerCase();
      if (cardText && cardText.includes(this.selectors.jobCards.easyApplyText)) {
        return true;
      }
      
      // Method 2: Look for specific "Easy Apply" elements in common locations
      
      // Check footer items first (most common location)
      const footerItems = this.domUtils ? 
        this.domUtils.querySelectorAll(this.selectors.jobCards.easyApplyContainers, card) : 
        card.querySelectorAll(this.selectors.jobCards.easyApplyContainers);
        
      for (const item of footerItems) {
        try {
          const itemText = item.textContent && item.textContent.trim().toLowerCase();
          if (itemText && itemText.includes(this.selectors.jobCards.easyApplyText)) {
            return true;
          }
        } catch (error) {
          // Ignore errors when checking individual items
        }
      }
      
      // Method 3: Look for LinkedIn icon followed by "Easy Apply" text
      // LinkedIn often shows their logo next to "Easy Apply"
      const linkedInIcons = this.domUtils ? 
        this.domUtils.querySelectorAll(this.selectors.jobCards.linkedInIcon, card) : 
        card.querySelectorAll(this.selectors.jobCards.linkedInIcon);
        
      for (const icon of linkedInIcons) {
        try {
          // Check if any parent element within 3 levels contains "Easy Apply"
          let parent = icon.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            const parentText = parent.textContent && parent.textContent.trim().toLowerCase();
            if (parentText && parentText.includes(this.selectors.jobCards.easyApplyText)) {
              return true;
            }
            parent = parent.parentElement;
          }
        } catch (error) {
          // Ignore errors when checking individual icons
        }
      }
      
      // Method 4: Use DOMUtils to find elements by text directly
      if (this.domUtils) {
        const easyApplyElements = this.domUtils.findElementsByText(
          this.selectors.jobCards.easyApplyText, 
          '*', 
          card
        );
        
        if (easyApplyElements.length > 0) {
          return true;
        }
      }
      
      return false;
    }, 'Error checking for Easy Apply label', false);
  }

  /**
   * Get job info from a card
   * 
   * @param {Element} card - Job card element
   * @returns {Object} - Job title and company
   */
  getJobCardInfo(card) {
    try {
      // Try multiple selectors for job title
      const titleSelectors = [
        '.job-card-list__title',
        '.jobs-search-results__list-item-title',
        '.artdeco-entity-lockup__title',
        '.job-card-container__link',
        'h3.base-search-card__title',
        '.job-card-container__primary-description a',
        'a[data-control-name="job_title"]'
      ];
      
      // Try multiple selectors for company name
      const companySelectors = [
        '.job-card-container__company-name',
        '.job-card-container__primary-description',
        '.artdeco-entity-lockup__subtitle',
        '.base-search-card__subtitle',
        'a[data-control-name="company_link"]'
      ];
      
      // Find job title
      let title = '';
      for (const selector of titleSelectors) {
        const titleEl = card.querySelector(selector);
        if (titleEl && titleEl.textContent.trim()) {
          title = titleEl.textContent.trim();
          break;
        }
      }
      
      // Find company name
      let company = '';
      for (const selector of companySelectors) {
        const companyEl = card.querySelector(selector);
        if (companyEl && companyEl.textContent.trim()) {
          company = companyEl.textContent.trim();
          break;
        }
      }
      
      // If still no title/company, try to find any text in the card
      if (!title) {
        // Try to find any heading element
        const headings = card.querySelectorAll('h1, h2, h3, h4, h5');
        if (headings.length > 0) {
          title = headings[0].textContent.trim();
        }
      }
      
      // Check if this is an Easy Apply job
      const isEasyApply = this.hasEasyApplyLabel(card);
      
      this._log(`Extracted job info - Title: "${title}", Company: "${company}", Easy Apply: ${isEasyApply}`);
      return { title, company, isEasyApply };
    } catch (error) {
      this._logError('Error getting job card info:', error);
      return { title: '', company: '', isEasyApply: false };
    }
  }

  /**
   * Check if a job card has already been applied to
   * 
   * @param {Element} card - Job card element
   * @returns {boolean} - Whether the job has been applied to
   */
  isJobAlreadyApplied(card) {
    if (!card) return false;
    
    try {
      // Method 1: Check for 'Applied' text in footer items
      const footerItems = card.querySelectorAll('.job-card-job-posting-card-wrapper__footer-items li');
      for (const item of footerItems) {
        const itemText = item.textContent && item.textContent.trim().toLowerCase();
        if (itemText === 'applied' || itemText === 'application submitted' || itemText === 'viewed') {
          this._log('Job already applied to (found in footer items)');
          return true;
        }
      }
      
      // Method 2: Check for 'Applied' text in any element
      const appliedTextElements = Array.from(card.querySelectorAll('*'));
      const hasAppliedText = appliedTextElements.some(el => {
        const text = el.textContent && el.textContent.trim().toLowerCase();
        return text === 'applied' || text === 'application submitted';
      });
      
      if (hasAppliedText) {
        this._log('Job already applied to (found applied text)');
        return true;
      }
      
      // Method 3: Check for applied status indicator classes
      const hasAppliedClass = card.querySelector(
        '.jobs-application-status--applied, ' + 
        '.artdeco-inline-feedback--success, ' +
        '.job-card-container__applied-status, ' +
        '.job-applied-status, ' +
        '.job-card-job-posting-card-wrapper__footer-item.t-bold'
      );
      
      if (hasAppliedClass) {
        // Verify it contains "Applied" text
        if (hasAppliedClass.textContent && 
            hasAppliedClass.textContent.trim().toLowerCase() === 'applied') {
          this._log('Job already applied to (found applied class with text)');
          return true;
        }
      }
      
      // Method 4: Check specifically for the bold footer item with "Applied" text
      const boldFooterItems = card.querySelectorAll('.job-card-job-posting-card-wrapper__footer-item.t-bold');
      for (const item of boldFooterItems) {
        const itemText = item.textContent && item.textContent.trim().toLowerCase();
        if (itemText === 'applied') {
          this._log('Job already applied to (found bold footer item with Applied text)');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this._logError('Error checking if job already applied:', error);
      return false;
    }
  }

  /**
   * Get job info from the right pane
   * 
   * @returns {Object} - Job title and company
   */
  getRightPaneJobInfo() {
    try {
      // Try multiple selectors for job title
      const titleSelectors = [
        '.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-details-top-card__job-title',
        'h2.t-24'
      ];
      
      // Try multiple selectors for company name
      const companySelectors = [
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-details-top-card__company-info',
        'a.app-aware-link[href*="company"]'
      ];
      
      // Find job title
      let title = '';
      for (const selector of titleSelectors) {
        const titleEl = document.querySelector(selector);
        if (titleEl && titleEl.textContent.trim()) {
          title = titleEl.textContent.trim();
          break;
        }
      }
      
      // Find company name
      let company = '';
      for (const selector of companySelectors) {
        const companyEl = document.querySelector(selector);
        if (companyEl && companyEl.textContent.trim()) {
          company = companyEl.textContent.trim();
          break;
        }
      }
      
      this._log(`Right pane job info - Title: "${title}", Company: "${company}"`);
      return { title, company };
    } catch (error) {
      this._logError('Error getting right pane job info:', error);
      return { title: '', company: '' };
    }
  }

  /**
   * Wait for the right pane to match the selected job card
   * 
   * @param {Object} cardInfo - Job info from card
   * @param {number} timeout - Maximum time to wait in ms
   * @returns {Promise<boolean>} - Whether the right pane matched
   */
  waitForRightPaneToMatch(cardInfo, timeout = 10000) {
    console.log("cardinfo"+cardInfo.title);
    return new Promise((resolve) => {
      const interval = 5000;
      let elapsed = 0;
      const timer = setInterval(() => {
        const paneInfo = this.getRightPaneJobInfo();
        
        // Check if title matches
        if (paneInfo.title.includes(cardInfo.title) || cardInfo.title.includes(paneInfo.title)) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        
        elapsed += interval;
        if (elapsed >= timeout) {
          clearInterval(timer);
          resolve(false);
        }
      }, interval);
    });
  }

  /**
   * Wait for the Easy Apply button to appear
   * 
   * @param {Function} isElementVisible - Function to check if element is visible
   * @param {number} timeout - Maximum time to wait in ms
   * @returns {Promise<Element|null>} - The Easy Apply button or null
   */
  waitForEasyApplyButton(isElementVisible, timeout = 10000) {
    try {
      this._log('Waiting for Easy Apply button...');
      
      // Use DOMUtils for visibility check if available
      const checkVisibility = this.domUtils ? 
        this.domUtils.isElementVisible.bind(this.domUtils) : 
        (typeof isElementVisible === 'function' ? 
          isElementVisible : 
          (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  style.opacity !== '0' &&
                  el.offsetWidth > 0 &&
                  el.offsetHeight > 0;
          });
      
      // Ensure we have our selectors
      const buttonText = this.selectors?.easyApplyButton?.buttonText || 'easy apply';
      const buttonSelectors = this.selectors?.easyApplyButton?.buttonSelectors || [
        '.jobs-apply-button',
        '.jobs-apply-button--top-card',
        'button[aria-label*="Easy Apply"]'
      ];
      const containerSelectors = this.selectors?.easyApplyButton?.containerSelectors || [
        '.jobs-apply-button--top-card',
        '.jobs-s-apply',
        '.jobs-apply-button'
      ];
      
      // If DOMUtils is available, use its waitForElement method
      if (this.domUtils) {
        // Try each button selector with waitForElement
        for (const selector of buttonSelectors) {
          const button = this.domUtils.waitForElement(selector, {
            timeout: timeout / buttonSelectors.length, // Divide timeout among selectors
            visible: true
          });
          
          if (button) {
            this._log(`Found Easy Apply button using selector: ${selector}`);
            return Promise.resolve(button);
          }
        }
        
        // Try finding by text content
        const easyApplyButtons = this.domUtils.findElementsByText(buttonText, 'button');
        if (easyApplyButtons.length > 0) {
          const visibleButtons = easyApplyButtons.filter(btn => checkVisibility(btn));
          if (visibleButtons.length > 0) {
            this._log('Found Easy Apply button by text content');
            return Promise.resolve(visibleButtons[0]);
          }
        }
      }
      
      // Fallback to traditional approach if DOMUtils is not available or didn't find anything
      return new Promise((resolve) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
          try {
            // Approach 1: Look for button with "Easy Apply" text content (most reliable)
            const allButtons = this.domUtils ? 
              this.domUtils.querySelectorAll('button') : 
              Array.from(document.querySelectorAll('button'));
              
            const easyApplyButtons = allButtons.filter(btn => {
              try {
                if (!btn || !checkVisibility(btn)) return false;
                
                const btnText = btn.textContent && btn.textContent.trim().toLowerCase();
                return btnText === buttonText || btnText.includes(buttonText);
              } catch (err) {
                this._logError('Error filtering button:', err);
                return false;
              }
            });
            
            if (easyApplyButtons.length > 0) {
              clearInterval(timer);
              this._log('Found Easy Apply button by text content');
              resolve(easyApplyButtons[0]);
              return;
            }
            
            // Approach 2: Look for button with aria-label containing "Easy Apply"
            const ariaLabelButtons = allButtons.filter(btn => {
              try {
                if (!btn || !checkVisibility(btn)) return false;
                
                const ariaLabel = this.domUtils ? 
                  this.domUtils.getAttribute(btn, 'aria-label') : 
                  btn.getAttribute('aria-label');
                  
                return ariaLabel && ariaLabel.toLowerCase().includes(buttonText);
              } catch (err) {
                this._logError('Error checking aria-label:', err);
                return false;
              }
            });
            
            if (ariaLabelButtons.length > 0) {
              clearInterval(timer);
              this._log('Found Easy Apply button by aria-label');
              resolve(ariaLabelButtons[0]);
              return;
            }
            
            // Approach 3: Look for common container classes that might hold the Easy Apply button
            for (const selector of containerSelectors) {
              try {
                const container = this.domUtils ? 
                  this.domUtils.querySelector(selector) : 
                  document.querySelector(selector);
                  
                if (!container) continue;
                
                // Look for any button inside this container
                const btn = this.domUtils ? 
                  this.domUtils.querySelector('button', container) : 
                  container.querySelector('button');
                  
                if (btn && checkVisibility(btn)) {
                  clearInterval(timer);
                  this._log(`Found Easy Apply button in container: ${selector}`);
                  resolve(btn);
                  return;
                }
              } catch (err) {
                this._logError(`Error checking container ${selector}:`, err);
              }
            }
            
            // Approach 4: Try direct button selectors
            for (const selector of buttonSelectors) {
              try {
                const btn = this.domUtils ? 
                  this.domUtils.querySelector(selector) : 
                  document.querySelector(selector);
                  
                if (btn && checkVisibility(btn)) {
                  clearInterval(timer);
                  this._log(`Found Easy Apply button using selector: ${selector}`);
                  resolve(btn);
                  return;
                }
              } catch (err) {
                this._logError(`Error checking button selector ${selector}:`, err);
              }
            }
            
            // Approach 5: Look for buttons with specific class patterns
            const buttonClassPatterns = [
              'button[class*="apply"]',
              'button[class*="jobs"]',
              'button.artdeco-button--primary'
            ];
            
            for (const pattern of buttonClassPatterns) {
              try {
                const buttons = this.domUtils ? 
                  this.domUtils.querySelectorAll(pattern) : 
                  document.querySelectorAll(pattern);
                  
                for (const btn of buttons) {
                  if (checkVisibility(btn)) {
                    // Check if it has "apply" text or is a primary action button
                    const btnText = btn.textContent && btn.textContent.trim().toLowerCase();
                    if (btnText && (btnText.includes('apply') || btnText.includes('submit'))) {
                      clearInterval(timer);
                      this._log(`Found Apply button using pattern: ${pattern}`);
                      resolve(btn);
                      return;
                    }
                  }
                }
              } catch (err) {
                this._logError(`Error checking button pattern ${pattern}:`, err);
              }
            }
          } catch (error) {
            this._logError('Error in button detection loop:', error);
          }
          
          elapsed += interval;
          if (elapsed >= timeout) {
            clearInterval(timer);
            this._log('Easy Apply button not found');
            resolve(null);
          }
        }, interval);
      });
    } catch (error) {
      this._logError('Error waiting for Easy Apply button:', error);
      return Promise.resolve(null);
    }
  }

  /**
   * Get the next page button
   * 
   * @param {Function} isElementVisible - Function to check if element is visible
   * @returns {Element|null} - The next page button or null
   */
  getNextPageButton(isElementVisible) {
    try {
      // Method 1: Standard pagination
      const pagination = document.querySelector('.artdeco-pagination__pages');
      if (pagination) {
        // Find the active page button
        const activeButton = pagination.querySelector('li.active, li.selected');
        if (activeButton) {
          // Get the next page button
          const nextButton = activeButton.nextElementSibling;
          if (nextButton && isElementVisible(nextButton)) {
            // Find the actual button element inside the li
            const button = nextButton.querySelector('button');
            if (button && isElementVisible(button)) {
              this._log('Found next page button using standard pagination');
              return button;
            }
          }
        }
      }
      
      // Method 2: Look for "Next" button directly
      const nextButtons = Array.from(document.querySelectorAll('button'));
      for (const btn of nextButtons) {
        if (btn.textContent && 
            btn.textContent.trim().toLowerCase() === 'next' && 
            isElementVisible(btn)) {
          this._log('Found next page button by text content "Next"');
          return btn;
        }
        
        // Check for aria-label
        if (btn.getAttribute('aria-label') === 'Next' && isElementVisible(btn)) {
          this._log('Found next page button by aria-label "Next"');
          return btn;
        }
      }
      
      // Method 3: Look for pagination with SVG arrow icons
      const paginationControls = document.querySelectorAll('.artdeco-pagination__button--next');
      for (const control of paginationControls) {
        if (isElementVisible(control) && !control.disabled) {
          this._log('Found next page button using pagination controls');
          return control;
        }
      }
      
      // Method 4: Look for any element with "next" or "arrow" in class name
      const nextElements = document.querySelectorAll('[class*="next"], [class*="arrow"]');
      for (const el of nextElements) {
        if (el.tagName === 'BUTTON' && isElementVisible(el) && !el.disabled) {
          this._log('Found next page button using class name pattern');
          return el;
        }
      }
      
      this._log('No next page button found');
      return null;
    } catch (error) {
      this._logError('Error getting next page button:', error);
      return null;
    }
  }
  
  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    if (this.errorHandler) {
      this.errorHandler.logInfo(message, true); // Silent logging
    }
    // Debug logging disabled
    return;
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
      console.error(`${this._logPrefix} ${message}`, error || '');
    }
  }

  /**
   * Debug job detection issues by logging detailed information about job cards
   */
  /*
  debugJobCards() {
    try {
      this._log('========== DEBUG JOB DETECTION ==========');
      
      // Get all job cards
      const allCards = this.getJobCards();
      this._log(`Found ${allCards.length} total job cards`);
      
      if (allCards.length === 0) {
        this._log('No job cards found. Checking for any list items:');
        const allListItems = document.querySelectorAll('li');
        this._log(`Found ${allListItems.length} list items in total`);
        
        // Check for job search container
        const searchContainer = document.querySelector('.jobs-search-results-list, .jobs-search-results__list');
        if (searchContainer) {
          this._log('Found job search container');
          this._log(`Container HTML snippet: ${searchContainer.outerHTML.substring(0, 300)}...`);
        } else {
          this._log('No job search container found');
        }
        
        return;
      }
      
      // Count Easy Apply and already applied jobs
      let easyApplyCount = 0;
      let alreadyAppliedCount = 0;
      let nonEasyApplyCount = 0;
      
      for (const card of allCards) {
        const isApplied = this.isJobAlreadyApplied(card);
        if (isApplied) {
          alreadyAppliedCount++;
          continue;
        }
        
        const hasEasyApply = this.hasEasyApplyLabel(card);
        if (hasEasyApply) {
          easyApplyCount++;
        } else {
          nonEasyApplyCount++;
        }
      }
      
      this._log(`Summary: Total cards: ${allCards.length}, Already applied: ${alreadyAppliedCount}, Easy Apply: ${easyApplyCount}, Non-Easy Apply: ${nonEasyApplyCount}`);
      
      // Check first 3 cards
      const cardsToCheck = Math.min(3, allCards.length);
      for (let i = 0; i < cardsToCheck; i++) {
        const card = allCards[i];
        this._log(`\n--- Card ${i+1} Details ---`);
        
        // Get card classes
        this._log(`Classes: ${card.className}`);
        
        // Get card text content
        const text = card.textContent.trim().substring(0, 100);
        this._log(`Text content (first 100 chars): ${text}...`);
        
        // Look for footer items container
        const footerItemsContainer = card.querySelector('.job-card-job-posting-card-wrapper__footer-items');
        if (footerItemsContainer) {
          this._log('Found footer items container');
          this._log(`Footer container HTML: ${footerItemsContainer.outerHTML}`);
        } else {
          this._log('No footer items container found');
        }
        
        // Check if job is already applied
        const isApplied = this.isJobAlreadyApplied(card);
        this._log(`Already applied: ${isApplied}`);
        
        // Check if job has Easy Apply
        if (!isApplied) {
          const hasEasyApply = this.hasEasyApplyLabel(card);
          this._log(`Has Easy Apply: ${hasEasyApply}`);
        }
      }
      
      this._log('========== END DEBUG ==========');
    } catch (error) {
      this._logError('Error in debug method:', error);
    }
  }
  */

  /**
   * Debug Easy Apply detection for a specific job card
   * 
   * @param {Element} card - Job card element to debug
   */
  /*
  debugEasyApplyDetection(card) {
    if (!card) {
      this._log('No card provided for Easy Apply detection debug');
      return;
    }
    
    this._log('========== DEBUG EASY APPLY DETECTION ==========');
    
    // Check if already applied
    const isApplied = this.isJobAlreadyApplied(card);
    this._log(`Is job already applied: ${isApplied}`);
    
    if (isApplied) {
      this._log('Job is already applied, skipping Easy Apply detection');
      this._log('========== END DEBUG ==========');
      return;
    }
    
    // Direct approach: Check for elements with class job-card-job-posting-card-wrapper__footer-item
    const directFooterItems = card.querySelectorAll('.job-card-job-posting-card-wrapper__footer-item');
    this._log(`Found ${directFooterItems.length} direct footer items`);
    
    directFooterItems.forEach((item, idx) => {
      const itemText = item.textContent && item.textContent.trim();
      this._log(`Direct footer item ${idx+1} text: "${itemText}"`);
      
      // Check if the text contains "Easy Apply" (case-insensitive)
      if (itemText && itemText.toLowerCase().includes('easy apply')) {
        this._log(`Direct footer item ${idx+1} contains "Easy Apply" text`);
      }
      
      // Log the HTML of the footer item
      this._log(`Direct footer item ${idx+1} HTML: ${item.outerHTML}`);
    });
    
    // Check footer items in list
    const footerItems = card.querySelectorAll('.job-card-job-posting-card-wrapper__footer-items li');
    this._log(`Found ${footerItems.length} footer items in list`);
    
    footerItems.forEach((item, idx) => {
      const itemText = item.textContent && item.textContent.trim();
      this._log(`Footer list item ${idx+1} text: "${itemText}"`);
      
      // Check if the text contains "Easy Apply" (case-insensitive)
      if (itemText && itemText.toLowerCase().includes('easy apply')) {
        this._log(`Footer list item ${idx+1} contains "Easy Apply" text`);
      }
      
      // Check for LinkedIn bug icon
      const linkedInIcon = item.querySelector('svg.job-card-job-posting-card-wrapper__footer-item-icon');
      if (linkedInIcon) {
        this._log(`Footer list item ${idx+1} has LinkedIn bug icon with class job-card-job-posting-card-wrapper__footer-item-icon`);
        
        // Check for span with Easy Apply text
        const spanElement = item.querySelector('span');
        if (spanElement) {
          const spanText = spanElement.textContent && spanElement.textContent.trim();
          this._log(`Footer list item ${idx+1} has span with text: "${spanText}"`);
        }
      }
      
      // Check for any LinkedIn bug icon
      const hasLinkedInIcon = item.querySelector('svg[data-test-icon="linkedin-bug-color-small"]');
      if (hasLinkedInIcon) {
        this._log(`Footer list item ${idx+1} has LinkedIn bug icon with data-test-icon="linkedin-bug-color-small"`);
      }
      
      // Log the HTML of the footer item
      this._log(`Footer list item ${idx+1} HTML: ${item.outerHTML}`);
    });
    
    // Final determination
    const hasEasyApply = this.hasEasyApplyLabel(card);
    this._log(`Final determination - Has Easy Apply label: ${hasEasyApply}`);
    
    this._log('========== END DEBUG ==========');
  }
  */

  /**
   * Find and log all Easy Apply jobs on the page
   * This is a specialized debugging function to help identify Easy Apply jobs
   */
  /*
  findAllEasyApplyJobs() {
    try {
      this._log('========== FINDING ALL EASY APPLY JOBS ==========');
      
      // Get all job cards
      const allCards = this.getJobCards();
      this._log(`Found ${allCards.length} total job cards`);
      
      if (allCards.length === 0) {
        this._log('No job cards found on the page');
        return;
      }
      
      // Find all elements with "Easy Apply" text anywhere on the page
      const allElements = document.querySelectorAll('*');
      const easyApplyElements = Array.from(allElements).filter(el => {
        const text = el.textContent && el.textContent.trim().toLowerCase();
        return text === 'easy apply';
      });
      
      this._log(`Found ${easyApplyElements.length} elements with exact "Easy Apply" text on the page`);
      
      // Log each element with "Easy Apply" text
      easyApplyElements.forEach((el, idx) => {
        this._log(`Easy Apply element ${idx+1}:`);
        this._log(`  Tag: ${el.tagName}`);
        this._log(`  Classes: ${el.className}`);
        this._log(`  Text: "${el.textContent.trim()}"`);
        this._log(`  HTML: ${el.outerHTML}`);
        
        // Try to find the parent job card
        let parent = el.parentElement;
        let foundCard = false;
        while (parent && !foundCard) {
          if (parent.matches('li.scaffold-layout__list-item') || 
              parent.matches('.job-card-container') || 
              parent.matches('.jobs-search-results__list-item')) {
            this._log(`  Found parent job card: ${parent.className}`);
            foundCard = true;
          } else {
            parent = parent.parentElement;
          }
        }
      });
      
      // Find all job cards with "Easy Apply" in their footer
      const jobsWithEasyApply = [];
      let easyApplyCount = 0;
      let alreadyAppliedCount = 0;
      
      for (let i = 0; i < allCards.length; i++) {
        const card = allCards[i];
        
        // Check if already applied
        const isApplied = this.isJobAlreadyApplied(card);
        if (isApplied) {
          alreadyAppliedCount++;
          continue;
        }
        
        // Simple text-based check for "Easy Apply"
        let hasEasyApply = false;
        
        // Check all text content in the card for "easy apply"
        const cardText = card.textContent && card.textContent.trim().toLowerCase();
        if (cardText && cardText.includes('easy apply')) {
          hasEasyApply = true;
        }
        
        if (hasEasyApply) {
          easyApplyCount++;
          jobsWithEasyApply.push(card);
          
          // Log details for first 3 Easy Apply jobs
          if (jobsWithEasyApply.length <= 3) {
            this._log(`\nFound Easy Apply job ${jobsWithEasyApply.length}:`);
            const jobInfo = this.getJobCardInfo(card);
            this._log(`  Title: ${jobInfo.title}`);
            this._log(`  Company: ${jobInfo.company}`);
            
            // Log the footer HTML
            const footerContainer = card.querySelector('.job-card-job-posting-card-wrapper__footer-items');
            if (footerContainer) {
              this._log(`  Footer HTML: ${footerContainer.outerHTML}`);
            }
          }
        }
      }
      
      this._log(`\nSummary: Found ${easyApplyCount} Easy Apply jobs out of ${allCards.length - alreadyAppliedCount} non-applied jobs`);
      this._log(`Already applied to ${alreadyAppliedCount} jobs`);
      
      this._log('========== END FINDING ALL EASY APPLY JOBS ==========');
      
      return jobsWithEasyApply;
    } catch (error) {
      this._logError('Error finding Easy Apply jobs:', error);
      return [];
    }
  }
  */

  /**
   * Test the Easy Apply detection on all job cards on the current page
   * This function can be called from the browser console to verify the detection
   * 
   * @returns {Object} - Statistics about detected jobs
   */
  /*
  testEasyApplyDetection() {
    try {
      console.log('========== TESTING EASY APPLY DETECTION ==========');
      
      // Get all job cards
      const allCards = this.getJobCards();
      console.log(`Found ${allCards.length} total job cards`);
      
      if (allCards.length === 0) {
        console.log('No job cards found on the page');
        return { total: 0, easyApply: 0, alreadyApplied: 0, nonEasyApply: 0 };
      }
      
      // Count different types of jobs
      let easyApplyCount = 0;
      let alreadyAppliedCount = 0;
      let nonEasyApplyCount = 0;
      
      const easyApplyJobs = [];
      const alreadyAppliedJobs = [];
      const nonEasyApplyJobs = [];
      
      for (const card of allCards) {
        // First check if already applied
        const isApplied = this.isJobAlreadyApplied(card);
        
        if (isApplied) {
          alreadyAppliedCount++;
          alreadyAppliedJobs.push(card);
          continue;
        }
        
        // Then check if it's an Easy Apply job
        if (this.hasEasyApplyLabel(card)) {
          easyApplyCount++;
          easyApplyJobs.push(card);
        } else {
          nonEasyApplyCount++;
          nonEasyApplyJobs.push(card);
        }
      }
      
      console.log(`Summary: Total cards: ${allCards.length}`);
      console.log(`- Easy Apply jobs: ${easyApplyCount}`);
      console.log(`- Already applied jobs: ${alreadyAppliedCount}`);
      console.log(`- Non-Easy Apply jobs: ${nonEasyApplyCount}`);
      
      // Show first Easy Apply job if found
      if (easyApplyJobs.length > 0) {
        const firstJob = easyApplyJobs[0];
        const jobInfo = this.getJobCardInfo(firstJob);
        console.log('\nSample Easy Apply job:');
        console.log(`- Title: ${jobInfo.title}`);
        console.log(`- Company: ${jobInfo.company}`);
      }
      
      console.log('========== END TESTING ==========');
      
      return {
        total: allCards.length,
        easyApply: easyApplyCount,
        alreadyApplied: alreadyAppliedCount,
        nonEasyApply: nonEasyApplyCount,
        easyApplyJobs,
        alreadyAppliedJobs,
        nonEasyApplyJobs
      };
    } catch (error) {
      console.error('Error testing Easy Apply detection:', error);
      return { error: error.message };
    }
  }
  */
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = JobDetector;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.JobDetector = JobDetector;
} 