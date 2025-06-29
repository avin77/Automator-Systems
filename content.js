/**
 * LinkedIn Easy Apply Automator - Content Script
 * This script is injected into LinkedIn job search pages to automate the Easy Apply process.
 * It uses a modular architecture with specialized handlers for different field types.
 * 
 * @author EasyApplyPlugin Team
 * @version 2.0.0
 */

console.log('[EasyApplyPlugin] Initializing...');

// Initialize global error handler
let globalErrorHandler = null;
try {
  // Check if ErrorHandler class is available
  if (typeof ErrorHandler === 'function') {
    globalErrorHandler = new ErrorHandler('ContentScript');
    console.log('[EasyApplyPlugin] ErrorHandler initialized');
  } else {
    console.log('[EasyApplyPlugin] ErrorHandler class not available, using basic error handling');
  }
} catch (error) {
  console.error('[EasyApplyPlugin] Error initializing ErrorHandler:', error);
}

// Check if EasyApplyConfig exists, if not create a default config
if (typeof EasyApplyConfig === 'undefined') {
  console.log('[EasyApplyPlugin] EasyApplyConfig not found, creating default config');
  // Define a default config
  window.EasyApplyConfig = {
    timeouts: {
      defaultWait: 10,
      elementVisibilityTimeout: 10,
      modalVisibilityTimeout: 10,
      modalHiddenTimeout: 10,
      buttonClickTimeout: 5,
      afterSubmitDelay: 5,
      applicationSentPollingInterval: 1,
      applicationSentPollingDuration: 30,
      afterDoneClickDelay: 5,
      postApplicationPopupDelay: 2,
      doneButtonModalPolling: 7,
      fieldFillDelay: 0.5,
      betweenFieldCheckDelay: 0.2,
      betweenButtonClicksDelay: 2,
      geminiApiTimeout: 5
    },
    retries: {
      modalVisibility: 3,
      nextButtonClick: 7,
      submitApplicationClick: 3,
      doneButtonClick: 5,
      formFill: 10,
      maxFormSteps: 10
    },
    selectors: {
      modalContainers: [
        '.jobs-easy-apply-content',
        '.jobs-easy-apply-modal',
        '.jobs-easy-apply-content__wrapper',
        '[data-test-modal]'
      ],
      applicationSentModal: '[data-test-modal][aria-labelledby="post-apply-modal"], .artdeco-modal.artdeco-modal--layer-default[size="medium"]',
      applicationSentHeader: 'h2#post-apply-modal, .artdeco-modal__header h2',
      applicationSentSuccessIcon: 'svg[data-test-icon="signal-success"], .jpac-modal-header-icon svg',
      applicationSentMessage: '.jpac-modal-header.t-20.t-bold, .artdeco-modal__content h3'
    }
  };
} else {
  console.log('[EasyApplyPlugin] Using existing EasyApplyConfig');
}

// Flag to stop automation
window.easyApplyStop = false;

// Cache for processed fields
const processedFields = new Set();

// User data from storage
let userCV = '';
let geminiApiKey = '';
let qaCache = {};

// Create a job detector instance
let jobDetector = new JobDetector();

// Add at the top level
let nextButtonClicked = false;
let reviewButtonClicked = false;

/**
 * Wait for a selector to appear in the DOM
 * 
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<Element>} - The found element
 */
function waitForSelector(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // If element already exists, resolve immediately
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      resolve(existingElement);
      return;
    }
    
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log(`[EasyApplyPlugin] Stopping wait for selector "${selector}" as requested`);
        clearInterval(timer);
        resolve(null); // Resolve with null to allow cleanup code to run
        return;
      }
      
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for selector: ${selector}`));
      }
    }, interval);
  });
}

/**
 * Check if a modal is visible
 * 
 * @returns {boolean} - Whether a modal is visible
 */
function isModalVisible() {
  try {
    // Common LinkedIn modal selectors as fallback
    const additionalSelectors = [
      '.jobs-easy-apply-modal',
      '.artdeco-modal__content',
      '.jobs-apply-form',
      '.jobs-easy-apply-content',
      'div[role="dialog"][aria-labelledby*="easy-apply"]',
      'div[role="dialog"][aria-labelledby*="jobs-apply"]',
      'div[data-test-modal]'
    ];
    
    // Check config selectors first if available
    if (EasyApplyConfig && EasyApplyConfig.selectors && EasyApplyConfig.selectors.modalContainers) {
      const modalSelectors = EasyApplyConfig.selectors.modalContainers;
      
      for (const selector of modalSelectors) {
        const modal = document.querySelector(selector);
        if (modal && isElementVisible(modal)) {
          return true;
        }
      }
    }
    
    // Check additional selectors if config selectors didn't find anything
    for (const selector of additionalSelectors) {
      const modal = document.querySelector(selector);
      if (modal && isElementVisible(modal)) {
        console.log(`[EasyApplyPlugin] Modal detected using selector: ${selector}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error checking modal visibility:', error);
    return false;
  }
}

/**
 * Wait for a modal to be visible
 * 
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} - Whether the modal became visible
 */
async function waitForModalToBeVisible(timeout = 10000) {
  return new Promise((resolve, reject) => {
    // If modal is already visible, resolve immediately
    if (isModalVisible()) {
      resolve(true);
      return;
    }
    
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log(`[EasyApplyPlugin] Stopping wait for modal visibility as requested`);
        clearInterval(timer);
        resolve(false); // Resolve with false to allow cleanup code to run
        return;
      }
      
      // Check for modal using multiple approaches
      if (isModalVisible()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      
      // Also check for any dialog or form container that might appear
      const alternativeSelectors = [
        '.jobs-easy-apply-content',
        '.jobs-apply-form',
        '.jobs-easy-apply-modal',
        'div[role="dialog"]',
        '.artdeco-modal',
        '.jobs-application-form',
        '.jobs-s-apply-form'
      ];
      
      for (const selector of alternativeSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
          console.log(`[EasyApplyPlugin] Found modal using alternative selector: ${selector}`);
          clearInterval(timer);
          resolve(true);
          return;
        }
      }
      
      elapsed += interval;
      if (elapsed >= timeout) {
        clearInterval(timer);
        console.log('[EasyApplyPlugin] Modal detection timed out. Checking for any visible dialogs...');
        
        // Last resort: check for any visible dialog
        const anyVisibleDialog = document.querySelector('div[role="dialog"]');
        if (anyVisibleDialog && isElementVisible(anyVisibleDialog)) {
          console.log('[EasyApplyPlugin] Found a dialog as fallback');
          resolve(true);
          return;
        }
        
        reject(new Error("Timeout waiting for modal to be visible"));
      }
    }, interval);
  });
}

/**
 * Wait for a modal to be hidden
 * 
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} - Whether the modal became hidden
 */
async function waitForModalToBeHidden(timeout = 10000) {
  return new Promise((resolve, reject) => {
    // If modal is already hidden, resolve immediately
    if (!isModalVisible()) {
      resolve(true);
      return;
    }
    
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log(`[EasyApplyPlugin] Stopping wait for modal to hide as requested`);
        clearInterval(timer);
        resolve(false); // Resolve with false to allow cleanup code to run
        return;
      }
      
      if (!isModalVisible()) {
        clearInterval(timer);
        resolve(true);
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        clearInterval(timer);
        reject(new Error("Timeout waiting for modal to be hidden"));
      }
    }, interval);
  });
}

/**
 * Check if an element is visible
 * 
 * @param {Element} element - Element to check
 * @returns {boolean} - Whether the element is visible
 */
function isElementVisible(element) {
  if (!element) return false;
  
  try {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error checking element visibility:', error);
    return false;
  }
}

/**
 * Log detailed information about the Easy Apply button for debugging
 * 
 * @param {Element} button - The Easy Apply button element
 */
/*
function logEasyApplyButtonDetails(button) {
  if (!button) {
    console.log('[EasyApplyPlugin] No Easy Apply button to log details for');
    return;
  }
  
  console.log('[EasyApplyPlugin] ========== EASY APPLY BUTTON DETAILS ==========');
  console.log(`[EasyApplyPlugin] Button text: "${button.textContent.trim()}"`);
  console.log(`[EasyApplyPlugin] Button classes: ${button.className}`);
  console.log(`[EasyApplyPlugin] Button HTML: ${button.outerHTML}`);
  
  // Check if it's inside the right pane
  const isInRightPane = button.closest('.jobs-search-results-list__list-item--active, .jobs-search-two-pane__details');
  console.log(`[EasyApplyPlugin] Is in right pane: ${!!isInRightPane}`);
  
  // Check if it's a filter button
  const isFilter = button.closest('.search-reusables__filter-binary-toggle');
  console.log(`[EasyApplyPlugin] Is filter button: ${!!isFilter}`);
  
  console.log('[EasyApplyPlugin] ========== END BUTTON DETAILS ==========');
}
*/

/**
 * Click a button with the specified text
 * Uses centralized selectors when available and provides detailed logging
 * 
 * @param {string} text - The text to search for in buttons
 * @returns {Promise<boolean>} - Whether a button was clicked
 */
