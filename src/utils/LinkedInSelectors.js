/**
 * @fileoverview Centralized selectors for LinkedIn DOM elements.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Selectors for various LinkedIn elements that are used by the Easy Apply plugin.
 * This centralized approach makes it easier to update selectors when LinkedIn's DOM structure changes.
 * 
 * IMPORTANT: This file should be loaded BEFORE any other plugin components to ensure
 * these selectors are available to all components.
 */
const LinkedInSelectors = {
  /**
   * Selectors for job cards in the search results
   */
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
  
  /**
   * Selectors for the Easy Apply button
   */
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
  },
  
  /**
   * Selectors for the Easy Apply modal
   */
  easyApplyModal: {
    // Primary modal selectors
    modalSelectors: [
      'div[data-test-modal][role="dialog"]',
      '.artdeco-modal[role="dialog"]',
      '.jobs-easy-apply-modal',
      'div[aria-labelledby="jobs-apply-header"]',
      '.artdeco-modal--layer-default',
      'div[role="dialog"][tabindex="-1"]'
    ],
    
    // Content-based selectors for when structure changes
    contentSelectors: [
      'div:contains("Contact info"):not(.visually-hidden)',
      'h3:contains("Contact info")',
      'button:contains("Next")',
      'button:contains("Submit application")'
    ],
    
    // Progress indicator
    progressIndicator: '.artdeco-completeness-meter-linear__progress-element',
    
    // Form fields and sections
    formFields: {
      // Input fields
      inputs: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
      
      // Contact info fields
      firstName: 'input[id*="first-name"], input[name*="firstName"], input[placeholder*="First name"], input[aria-label*="First name"]',
      lastName: 'input[id*="last-name"], input[name*="lastName"], input[placeholder*="Last name"], input[aria-label*="Last name"]',
      email: 'input[type="email"], input[id*="email"], input[name*="email"], select[id*="email"]',
      
      // Phone fields
      phoneCountryCode: 'select[id*="country"], select[id*="phoneNumber-country"], select[aria-label*="country code"]',
      phoneNumber: 'input[id*="phone"], input[id*="phoneNumber"], input[aria-label*="phone"], input[placeholder*="phone"]',
      mobilePhone: 'input[id*="mobile"], input[id*="cell"], input[aria-label*="Mobile phone"]',
      
      // Address fields
      address: 'input[id*="address"], input[name*="address"], textarea[id*="address"]',
      city: 'input[id*="city"], input[name*="city"]',
      state: 'input[id*="state"], input[name*="state"], select[id*="state"]',
      zip: 'input[id*="zip"], input[id*="postal"], input[name*="zip"], input[name*="postal"]',
      country: 'select[id*="country"]:not([id*="phoneNumber"]), select[name*="country"]',
      
      // Resume section
      resumeUpload: 'input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"]',
      resumeSelect: '.jobs-resume-picker__resume-btn, input[type="radio"][name*="resume"]'
    },
    
    // Buttons
    buttons: {
      next: 'button[aria-label="Continue to next step"], button[aria-label="Next"], button:contains("Next"), button:contains("Continue")',
      submit: 'button[aria-label="Submit application"], button:contains("Submit application"), button:contains("Submit")',
      review: 'button[aria-label="Review your application"], button[aria-label="Review"], button:contains("Review")',
      close: 'button[aria-label="Dismiss"], button.artdeco-modal__dismiss'
    }
  }
};

/**
 * Helper function to update selectors at runtime
 * This allows for dynamic updates to selectors if LinkedIn's DOM structure changes
 * 
 * @param {string} category - The selector category to update (e.g., 'easyApplyModal')
 * @param {string} subCategory - The subcategory (e.g., 'modalSelectors')
 * @param {string|string[]} selectors - The new selector(s) to add
 */
LinkedInSelectors.updateSelectors = function(category, subCategory, selectors) {
  try {
    // Ensure category exists
    if (!this[category]) {
      this[category] = {};
    }
    
    // Ensure subcategory exists
    if (!this[category][subCategory]) {
      this[category][subCategory] = Array.isArray(selectors) ? [] : {};
    }
    
    // Add new selectors
    if (Array.isArray(this[category][subCategory])) {
      // If it's an array, append new selectors
      if (Array.isArray(selectors)) {
        this[category][subCategory] = [...this[category][subCategory], ...selectors];
      } else {
        this[category][subCategory].push(selectors);
      }
    } else if (typeof this[category][subCategory] === 'object') {
      // If it's an object, merge properties
      this[category][subCategory] = { ...this[category][subCategory], ...selectors };
    } else {
      // If it's a primitive, replace it
      this[category][subCategory] = selectors;
    }
    
    console.log(`[LinkedInSelectors] Updated ${category}.${subCategory}`);
  } catch (error) {
    console.error('[LinkedInSelectors] Error updating selectors:', error);
  }
};

// Make the selectors available globally
if (typeof window !== 'undefined') {
  window.LinkedInSelectors = LinkedInSelectors;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkedInSelectors;
} 