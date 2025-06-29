/**
 * @fileoverview LinkedIn selectors configuration
 * This file centralizes all CSS selectors used to interact with LinkedIn's DOM
 * These selectors are designed to be resilient to LinkedIn's frequent UI changes
 * @author EasyApplyPlugin Team
 * @version 2.0.0
 */

/**
 * LinkedIn selectors organized by feature area
 * Each selector can be a string, array of alternatives, or an object with structure info
 */
class LinkedInSelectors {
  /**
   * Initialize selectors
   */
  constructor() {
    // Initialize all selector categories
    this.initialize();
  }

  /**
   * Initialize all selector categories
   */
  initialize() {
    // Job Cards - For identifying and interacting with job listings
    this.jobCards = {
      // Core structural selectors
      wrapper: {
        // Primary identifier for job cards (most stable)
        class: '.job-card-job-posting-card-wrapper',
        // Parent element typically containing job cards
        container: 'li',
        // Attribute that often contains the job ID
        jobIdAttribute: '[data-job-id]',
        // Common classes or patterns for job list containers
        listContainers: [
          '.jobs-search-results-list',
          '.jobs-search-results__list',
          'ul[class*="scaffold-layout__list"]',
          'div[class*="scaffold-layout__list-container"] > ul',
          'ul'
        ]
      },
      
      // Content selectors within job cards
      content: {
        // Job title selectors
        title: [
          '.job-card-job-posting-card-wrapper__title strong',
          '.artdeco-entity-lockup__title',
          'h3.base-search-card__title',
          'h3',
          'strong',
          '[class*="title"]'
        ],
        // Company name selectors
        company: [
          '.artdeco-entity-lockup__subtitle',
          '.job-card-job-posting-card-wrapper__content .artdeco-entity-lockup__subtitle',
          '.base-search-card__subtitle',
          '[class*="company"]',
          '[class*="subtitle"]'
        ],
        // Location selectors
        location: [
          '.artdeco-entity-lockup__caption',
          '.job-card-job-posting-card-wrapper__content .artdeco-entity-lockup__caption',
          '[class*="location"]',
          '[class*="caption"]'
        ],
        // Salary info selectors (when available)
        salary: [
          '.job-card-job-posting-card-wrapper__content .artdeco-entity-lockup__metadata div',
          '[class*="salary"]',
          '.compensation'
        ]
      },
      
      // Easy Apply and application status indicators
      status: {
        // Text patterns for Easy Apply
        easyApplyText: 'easy apply',
        // Common containers where Easy Apply appears
        easyApplyContainers: [
          '.job-card-job-posting-card-wrapper__footer-items li',
          'ul[class*="footer-items"] li',
          '[class*="footer"] li'
        ],
        // LinkedIn logo that often appears next to Easy Apply
        linkedInIcon: [
          'svg[class*="linkedin-bug"]',
          'svg[data-test-icon="linkedin-bug-color-small"]',
          '.linkedin-logo'
        ],
        // Text patterns indicating already applied
        appliedStatusText: ['applied', 'application submitted', 'viewed'],
        // Classes that might indicate applied status
        appliedStatusClasses: [
          '.t-bold',
          '[class*="applied-status"]',
          '[class*="application-status"]'
        ]
      }
    };
    
    // Easy Apply button selectors
    this.easyApplyButton = {
      // Text patterns for identifying the button
      buttonText: ['easy apply', 'apply now', 'apply'],
      // Common selectors for the Easy Apply button
      buttonSelectors: [
        '.jobs-apply-button',
        '.jobs-apply-button--top-card',
        'button[aria-label*="Easy Apply"]',
        'button.artdeco-button--primary',
        // Newer button selectors
        'button[data-control-name="jobdetails_topcard_inapply"]',
        'button[class*="jobs-apply-button"]'
      ],
      // Container elements where the button is typically found
      containerSelectors: [
        '.jobs-apply-button--top-card',
        '.jobs-s-apply',
        '.jobs-apply-button',
        '.job-details-jobs-unified-top-card__container',
        // Newer container selectors
        '[class*="top-card-action-container"]',
        '[class*="apply-button-container"]'
      ]
    };
    
    // Application form selectors
    this.applicationForm = {
      // Modal containers
      modalContainers: [
        '.jobs-easy-apply-content',
        '.jobs-easy-apply-modal',
        '[data-test-modal]',
        'div[role="dialog"]',
        // Newer modal selectors
        '.artdeco-modal__content',
        'div[data-test-modal-id]'
      ],
      
      // Form fields
      fields: {
        input: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
        select: 'select',
        textarea: 'textarea',
        checkbox: 'input[type="checkbox"]',
        radio: 'input[type="radio"]',
        // Special field types
        typeahead: 'input[role="combobox"][aria-autocomplete="list"]',
        typeaheadSuggestions: '.basic-typeahead__triggered-content, .search-basic-typeahead__dropdown, .basic-typeahead__selectable',
        // Required fields
        required: '[required], [aria-required="true"], [class*="required"]',
        // Fieldsets (often contain radio/checkbox groups)
        fieldset: 'fieldset',
        // Error messages
        errorMessages: '.artdeco-inline-feedback--error, .artdeco-text-input--error, .fb-text-selectable__error'
      },
      
      // Navigation buttons
      buttons: {
        next: {
          text: ['next', 'continue'],
          ariaLabel: ['next', 'continue'],
          classes: ['artdeco-button--primary']
        },
        review: {
          text: ['review', 'review your application'],
          ariaLabel: ['review', 'review application'],
          classes: ['artdeco-button--primary']
        },
        submit: {
          text: ['submit', 'submit application'],
          ariaLabel: ['submit', 'submit application'],
          classes: ['artdeco-button--primary']
        },
        done: {
          text: ['done', 'finish'],
          ariaLabel: ['done', 'finish'],
          classes: ['artdeco-button--primary']
        },
        cancel: {
          text: ['cancel', 'discard'],
          ariaLabel: ['cancel', 'discard'],
          classes: ['artdeco-button--secondary']
        }
      }
    };
    
    // Application status selectors
    this.applicationStatus = {
      // Applied status indicators
      appliedText: ['applied', 'application submitted', 'viewed'],
      appliedClasses: [
        '.jobs-application-status--applied',
        '.artdeco-inline-feedback--success',
        '.job-card-container__applied-status',
        '.job-applied-status',
        '.job-card-job-posting-card-wrapper__footer-item.t-bold'
      ],
      
      // Application sent popup
      applicationSentModal: [
        '[data-test-modal][aria-labelledby="post-apply-modal"]',
        '.artdeco-modal.artdeco-modal--layer-default[size="medium"]',
        'div[role="dialog"][data-test-modal]'
      ],
      applicationSentHeader: [
        'h2#post-apply-modal',
        '.artdeco-modal__header h2',
        '.jpac-modal-header'
      ],
      applicationSentSuccessIcon: [
        'svg[data-test-icon="signal-success"]',
        '.jpac-modal-header-icon svg',
        '[class*="success-icon"]'
      ],
      applicationSentMessage: [
        '.jpac-modal-header.t-20.t-bold',
        '.artdeco-modal__content h3',
        '[class*="application-success"]'
      ]
    };
    
    // Pagination selectors
    this.pagination = {
      container: [
        '.jobs-search-pagination__pages',
        '.artdeco-pagination__pages',
        'ul[class*="pagination"]'
      ],
      activeIndicator: [
        'button[aria-current="page"]',
        '.jobs-search-pagination__indicator-button--active',
        'li.active',
        'li.selected',
        '[class*="active"]'
      ],
      pageIndicator: [
        '.jobs-search-pagination__indicator',
        '.artdeco-pagination__indicator',
        'li'
      ],
      nextButton: [
        'button[aria-label="Next"]',
        'button.artdeco-pagination__button--next',
        'button:contains("Next")',
        '[class*="next-btn"]'
      ]
    };
    
    // Dialog and modal selectors
    this.dialogs = {
      closeButtons: [
        'button[aria-label="Dismiss"]',
        'button[data-test-modal-close-btn]',
        'button.artdeco-modal__dismiss',
        'button svg use[href="#close-medium"]',
        'button svg use[href="#close"]',
        '.artdeco-modal__dismiss',
        '[data-test-modal-close-btn]'
      ]
    };
  }
  
  /**
   * Get all alternative selectors as a comma-separated string
   * @param {string|string[]|object} selectorConfig - Selector configuration
   * @returns {string} Combined selector string
   */
  getSelector(selectorConfig) {
    if (!selectorConfig) return '';
    
    // If it's a string, return it directly
    if (typeof selectorConfig === 'string') {
      return selectorConfig;
    }
    
    // If it's an array, join with commas
    if (Array.isArray(selectorConfig)) {
      return selectorConfig.join(', ');
    }
    
    // If it's an object with a 'class' property, return that
    if (typeof selectorConfig === 'object' && selectorConfig.class) {
      return selectorConfig.class;
    }
    
    // Otherwise return empty string
    return '';
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = LinkedInSelectors;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.LinkedInSelectors = new LinkedInSelectors();
} 