async function clickButtonByText(text) {
  try {
    // Normalize the search text
    const searchText = text.toLowerCase();
    
    // Check if we have centralized button selectors
    let buttonSelectors = null;
    
    if (typeof LinkedInSelectors !== 'undefined' && 
        LinkedInSelectors.easyApplyModal && 
        LinkedInSelectors.easyApplyModal.buttons) {
        
      // Map button text to selector based on centralized config
      const buttonMap = {
        'next': LinkedInSelectors.easyApplyModal.buttons.next,
        'submit application': LinkedInSelectors.easyApplyModal.buttons.submit,
        'review': LinkedInSelectors.easyApplyModal.buttons.review,
        'continue': LinkedInSelectors.easyApplyModal.buttons.next, // Also uses next selector
        'done': LinkedInSelectors.easyApplyModal.buttons.close
      };
      
      buttonSelectors = buttonMap[searchText];
      
      if (buttonSelectors) {
        console.log(`[EasyApplyPlugin] Using centralized selector for "${searchText}" button`);
        
        // Check if the selector contains jQuery-style :contains()
        if (buttonSelectors.includes(':contains(')) {
          console.log('[EasyApplyPlugin] Selector contains jQuery-style :contains(), using text-based search instead');
          // Skip using this selector directly and fall back to text-based search
        } else {
          // Try the specialized selector first
          try {
            const specificButtons = document.querySelectorAll(buttonSelectors);
            
            for (const button of specificButtons) {
              if (isElementVisible(button)) {
                console.log(`[EasyApplyPlugin] Found "${searchText}" button using centralized selector`);
                button.click();
                return true;
              }
            }
            
            console.log(`[EasyApplyPlugin] No visible buttons found with centralized selector: ${buttonSelectors}`);
          } catch (error) {
            console.error(`[EasyApplyPlugin] Error using centralized selector "${buttonSelectors}": ${error.message}`);
          }
        }
      } else {
        console.log(`[EasyApplyPlugin] No centralized selector found for "${searchText}" button`);
      }
    }
    
    // Find buttons, spans, and divs that might be clickable
    const elements = Array.from(document.querySelectorAll('button, span, div, a, li'));
    
    // IMPROVED: Restrict search to the modal dialog to avoid matching page content
    const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal__content, div[data-test-modal]');
    let modalElements = [];
    
    if (modal) {
      modalElements = Array.from(modal.querySelectorAll('button, span, div, a, li'));
      console.log(`[EasyApplyPlugin] Searching for "${text}" button within modal (found ${modalElements.length} elements)`);
    } else {
      console.log(`[EasyApplyPlugin] No modal found, searching entire page for "${text}" button`);
    }
    
    // Use modal elements if available, otherwise use all elements
    const searchElements = modalElements.length > 0 ? modalElements : elements;
    
    // Check for exact matches first with button elements
    const buttonElements = searchElements.filter(el => el.tagName === 'BUTTON');
    for (const el of buttonElements) {
      // Skip invisible elements
      if (!isElementVisible(el)) continue;
      
      // Check if text content matches EXACTLY
      const elText = el.textContent && el.textContent.trim().toLowerCase();
      if (elText === searchText) {
        console.log(`[EasyApplyPlugin] Found exact match for button "${text}"`);
        el.click();
        return true;
      }
      
      // Check for aria-label that matches or contains the text (LinkedIn often uses this)
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        const ariaLabelText = ariaLabel.toLowerCase();
        
        // Special handling for next/continue buttons
        if ((searchText === 'next' || searchText === 'continue') && 
            (ariaLabelText.includes('next step') || ariaLabelText.includes('continue'))) {
          console.log(`[EasyApplyPlugin] Found Next/Continue button via aria-label: "${ariaLabel}"`);
          el.click();
          return true;
        }
        
        // Check for exact aria-label match
        if (ariaLabelText === searchText || ariaLabelText.includes(searchText)) {
          console.log(`[EasyApplyPlugin] Found button with matching aria-label: "${ariaLabel}"`);
          el.click();
          return true;
        }
      }
      
      // Check for data attributes often used by LinkedIn
      if ((searchText === 'next' && el.hasAttribute('data-easy-apply-next-button')) ||
          (searchText === 'review' && el.hasAttribute('data-easy-apply-review-button')) ||
          (searchText === 'submit application' && el.hasAttribute('data-easy-apply-submit-button'))) {
        console.log(`[EasyApplyPlugin] Found button with LinkedIn data attribute for "${searchText}"`);
        el.click();
        return true;
      }
    }
    
    // Check for exact matches with any element
    for (const el of searchElements) {
      // Skip invisible elements
      if (!isElementVisible(el)) continue;
      
      // Check if text content matches EXACTLY
      const elText = el.textContent && el.textContent.trim().toLowerCase();
      if (elText === searchText) {
        console.log(`[EasyApplyPlugin] Found exact match for "${text}" in a ${el.tagName}`);
        el.click();
        return true;
      }
    }
    
    // ONLY use partial matching for Next, Continue, and Submit buttons
    // For Review button, require exact match
    if (searchText !== 'review') {
      // If no exact match, try contains with button elements first
      for (const el of buttonElements) {
        // Skip invisible elements
        if (!isElementVisible(el)) continue;
        
        // Check if text content contains
        const elText = el.textContent && el.textContent.trim().toLowerCase();
        if (elText && elText.includes(searchText)) {
          console.log(`[EasyApplyPlugin] Found partial match for button "${text}": "${elText}"`);
          el.click();
          return true;
        }
      }
      
      // If still no match, try contains with any element
      for (const el of searchElements) {
        // Skip invisible elements
        if (!isElementVisible(el)) continue;
        
        // Check if text content contains
        const elText = el.textContent && el.textContent.trim().toLowerCase();
        if (elText && elText.includes(searchText)) {
          console.log(`[EasyApplyPlugin] Found partial match for "${text}" in a ${el.tagName}: "${elText}"`);
          el.click();
          return true;
        }
      }
    } else {
      console.log('[EasyApplyPlugin] Requiring exact match for Review button, skipping partial matching');
    }
    
    // Special handling for specific buttons
    if (searchText === 'submit application') {
      // Look for submit button by type
      const submitButtons = Array.from(document.querySelectorAll('button[type="submit"]'));
      for (const btn of submitButtons) {
        if (isElementVisible(btn)) {
          // Make sure it's actually a submit button and not a navigation button
          const btnText = btn.textContent && btn.textContent.trim().toLowerCase();
          if (btnText && (btnText.includes('submit') || btnText.includes('apply'))) {
            console.log('[EasyApplyPlugin] Found submit button by type');
            btn.click();
            return true;
          }
        }
      }
      
      // Look for primary action buttons
      const primaryButtons = Array.from(document.querySelectorAll('.artdeco-button--primary'));
      for (const btn of primaryButtons) {
        if (isElementVisible(btn)) {
          // Make sure it's actually a submit button and not a navigation button
          const btnText = btn.textContent && btn.textContent.trim().toLowerCase();
          // Only click if it contains "submit" or "apply" but not "next" or "continue"
          if (btnText && (btnText.includes('submit') || btnText.includes('apply')) && 
              !btnText.includes('next') && !btnText.includes('continue')) {
            console.log('[EasyApplyPlugin] Found primary action button for submission');
            btn.click();
            return true;
          }
        }
      }
    }
    
    console.log(`[EasyApplyPlugin] No button found with text "${text}"`);
    return false;
  } catch (error) {
    console.error(`[EasyApplyPlugin] Error clicking button with text "${text}":`, error);
    return false;
  }
}

/**
 * Check if the application sent popup is visible
 * Uses centralized selectors when available and provides detailed logging
 * 
 * @returns {boolean} - Whether the popup is visible
 */
