/**
 * @fileoverview Configuration file for DOM selectors used throughout the application
 * This file centralizes all selectors so they can be easily updated when LinkedIn's HTML changes
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

// Instead of redeclaring, extend the existing LinkedInSelectors object
// This avoids the "Identifier 'LinkedInSelectors' has already been declared" error
if (typeof LinkedInSelectors !== 'undefined') {
  // Extend the existing object with these selectors
  Object.assign(LinkedInSelectors, {
    // Job card selectors
    jobCards: {
      // Core selectors that identify job cards
      container: 'li',
      jobIdAttribute: '[data-job-id]',
      
      // Job card content selectors
      title: 'h3, strong, [class*="title"]',
      company: '[class*="company"], [class*="subtitle"]',
      location: '[class*="location"], [class*="caption"]',
      
      // Easy Apply indicators
      easyApplyText: 'easy apply',
      easyApplyContainers: 'li, [class*="footer"]',
      linkedInIcon: 'svg, [data-test-icon="linkedin-bug"]',
      
      // Job list containers
      listContainers: [
        '.jobs-search-results-list',
        '.jobs-search-results__list',
        '[data-test-search-results-list]',
        '.scaffold-layout__list'
      ]
    },
    
    // Easy Apply button selectors
    easyApplyButton: {
      // Text identifiers
      buttonText: 'easy apply',
      
      // Common button selectors
      buttonSelectors: [
        '.jobs-apply-button',
        '.jobs-apply-button--top-card',
        'button[aria-label*="Easy Apply"]',
        'button.artdeco-button--primary'
      ],
      
      // Container selectors where buttons might be found
      containerSelectors: [
        '.jobs-apply-button--top-card',
        '.jobs-s-apply',
        '.jobs-apply-button',
        '.job-details-jobs-unified-top-card__container'
      ]
    },
    
    // Job details selectors
    jobDetails: {
      // Job title selectors
      titleSelectors: [
        '.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title',
        'h2.t-24'
      ],
      
      // Company name selectors
      companySelectors: [
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        'a.app-aware-link[href*="company"]'
      ]
    },
    
    // Application form selectors
    applicationForm: {
      // Modal containers
      modalContainers: [
        '.jobs-easy-apply-content',
        '.jobs-easy-apply-modal',
        '[data-test-modal]',
        'div[role="dialog"]'
      ],
      
      // Form fields
      inputFields: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      selectFields: 'select',
      textareaFields: 'textarea',
      checkboxes: 'input[type="checkbox"]',
      radioButtons: 'input[type="radio"]',
      
      // Navigation buttons
      nextButton: 'next',
      submitButton: 'submit application',
      reviewButton: 'review',
      continueButton: 'continue',
      doneButton: 'done'
    },
    
    // Application status selectors
    applicationStatus: {
      // Applied indicators
      appliedText: ['applied', 'application submitted', 'viewed'],
      appliedClasses: [
        '.jobs-application-status--applied',
        '.artdeco-inline-feedback--success',
        '.job-card-container__applied-status',
        '.job-applied-status',
        '.job-card-job-posting-card-wrapper__footer-item.t-bold'
      ],
      
      // Application sent popup
      applicationSentModal: '[data-test-modal][aria-labelledby="post-apply-modal"], .artdeco-modal.artdeco-modal--layer-default[size="medium"]',
      applicationSentHeader: 'h2#post-apply-modal, .artdeco-modal__header h2',
      applicationSentMessage: '.jpac-modal-header.t-20.t-bold, .artdeco-modal__content h3'
    }
  });
} else {
  console.error('[EasyApplyPlugin] LinkedInSelectors not defined before loading selectors.js. Check your import order in manifest.json');
}

// Don't need to export the selectors since we're modifying the existing global object 