function isApplicationSentPopupVisible() {
  try {
    // Initialize selector objects
    let selectors = {
      applicationSentModal: '[data-test-modal][aria-labelledby="post-apply-modal"], .artdeco-modal.artdeco-modal--layer-default[size="medium"]',
      applicationSentHeader: 'h2#post-apply-modal, .artdeco-modal__header h2',
      applicationSentSuccessIcon: 'svg[data-test-icon="signal-success"], .jpac-modal-header-icon svg',
      applicationSentMessage: '.jpac-modal-header.t-20.t-bold, .artdeco-modal__content h3'
    };
    
    // Try to get selectors from different sources, in order of preference:
    
    // 1. From LinkedInSelectors (most preferred)
    if (typeof LinkedInSelectors !== 'undefined' && 
        LinkedInSelectors.applicationStatus) {
      
      if (LinkedInSelectors.applicationStatus.applicationSentModal) {
        selectors.applicationSentModal = LinkedInSelectors.applicationStatus.applicationSentModal;
      }
      
      if (LinkedInSelectors.applicationStatus.applicationSentHeader) {
        selectors.applicationSentHeader = LinkedInSelectors.applicationStatus.applicationSentHeader;
      }
      
      if (LinkedInSelectors.applicationStatus.applicationSentMessage) {
        selectors.applicationSentMessage = LinkedInSelectors.applicationStatus.applicationSentMessage;
      }
      
      console.log('[EasyApplyPlugin] Using selectors from LinkedInSelectors for application sent popup');
    }
    // 2. From EasyApplyConfig (fallback)
    else if (EasyApplyConfig && EasyApplyConfig.selectors) {
      
      if (EasyApplyConfig.selectors.applicationSentModal) {
        selectors.applicationSentModal = EasyApplyConfig.selectors.applicationSentModal;
      }
      
      if (EasyApplyConfig.selectors.applicationSentHeader) {
        selectors.applicationSentHeader = EasyApplyConfig.selectors.applicationSentHeader;
      }
      
      if (EasyApplyConfig.selectors.applicationSentSuccessIcon) {
        selectors.applicationSentSuccessIcon = EasyApplyConfig.selectors.applicationSentSuccessIcon;
      }
      
      if (EasyApplyConfig.selectors.applicationSentMessage) {
        selectors.applicationSentMessage = EasyApplyConfig.selectors.applicationSentMessage;
      }
      
      console.log('[EasyApplyPlugin] Using selectors from EasyApplyConfig for application sent popup');
    } else {
      console.log('[EasyApplyPlugin] Using default selectors for application sent popup');
    }
    
    // Try to find the modal
    let modal = null;
    
    try {
      modal = document.querySelector(selectors.applicationSentModal);
      
      if (!modal) {
        console.log('[EasyApplyPlugin] No application sent modal found using selector: ' + selectors.applicationSentModal);
        
        // Try additional selectors as fallback
        const fallbackSelectors = [
          '.artdeco-modal:not(.jobs-easy-apply-modal)',
          'div[role="dialog"]:not(.jobs-easy-apply-modal)',
          '.artdeco-modal--layer-confirmation'
        ];
        
        for (const selector of fallbackSelectors) {
          modal = document.querySelector(selector);
          if (modal) {
            console.log(`[EasyApplyPlugin] Found potential application sent modal using fallback selector: ${selector}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('[EasyApplyPlugin] Error finding application sent modal:', error);
    }
    
    if (!modal) {
      return false;
    }
    
    // Check if it's visible
    if (!isElementVisible(modal)) {
      return false;
    }
    
    // Check for success indicators or confirmation text
    const successIndicators = [
      'application submitted',
      'application sent',
      'successfully submitted',
      'thank you for applying',
      'your application has been submitted',
      'you applied'
    ];
    
    const modalText = modal.textContent.toLowerCase();
    
    for (const indicator of successIndicators) {
      if (modalText.includes(indicator)) {
        console.log(`[EasyApplyPlugin] Application sent popup detected with text: "${indicator}"`);
        return true;
      }
    }
    
    // Check for specific elements that indicate success
    try {
      // Check for success header
      const header = modal.querySelector(selectors.applicationSentHeader);
      if (header && isElementVisible(header)) {
        console.log('[EasyApplyPlugin] Application sent popup detected with header');
        return true;
      }
      
      // Check for success icon
      const icon = modal.querySelector(selectors.applicationSentSuccessIcon);
      if (icon && isElementVisible(icon)) {
        console.log('[EasyApplyPlugin] Application sent popup detected with success icon');
        return true;
      }
      
      // Check for success message
      const message = modal.querySelector(selectors.applicationSentMessage);
      if (message && isElementVisible(message)) {
        console.log('[EasyApplyPlugin] Application sent popup detected with message');
        return true;
      }
    } catch (error) {
      console.error('[EasyApplyPlugin] Error checking application sent popup elements:', error);
    }
    
    // If we got this far, it's probably not the application sent popup
    return false;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error checking if application sent popup is visible:', error);
    return false;
  }
}

/**
 * Wait for the application sent popup
 * 
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} - Whether the popup appeared
 */
async function waitForApplicationSentPopup(timeout = 10000) {
  console.log(`[EasyApplyPlugin] Waiting for application sent popup (timeout: ${timeout}ms)...`);
  
  return new Promise((resolve) => {
    const interval = 500; // Check less frequently (every 500ms)
    let elapsed = 0;
    let logCounter = 0;
    let successIndicatorsCount = 0;
    
    const timer = setInterval(() => {
      // Check using the standard method
      if (isApplicationSentPopupVisible()) {
        clearInterval(timer);
        console.log('[EasyApplyPlugin] Application sent popup detected');
        resolve(true);
        return;
      }
      
      // Check for alternative success indicators
      const successIndicators = [
        // Check for success message in any visible dialog
        document.querySelector('.artdeco-modal__content h2, .artdeco-modal__content h3'),
        // Check for the generic success icon
        document.querySelector('svg[data-test-icon="signal-success"]'),
        // Check for post-apply modal
        document.querySelector('[data-test-modal][aria-labelledby="post-apply-modal"]'),
        // Check for done button which appears after submission
        document.querySelector('button')
      ];
      
      let foundIndicators = 0;
      for (const indicator of successIndicators) {
        if (indicator && isElementVisible(indicator)) {
          const text = indicator.textContent?.trim().toLowerCase() || '';
          if (text.includes('application') || 
              text.includes('applied') || 
              text.includes('success') ||
              text.includes('done')) {
            foundIndicators++;
          }
        }
      }
      
      if (foundIndicators > 0) {
        successIndicatorsCount++;
        if (successIndicatorsCount >= 3) {
          clearInterval(timer);
          console.log('[EasyApplyPlugin] Multiple success indicators found, assuming application was sent');
          resolve(true);
          return;
        }
      }
      
      elapsed += interval;
      
      // Only log every few checks to reduce spam
      logCounter++;
      if (logCounter % 4 === 0) { // Log every 2 seconds (4 * 500ms)
        console.log(`[EasyApplyPlugin] Still waiting for application sent popup... (${elapsed}/${timeout}ms)`);
      }
      
      if (elapsed >= timeout) {
        clearInterval(timer);
        console.log('[EasyApplyPlugin] Timeout waiting for application sent popup');
        
        // Final check - if modal disappeared completely, that might mean success
        if (!isModalVisible() && logCounter > 3) {
          console.log('[EasyApplyPlugin] Application modal has disappeared, assuming success');
          resolve(true);
          return;
        }
        
        resolve(false);
      }
    }, interval);
  });
}

/**
 * Handle the resume selection step
 * 
 * @returns {Promise<boolean>} - Whether the step was handled successfully
 */
async function handleResumeSelection() {
  try {
    console.log('[EasyApplyPlugin] Handling resume selection step');
    
    // Check if automation should be stopped
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Stopping resume selection as requested');
      return false;
    }
    
    // Look for resume radio buttons
    const resumeRadios = document.querySelectorAll('input[type="radio"][name*="resume"]');
    if (resumeRadios.length > 0) {
      console.log(`[EasyApplyPlugin] Found ${resumeRadios.length} resume options`);
      
      // Select the first resume
      resumeRadios[0].checked = true;
      resumeRadios[0].dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[EasyApplyPlugin] Selected first resume');
      
      // Wait a moment for any UI updates
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
    
    // If no radio buttons found, check if there's a preview shown (already selected)
    const resumePreview = document.querySelector('.jobs-resume-picker__resume-link');
    if (resumePreview) {
      console.log('[EasyApplyPlugin] Resume already selected (preview visible)');
      return true;
    }
    
    console.log('[EasyApplyPlugin] No resume selection options found');
    // Return true even if no resume options found, so the form filling process continues
    return true;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error handling resume selection:', error);
    // Return true even on error to allow the process to continue
    return true;
  }
}

/**
 * Handle the Easy Apply form flow
 * Uses centralized selectors and provides detailed error logging
 * 
 * @returns {Promise<boolean>} - Whether the application was successfully submitted
 */
async function handleEasyApplyForm() {
  try {
    console.log('[EasyApplyPlugin] Starting to handle Easy Apply form');
    
    // Check stop flag at the start of form handling
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Stopping form handling as requested');
      return false;
    }
    
    // Use centralized selectors from LinkedInSelectors.js if available
    let modalSelectors = ['.jobs-easy-apply-modal', 'div[data-test-modal][role="dialog"]']; // Fallback selectors
    
    // Check if we have access to centralized selectors
    if (typeof LinkedInSelectors !== 'undefined' && LinkedInSelectors.easyApplyModal) {
      if (Array.isArray(LinkedInSelectors.easyApplyModal.modalSelectors) && 
          LinkedInSelectors.easyApplyModal.modalSelectors.length > 0) {
        modalSelectors = LinkedInSelectors.easyApplyModal.modalSelectors;
        console.log(`[EasyApplyPlugin] Using ${modalSelectors.length} selectors from LinkedInSelectors`);
      }
    } else {
      console.log('[EasyApplyPlugin] LinkedInSelectors not available, using fallback selectors');
    }
    
    // Wait for modal to be fully loaded
    console.log('[EasyApplyPlugin] Waiting for modal to be ready...');
    await new Promise(r => setTimeout(r, 5000)); // 1 second delay
    
    let modal = null;
    for (const selector of modalSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          modal = element;
          console.log(`[EasyApplyPlugin] Found modal using selector: ${selector}`);
          break;
        } else {
          console.log(`[EasyApplyPlugin] Selector failed: "${selector}" - No matching element found`);
        }
      } catch (error) {
        console.error(`[EasyApplyPlugin] Error with selector "${selector}":`, error);
      }
    }
    
    if (!modal) {
      console.error('[EasyApplyPlugin] Failed to find Easy Apply modal with any selector');
      return false;
    }
    
    // Create FormFiller instance if not already created
    let formFiller = null;
    if (typeof FormFiller === 'function') {
      try {
        const config = {
          delays: {
            afterField: 300,
            afterForm: 1000
          }
        };
        
        // Get user settings
        const userSettings = await chrome.storage.local.get([
          'cv', 
          'apiKey', 
          'qaCache',
          'phoneNumber',
          'mobileNumber',
          'countryCode'
        ]);
        
        formFiller = new FormFiller(
          modal, 
          config, 
          getGeminiAnswer, 
          userSettings.cv || '',
          userSettings.apiKey || '',
          userSettings.qaCache || {},
          {
            phoneNumber: userSettings.phoneNumber || '',
            mobileNumber: userSettings.mobileNumber || '',
            countryCode: userSettings.countryCode || '+1'
          }
        );
        console.log('[EasyApplyPlugin] Created FormFiller instance');
      } catch (error) {
        console.error('[EasyApplyPlugin] Error creating FormFiller:', error);
      }
    }
    
    let stepCount = 1;
    const maxSteps = 12;
    let previousModalContent = '';
    
    // Create a progress tracker instance
    const progressTracker = new ProgressTracker();
    
    while (stepCount <= maxSteps) {
      console.log(`[EasyApplyPlugin] Processing form step ${stepCount}`);
      
      // Wait for modal to be fully loaded
      await new Promise(r => setTimeout(r, 1000));
      
      // Get current application progress and update the tracker
      const currentProgress = getApplicationProgress();
      progressTracker.update(currentProgress);
      
      // Check if application appears to be stuck
      if (progressTracker.isApplicationStuck()) {
        console.log(`[EasyApplyPlugin] Application appears stuck at ${progressTracker.getProgress()}%, checking for unfilled required fields`);
        
        if (isFormStuck(modal)) {
          console.log('[EasyApplyPlugin] Form appears to have missing required fields, will retry form fill');
          await new Promise(r => setTimeout(r, 1000));
          if (formFiller) {
            await formFiller.fillForm();
          } else {
            await simpleFormFill(modal);
          }
        }
      }
      
      // Check if modal content has changed since last step
      const currentModalContent = modal.innerHTML;
      if (stepCount > 1 && currentModalContent === previousModalContent) {
        console.log('[EasyApplyPlugin] Modal content has not changed, waiting longer... (content length: ' + currentModalContent.length + ')');
        await new Promise(r => setTimeout(r, 2000)); // Wait longer
        
        // Check again after waiting
        const newModalContent = modal.innerHTML;
        if (newModalContent === previousModalContent) {
          console.log('[EasyApplyPlugin] Modal content still unchanged, may be stuck. Moving to next action.');
        }
      }
      previousModalContent = currentModalContent;
      
      // Handle resume selection if present
      const resumeHandled = await handleResumeSelection();
      console.log(`[EasyApplyPlugin] Resume selection handled: ${resumeHandled}`);
      
      // Fill all fields in the current step
      let formFilled = false;
      if (formFiller) {
        try {
          // Fill the form using FormFiller
          formFilled = await formFiller.fillForm();
          console.log(`[EasyApplyPlugin] Form filling result: ${formFilled}`);
        } catch (error) {
          console.error('[EasyApplyPlugin] Error during form filling:', error);
          formFilled = false;
        }
      } else {
        // Simple form filling as fallback
        formFilled = await simpleFormFill(modal);
      }
      
      // Add a delay after filling the form
      await new Promise(r => setTimeout(r, 1000));
      
      // Check for buttons in a logical order based on application progress:
      // 1. If progress is 100%, try Submit Application
      // 2. If we've clicked Review, look for Submit Application
      // 3. If we've clicked Next at least once, look for Review
      // 4. Otherwise try Next/Continue
      
      // Use the progress tracker to determine which button to click
      
      // Check if we're at 100% progress or if Review was clicked
      if (progressTracker.isComplete() || reviewButtonClicked) {
        // We're at the final step, try to submit the application
        if (await clickButtonByText('Submit application')) {
          console.log(`[EasyApplyPlugin] Clicked Submit application button (progress: ${progressTracker.getProgress()}%)`);
          
          // Wait for form to process
          await waitForModalContentRefresh(3000);
          
          // Wait for the application sent popup with a reasonable timeout
          const applicationSent = await waitForApplicationSentPopup(10000);
          
          if (applicationSent) {
            console.log('[EasyApplyPlugin] Application sent successfully');
            
            // Click the Done button
            if (await clickButtonByText('Done')) {
              console.log('[EasyApplyPlugin] Clicked Done button');
              
              // Wait for modal to close
              await waitForModalToBeHidden(5000);
              
              // Clean up resources
              if (formFiller) {
                formFiller.dispose();
              }
              
              // Reset progress tracker
              progressTracker.reset();
              
              return true;
            }
          } else {
            console.log('[EasyApplyPlugin] No confirmation popup detected, but assuming application was sent');
            return true;
          }
          
          break;
        }
      } else if (progressTracker.isNearCompletion() || (nextButtonClicked && await clickButtonByText('Review'))) {
        // We're close to completion, look for Review button
        console.log(`[EasyApplyPlugin] Clicked Review button (progress: ${progressTracker.getProgress()}%)`);
        reviewButtonClicked = true;
        
        // Wait for modal content to refresh after clicking Review
        await waitForModalContentRefresh(3000);
        await new Promise(r => setTimeout(r, 2000)); // Additional wait
      } else if (await clickButtonByText('Next')) {
        console.log(`[EasyApplyPlugin] Clicked Next button (progress: ${progressTracker.getProgress()}%)`);
        nextButtonClicked = true;
        
        // Wait for modal content to refresh after clicking Next
        await waitForModalContentRefresh(3000);
        await new Promise(r => setTimeout(r, 2000));
      } else if (await clickButtonByText('Continue')) {
        console.log(`[EasyApplyPlugin] Clicked Continue button (progress: ${progressTracker.getProgress()}%)`);
        nextButtonClicked = true;
        
        // Wait for modal content to refresh after clicking Continue
        await waitForModalContentRefresh(3000);
        await new Promise(r => setTimeout(r, 2000));
      } else if (!nextButtonClicked && !reviewButtonClicked && await clickButtonByText('Submit application')) {
        // Single-step application (Submit without Next/Review)
        console.log('[EasyApplyPlugin] Clicked Submit application button (single-step application)');
        
        // Wait for form to process
        await waitForModalContentRefresh(3000);
        
        // Wait for the application sent popup
        const applicationSent = await waitForApplicationSentPopup(10000);
        
        if (applicationSent) {
          console.log('[EasyApplyPlugin] Application sent successfully');
          
          // Click the Done button
          if (await clickButtonByText('Done')) {
            console.log('[EasyApplyPlugin] Clicked Done button');
            
            // Wait for modal to close
            await waitForModalToBeHidden(5000);
            
            // Clean up resources
            if (formFiller) {
              formFiller.dispose();
            }
            
            return true;
          }
        } else {
          console.log('[EasyApplyPlugin] No confirmation popup detected, but assuming application was sent');
          return true;
        }
        
        break;
      } else {
        console.log(`[EasyApplyPlugin] No navigation buttons found (progress: ${progressTracker.getProgress()}%), form may be complete or stuck`);
        
        // If we're stuck at a high progress percentage, try again with form filling
        if (progressTracker.getProgress() >= 80 && progressTracker.isApplicationStuck()) {
          console.log('[EasyApplyPlugin] High progress but stuck, retrying form fill to check for missed fields');
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        break;
      }
      
      // Add a delay after clicking any button
      await new Promise(r => setTimeout(r, 2000));
      
      stepCount++;
    }
    
    // Clean up resources
    if (formFiller) {
      formFiller.dispose();
    }
    
    // Reset progress tracker
    progressTracker.reset();
    
    return false;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error handling Easy Apply form:', error);
    return false;
  }
}

/**
 * Simple form filling function as fallback when FormFiller is not available
 * 
 * @param {HTMLElement} modal - The modal element containing the form
 * @returns {Promise<boolean>} - Whether filling was successful
 */
async function simpleFormFill(modal) {
  try {
    console.log('[EasyApplyPlugin] Using simple form filling');
    
    // Check if automation should be stopped
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Stopping form filling as requested');
      return false;
    }
    
    // Find all visible input fields
    const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
    const selects = Array.from(modal.querySelectorAll('select'));
    const textareas = Array.from(modal.querySelectorAll('textarea'));
    const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]'));
    const radioButtons = Array.from(modal.querySelectorAll('input[type="radio"]'));
    
    console.log(`[EasyApplyPlugin] Found ${inputs.length} inputs, ${selects.length} selects, ${textareas.length} textareas, ${checkboxes.length} checkboxes, ${radioButtons.length} radio buttons`);
    
    // Fill text inputs
    for (const input of inputs) {
      try {
        if (!isElementVisible(input)) continue;
        if (input.value) continue; // Skip if already filled
        
        const type = input.type && input.type.toLowerCase();
        if (type === 'text' || type === 'email' || type === 'tel' || type === 'url') {
          if (type === 'email') {
            input.value = 'example@example.com';
          } else if (type === 'tel') {
            input.value = '1234567890';
          } else {
            input.value = 'Yes';
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Filled input: ${input.name || input.id || 'unnamed'}`);
          
          // Add a small delay between fields
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (error) {
        console.error('[EasyApplyPlugin] Error filling input:', error);
      }
    }
    
    // Fill select dropdowns
    for (const select of selects) {
      try {
        if (!isElementVisible(select)) continue;
        if (select.value) continue; // Skip if already selected
        
        if (select.options && select.options.length > 1) {
          // Select the first non-empty option
          for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value) {
              select.selectedIndex = i;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`[EasyApplyPlugin] Selected option in: ${select.name || select.id || 'unnamed'}`);
              break;
            }
          }
          
          // Add a small delay between fields
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (error) {
        console.error('[EasyApplyPlugin] Error filling select:', error);
      }
    }
    
    // Fill textareas
    for (const textarea of textareas) {
      try {
        if (!isElementVisible(textarea)) continue;
        if (textarea.value) continue; // Skip if already filled
        
        textarea.value = 'I am a qualified candidate with relevant experience for this position.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[EasyApplyPlugin] Filled textarea: ${textarea.name || textarea.id || 'unnamed'}`);
        
        // Add a small delay between fields
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.error('[EasyApplyPlugin] Error filling textarea:', error);
      }
    }
    
    // Check checkboxes (usually for terms acceptance)
    for (const checkbox of checkboxes) {
      try {
        if (!isElementVisible(checkbox)) continue;
        if (checkbox.checked) continue; // Skip if already checked
        
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[EasyApplyPlugin] Checked checkbox: ${checkbox.name || checkbox.id || 'unnamed'}`);
        
        // Add a small delay between fields
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.error('[EasyApplyPlugin] Error checking checkbox:', error);
      }
    }
    
    // Select first radio button in each group
    const radioGroups = {};
    for (const radio of radioButtons) {
      try {
        if (!isElementVisible(radio)) continue;
        if (radio.checked) continue; // Skip if already checked
        
        const name = radio.name || 'unnamed';
        if (!radioGroups[name]) {
          radioGroups[name] = [];
        }
        radioGroups[name].push(radio);
      } catch (error) {
        console.error('[EasyApplyPlugin] Error processing radio button:', error);
      }
    }
    
    for (const groupName in radioGroups) {
      try {
        if (radioGroups[groupName].length > 0) {
          radioGroups[groupName][0].checked = true;
          radioGroups[groupName][0].dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Selected radio in group: ${groupName}`);
          
          // Add a small delay between groups
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (error) {
        console.error(`[EasyApplyPlugin] Error selecting radio in group ${groupName}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error in simple form filling:', error);
    return false;
  }
}

/**
 * Get an answer from the Gemini API
 * 
 * @param {string} question - The question to ask
 * @param {string} cv - The user's CV
 * @param {string} apiKey - The Gemini API key
 * @param {Array|null} optionsList - List of options for multiple choice
 * @param {boolean} numericOnly - Whether to return numeric values only
 * @param {Object|null} qaCache - Question/answer cache
 * @param {boolean} isSummaryField - Whether this is a summary field
 * @param {boolean} isSpecificallyCoverLetter - Whether this is a cover letter
 * @returns {Promise<string>} - The answer from Gemini
 */
async function getGeminiAnswer(question, cv, apiKey, optionsList = null, numericOnly = false, qaCache = null, isSummaryField = false, isSpecificallyCoverLetter = false) {
  try {
    console.log(`[EasyApplyPlugin][Gemini] 🔍 Processing question: "${question}"`);
    
    // Check if automation should be stopped
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Stopping Gemini API call as requested');
      return null;
    }
    
    // Check cache first
    if (qaCache && qaCache[question]) {
      console.log(`[EasyApplyPlugin][Gemini] 📋 Using cached answer for: "${question}"`);
      return qaCache[question];
    }
    
    // Construct the prompt
    let prompt = `Based on my CV: ${cv}\n\nQuestion: ${question}\n\n`;
    
    if (optionsList && optionsList.length > 0) {
      console.log(`[EasyApplyPlugin][Gemini] 📝 Question has ${optionsList.length} options:`);
      optionsList.forEach((opt, index) => {
        console.log(`[EasyApplyPlugin][Gemini]    ${index + 1}. ${opt}`);
      });
      
      prompt += `Please choose the best option from the following list:\n`;
      optionsList.forEach((opt, index) => {
        prompt += `${index + 1}. ${opt}\n`;
      });
      
      // For selection questions with Yes/No options, prefer Yes for most cases
      const hasYesOption = optionsList.some(opt => 
        opt.toLowerCase() === 'yes' || 
        opt.toLowerCase().includes('yes,') || 
        opt.toLowerCase() === 'i do'
      );
      
      if (hasYesOption && (
        question.toLowerCase().includes('are you comfortable') ||
        question.toLowerCase().includes('are you authorized') ||
        question.toLowerCase().includes('are you able') ||
        question.toLowerCase().includes('can you') ||
        question.toLowerCase().includes('do you have') ||
        question.toLowerCase().includes('are you willing')
      )) {
        prompt += `\nFor questions about my capabilities, authorizations, or willingness, please assume I am answering YES unless there's a clear reason not to based on my CV.`;
      }
      
      prompt += `\nRespond with ONLY the option number or the exact text of the option.`;
    } else if (numericOnly) {
      prompt += `Please respond with ONLY a number.`;
    } else if (isSummaryField) {
      if (isSpecificallyCoverLetter) {
        prompt += `Please write a professional, concise cover letter explaining why I'm a good fit for this role based on my experience. Keep it to around 1000 characters, focusing on my most relevant skills and achievements.`;
      } else {
        prompt += `Please provide a concise professional summary based on my CV. Keep it to around 800 characters, highlighting my key skills and experiences. Make it directly relevant to this job application.`;
      }
    } else {
      prompt += `Please provide a direct, concise answer based on my CV. Keep your response short and to the point.`;
    }
    
    // Truncate CV in the log message to avoid clutter
    const truncatedCV = cv.substring(0, 50) + (cv.length > 50 ? '...' : '');
    console.log(`[EasyApplyPlugin][Gemini] 📤 Sending prompt to Gemini API: 
Question: ${question}
CV (truncated): ${truncatedCV}
Has options: ${optionsList ? 'Yes' : 'No'}
Numeric only: ${numericOnly ? 'Yes' : 'No'}
Is summary field: ${isSummaryField ? 'Yes' : 'No'}
Is cover letter: ${isSpecificallyCoverLetter ? 'Yes' : 'No'}`);
    
    // Call the Gemini API
    const startTime = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const endTime = Date.now();
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[EasyApplyPlugin][Gemini] 📥 Received response in ${endTime - startTime}ms`);
    
    // Extract the text from the response
    const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean and format the answer
    let cleanAnswer = answerText.trim();
    console.log(`[EasyApplyPlugin][Gemini] 📄 Raw response: "${cleanAnswer}"`);
    
    // For multiple choice, try to extract just the option
    if (optionsList && optionsList.length > 0) {
      // Look for option numbers
      const numberMatch = cleanAnswer.match(/^[0-9]+/);
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[0]) - 1;
        if (optionIndex >= 0 && optionIndex < optionsList.length) {
          console.log(`[EasyApplyPlugin][Gemini] 🔢 Found option number ${numberMatch[0]}, selecting option: "${optionsList[optionIndex]}"`);
          cleanAnswer = optionsList[optionIndex];
        }
      } else {
        // Look for exact option text
        let foundMatch = false;
        for (const option of optionsList) {
          if (cleanAnswer.includes(option)) {
            console.log(`[EasyApplyPlugin][Gemini] 📌 Found exact option text: "${option}"`);
            cleanAnswer = option;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          console.log(`[EasyApplyPlugin][Gemini] ⚠️ Couldn't match response to any option, using first option as fallback: "${optionsList[0]}"`);
          cleanAnswer = optionsList[0];
        }
      }
    }
    
    // For numeric only responses, extract just the number
    if (numericOnly) {
      const numberMatch = cleanAnswer.match(/\d+/);
      if (numberMatch) {
        console.log(`[EasyApplyPlugin][Gemini] 🔢 Extracted number: ${numberMatch[0]}`);
        cleanAnswer = numberMatch[0];
      }
    }
    
    console.log(`[EasyApplyPlugin][Gemini] ✅ Final answer for "${question}": "${cleanAnswer}"`);
    
    // Save to cache
    if (qaCache) {
      qaCache[question] = cleanAnswer;
      // Save to chrome.storage.local
      chrome.storage.local.set({ qaCache });
      console.log(`[EasyApplyPlugin][Gemini] 💾 Saved answer to cache`);
    }
    
    return cleanAnswer;
  } catch (error) {
    console.error('[EasyApplyPlugin][Gemini] ❌ Error getting answer:', error);
    
    // Provide a sensible fallback
    let fallbackAnswer = "";
    
    if (isSummaryField) {
      fallbackAnswer = "I am a skilled professional with relevant experience for this position. My background includes the key skills mentioned in the job description, and I'm excited about the opportunity to contribute to your team.";
    } else if (optionsList && optionsList.length > 0) {
      // For option lists, try to find a "Yes" option or use the first option
      const yesOption = optionsList.find(opt => 
        opt.toLowerCase() === 'yes' || 
        opt.toLowerCase().includes('yes,') ||
        opt.toLowerCase() === 'i do'
      );
      
      fallbackAnswer = yesOption || optionsList[0];
    } else {
      fallbackAnswer = "Yes";
    }
    
    console.log(`[EasyApplyPlugin][Gemini] 🔄 Using fallback answer: "${fallbackAnswer}"`);
    return fallbackAnswer;
  }
}

/**
 * Automate the Easy Apply process
 * 
 * @param {boolean} processNonEasyApplyAsFallback - Whether to process non-Easy Apply jobs if no Easy Apply jobs are found
 * @returns {Promise<void>}
 */
async function automateEasyApply(processNonEasyApplyAsFallback = false) {
  try {
    console.log('[EasyApplyPlugin] Starting Easy Apply automation');
    window.easyApplyJobsApplied = 0;
    const progressTracker = new ProgressTracker();
    
    // Check if automation should be stopped before starting
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Automation stopped before starting');
      return;
    }
    
    // Ensure jobDetector is initialized
    if (!jobDetector) {
      jobDetector = new JobDetector();
    }
    
    // Debug job detection if needed
    /*
    if (EasyApplyConfig.debug?.jobDetection) {
      console.log('[EasyApplyPlugin] Starting job detection debug');
      jobDetector.debugJobCards();
      console.log('[EasyApplyPlugin] Debug completed');
    }
    
    // Force debug to be true for the first run to help diagnose issues
    console.log('[EasyApplyPlugin] Running job detection debug to diagnose issues');
    jobDetector.debugJobCards();
    */
    
    // Get only Easy Apply job cards
    const cards = jobDetector.getEasyApplyJobCards(processNonEasyApplyAsFallback);
    
    if (cards.length > 0) {
      if (processNonEasyApplyAsFallback) {
        console.log(`[EasyApplyPlugin] Found ${cards.length} job cards to process (may include non-Easy Apply jobs)`);
      } else {
        console.log(`[EasyApplyPlugin] Found ${cards.length} Easy Apply job cards`);
      }
    } else {
      console.log('[EasyApplyPlugin] No jobs found to process on this page, checking if we should move to next page');
      
      // Check if there are any jobs on the page that aren't applied to yet
      let allCards = [];
      try {
        allCards = jobDetector.getJobCards();
      } catch (error) {
        console.error('[EasyApplyPlugin] Error getting all job cards:', error);
        allCards = [];
      }
      
      const nonAppliedCount = allCards.filter(card => {
        try {
          return !jobDetector.isJobAlreadyApplied(card);
        } catch (error) {
          console.error('[EasyApplyPlugin] Error checking if job already applied:', error);
          return false;
        }
      }).length;
      
      // Count how many of these non-applied jobs have Easy Apply
      const easyApplyCount = allCards.filter(card => {
        try {
          return !jobDetector.isJobAlreadyApplied(card) && jobDetector.hasEasyApplyLabel(card);
        } catch (error) {
          console.error('[EasyApplyPlugin] Error checking if job has Easy Apply:', error);
          return false;
        }
      }).length;
      
      console.log(`[EasyApplyPlugin] Found ${nonAppliedCount} non-applied jobs, of which ${easyApplyCount} have Easy Apply`);
      
      if (nonAppliedCount === 0) {
        console.log('[EasyApplyPlugin] All jobs on this page are already applied to');
      } else if (easyApplyCount === 0) {
        console.log('[EasyApplyPlugin] Found non-applied jobs, but none with Easy Apply');
      }
      
      // Go to the next page
      let nextButton = null;
      try {
        nextButton = jobDetector.getNextPageButton(isElementVisible);
      } catch (error) {
        console.error('[EasyApplyPlugin] Error getting next page button:', error);
      }
      
      if (nextButton && !window.easyApplyStop) {
        console.log('[EasyApplyPlugin] Going to next page to look for jobs');
        nextButton.click();
        await new Promise(r => setTimeout(r, 3000)); // Wait for page to load
        await automateEasyApply(processNonEasyApplyAsFallback); // Process next page
      } else {
        console.log('[EasyApplyPlugin] No more pages or next button not found, automation completed');
        
        // If next button not found but there are more pages, try to find pagination
        const pagination = document.querySelector('.artdeco-pagination');
        if (pagination) {
          console.log('[EasyApplyPlugin] Pagination found but next button not detected. Pagination HTML:');
          console.log(pagination.outerHTML.substring(0, 300) + '...');
        }
      }
      return;
    }
    
    // Process job cards
    await processJobCards(cards, processNonEasyApplyAsFallback);
    
    // Go to the next page if there are more jobs
    let nextButton = null;
    try {
      nextButton = jobDetector.getNextPageButton(isElementVisible);
    } catch (error) {
      console.error('[EasyApplyPlugin] Error getting next page button:', error);
    }
    
    if (nextButton && !window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Going to next page');
      nextButton.click();
      await new Promise(r => setTimeout(r, 3000)); // Wait for page to load
      await automateEasyApply(processNonEasyApplyAsFallback); // Process next page
    } else {
      console.log('[EasyApplyPlugin] No more pages or next button not found, automation completed');
    }
  } catch (error) {
    console.error('[EasyApplyPlugin] Error in automation:', error);
    alert('An error occurred during automation. Please check the console for details.');
  }
}

/**
 * Process job cards one by one
 * 
 * @param {Array<Element>} cards - Job cards to process
 * @param {boolean} processNonEasyApplyAsFallback - Whether to process non-Easy Apply jobs
 * @returns {Promise<void>}
 */
async function processJobCards(cards, processNonEasyApplyAsFallback) {
  try {
    // Check if automation should be stopped
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Stopping job card processing as requested');
      return;
    }
    
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let easyApplyCount = 0;
    let nonEasyApplyCount = 0;
    let alreadyAppliedCount = 0;
    
    console.log(`[EasyApplyPlugin] Processing ${cards.length} job cards`);
    
    // Ensure jobDetector is initialized
    if (!jobDetector) {
      jobDetector = new JobDetector();
    }
    
    for (let i = 0; i < cards.length; i++) {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log('[EasyApplyPlugin] Stopping job card processing loop as requested');
        return;
      }
      
      // Reset state variables for each job
      resetApplicationState();
      
      const card = cards[i];
      console.log(`[EasyApplyPlugin] Processing job ${i+1}/${cards.length}`);
      
      // Double-check if already applied - sometimes the initial filter misses some
      const isAlreadyApplied = jobDetector.isJobAlreadyApplied(card);
      if (isAlreadyApplied) {
        console.log('[EasyApplyPlugin] This job is already applied to, skipping');
        alreadyAppliedCount++;
        continue;
      }
      
      // Check if this is an Easy Apply job
      const isEasyApply = jobDetector.hasEasyApplyLabel(card);
      if (isEasyApply) {
        easyApplyCount++;
        console.log('[EasyApplyPlugin] This is an Easy Apply job');
      } else {
        nonEasyApplyCount++;
        console.log('[EasyApplyPlugin] This is NOT an Easy Apply job');
        
        if (!processNonEasyApplyAsFallback) {
          console.log('[EasyApplyPlugin] Skipping non-Easy Apply job');
          continue;
        }
      }
      
      // Get job info from card
      let cardInfo = {};
      try {
        cardInfo = jobDetector.getJobCardInfo(card);
        console.log(`[EasyApplyPlugin] Job: ${cardInfo.title} at ${cardInfo.company}`);
      } catch (error) {
        console.error('[EasyApplyPlugin] Error getting job info:', error);
      }
      
      // Click on the job card to load details in right pane
      try {
        // First try to find a link element inside the card that should be clicked
        const cardLink = card.querySelector('a.job-card-job-posting-card-wrapper__card-link, a.job-card-container__link, a[data-test-app-aware-link], a.job-card-list__title');
        
        if (cardLink) {
          console.log('[EasyApplyPlugin] Found specific link element in job card, clicking it');
          cardLink.click();
        } else {
          // Fallback to clicking the card itself
          console.log('[EasyApplyPlugin] No specific link found, clicking the card itself');
          card.click();
        }
        
        console.log('[EasyApplyPlugin] Clicked job card');
      } catch (error) {
        console.error('[EasyApplyPlugin] Error clicking job card:', error);
        failureCount++;
        continue;
      }
      
      // Wait for right pane to load
      let rightPaneLoaded = false;
      // try {
      //   rightPaneLoaded = await jobDetector.waitForRightPaneToMatch(cardInfo);
      // } catch (error) {
      //   console.error('[EasyApplyPlugin] Error waiting for right pane:', error);
      // }
      
      // if (!rightPaneLoaded) {
      //   console.log('[EasyApplyPlugin] Right pane did not load or match the job card, skipping job');
      //   failureCount++;
      //   continue;
      // }
      
      // Wait for Apply button (either Easy Apply or regular Apply)
      let applyButton = null;
      try {
        console.log('[EasyApplyPlugin] Looking for Easy Apply button...');
        applyButton = await jobDetector.waitForEasyApplyButton(isElementVisible);
        console.log('[EasyApplyPlugin] Found Apply button');
        
      } catch (error) {
        if (globalErrorHandler) {
          globalErrorHandler.logError('Error waiting for Apply button', error);
        } else {
          console.error('[EasyApplyPlugin] Error waiting for Apply button:', error);
        }
      }
      
      if (!applyButton) {
        console.log('[EasyApplyPlugin] No Apply button found, skipping job');
        failureCount++;
        continue;
      }
      
      // Check if the button text indicates Easy Apply
      const buttonText = applyButton.textContent && applyButton.textContent.trim().toLowerCase();
      const isEasyApplyButton = buttonText && (buttonText === 'easy apply' || buttonText.includes('easy apply'));
      
      if (!isEasyApplyButton && !processNonEasyApplyAsFallback) {
        console.log('[EasyApplyPlugin] Apply button is not Easy Apply, skipping job');
        continue;
      }
      
      // Only proceed with Easy Apply buttons
      if (!isEasyApplyButton) {
        console.log('[EasyApplyPlugin] This is a regular Apply button, not Easy Apply. Skipping.');
        continue;
      }
      
      // Click the Apply button
      try {
        applyButton.click();
        console.log(`[EasyApplyPlugin] Clicked ${isEasyApplyButton ? 'Easy Apply' : 'Apply'} button`);
        
        // Wait for the modal to appear
        console.log('[EasyApplyPlugin] Waiting for Easy Apply modal to appear...');
        await waitForModalToBeVisible(5000); // Wait up to 5 seconds for modal
        console.log('[EasyApplyPlugin] Easy Apply modal is now visible');
      } catch (error) {
        console.error('[EasyApplyPlugin] Error clicking Apply button or waiting for modal:', error);
        failureCount++;
        continue;
      }
      
      // Handle the application form
      let success = false;
      try {
        success = await handleEasyApplyForm();
      } catch (error) {
        console.error('[EasyApplyPlugin] Error handling application form:', error);
        success = false;
      }
      
      processedCount++;
      if (success) {
        console.log('[EasyApplyPlugin] Successfully applied to job');
        successCount++;
      } else {
        console.log('[EasyApplyPlugin] Failed to apply to job');
        failureCount++;
      }
      
      // Wait a bit before moving to the next job
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`[EasyApplyPlugin] Processed ${processedCount} jobs. Success: ${successCount}, Failure: ${failureCount}`);
    console.log(`[EasyApplyPlugin] Easy Apply jobs: ${easyApplyCount}, Non-Easy Apply jobs: ${nonEasyApplyCount}, Already applied: ${alreadyAppliedCount}`);
  } catch (error) {
    console.error('[EasyApplyPlugin] Error processing job cards:', error);
    alert('An error occurred while processing job cards. Please check the console for details.');
  }
}

/**
 * Debug Easy Apply button detection
 * 
 * @returns {Promise<boolean>} - Whether the debug completed successfully
 */
/*
async function debugEasyApplyButton() {
  console.log('[EasyApplyPlugin] Starting Easy Apply button detection debug');
  
  try {
    // Initialize job detector if not already done
    if (!jobDetector) {
      jobDetector = new JobDetector();
    }
    
    // First, get job cards and find one that has Easy Apply
    const cards = jobDetector.getJobCards();
    console.log(`[EasyApplyPlugin] Found ${cards.length} job cards`);
    
    let easyApplyCard = null;
    for (const card of cards) {
      if (jobDetector.hasEasyApplyLabel(card)) {
        easyApplyCard = card;
        console.log('[EasyApplyPlugin] Found a job card with Easy Apply label');
        break;
      }
    }
    
    if (!easyApplyCard) {
      console.log('[EasyApplyPlugin] No job card with Easy Apply label found');
      return false;
    }
    
    // Click on the card to load the right pane
    // First try to find a link element inside the card that should be clicked
    const cardLink = easyApplyCard.querySelector('a.job-card-job-posting-card-wrapper__card-link, a.job-card-container__link, a[data-test-app-aware-link], a.job-card-list__title');
    
    if (cardLink) {
      console.log('[EasyApplyPlugin] Found specific link element in job card, clicking it');
      cardLink.click();
    } else {
      // Fallback to clicking the card itself
      console.log('[EasyApplyPlugin] No specific link found, clicking the card itself');
      easyApplyCard.click();
    }
    console.log('[EasyApplyPlugin] Clicked on Easy Apply job card');
    
    // Wait for the right pane to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Look for the Easy Apply button in the right pane
    const applyButton = await jobDetector.waitForEasyApplyButton(isElementVisible);
    
    if (applyButton) {
      console.log('[EasyApplyPlugin] Found Easy Apply button in right pane');
      // logEasyApplyButtonDetails(applyButton); // Commented out
      console.log('[EasyApplyPlugin] Debug logging for buttons is disabled');
      return true;
    } else {
      console.log('[EasyApplyPlugin] Failed to find Easy Apply button in right pane');
      return false;
    }
  } catch (error) {
    console.error('[EasyApplyPlugin] Error in Easy Apply button debug:', error);
    return false;
  }
}
*/

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAutomation') {
    window.easyApplyStop = false;
    const processNonEasyApply = message.processNonEasyApply || false;
    automateEasyApply(processNonEasyApply);
    sendResponse({ 
      status: 'Automation started', 
      processNonEasyApply: processNonEasyApply 
    });
  } else if (message.action === 'processAllJobs') {
    window.easyApplyStop = false;
    console.log('[EasyApplyPlugin] Starting to process all jobs one by one');
    processAllJobs();
    sendResponse({
      status: 'Processing all jobs started'
    });
  } else if (message.action === 'stopAutomation') {
    window.easyApplyStop = true;
    console.log('[EasyApplyPlugin] Stopping automation as requested by user');
    
    // Reset application state when stopping
    resetApplicationState();
    
    // Close any open modals
    try {
      const closeButtons = document.querySelectorAll('button[aria-label="Dismiss"], button[data-test-modal-close-btn], button.artdeco-modal__dismiss');
      if (closeButtons.length > 0) {
        console.log('[EasyApplyPlugin] Attempting to close open modals');
        for (const button of closeButtons) {
          if (isElementVisible(button)) {
            button.click();
            console.log('[EasyApplyPlugin] Clicked modal close button');
          }
        }
      }
    } catch (error) {
      console.error('[EasyApplyPlugin] Error closing modals:', error);
    }
    
    sendResponse({ status: 'Automation stopped' });
  } else if (message.action === 'debugJobDetection') {
    // Debug functionality is commented out
    console.log('[EasyApplyPlugin] Debug functionality is disabled');
    sendResponse({ status: 'Debug functionality is disabled' });
  } else if (message.action === 'debugEasyApplyButton') {
    // Debug functionality is commented out
    console.log('[EasyApplyPlugin] Debug functionality is disabled');
    sendResponse({ status: 'Debug functionality is disabled' });
  }
  return true;
});

console.log('[EasyApplyPlugin] Content script loaded and ready');

/**
 * Wait for the modal content to refresh after clicking a navigation button
 * 
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} - Whether the modal content has refreshed
 */
async function waitForModalContentRefresh(timeout = 3000) {
  console.log('[EasyApplyPlugin] Waiting for modal content to refresh...');
  
  // Take a snapshot of the current modal content
  const modalElement = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal__content, div[data-test-modal]');
  if (!modalElement) {
    console.log('[EasyApplyPlugin] No modal element found to monitor for refresh');
    return false;
  }
  
  // Store initial state - don't store the actual content, just the length
  const initialContentLength = modalElement.innerHTML.length;
  const initialHeight = modalElement.offsetHeight;
  
  return new Promise((resolve) => {
    const interval = 100;
    let elapsed = 0;
    let contentStabilized = false;
    let lastContentLength = initialContentLength;
    let stabilityCounter = 0;
    
    const timer = setInterval(() => {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log(`[EasyApplyPlugin] Stopping wait for modal content refresh as requested`);
        clearInterval(timer);
        resolve(false); // Resolve with false to allow cleanup code to run
        return;
      }
      
      // Check if content has changed - compare lengths, not actual content
      const currentContent = modalElement.innerHTML;
      const currentContentLength = currentContent.length;
      const currentHeight = modalElement.offsetHeight;
      
      if (currentContentLength !== initialContentLength || currentHeight !== initialHeight) {
        console.log(`[EasyApplyPlugin] Modal content has changed (length: ${initialContentLength} → ${currentContentLength})`);
        
        // Check if content has stabilized (hasn't changed for 2 consecutive checks)
        if (currentContentLength === lastContentLength) {
          stabilityCounter++;
          if (stabilityCounter >= 2) {
            console.log('[EasyApplyPlugin] Modal content has stabilized');
            contentStabilized = true;
            clearInterval(timer);
            resolve(true);
          }
        } else {
          // Content still changing, reset stability counter
          stabilityCounter = 0;
        }
        
        lastContentLength = currentContentLength;
      }
      
      elapsed += interval;
      if (elapsed >= timeout) {
        console.log('[EasyApplyPlugin] Timeout waiting for modal content to refresh');
        clearInterval(timer);
        resolve(contentStabilized);
      }
    }, interval);
  });
}

/**
 * Get the application progress percentage from the modal
 * 
 * @returns {number|null} - The progress percentage or null if not found
 */
function getApplicationProgress() {
  try {
    // Look for the progress indicator text
    const progressSelectors = [
      '.pl3.t-14.t-black--light',
      '.artdeco-text-input__hint',
      '.jobs-easy-apply-content__progress-text',
      'p[data-test-form-element="progress-label"]'
    ];
    
    for (const selector of progressSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        if (!isElementVisible(element)) continue;
        
        const text = element.textContent?.trim();
        if (!text) continue;
        
        // Check for the progress text pattern
        if (text.toLowerCase().includes('job application progress') || 
            text.toLowerCase().includes('your application is')) {
          // Extract the percentage using regex
          const percentMatch = text.match(/(\d+)%/);
          if (percentMatch && percentMatch[1]) {
            const percent = parseInt(percentMatch[1], 10);
            console.log(`[EasyApplyPlugin] Found application progress: ${percent}%`);
            return percent;
          }
        }
      }
    }
    
    console.log('[EasyApplyPlugin] No application progress indicator found');
    return null;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error getting application progress:', error);
    return null;
  }
}

/**
 * Check if the form is stuck on a specific field that needs attention
 * 
 * @param {HTMLElement} modal - The modal element
 * @returns {boolean} - Whether the form appears to be stuck
 */
function isFormStuck(modal) {
  try {
    if (!modal) return false;
    
    // Look for error messages
    const errorMessages = modal.querySelectorAll('.artdeco-inline-feedback--error, .artdeco-text-input--error, .fb-text-selectable__error');
    if (errorMessages.length > 0) {
      console.log(`[EasyApplyPlugin] Found ${errorMessages.length} error messages in the form`);
      return true;
    }
    
    // Look for required fields that are empty
    const requiredFields = modal.querySelectorAll('input[required], select[required], textarea[required]');
    for (const field of requiredFields) {
      if (!field.value && isElementVisible(field)) {
        console.log('[EasyApplyPlugin] Found empty required field:', field);
        return true;
      }
    }
    
    // Look for required checkbox groups that have no selection
    const checkboxGroups = modal.querySelectorAll('.fb-dash-form-element--required fieldset');
    for (const group of checkboxGroups) {
      const checkboxes = group.querySelectorAll('input[type="checkbox"]');
      let anyChecked = false;
      for (const checkbox of checkboxes) {
        if (checkbox.checked) {
          anyChecked = true;
          break;
        }
      }
      if (!anyChecked) {
        console.log('[EasyApplyPlugin] Found checkbox group with no selection');
        return true;
      }
    }
    
    // Look for required radio button groups that have no selection
    const radioGroups = modal.querySelectorAll('fieldset[aria-describedby*="error"], fieldset[data-test-form-builder-radio-button-form-component="true"]');
    for (const group of radioGroups) {
      // Check if it's a required fieldset
      const isRequired = 
        group.querySelector('.fb-dash-form-element__label-title--is-required') || 
        group.querySelector('[aria-required="true"]') ||
        group.hasAttribute('aria-required') ||
        group.getAttribute('aria-describedby')?.includes('error');
      
      if (isRequired) {
        const radioButtons = group.querySelectorAll('input[type="radio"]');
        let anyChecked = false;
        for (const radio of radioButtons) {
          if (radio.checked) {
            anyChecked = true;
            break;
          }
        }
        
        if (!anyChecked) {
          console.log('[EasyApplyPlugin] Found radio button group with no selection');
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('[EasyApplyPlugin] Error checking if form is stuck:', error);
    return false;
  }
}

/**
 * Reset state variables for a new job application
 * 
 * @param {ProgressTracker} progressTracker - Optional progress tracker to reset
 */
function resetApplicationState(progressTracker = null) {
  // Reset button click tracking
  nextButtonClicked = false;
  reviewButtonClicked = false;
  
  // Clear processed fields cache if it exists
  if (typeof processedFields !== 'undefined' && processedFields instanceof Set) {
    processedFields.clear();
  }
  
  // Reset progress tracker if provided
  if (progressTracker) {
    progressTracker.reset();
  }
  
  console.log('[EasyApplyPlugin] Reset application state for new job');
}

/**
 * ProgressTracker class to monitor and manage application progress
 */
class ProgressTracker {
  constructor() {
    this.currentProgress = 0;
    this.previousProgress = 0;
    this.unchangedCount = 0;
    this.progressHistory = [];
    this.lastUpdateTime = Date.now();
    this.isStuck = false;
    this.maxStuckCount = 3;
  }

  /**
   * Update the progress tracker with the latest progress value
   * @param {number|null} newProgress - The new progress percentage or null if not found
   * @returns {boolean} - Whether the progress has changed
   */
  update(newProgress) {
    // If newProgress is null or undefined, keep the current value
    if (newProgress === null || newProgress === undefined) {
      this.unchangedCount++;
      console.log(`[ProgressTracker] No progress value found, unchanged count: ${this.unchangedCount}`);
      
      if (this.unchangedCount >= this.maxStuckCount) {
        this.isStuck = true;
      }
      
      return false;
    }
    
    // Record time since last progress update
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Store previous progress
    this.previousProgress = this.currentProgress;
    
    // Update current progress
    this.currentProgress = newProgress;
    
    // Add to history (timestamp, progress value)
    this.progressHistory.push({
      timestamp: now,
      progress: newProgress,
      timeSinceLastUpdate: timeSinceLastUpdate
    });
    
    // Keep history limited to last 10 entries
    if (this.progressHistory.length > 10) {
      this.progressHistory.shift();
    }
    
    // Check if progress has changed
    if (this.currentProgress > this.previousProgress) {
      // Progress increased, reset stuck counter
      this.unchangedCount = 0;
      this.isStuck = false;
      console.log(`[ProgressTracker] Progress increased: ${this.previousProgress}% → ${this.currentProgress}%`);
      return true;
    } else if (this.currentProgress === this.previousProgress) {
      // Progress unchanged
      this.unchangedCount++;
      console.log(`[ProgressTracker] Progress unchanged at ${this.currentProgress}%, count: ${this.unchangedCount}`);
      
      if (this.unchangedCount >= this.maxStuckCount) {
        this.isStuck = true;
      }
      
      return false;
    } else {
      // Progress decreased (unusual, but possible)
      console.log(`[ProgressTracker] Progress decreased: ${this.previousProgress}% → ${this.currentProgress}% (unusual)`);
      this.unchangedCount = 0;
      this.isStuck = false;
      return true;
    }
  }
  
  /**
   * Check if the application progress is at 100%
   * @returns {boolean} - Whether the application is complete
   */
  isComplete() {
    return this.currentProgress === 100;
  }
  
  /**
   * Check if progress is near completion (90% or higher)
   * @returns {boolean} - Whether the progress is near completion
   */
  isNearCompletion() {
    return this.currentProgress >= 90;
  }
  
  /**
   * Check if the application appears to be stuck at the same progress
   * @returns {boolean} - Whether the application is stuck
   */
  isApplicationStuck() {
    return this.isStuck;
  }
  
  /**
   * Get the current progress percentage
   * @returns {number} - The current progress percentage
   */
  getProgress() {
    return this.currentProgress;
  }
  
  /**
   * Reset the progress tracker
   */
  reset() {
    this.currentProgress = 0;
    this.previousProgress = 0;
    this.unchangedCount = 0;
    this.progressHistory = [];
    this.lastUpdateTime = Date.now();
    this.isStuck = false;
  }
  
  /**
   * Get a report of the progress history
   * @returns {string} - A formatted report of progress history
   */
  getProgressReport() {
    if (this.progressHistory.length === 0) {
      return "No progress history available";
    }
    
    let report = "Progress History:\n";
    this.progressHistory.forEach((entry, index) => {
      const date = new Date(entry.timestamp);
      const timeString = date.toLocaleTimeString();
      report += `${index + 1}. ${timeString}: ${entry.progress}% (${entry.timeSinceLastUpdate}ms since previous)\n`;
    });
    
    return report;
  }
}

/**
 * Process all job listings one by one, checking each for Easy Apply button
 * 
 * @returns {Promise<void>}
 */
async function processAllJobs() {
  try {
    console.log('[EasyApplyPlugin] Starting to process all jobs one by one');
    
    // Check if automation should be stopped
    if (window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Automation stopped before starting');
      return;
    }
    
    // Ensure jobDetector is initialized
    if (!jobDetector) {
      jobDetector = new JobDetector();
    }
    
    // Get all job cards without filtering for Easy Apply
    console.log('[EasyApplyPlugin] Finding all job cards on the page...');
    let allJobCards = jobDetector.getJobCards();
    
    // If no job cards found with the standard method, try finding ember elements
    if (allJobCards.length === 0) {
      console.log('[EasyApplyPlugin] No job cards found with standard method, trying to find ember elements');
      const emberElements = document.querySelectorAll('li[id^="ember"]');
      if (emberElements.length > 0) {
        console.log(`[EasyApplyPlugin] Found ${emberElements.length} ember elements that might be job cards`);
        allJobCards = Array.from(emberElements);
      }
    }
    
    // If still no job cards found, try a more generic approach
    if (allJobCards.length === 0) {
      console.log('[EasyApplyPlugin] Still no job cards found, trying a more generic approach');
      const scaffoldList = document.querySelector('ul.scaffold-layout__list');
      if (scaffoldList) {
        const listItems = scaffoldList.querySelectorAll('li');
        if (listItems.length > 0) {
          console.log(`[EasyApplyPlugin] Found ${listItems.length} list items in scaffold-layout__list`);
          allJobCards = Array.from(listItems);
        }
      }
    }
    
    if (allJobCards.length === 0) {
      console.log('[EasyApplyPlugin] No job cards found on this page');
      
      // Check if there's a next page
      let nextButton = null;
      try {
        nextButton = jobDetector.getNextPageButton(isElementVisible);
      } catch (error) {
        console.error('[EasyApplyPlugin] Error getting next page button:', error);
      }
      
      if (nextButton && !window.easyApplyStop) {
        console.log('[EasyApplyPlugin] Going to next page to look for jobs');
        nextButton.click();
        await new Promise(r => setTimeout(r, 3000)); // Wait for page to load
        await processAllJobs(); // Process next page
      } else {
        console.log('[EasyApplyPlugin] No more pages or next button not found, automation completed');
      }
      return;
    }
    
    console.log(`[EasyApplyPlugin] Found ${allJobCards.length} job cards to check one by one`);
    
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let easyApplyCount = 0;
    let nonEasyApplyCount = 0;
    let alreadyAppliedCount = 0;
    
    for (let i = 0; i < allJobCards.length; i++) {
      // Check if automation should be stopped
      if (window.easyApplyStop) {
        console.log('[EasyApplyPlugin] Stopping job processing loop as requested');
        return;
      }
      
      // Reset state variables for each job
      resetApplicationState();
      
      const card = allJobCards[i];
      console.log(`[EasyApplyPlugin] Checking job ${i+1}/${allJobCards.length} (ID: ${card.id || 'unknown'})`);
      
      // Check if already applied
      const isAlreadyApplied = jobDetector.isJobAlreadyApplied(card);
      if (isAlreadyApplied) {
        console.log('[EasyApplyPlugin] This job is already applied to, skipping');
        alreadyAppliedCount++;
        continue;
      }
      
      // Get job info from card
      let cardInfo = {};
      try {
        cardInfo = jobDetector.getJobCardInfo(card);
        console.log(`[EasyApplyPlugin] Job: ${cardInfo.title || 'Unknown title'} at ${cardInfo.company || 'Unknown company'}`);
      } catch (error) {
        console.error('[EasyApplyPlugin] Error getting job info:', error);
      }
      
      // Click on the job card to load details in right pane
      try {
        // First try to find a link element inside the card that should be clicked
        const cardLink = card.querySelector('a.job-card-job-posting-card-wrapper__card-link, a.job-card-container__link, a[data-test-app-aware-link], a.job-card-list__title, a[href*="jobs"]');
        
        if (cardLink) {
          console.log('[EasyApplyPlugin] Found specific link element in job card, clicking it');
          cardLink.click();
        } else {
          // Fallback to clicking the card itself
          console.log('[EasyApplyPlugin] No specific link found, clicking the card itself');
          card.click();
        }
        
        console.log('[EasyApplyPlugin] Clicked job card');
        
        // Wait for job details to load
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error('[EasyApplyPlugin] Error clicking job card:', error);
        failureCount++;
        continue;
      }
      
      // Wait for Apply button (either Easy Apply or regular Apply)
      let applyButton = null;
      try {
        console.log('[EasyApplyPlugin] Looking for Easy Apply button...');
        applyButton = await jobDetector.waitForEasyApplyButton(isElementVisible, 5000); // 5 second timeout
        console.log('[EasyApplyPlugin] Found Apply button');
      } catch (error) {
        console.error('[EasyApplyPlugin] Error waiting for Apply button:', error);
        failureCount++;
        continue;
      }
      
      if (!applyButton) {
        console.log('[EasyApplyPlugin] No Apply button found for this job, skipping');
        nonEasyApplyCount++;
        continue;
      }
      
      // Check if the button text indicates Easy Apply
      const buttonText = applyButton.textContent && applyButton.textContent.trim().toLowerCase();
      const isEasyApplyButton = buttonText && (buttonText === 'easy apply' || buttonText.includes('easy apply'));
      
      if (!isEasyApplyButton) {
        console.log('[EasyApplyPlugin] This is a regular Apply button, not Easy Apply. Skipping.');
        nonEasyApplyCount++;
        continue;
      }
      
      // Found an Easy Apply job
      easyApplyCount++;
      console.log('[EasyApplyPlugin] Found Easy Apply job!');
      
      // Click the Easy Apply button
      try {
        applyButton.click();
        console.log('[EasyApplyPlugin] Clicked Easy Apply button');
        
        // Wait for the modal to appear
        console.log('[EasyApplyPlugin] Waiting for Easy Apply modal to appear...');
        await waitForModalToBeVisible(5000); // Wait up to 5 seconds for modal
        console.log('[EasyApplyPlugin] Easy Apply modal is now visible');
      } catch (error) {
        console.error('[EasyApplyPlugin] Error clicking Easy Apply button or waiting for modal:', error);
        failureCount++;
        continue;
      }
      
      // Handle the application form
      let success = false;
      try {
        success = await handleEasyApplyForm();
      } catch (error) {
        console.error('[EasyApplyPlugin] Error handling application form:', error);
        success = false;
      }
      
      processedCount++;
      if (success) {
        console.log('[EasyApplyPlugin] Successfully applied to job');
        successCount++;
      } else {
        console.log('[EasyApplyPlugin] Failed to apply to job');
        failureCount++;
      }
      
      // Wait a bit before moving to the next job
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`[EasyApplyPlugin] Processed ${processedCount} jobs. Success: ${successCount}, Failure: ${failureCount}`);
    console.log(`[EasyApplyPlugin] Easy Apply jobs found: ${easyApplyCount}, Regular Apply jobs: ${nonEasyApplyCount}, Already applied: ${alreadyAppliedCount}`);
    
    // Go to the next page if there are more jobs
    let nextButton = null;
    try {
      nextButton = jobDetector.getNextPageButton(isElementVisible);
    } catch (error) {
      console.error('[EasyApplyPlugin] Error getting next page button:', error);
    }
    
    if (nextButton && !window.easyApplyStop) {
      console.log('[EasyApplyPlugin] Going to next page');
      nextButton.click();
      await new Promise(r => setTimeout(r, 3000)); // Wait for page to load
      await processAllJobs(); // Process next page
    } else {
      console.log('[EasyApplyPlugin] No more pages or next button not found, automation completed');
    }
  } catch (error) {
    console.error('[EasyApplyPlugin] Error processing all jobs:', error);
    alert('An error occurred during job processing. Please check the console for details.');
  }
}

