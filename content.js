// Initialize the LinkedIn Easy Apply Automator
console.log('[EasyApplyPlugin] Initializing...');

// Configuration loaded from config.js (ensure config.js is included first in manifest.json)

const experienceKeywords = [
    'experience', 'years', 'year', 'exp.', 'exp ', 'relevant work',
    'python', 'java', 'javascript', 'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin', 'golang', 'rust',
    'sql', 'nosql', 'mongodb', 'postgresql', 'mysql',
    'aws', 'azure', 'gcp', 'cloud',
    'project management', 'agile', 'scrum',
    'data analysis', 'machine learning', 'ai', 'artificial intelligence',
    'customer service', 'sales', 'marketing'
    // Add more keywords as needed
];

const summaryKeywords = [
    'summary', 'overview', 'bio', 'introduction', 'background',
    'objective', 'statement', 'profile', 'about you', 'tell me about yourself',
    'additional information', 'notes', 'comments',
    'cover letter', 'letter of intent', // Though cover letters have more specific handling too
    'explain', 'detail', 'elaborate', 'describe'
    // Add more keywords as needed
];


// Helper functions for typeahead are directly integrated in this file

console.log("[EasyApplyPlugin] Automation started third");

window.easyApplyStop = false;

// Helper to wait for a selector
/**
 * Waits for a specific DOM element, identified by a CSS selector, to be present.
 * @param {string} selector - The CSS selector for the target element.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @returns {Promise<Element>} A promise that resolves with the found element.
 * @throws {Error} If the element is not found within the timeout.
 */
function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                resolve(el);
            }
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error("Timeout waiting for selector: " + selector));
            }
        }, interval);
    });
}

/**
 * Checks if a given DOM element is currently visible on the page.
 * Considers CSS properties like display, visibility, opacity, and element dimensions.
 * @param {HTMLElement} element - The DOM element to check.
 * @returns {boolean} True if the element is visible, false otherwise or if an error occurs.
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
 * Safely get bounding client rect with error handling
 * @param {HTMLElement} element - The element to get rect for
 * @returns {DOMRect|null} - The bounding client rect or null if error
 */
function safeGetBoundingClientRect(element) {
    if (!element) return null;
    
    try {
        return element.getBoundingClientRect();
    } catch (error) {
        console.error('[EasyApplyPlugin] Error getting bounding client rect:', error);
        return null;
    }
}

/**
 * Check if a job card is already applied
 * @param {HTMLElement} card - The job card element
 * @returns {boolean} - Whether the job has already been applied
 */
function isJobAlreadyApplied(card) {
    if (!card) return false;
    
    try {
        // Check for 'Applied' text in the card
        const appliedText = Array.from(card.querySelectorAll('*'))
            .some(el => el.textContent && el.textContent.trim().toLowerCase() === 'applied');
        
        // Check for applied status indicator classes
        const hasAppliedClass = card.querySelector('.jobs-application-status--applied, .artdeco-inline-feedback--success');
        
        return appliedText || hasAppliedClass;
    } catch (error) {
        console.error('[EasyApplyPlugin] Error checking if job already applied:', error);
        return false;
    }
}

/**
 * Checks if the LinkedIn Easy Apply modal is currently visible on the page.
 * It looks for common selectors associated with the Easy Apply modal.
 * @returns {boolean} True if the modal is visible, false otherwise.
 */
function isModalVisible() {
    // Check for the Easy Apply modal container
    const modalSelectors = [
        '.jobs-easy-apply-content',
        '.jobs-easy-apply-modal',
        '.jobs-easy-apply-content__wrapper',
        '[data-test-modal]'
    ];
    
    for (const selector of modalSelectors) {
        const modal = document.querySelector(selector);
        if (modal && isElementVisible(modal)) {
            return true;
        }
    }
    return false;
}

// Function to check if the "Application sent" popup is visible
/**
 * Checks if the 'Application sent' confirmation popup is visible.
 * This typically appears after successfully submitting an application.
 * It verifies the modal's presence, header text, success icon, and confirmation message content.
 * Uses selectors defined in `window.EasyApplyConfig.selectors`.
 * @returns {boolean} True if the 'Application sent' popup is visible, false otherwise.
 */
function isApplicationSentPopupVisible() {
    try {
        // Get selectors from config
        const { applicationSentModal, applicationSentHeader, applicationSentSuccessIcon, applicationSentMessage } = window.EasyApplyConfig.selectors;
        
        // Look for the modal with specific attributes
        const modal = document.querySelector(applicationSentModal);
        if (!modal || !isElementVisible(modal)) return false;
        
        // Check for the header text "Application sent"
        const header = modal.querySelector(applicationSentHeader);
        if (!header || header.textContent.trim() !== 'Application sent') return false;
        
        // Check for success icon
        const successIcon = modal.querySelector(applicationSentSuccessIcon);
        if (!successIcon) return false;
        
        // Check for confirmation message
        const confirmationMsg = modal.querySelector(applicationSentMessage);
        if (!confirmationMsg || !confirmationMsg.textContent.includes('Your application was sent to')) return false;
        
        // All checks passed, this is the application sent popup
        return true;
    } catch (error) {
        console.error('[EasyApplyPlugin] Error checking for Application sent popup:', error);
        return false;
    }
}

/**
 * Waits for the LinkedIn Easy Apply modal to become visible on the page.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @returns {Promise<boolean>} A promise that resolves with true if the modal becomes visible.
 * @throws {Error} If the modal does not become visible within the timeout.
 */
async function waitForModalToBeVisible(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
            if (isModalVisible()) {
                clearInterval(timer);
                resolve(true);
            }
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error("Timeout waiting for modal to be visible"));
            }
        }, interval);
    });
}

/**
 * Waits for the LinkedIn Easy Apply modal to become hidden (no longer visible) on the page.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @returns {Promise<boolean>} A promise that resolves with true if the modal becomes hidden.
 * @throws {Error} If the modal does not become hidden within the timeout.
 */
async function waitForModalToBeHidden(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
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
 * Waits for the Easy Apply modal to transition to the next step in the application process.
 * It checks for changes in the form content or specific indicators of step progression.
 * @param {HTMLElement} currentStep - The current form or section element representing the current step.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @returns {Promise<boolean>} A promise that resolves with true if the next step is detected.
 * @throws {Error} If the next step is not detected within the timeout.
 */
async function waitForNextStep(currentStep, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
            // Check for different types of next steps
            const newForm = document.querySelector('form');
            const newResumeSection = document.querySelector('.jobs-document-upload-redesign-card__container');
            const newQuestionsSection = document.querySelector('.jobs-easy-apply-content__wrapper');
            
            // If we're on a resume step, wait for questions or review
            if (currentStep && currentStep.querySelector('.jobs-document-upload-redesign-card__container')) {
                if (newQuestionsSection || document.querySelector('button[aria-label*="Review"]')) {
                    clearInterval(timer);
                    resolve(true);
                }
            }
            // If we're on a questions step, wait for review or submit
            else if (currentStep && currentStep.querySelector('.jobs-easy-apply-content__wrapper')) {
                if (document.querySelector('button[aria-label*="Review"]') || 
                    document.querySelector('button[aria-label*="Submit"]')) {
                    clearInterval(timer);
                    resolve(true);
                }
            }
            // For other steps, check if form changed
            else if (newForm && newForm !== currentStep) {
                clearInterval(timer);
                resolve(true);
            }
            
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error("Timeout waiting for next step"));
            }
        }, interval);
    });
}

/**
 * Checks if there are any visible validation error messages within a given form.
 * Looks for elements with IDs ending in '-error' that contain text.
 * @param {HTMLFormElement} form - The form element to check for validation errors.
 * @returns {boolean} True if validation errors are found, false otherwise.
 */
function hasValidationErrors(form) {
    // Check for error messages
    const errorElements = form.querySelectorAll('[id$="-error"]');
    for (const error of errorElements) {
        if (error.innerText.trim()) {
            console.log('[EasyApplyPlugin] Found validation error:', error.innerText);
            return true;
        }
    }
    return false;
}

/**
 * Waits for a DOM element, identified by a CSS selector, to be present and visible on the page.
 * @param {string} selector - The CSS selector for the target element.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @returns {Promise<Element>} A promise that resolves with the found and visible element.
 * @throws {Error} If the element is not found or not visible within the timeout.
 */
async function waitForElementVisible(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el && isElementVisible(el)) {
                clearInterval(timer);
                resolve(el);
            }
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error("Timeout waiting for visible element: " + selector));
            }
        }, interval);
    });
}

/**
 * Attempts to fill various types of input fields within a given form.
 * This is a placeholder/basic implementation and currently fills fields with "Test Value" or selects the first available option.
 * It also checks if the modal disappears during the process.
 * @param {HTMLFormElement} form - The form element whose fields are to be filled.
 * @throws {Error} If the modal disappears or if validation errors are found after filling.
 */
async function fillFormFields(form) {
    console.log('[EasyApplyPlugin] Starting to fill form fields...');
    
    // Verify modal is still visible
    if (!isModalVisible()) {
        throw new Error('Modal disappeared while filling form');
    }
    
    // Fill text inputs
    const textInputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    for (const input of textInputs) {
        if (!input.value && isElementVisible(input)) {
            input.value = "Test Value";
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Filled text input: ${input.name || input.id}`);
            await new Promise(res => setTimeout(res, 500));
            
            // Verify modal is still visible after each input
            if (!isModalVisible()) {
                throw new Error('Modal disappeared while filling inputs');
            }
        }
    }

    // Fill selects
    const selects = form.querySelectorAll('select');
    for (const select of selects) {
        if (isElementVisible(select) && select.options.length > 1) {
            select.selectedIndex = 1;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Selected option for: ${select.name || select.id}`);
            await new Promise(res => setTimeout(res, 500));
        }
    }

    // Fill radios
    const radioGroups = {};
    form.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (!radioGroups[radio.name]) radioGroups[radio.name] = [];
        radioGroups[radio.name].push(radio);
    });

    for (const radios of Object.values(radioGroups)) {
        if (radios.some(r => isElementVisible(r)) && !radios.some(r => r.checked)) {
            radios[0].checked = true;
            radios[0].dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Checked radio: ${radios[0].name}`);
            await new Promise(res => setTimeout(res, 500));
        }
    }

    // Check for validation errors after filling
    if (hasValidationErrors(form)) {
        throw new Error('Validation errors found after filling form');
    }
}

/**
 * Finds and clicks a button on the page that matches the given text.
 * It prioritizes buttons with the 'data-easy-apply-next-button' attribute.
 * It also waits for the button to be enabled before clicking.
 * @param {string} text - The text content of the button to click (case-insensitive).
 * @returns {Promise<void>} A promise that resolves when the button is clicked.
 * @throws {Error} If the button is not found, not visible, or cannot be clicked.
 */
async function clickButtonByText(text) {
    // Log all visible buttons and their text
    const buttons = Array.from(document.querySelectorAll('button'));
    console.log('[EasyApplyPlugin] Visible buttons:');
    for (const btn of buttons) {
        if (isElementVisible(btn)) {
            const btnText = btn.innerText.trim().replace(/\s+/g, ' ');
            console.log(`  - [${btnText}] id=${btn.id} aria-label=${btn.getAttribute('aria-label') || ''} data-easy-apply-next-button=${btn.hasAttribute('data-easy-apply-next-button')}`);
        }
    }

    // Prefer button with data-easy-apply-next-button
    let targetBtn = buttons.find(btn =>
        isElementVisible(btn) &&
        btn.hasAttribute('data-easy-apply-next-button') &&
        (btn.innerText.trim().toLowerCase() === text.toLowerCase() ||
         (btn.querySelector('span.artdeco-button__text') && btn.querySelector('span.artdeco-button__text').innerText.trim().toLowerCase() === text.toLowerCase()))
    );

    // Fallback: match by text as before
    if (!targetBtn) {
        targetBtn = buttons.find(btn =>
            isElementVisible(btn) &&
            (btn.innerText.trim().toLowerCase() === text.toLowerCase() ||
             (btn.querySelector('span.artdeco-button__text') && btn.querySelector('span.artdeco-button__text').innerText.trim().toLowerCase() === text.toLowerCase()))
        );
    }

    if (targetBtn) {
        // Wait for button to be enabled
        let waited = 0;
        while (targetBtn.disabled && waited < 5000) {
            await new Promise(res => setTimeout(res, 100));
            waited += 100;
        }
        if (targetBtn.disabled) {
            console.log('[EasyApplyPlugin] Target button is still disabled after waiting.');
            return null;
        }
        targetBtn.click();
        return targetBtn;
    }
    return null;
}

/**
 * Waits for the main 'Easy Apply' button to appear on a LinkedIn job page.
 * This button initiates the Easy Apply modal.
 * @returns {Promise<Element>} A promise that resolves with the 'Easy Apply' button element.
 * @throws {Error} If the 'Easy Apply' button is not found within the timeout.
 */
async function waitForEasyApplyButton() {
    // Try multiple selectors for the Easy Apply button
    const selectors = [
        'button.jobs-apply-button',
        'button[data-control-name="jobdetails_topcard_inapply"]',
        'button[data-control-name="jobdetails_topcard_apply"]',
        'button[aria-label*="Easy Apply"]',
        'button span.artdeco-button__text:contains("Easy Apply")'
    ];
    
    for (const selector of selectors) {
        try {
            const buttons = Array.from(document.querySelectorAll(selector));
            for (const button of buttons) {
                // Skip filter button or any button with id='searchFilter_applyWithLinkedin' or aria-label containing 'Easy Apply filter.'
                if (
                    button.id === 'searchFilter_applyWithLinkedin' ||
                    (button.getAttribute('aria-label') && button.getAttribute('aria-label').toLowerCase().includes('easy apply filter'))
                ) {
                    continue;
                }
                if (button && button.innerText.includes("Easy Apply")) {
                    return button;
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

/**
 * Checks if a job card indicates that the job has already been applied to.
 * This version specifically checks the footer item of the job card for the text 'Applied'.
 * @param {HTMLElement} card - The job card element to check.
 * @returns {boolean} True if the 'Applied' status is found, false otherwise.
 */
function isJobAlreadyApplied(card) {
    // Check left pane for "Applied" status
    const appliedStatus = card.querySelector('.job-card-container__footer-item');
    if (appliedStatus && appliedStatus.innerText.includes('Applied')) {
        return true;
    }
    return false;
}

/**
 * Handles the resume selection step in the Easy Apply modal.
 * It waits for resume cards to be visible, checks if a resume is already selected,
 * and if not, selects the first available resume.
 * @returns {Promise<void>} A promise that resolves when resume selection is handled.
 * @throws {Error} If no resume cards are found or if selection fails.
 */
async function handleResumeSelection() {
    console.log('[EasyApplyPlugin] Handling resume selection step');
    
    // Wait for resume cards to be visible
    await waitForElementVisible('.jobs-document-upload-redesign-card__container', 5000);
    
    // Find all resume cards
    const resumeCards = Array.from(document.querySelectorAll('.jobs-document-upload-redesign-card__container'));
    if (resumeCards.length === 0) {
        throw new Error('No resume cards found');
    }
    
    // Check if any resume is already selected
    const selectedCard = resumeCards.find(card => 
        card.classList.contains('jobs-document-upload-redesign-card__container--selected')
    );
    
    if (selectedCard) {
        console.log('[EasyApplyPlugin] Found pre-selected resume, keeping selection');
        // Verify the radio button is checked
        const radioInput = selectedCard.querySelector('input[type="radio"]');
        if (radioInput && !radioInput.checked) {
            radioInput.checked = true;
            radioInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else {
        console.log('[EasyApplyPlugin] No resume selected, selecting first available resume');
        // Only select a resume if none is selected
        const firstCard = resumeCards[0];
        const radioInput = firstCard.querySelector('input[type="radio"]');
        if (radioInput) {
            radioInput.checked = true;
            radioInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    // Wait a moment for the selection to register
    await new Promise(res => setTimeout(res, 1000));
    
    // Verify selection is still valid
    const stillSelected = document.querySelector('.jobs-document-upload-redesign-card__container--selected');
    if (!stillSelected) {
        throw new Error('Resume selection failed');
    }
}

/**
 * Waits for a button with specific text to become visible and available within a given container.
 * @param {string} text - The text content of the button to find (case-insensitive).
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait.
 * @param {HTMLElement|Document} [container=document] - The DOM element to search within.
 * @returns {Promise<HTMLElement>} A promise that resolves with the found button element.
 * @throws {Error} If the button is not found, the container is not in DOM, or a timeout occurs.
 */
async function waitForButtonByText(text, timeout = 10000, container = document) {
    return new Promise((resolve, reject) => {
        const interval = 200;
        let elapsed = 0;
        const timer = setInterval(() => {
            // First check if container still exists in DOM and is accessible
            if (!container || !container.isConnected) {
                clearInterval(timer);
                reject(new Error(`Container no longer in DOM when searching for button: ${text}`));
                return;
            }
            
            // Safely query buttons with try/catch
            let buttons = [];
            try {
                buttons = Array.from(container.querySelectorAll('button'));
            } catch (err) {
                console.warn(`[EasyApplyPlugin] Error querying buttons in container: ${err.message}`);
                clearInterval(timer);
                reject(new Error(`Error querying buttons: ${err.message}`));
                return;
            }
            
            // Safely find matching button
            const btn = buttons.find(b => {
                try {
                    return isElementVisible(b) &&
                           (b.innerText.trim().toLowerCase() === text.toLowerCase() ||
                           (b.querySelector('span.artdeco-button__text') && 
                            b.querySelector('span.artdeco-button__text').innerText.trim().toLowerCase() === text.toLowerCase()));
                } catch (err) {
                    console.warn(`[EasyApplyPlugin] Error checking button: ${err.message}`);
                    return false;
                }
            });
            if (btn) {
                clearInterval(timer);
                resolve(btn);
            }
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error(`Timeout waiting for button: ${text}`));
            }
        }, interval);
    });
}

/**
 * Manages the overall Easy Apply form submission process within the modal.
 * This function orchestrates steps like waiting for the modal, filling fields (delegated to fillAllBlankFieldsInModal),
 * clicking 'Next'/'Review', handling resume selection, and finally submitting the application.
 * It includes retry logic for various actions and uses configuration from `window.EasyApplyConfig`.
 * It also handles stopping the automation if `window.easyApplyStop` is true.
 * @returns {Promise<void>} A promise that resolves when the form handling is complete or stopped.
 */
async function handleEasyApplyForm() {
    // Ensure config loaded
    if (!window.EasyApplyConfig || !window.EasyApplyConfig.retries) {
        console.error('[EasyApplyPlugin] Config or retries undefined');
        window.easyApplyStop = true;
        return;
    }
    
    let step = 1;
    let modalClosed = false;
    const loggedBlankFields = new Set();

    try {
        // Retry logic for waiting for modal to be visible
        const modalRetries = window.EasyApplyConfig.retries.modalVisibility;
        const modalTimeout = window.EasyApplyConfig.timeouts.modalVisibilityTimeout * 1000;
        let modalVisible = false;
        for (let attempt = 0; attempt < modalRetries; attempt++) {
            try {
                await waitForModalToBeVisible(modalTimeout);
                modalVisible = true;
                break;
            } catch (e) {
                console.log(`[EasyApplyPlugin] Modal not visible (attempt ${attempt + 1}), waiting ${window.EasyApplyConfig.timeouts.modalVisibilityTimeout}s before retry...`);
                await new Promise(res => setTimeout(res, modalTimeout));
            }
        }
        if (!modalVisible) {
            console.log('[EasyApplyPlugin] Failed to detect modal after ' + modalRetries + ' attempts, stopping.');
            window.easyApplyStop = true;
            return;
        }
        console.log('[EasyApplyPlugin] Initial modal is visible');

        // Step 1: Fill fields and click Next/Review until we see Review or Submit
        let nextClickCount = 0;
        while (true) {
            if (window.easyApplyStop) {
                console.log('[EasyApplyPlugin] Automation stopped by user during form handling.');
                return;
            }
            const btnTimeout = window.EasyApplyConfig.timeouts.buttonClickTimeout * 1000;
            let nextBtn = await waitForButtonByText('Next', btnTimeout, document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper')).catch(() => null);
            let reviewBtn = await waitForButtonByText('Review', btnTimeout, document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper')).catch(() => null);
            if (nextBtn || reviewBtn) {
                let btn = nextBtn || reviewBtn;
                let prevModal = document.querySelector('.jobs-easy-apply-content, .jobs-easy-apply-modal, .jobs-easy-apply-content__wrapper, [data-test-modal]');
                let prevModalHtml = prevModal ? prevModal.innerHTML : '';
                let prevBtn = btn;
                let changed = false;
                const stepRetries = window.EasyApplyConfig.retries.nextButtonClick;
                for (let retry = 0; retry < stepRetries; retry++) {
                    if (window.easyApplyStop) {
                        console.log('[EasyApplyPlugin] Automation stopped by user during step change wait.');
                        return;
                    }
                    // Initial fill attempt for this step (or if it's the first iteration of the retry loop)
                    if (retry === 0) { // Only do the full fill logic on the first attempt of this specific button click retry cycle
                        const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper');
                        if (modal && btn && btn.innerText.trim().toLowerCase() !== 'done') {
                            console.log('[EasyApplyPlugin] Attempting to fill fields before Next/Review click...');
                            const { userCV, geminiApiKey, qaCache } = await new Promise(resolve => chrome.storage.local.get(['userCV', 'geminiApiKey', 'qaCache'], resolve));
                            await fillAllBlankFieldsInModal(modal, qaCache || {}, userCV, geminiApiKey, loggedBlankFields);
                            // Wait for fields to be filled (up to 2s)
                            let allFilled = false;
                            for (let waitTry = 0; waitTry < 10; waitTry++) {
                                allFilled = true;
                                const fields = Array.from(modal.querySelectorAll('input, select, textarea'));
                                for (const field of fields) {
                                    if (field.offsetParent === null) continue;
                                    let isBlank = false;
                                    if (field.type === 'checkbox' || field.type === 'radio') {
                                        isBlank = !field.checked;
                                    } else if (field.tagName === 'SELECT') {
                                        isBlank = field.selectedIndex === 0 || field.value === '' || field.value === 'Select an option';
                                    } else {
                                        isBlank = !field.value;
                                    }
                                    // Check for required attribute or visible error message as well
                                    let isActuallyRequired = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true';
                                    if (!isActuallyRequired && field.closest) {
                                        const container = field.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, .artdeco-form__item, .jobs-easy-apply-form-section__grouping--required, .jobs-easy-apply-form-section__grouping--is-required, fieldset');
                                        if (container) {
                                            const errorEl = container.querySelector('[id$="-error"], .artdeco-inline-feedback'); // Added .artdeco-inline-feedback
                                            if (errorEl && errorEl.offsetParent !== null && errorEl.innerText.trim() !== '') isActuallyRequired = true;
                                        }
                                    }

                                    if (isBlank && isActuallyRequired && !loggedBlankFields.has(field.id || field.name)) {
                                        loggedBlankFields.add(field.id || field.name);
                                        console.warn('[EasyApplyPlugin] Field still blank after Gemini (and is required):', field, `Label: ${field.labels ? field.labels[0]?.innerText : 'N/A'}`);
                                        allFilled = false;
                                        break; // Found a blank required field, no need to check others
                                    }
                                }
                                if (allFilled) break;
                                await new Promise(resolve => setTimeout(resolve, window.EasyApplyConfig.timeouts.betweenFieldCheckDelay * 1000));
                            }
                            if (!allFilled) console.warn('[EasyApplyPlugin] Proceeding with Next/Review click despite some required fields potentially remaining blank after filling attempt.');
                        }
                    }

                    // Re-check for button in case it disappeared
                    btn = await waitForButtonByText(prevBtn.innerText, 100).catch(() => null);
                    if (!btn) {
                        console.log('[EasyApplyPlugin] Next/Review button disappeared, trying to find Submit or Done.');
                        break; // Exit retry loop, outer loop will re-evaluate
                    }

                    console.log(`[EasyApplyPlugin] Clicking ${btn.innerText} button (attempt ${retry + 1}/${stepRetries}), waiting ${window.EasyApplyConfig.timeouts.betweenButtonClicksDelay * 1000 / 1000}s...`);
                    btn.click();
                    await new Promise(resolve => setTimeout(resolve, window.EasyApplyConfig.timeouts.betweenButtonClicksDelay * 1000));
                    
                    // Check if modal content changed
                    let currentModal = document.querySelector('.jobs-easy-apply-content, .jobs-easy-apply-modal, .jobs-easy-apply-content__wrapper, [data-test-modal]');
                    let currentModalHtml = currentModal ? currentModal.innerHTML : '';
                    if (currentModalHtml !== prevModalHtml) {
                        changed = true;
                        nextClickCount++;
                        console.log(`[EasyApplyPlugin] Step changed after ${nextClickCount} Next/Review clicks. (Maximum: ${window.EasyApplyConfig.retries.maxFormSteps})`);
                        break;
                    } else {
                        console.log(`[EasyApplyPlugin] Modal content did not change (retry ${retry + 1}/${stepRetries}), waiting ${window.EasyApplyConfig.timeouts.betweenButtonClicksDelay * 1000 / 1000}s before next attempt...`);
                        // If modal didn't change, it's likely due to validation errors. Re-fill fields before next attempt.
                        const modalToReFill = document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper');
                        if (modalToReFill && btn && btn.innerText.trim().toLowerCase() !== 'done') {
                            console.log('[EasyApplyPlugin] Re-attempting to fill fields due to unchanged modal content...');
                            const { userCV, geminiApiKey, qaCache } = await new Promise(resolve => chrome.storage.local.get(['userCV', 'geminiApiKey', 'qaCache'], resolve));
                            await fillAllBlankFieldsInModal(modalToReFill, qaCache || {}, userCV, geminiApiKey, loggedBlankFields); // Use modalToReFill
                            await new Promise(resolve => setTimeout(resolve, 500)); // Short delay after re-filling
                        }
                    }


                    if (retry < stepRetries - 1) { // Don't wait on the last retry
                        const retryWait = 2000 + Math.floor(Math.random() * 2000);
                        console.log(`[EasyApplyPlugin] Modal content did not change (retry ${retry + 1}/${stepRetries}), waiting ${retryWait / 1000}s before next attempt...`);
                        await new Promise(res => setTimeout(res, retryWait));
                    }
                }
                if (!changed) {
                    console.log(`[EasyApplyPlugin] Step did not change after ${stepRetries} attempts. Stopping automation.`);
                    window.easyApplyStop = true;
                    return;
                } else {
                    nextClickCount++;
                    const maxSteps = window.EasyApplyConfig.retries.maxFormSteps || 10;
                    if (nextClickCount > maxSteps) {
                        console.log(`[EasyApplyPlugin] Too many Next/Review clicks on this modal (${nextClickCount}/${maxSteps}). Stopping automation.`);
                        window.easyApplyStop = true;
                        return;
                    }
                    console.log(`[EasyApplyPlugin] Step changed after ${nextClickCount} Next/Review clicks. (Maximum: ${maxSteps})`);
                }
                step++;
                continue;
            }
            // Commented out Submit application button handling as it's not consistently appearing
            // Instead, check directly for the Done button which appears after application is submitted
            // let submitBtn = await waitForButtonByText('Submit application', 5000, document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper')).catch(() => null);
            
            // Look for the Done button directly
            let doneBtn = await waitForButtonByText('Done', window.EasyApplyConfig.timeouts.doneButtonModalPolling * 1000).catch(() => null);
            if (doneBtn) {
                console.log('[EasyApplyPlugin] Found Done button, clicking to complete application...');
                doneBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(res => setTimeout(res, 500));
                doneBtn.click();
                console.log('[EasyApplyPlugin] Clicked Done button, application should be complete.');
                await new Promise(res => setTimeout(res, 2000));
                break;
            }
            
            // If we're here, we didn't find a Done button, check for Review or Submit buttons
            let checkReviewBtn = await waitForButtonByText('Review', 2000).catch(() => null);
            let submitBtn = await waitForButtonByText('Submit application', 2000).catch(() => null);
            
            if (submitBtn) {
                console.log('[EasyApplyPlugin] Found Submit application button, clicking...');
                // Always fill blank fields before clicking Submit
                const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal], .jobs-easy-apply-content, .jobs-easy-apply-content__wrapper');
                if (modal) {
                    const { userCV, geminiApiKey, qaCache } = await new Promise(resolve => chrome.storage.local.get(['userCV', 'geminiApiKey', 'qaCache'], resolve));
                    await fillAllBlankFieldsInModal(modal, qaCache || {}, userCV, geminiApiKey, loggedBlankFields);
                }
                
                submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(res => setTimeout(res, 500));
                submitBtn.click();
                console.log(`[EasyApplyPlugin] Clicked 'Submit application', waiting 3 seconds...`);
                await new Promise(res => setTimeout(res, 3000));
                continue; // Continue the loop to find the Done button in the next iteration
            }
            
            // If Done not found, try close/cross buttons
            // Removed fallback X-dismiss block
            continue;
        }
        
        // If we get here, no buttons were found
        console.log('[EasyApplyPlugin] No Next/Review/Submit button found, ending form handling.');
        return;
    } catch (error) {
        console.error('[EasyApplyPlugin] Error in handleEasyApplyForm:', error);
        return false;
    } // End of handleEasyApplyForm function
}

/**
 * Retrieves all job card elements from the current LinkedIn job search results page.
 * It specifically targets `<li>` elements that contain a job posting card link.
 * @returns {Promise<HTMLElement[]>} A promise that resolves with an array of job card HTMLElements.
 */
async function getJobCards() {
    // Only select <li> elements with a job card link (ignore filter buttons)
    return Array.from(document.querySelectorAll('li.scaffold-layout__list-item'))
        .filter(li => li.querySelector('.job-card-job-posting-card-wrapper__card-link'));
}

/**
 * Extracts the URL of the job posting from a given job card element.
 * @param {HTMLElement} card - The job card element.
 * @returns {string|null} The URL of the job posting, or null if not found.
 */
function getJobCardUrl(card) {
    const link = card.querySelector('.job-card-job-posting-card-wrapper__card-link');
    return link ? link.href : null;
}

/**
 * Checks if a given job card is an 'Easy Apply' job.
 * It searches for the text 'Easy Apply' within any descendant element of the card.
 * @param {HTMLElement} card - The job card element to check.
 * @returns {boolean} True if the card is an 'Easy Apply' job, false otherwise.
 */
function isEasyApplyCard(card) {
    // Check if any descendant element contains the text 'Easy Apply'
    return Array.from(card.querySelectorAll('*')).some(el => el.textContent && el.textContent.trim().includes('Easy Apply'));
}

/**
 * Check if there is a next page button in the pagination controls
 * @returns {HTMLElement|null} - The next page button element or null if not found
 */
function getNextPageButton() {
    // Get the pagination controls
    const paginationContainer = document.querySelector('.jobs-search-pagination__pages');
    if (!paginationContainer) {
        console.log('[EasyApplyPlugin] No pagination container found');
        return null;
    }
    
    // Find the active page indicator
    const activePage = paginationContainer.querySelector('.jobs-search-pagination__indicator-button--active');
    if (!activePage) {
        console.log('[EasyApplyPlugin] No active page indicator found');
        return null;
    }
    
    // Get the page number
    const activePageNumber = parseInt(activePage.textContent.trim());
    if (isNaN(activePageNumber)) {
        console.log('[EasyApplyPlugin] Could not parse active page number');
        return null;
    }
    
    console.log(`[EasyApplyPlugin] Current page: ${activePageNumber}`);
    
    // Find the next page button - either with explicit 'Next' text or page number + 1
    const nextPageButton = Array.from(paginationContainer.querySelectorAll('button'))
        .find(btn => {
            // Check if it's a 'Next' button
            if (btn.getAttribute('aria-label')?.includes('Next')) return true;
            
            // Check if it's the next page number
            const btnText = btn.textContent.trim();
            const btnNumber = parseInt(btnText);
            return !isNaN(btnNumber) && btnNumber === activePageNumber + 1;
        });
    
    if (nextPageButton) {
        console.log(`[EasyApplyPlugin] Found next page button: ${nextPageButton.textContent.trim()}`);
    } else {
        console.log('[EasyApplyPlugin] No next page button found - likely on last page');
    }
    
    return nextPageButton;
}

/**
 * Navigate to the next page of job results
 * @returns {Promise<boolean>} - Whether navigation was successful
 */
async function goToNextPage() {
    const nextPageButton = getNextPageButton();
    if (!nextPageButton) {
        console.log('[EasyApplyPlugin] No next page button found, cannot navigate');
        return false;
    }
    
    try {
        // Scroll to the button and click it
        nextPageButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(res => setTimeout(res, 1000));
        
        console.log('[EasyApplyPlugin] Clicking next page button');
        nextPageButton.click();
        
        // Wait for page to load
        console.log('[EasyApplyPlugin] Waiting for next page to load...');
        await new Promise(res => setTimeout(res, 10000));
        
        return true;
    } catch (error) {
        console.error('[EasyApplyPlugin] Error navigating to next page:', error);
        return false;
    }
}

/**
 * Extracts the job title and company name from a job card element.
 * @param {HTMLElement} card - The job card element.
 * @returns {{title: string, company: string}} An object containing the job title and company name.
 */
function getJobCardInfo(card) {
    const titleEl = card.querySelector('.job-card-job-posting-card-wrapper__title');
    // Prefer <div dir="ltr"> for company name if available
    let companyEl = card.querySelector('.job-card-job-posting-card-wrapper__subtitle div[dir="ltr"]');
    if (!companyEl) companyEl = card.querySelector('.job-card-job-posting-card-wrapper__subtitle');
    return {
        title: titleEl ? titleEl.innerText.trim() : '',
        company: companyEl ? companyEl.innerText.trim() : ''
    };
}

/**
 * Extracts the job title and company name from the right-hand job details pane.
 * @returns {{title: string, company: string}} An object containing the job title and company name from the details pane.
 */
function getRightPaneJobInfo() {
    const titleEl = document.querySelector('.jobs-details-top-card__job-title, .top-card-layout__title');
    // Prefer <a data-test-app-aware-link> for company name if available
    let companyEl = document.querySelector('.jobs-details-top-card__company-url a[data-test-app-aware-link], .topcard__org-name-link a[data-test-app-aware-link], .topcard__flavor-row a[data-test-app-aware-link]');
    if (!companyEl) companyEl = document.querySelector('a[data-test-app-aware-link]');
    if (!companyEl) companyEl = document.querySelector('.jobs-details-top-card__company-url div[dir="ltr"], .topcard__org-name-link div[dir="ltr"], .topcard__flavor-row a div[dir="ltr"]');
    if (!companyEl) companyEl = document.querySelector('.jobs-details-top-card__company-url, .topcard__org-name-link, .topcard__flavor-row a');
    return {
        title: titleEl ? titleEl.innerText.trim() : '',
        company: companyEl ? companyEl.innerText.trim() : ''
    };
}

/**
 * Waits for the job details in the right-hand pane to match the information from a selected job card.
 * This is used to ensure the correct job details are loaded before proceeding with actions like 'Easy Apply'.
 * @param {{title: string, company: string}} cardInfo - An object containing the title and company from the job card.
 * @param {number} [timeout=10000] - Maximum time in milliseconds to wait for the match.
 * @returns {Promise<boolean>} A promise that resolves with true if the pane matches, or rejects on timeout.
 */
async function waitForRightPaneToMatch(cardInfo, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 200;
        let elapsed = 0;
        const timer = setInterval(() => {
            const rightInfo = getRightPaneJobInfo();
            if (
                rightInfo.title && rightInfo.company &&
                rightInfo.title.toLowerCase().includes(cardInfo.title.toLowerCase().slice(0, 10)) &&
                rightInfo.company.toLowerCase().includes(cardInfo.company.toLowerCase().slice(0, 5))
            ) {
                clearInterval(timer);
                resolve(true);
            }
            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(new Error('Timeout waiting for right pane to match job card'));
            }
        }, interval);
    });
}

/**
 * Fetches an answer from the Gemini API for a given question, using the user's CV and Q&A cache.
 * It constructs a prompt tailored to the type of question (e.g., options list, numeric, summary, cover letter).
 * @param {string} question - The question to ask the Gemini API.
 * @param {string} cv - The user's CV text.
 * @param {string} apiKey - The Gemini API key.
 * @param {string[]|null} [optionsList=null] - A list of predefined options for the answer, if applicable.
 * @param {boolean} [numericOnly=false] - Whether the answer should be strictly numeric.
 * @param {Object<string, string>|null} [qaCache=null] - A cache of previous questions and answers.
 * @param {boolean} [isSummaryField=false] - Whether the question is for a summary/text area requiring a detailed response.
 * @param {boolean} [isSpecificallyCoverLetter=false] - Whether the question is specifically for a cover letter.
 * @returns {Promise<string>} A promise that resolves with the answer from the Gemini API, or a fallback/default value in case of error.
 */
async function getGeminiAnswer(question, cv, apiKey, optionsList = null, numericOnly = false, qaCache = null, isSummaryField = false, isSpecificallyCoverLetter = false) {
    let prompt = `My CV: ${cv}`;
    if (qaCache && Object.keys(qaCache).length > 0) {
        const qaPairs = Object.entries(qaCache).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n');
        prompt += `\n\nPrevious Q&A:\n${qaPairs}`;
    }
    prompt += `\n\nQuestion: ${question}`;
    if (optionsList && optionsList.length) {
        prompt += `\nOptions: ${optionsList.join(', ')}`;
        prompt += `\nPlease answer ONLY with the most relevant option from the list above, based on my CV, and nothing else.`;
    } else if (numericOnly) {
        prompt += `\nPlease answer only with a number, no text or explanation.`;
    } else if (isSpecificallyCoverLetter) {
        prompt += `\nBased on my CV, please write a compelling and detailed cover letter of at least 300-400 words. The field is labeled '${question}'. Ensure the tone is professional and tailored as if applying for a job.`;
    } else if (isSummaryField) {
        prompt += `\nPlease provide a comprehensive and detailed response of at least 300-400 words, based on the provided CV, for the question '${question}'.`;
    } else {
        prompt += `\nPlease answer only with the most relevant value, no explanation.`;
    }
    prompt += `\n\nAnswer:`;
    try {
        console.log('[EasyApplyPlugin] Gemini API prompt:', { question, options: optionsList, numericOnly, isSummaryField, isSpecificallyCoverLetter });
        console.log('[EasyApplyPlugin] Waiting for Gemini response (timeout: 5s)...');
        
        // Create a promise that rejects after 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Gemini API timeout after 5 seconds')), 5000);
        });

        // Create the API call promise
        const geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
        console.log('[EasyApplyPlugin] Calling Gemini API at:', geminiApiUrl.split('?')[0] + '?key=REDACTED');
        
        const apiCallPromise = fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        // Race between the API call and the timeout
        const response = await Promise.race([apiCallPromise, timeoutPromise]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[EasyApplyPlugin] Gemini raw response:', data);
        
        if (data.error) {
            throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        const geminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[EasyApplyPlugin] Gemini response is >>>', geminiAnswer);
        return geminiAnswer;
    } catch (e) {
        console.error('[EasyApplyPlugin] Gemini API error:', e);
        
        // Network error fallback for experience fields
        if (numericOnly) {
            console.log('[EasyApplyPlugin] Network error with numeric field - returning default value: 100000');
            return '100000'; // Default value for salary/numeric fields when API fails
        }
        
        // Check if this might be an experience-related question based on keywords
        if (/experience|years|how long|how many years|expertise/i.test(question)) {
            const defaultExperience = window.EasyApplyConfig?.defaults?.experienceYears || 4;
            console.log(`[EasyApplyPlugin] Experience field detected with 0 or no experience. Using default value from config: ${defaultExperience}`);
            return String(defaultExperience);
        }
        
        // Generic fallback
        console.log('[EasyApplyPlugin] Returning empty string due to API error');
        return '';
    }
}

/**
 * Tests the connectivity and validity of the provided Gemini API key.
 * It sends a simple request to the Gemini API and checks for a successful response.
 * @param {string} apiKey - The Gemini API key to test.
 * @returns {Promise<boolean>} A promise that resolves with true if the API key is valid and connectivity is successful, false otherwise.
 */
async function testGeminiApi(apiKey) {
    const prompt = "Tell me your name";
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    const data = await response.json();
    console.log('[EasyApplyPlugin] Gemini test response:', data);
}

/**
 * Iterates through all visible input, select, and textarea fields within the provided modal,
 * identifies blank ones, and attempts to fill them using various strategies.
 * - For most fields, it queries the Gemini API for an appropriate answer based on the field's label and the user's CV.
 * - Handles special field types like location, years of experience, and terms/conditions checkboxes with specific logic.
 * - Manages a Q&A cache to store and reuse Gemini's answers for similar questions.
 * - Skips fields that are not visible or are part of an already processed radio/checkbox group.
 * - Logs fields that are found to be blank to avoid redundant processing if the function is called multiple times.
 * @param {HTMLElement} modal - The modal element containing the form fields to be filled.
 * @param {Object<string, string>} cache - The Q&A cache object to read from and write to.
 * @param {string} userCV - The user's CV text to be used by the Gemini API.
 * @param {string} geminiApiKey - The API key for the Gemini service.
 * @param {Set<string>} [loggedBlankFields=new Set()] - A set to keep track of fields already identified and logged as blank in the current session to prevent re-processing.
 * @returns {Promise<void>} A promise that resolves when all attempts to fill blank fields are complete.
 */
async function fillAllBlankFieldsInModal(modal, cache, userCV, geminiApiKey, loggedBlankFields = new Set()) {
    const experienceKeywords = ['year of experience', 'years of experience', 'experience in', 'experience as', 'how many years', 'duration of experience'];
    const summaryKeywords = ['summary', 'describe', 'explain', 'detail', 'elaborate', 'cover letter', 'bio', 'introduction', 'overview', 'additional information', 'tell us about', 'why are you interested'];

    if (!modal) {
        console.log('[EasyApplyPlugin] No modal found for blank field filling.');
        return;
    }
    // Find all required fields in the modal
    const fields = Array.from(modal.querySelectorAll('input, select, textarea'));
    // Log all input, select, and textarea fields and their blank/filled status
    console.log('[EasyApplyPlugin][FieldScan] Starting field scan within modal...');
    for (const field of fields) { // `fields` already includes input, select, textarea
        // Try to get label more robustly
        let label = '';
        if (field.id) {
            const labelEl = modal.querySelector(`label[for='${field.id}']`);
            if (labelEl) label = labelEl.innerText.trim();
        }
        if (!label && field.getAttribute('aria-label')) {
            label = field.getAttribute('aria-label');
        }
        if (!label && field.name) {
            label = field.name;
        }
        if (!label && field.closest) { // Try to find a nearby label text if no direct association
            let parentLabelElement = field.closest('div, fieldset, .artdeco-form__item, .fb-dash-form-element');
            if (parentLabelElement) {
                const potentialLabel = parentLabelElement.querySelector('label, .fb-form-element-label, .artdeco-form-item__label, .jobs-form-element__label');
                if (potentialLabel && potentialLabel.innerText) {
                    // Ensure this label isn't for a different specific input within the same group
                    if (!potentialLabel.hasAttribute('for') || potentialLabel.getAttribute('for') === field.id) {
                         label = potentialLabel.innerText.trim();
                    }
                }
            }
        }
        if (!label) label = field.id || field.name || '[unknown field]';

        let isBlank = false;
        let valueToShow = field.value;
        const fieldType = field.type ? field.type.toLowerCase() : field.tagName.toLowerCase();

        if (fieldType === 'checkbox' || fieldType === 'radio') {
            isBlank = !field.checked;
            valueToShow = field.checked ? 'checked' : 'unchecked';
        } else if (fieldType === 'select') {
            isBlank = field.selectedIndex === -1 || field.value === '' || (field.options[field.selectedIndex] && (field.options[field.selectedIndex].text.toLowerCase().includes('select an option') || field.options[field.selectedIndex].text.trim() === ''));
            valueToShow = field.selectedIndex > -1 ? field.options[field.selectedIndex].text : '(no selection or placeholder)';
        } else { // Handles INPUT type=text, TEXTAREA, etc.
            isBlank = !field.value;
        }

        if (isBlank) {
            console.log(`[EasyApplyPlugin][FieldScan] Field: "${label}" (id: ${field.id || 'N/A'}, name: ${field.name || 'N/A'}, type: ${fieldType}) — BLANK`);
        } else {
            console.log(`[EasyApplyPlugin][FieldScan] Field: "${label}" (id: ${field.id || 'N/A'}, name: ${field.name || 'N/A'}, type: ${fieldType}) — FILLED: ${valueToShow}`);
        }
    }
    let blanks = [];
    // Track processed radio/checkbox groups by name
    const processedGroups = new Set();
    for (const field of fields) {
        // Only visible fields
        if (field.offsetParent === null) continue;
        // Only fill if required (look for a span[data-test-text-entity-list-form-required] in the same form group/container)
        let isRequired = false;
        let container = field.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, .artdeco-form__item, .jobs-easy-apply-form-section__grouping--required, .jobs-easy-apply-form-section__grouping--is-required, fieldset');
        if (!container) container = field.parentElement;
        // Check for required markers
        if (container && (
            container.querySelector('span[data-test-text-entity-list-form-required], [data-test-text-entity-list-form-required], [data-test-form-required], .form-required, [data-test-form-builder-radio-button-form-component__required]')
            || container.querySelector('.fb-dash-form-element__label-title--is-required')
        )) {
            isRequired = true;
        }
        // Also check for required attribute as fallback
        if (field.hasAttribute('required') || field.getAttribute('aria-required') === 'true') isRequired = true;
        // Check for error element with id ending in -error and visible
        if (container) {
            const errorEl = container.querySelector('[id$="-error"]');
            if (errorEl && errorEl.offsetParent !== null) isRequired = true;
        }
        if (!isRequired) continue;

        // Attempt to get the label for the current field for special handling
        let specialHandlerLabelText = '';
        if (field.id) {
            const labelEl = modal.querySelector(`label[for='${field.id}']`);
            if (labelEl) specialHandlerLabelText = labelEl.innerText.trim();
        }
        if (!specialHandlerLabelText && field.closest) { // More robust search up the DOM for a general label
            let currentElement = field;
            for (let i = 0; i < 3; i++) { // Look up 3 levels
                const parent = currentElement.parentElement;
                if (!parent) break;
                // Try to find a label element that is not directly for another input (more generic)
                const labelElements = parent.querySelectorAll('label, .fb-form-element-label, .artdeco-form-item__label, .jobs-form-element__label, .form-label');
                for(const labelEl of labelElements) {
                    if (!labelEl.hasAttribute('for') || labelEl.getAttribute('for') === field.id) {
                         // Check if this label is not inside another form element that is not the current field's container
                        const closestFormField = labelEl.closest('.artdeco-form__item, .jobs-easy-apply-form-section__grouping, .fb-dash-form-element');
                        if (closestFormField && closestFormField.contains(field)) {
                            specialHandlerLabelText = labelEl.innerText.trim();
                            break;
                        }
                    }
                }
                if (specialHandlerLabelText) break;
                currentElement = parent;
            }
        }
        if (!specialHandlerLabelText) specialHandlerLabelText = field.getAttribute('aria-label') || field.placeholder || field.name || field.id || '[unknown_field_for_special_handling]';
        console.log(`[EasyApplyPlugin][Debug] Field ID: ${field.id}, Tag: ${field.tagName}, Type: ${field.type}, Extracted Label for Special Handling: "${specialHandlerLabelText}"`);
        
        // Special handling for text inputs and textareas (experience and summary)
        if ((field.tagName === 'INPUT' && !['radio', 'checkbox', 'button', 'submit', 'reset', 'file', 'hidden', 'image'].includes(field.type)) || field.tagName === 'TEXTAREA') {
                if (field.value && field.value.trim() !== '') {
                    console.log(`[EasyApplyPlugin][Debug] Field "${specialHandlerLabelText}" already filled with "${field.value}". Skipping special handling.`);
                } else if (field.matches(window.EasyApplyConfig.selectors.typeaheadField)) {
                    console.log(`[EasyApplyPlugin][Debug] Field "${specialHandlerLabelText}" is typeahead. Skipping special handling.`);
                } else {
                    let isExperienceField = false;
                    let isSummaryField = false;
                    const lowerLabel = specialHandlerLabelText.toLowerCase();
                    console.log(`[EasyApplyPlugin][Debug] Lowercase label for matching: "${lowerLabel}"`);

                    if (field.type === 'number' || experienceKeywords.some(keyword => lowerLabel.includes(keyword))) {
                        console.log(`[EasyApplyPlugin][Debug] Field type is number: ${field.type === 'number'}. Keyword match for experience: ${experienceKeywords.some(keyword => lowerLabel.includes(keyword))}`);
                        isExperienceField = true;
                    }
                    // Summary field can be textarea or input matching keywords. Prioritize textarea.
                    if (field.tagName === 'TEXTAREA' || summaryKeywords.some(keyword => lowerLabel.includes(keyword))) {
                        console.log(`[EasyApplyPlugin][Debug] Field is TEXTAREA: ${field.tagName === 'TEXTAREA'}. Keyword match for summary: ${summaryKeywords.some(keyword => lowerLabel.includes(keyword))}`);
                        isSummaryField = true;
                        if (field.tagName === 'TEXTAREA') isExperienceField = false; // Textarea is primarily for summary text
                    }

                    let geminiCalledForSpecialField = false;

                    if (isExperienceField || isSummaryField) {
                        // This block handles experience and summary fields, which might be INPUT or TEXTAREA
                        // 'answer' is already declared in the outer scope of the forEach loop, reuse it.
                        geminiCalledForSpecialField = false; // Reset for this field

                        // Check cache first. If found, 'answer' will be updated from the outer scope's initial cache check.
                        if (cache[specialHandlerLabelText]) {
                            answer = cache[specialHandlerLabelText];
                            console.log(`[EasyApplyPlugin][Debug][SpecialHandling] Found "${specialHandlerLabelText}" in cache: "${answer ? String(answer).substring(0,50)+'...' : '(empty)'}"`);
                        } else {
                            // If not in cache, 'answer' from outer scope is initially undefined or from a previous non-special field's Gemini call.
                            // We need to ensure it's explicitly undefined before specific Gemini calls for special fields if not cached.
                            answer = undefined; 
                        }

                        if (isExperienceField) {
                            console.log(`[EasyApplyPlugin][Debug] Field "${specialHandlerLabelText}" (type: ${field.type}) IDENTIFIED as EXPERIENCE field.`);
                            if (answer === undefined) { // Only call Gemini if not found in cache
                                console.log(`[EasyApplyPlugin][Debug] Calling Gemini for EXPERIENCE field (not found in cache). Question: "${specialHandlerLabelText}"`);
                                answer = await getGeminiAnswer(specialHandlerLabelText, userCV, geminiApiKey, null, true, cache, false, false);
                                geminiCalledForSpecialField = true;
                            }
                            
                            console.log(`[EasyApplyPlugin][Debug][Experience] Field: "${specialHandlerLabelText}", RAW answer (from cache or Gemini): "${answer}"`);
                            let numericAnswerOriginal = answer; 
                            let numericAnswer = parseInt(answer, 10);
                            console.log(`[EasyApplyPlugin][Debug][Experience] Field: "${specialHandlerLabelText}", Parsed numeric answer: ${numericAnswer}`);

                            if (!isNaN(numericAnswer) && numericAnswer < window.EasyApplyConfig.defaults.minimumExperienceYears && numericAnswer >= 0) {
                                console.log(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - Gemini/Cache returned ${numericAnswer}, which is less than ${window.EasyApplyConfig.defaults.minimumExperienceYears}. Defaulting to ${window.EasyApplyConfig.defaults.experienceYears}.`);
                                answer = String(window.EasyApplyConfig.defaults.experienceYears);
                            } else if (isNaN(numericAnswer) && numericAnswerOriginal && String(numericAnswerOriginal).trim() !== '' && experienceKeywords.some(keyword => specialHandlerLabelText.toLowerCase().includes(keyword))) {
                                console.warn(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - Gemini/Cache returned non-numeric text "${numericAnswerOriginal}" for an experience field. Defaulting to ${window.EasyApplyConfig.defaults.experienceYears}.`);
                                answer = String(window.EasyApplyConfig.defaults.experienceYears);
                            } else if ((answer === undefined || String(answer).trim() === '') && experienceKeywords.some(keyword => specialHandlerLabelText.toLowerCase().includes(keyword))) {
                                console.warn(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - Gemini/Cache returned empty or undefined. Defaulting to ${window.EasyApplyConfig.defaults.experienceYears}.`);
                                answer = String(window.EasyApplyConfig.defaults.experienceYears);
                            } else if (!isNaN(numericAnswer)) {
                                // If it's a valid number >= minimumExperienceYears, use it as is.
                                answer = String(numericAnswer); // Ensure it's a string
                                console.log(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - Using valid numeric answer: "${answer}".`);
                            } else {
                                // Non-numeric, not an experience keyword match, or already handled. Keep 'answer' as is (could be non-numeric text from Gemini if not an exp field by keywords)
                                console.log(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - Value (original: "${numericAnswerOriginal}") not meeting default conditions or not numeric. Using current answer: "${answer}".`);
                            }
                            console.log(`[EasyApplyPlugin][Debug][Experience] Field "${specialHandlerLabelText}" - FINAL value set to: "${answer}"`);

                        } else if (isSummaryField) { // This is an 'else if' because a field is either experience OR summary (or neither)
                            console.log(`[EasyApplyPlugin][Debug] Field "${specialHandlerLabelText}" (type: ${field.type}, tag: ${field.tagName}) IDENTIFIED as SUMMARY field.`);
                            if (answer === undefined) { // Only call Gemini if not found in cache
                                const isCoverLetter = specialHandlerLabelText.toLowerCase().includes('cover letter');
                                console.log(`[EasyApplyPlugin][Debug] Calling Gemini for SUMMARY field (not found in cache). Question: "${specialHandlerLabelText}", isCoverLetter: ${isCoverLetter}`);
                                answer = await getGeminiAnswer(specialHandlerLabelText, userCV, geminiApiKey, null, false, cache, true, isCoverLetter);
                                geminiCalledForSpecialField = true;
                            }
                            console.log(`[EasyApplyPlugin][Debug] Summary field "${specialHandlerLabelText}" - RAW answer (from cache or Gemini): "${answer ? String(answer).substring(0, 100) + '...' : '(empty)'}"`);
                            if (typeof answer !== 'string' && answer !== null && answer !== undefined) {
                        }
                        

                        // After processing experience or summary, if an answer was derived, fill the field
                        if (answer !== undefined && answer !== null && String(answer).trim() !== '') {
                            console.log(`[EasyApplyPlugin] Filling special field "${specialHandlerLabelText}" with: "${String(answer).substring(0,100)}${String(answer).length > 100 ? '...' : ''}"`);
                            field.value = String(answer);
                            field.dispatchEvent(new Event('input', { bubbles: true }));
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                            if (geminiCalledForSpecialField) {
                                cache[specialHandlerLabelText] = String(answer); // Cache if we made a new call
                                await chrome.storage.local.set({ [`geminiAnswersCache_${userCVDigest}`]: cache });
                                console.log(`[EasyApplyPlugin][Debug][Cache] Saved new answer for "${specialHandlerLabelText}" to cache.`);
                            }
                        } else {
                            console.log(`[EasyApplyPlugin] No answer derived or empty answer for special field "${specialHandlerLabelText}". Leaving as is or to be handled by subsequent logic if any.`);
                        }
                        console.log(`[EasyApplyPlugin][Debug][SpecialHandler] Field "${specialHandlerLabelText}" processed and filled by Experience/Summary. Skipping further generic handling for this field.`);
                        continue; // Skip generic input/textarea handling for this field, move to next field
                    } else {
                        console.log(`[EasyApplyPlugin][Debug] Special field "${specialHandlerLabelText}" - final answer is empty, not filling.`);
                    }
                }
            }
        }   
        
        
        // End of special handling for INPUT/TEXTAREA (experience/summary)

        if (field.tagName === 'SELECT') {
            console.log(`[EasyApplyPlugin][Debug] Handling SELECT field: "${specialHandlerLabelText}"`); 
            if (field.value && field.value.trim() !== '') {
                console.log(`[EasyApplyPlugin][Debug] SELECT field "${specialHandlerLabelText}" already has a value: "${field.value}". Skipping.`);
                continue; // Already filled, move to next field 
            } else { 
                const options = Array.from(field.options).map(opt => opt.text.trim()).filter(optText => optText.length > 0);
                if (options.length === 0) {
                    console.log(`[EasyApplyPlugin][Debug] SELECT field "${specialHandlerLabelText}" has no options. Skipping.`);
                    continue; // No options, move to next field 
                } else {
                    let answer = cache[specialHandlerLabelText];
                    if (!answer) {
                        console.log(`[EasyApplyPlugin][Debug] Calling Gemini for SELECT field "${specialHandlerLabelText}". Options: ${options.join('; ')}`);
                        answer = await getGeminiAnswer(specialHandlerLabelText, userCV, geminiApiKey, options, false, cache);
                    } else {
                        console.log(`[EasyApplyPlugin][Debug] Found SELECT field "${specialHandlerLabelText}" in cache: "${answer}"`);
                    }

                    if (answer) {
                        let bestMatchOption = null;
                        const lowerAnswer = String(answer).toLowerCase().trim();

                        for (const opt of field.options) {
                            if (opt.text.toLowerCase().trim() === lowerAnswer || opt.value.toLowerCase().trim() === lowerAnswer) {
                                bestMatchOption = opt;
                                break;
                            }
                        }

                        if (!bestMatchOption) {
                            for (const opt of field.options) {
                                const lowerOptText = opt.text.toLowerCase().trim();
                                if (lowerAnswer.includes(lowerOptText) || lowerOptText.includes(lowerAnswer)) {
                                    bestMatchOption = opt;
                                    console.log(`[EasyApplyPlugin][Debug][Select] Partial match found: Gemini="${lowerAnswer}", Option="${lowerOptText}"`);
                                    break;
                                }
                            }
                        }
                        
                        if (!bestMatchOption) {
                            const matchedOriginalOptionText = options.find(optText => optText.toLowerCase().trim() === lowerAnswer || lowerAnswer.includes(optText.toLowerCase().trim()));
                            if (matchedOriginalOptionText) {
                                 for (const opt of field.options) { 
                                    if (opt.text.toLowerCase().trim() === matchedOriginalOptionText.toLowerCase().trim()) {
                                        bestMatchOption = opt;
                                        console.log(`[EasyApplyPlugin][Debug][Select] Matched original option list: Gemini="${lowerAnswer}", OriginalOpt="${matchedOriginalOptionText}"`);
                                        break;
                                    }
                                }
                            }
                        }

                        if (bestMatchOption && bestMatchOption.value) { 
                            console.log(`[EasyApplyPlugin] Setting SELECT field "${specialHandlerLabelText}" to value: "${bestMatchOption.value}" (text: "${bestMatchOption.text}"). Gemini raw answer: "${answer}"`);
                            field.value = bestMatchOption.value;
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                            field.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            cache[specialHandlerLabelText] = answer; 
                            cache[`${specialHandlerLabelText}_selected`] = bestMatchOption.value; 
                            await chrome.storage.local.set({ [`geminiAnswersCache_${userCVDigest}`]: cache }); 
                            console.log(`[EasyApplyPlugin][Debug][Cache] Updated cache for SELECT field "${specialHandlerLabelText}".`);
                            console.log(`[EasyApplyPlugin][Debug][SpecialHandler] Field "${specialHandlerLabelText}" processed and filled by SELECT handler. Skipping further generic handling for this field.`);
                            continue; // Field handled, move to next field 
                        } else {
                            console.warn(`[EasyApplyPlugin] Gemini answer "${answer}" for SELECT field "${specialHandlerLabelText}" did not lead to a valid option selection. Options: ${Array.from(field.options).map(o => `"${o.text}"(value:${o.value})`).join(', ')}`);
                        }
                    } else {
                         console.log(`[EasyApplyPlugin][Debug] No answer from Gemini or cache for SELECT field "${specialHandlerLabelText}".`);
                    }
                }
            }
        }

        // Handle radio groups
        if (field.type === 'radio' && field.name && !processedGroups.has('radio:' + field.name)) {
            processedGroups.add('radio:' + field.name);
            const group = Array.from(modal.querySelectorAll(`input[type="radio"][name='${field.name}']`)).filter(r => r.offsetParent !== null);
            if (group.length === 0) continue;
            const anyChecked = group.some(r => r.checked);
            if (anyChecked) continue; // skip if any selected
            // Get label
            let label = '';
            let fieldset = field.closest('fieldset');
            if (fieldset) {
                const legend = fieldset.querySelector('legend');
                if (legend) label = legend.innerText.trim();
            }
            if (!label && field.id) {
                const labelEl = modal.querySelector(`label[for='${field.id}']`);
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label) label = field.name || field.id || '[unknown]';
            // Get options
            const options = group.map(r => {
                let optLabel = '';
                if (r.nextElementSibling && r.nextElementSibling.tagName === 'LABEL') {
                    optLabel = r.nextElementSibling.innerText.trim();
                } else if (r.parentElement && r.parentElement.tagName === 'LABEL') {
                    optLabel = r.parentElement.innerText.trim();
                }
                return optLabel || r.value || '[option]';
            });
            // Ask Gemini
            let answer = cache[label];
            if (!answer) {
                answer = await getGeminiAnswer(label, userCV, geminiApiKey, options, false, cache);
                console.log('Gemini response is >>>', answer);
            }
            // Match Gemini answer to options (case-insensitive, partial match)
            let matchedIndex = -1;
            for (let i = 0; i < options.length; i++) {
                if (answer && options[i] && answer.toLowerCase().includes(options[i].toLowerCase())) {
                    matchedIndex = i;
                    break;
                }
            }
            if (matchedIndex !== -1) {
                group[matchedIndex].checked = true;
                group[matchedIndex].dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[EasyApplyPlugin] Selected radio for: ${label} => ${options[matchedIndex]}`);
            } else if (group.length) {
                group[0].checked = true;
                group[0].dispatchEvent(new Event('change', { bubbles: true }));
                console.warn(`[EasyApplyPlugin] Gemini answer did not match any radio option for: ${label}. Fallback to: ${options[0]}`);
            }
            await new Promise(res => setTimeout(res, 1000));
            let isStillBlank = !group.some(r => r.checked);
            if (isStillBlank && !loggedBlankFields.has(group[0])) {
                loggedBlankFields.add(group[0]);
                console.warn('[EasyApplyPlugin] Radio group still blank after Gemini:', { label, answer, options });
            }
            continue;


        // Handle checkbox groups (multi or single)
        if (field.type === 'checkbox' && field.name && !processedGroups.has('checkbox:' + field.name)) {
            processedGroups.add('checkbox:' + field.name);
            const group = Array.from(modal.querySelectorAll(`input[type="checkbox"][name='${field.name}']`)).filter(c => c.offsetParent !== null);
            if (group.length === 0) continue;
            const anyChecked = group.some(c => c.checked);
            if (anyChecked) continue; // skip if any selected
            // Get label
            let label = '';
            let fieldset = field.closest('fieldset');
            if (fieldset) {
                const legend = fieldset.querySelector('legend');
                if (legend) label = legend.innerText.trim();
            }
            if (!label && field.id) {
                const labelEl = modal.querySelector(`label[for='${field.id}']`);
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label) label = field.name || field.id || '[unknown]';
            // Get options
            const options = group.map(c => {
                let optLabel = '';
                if (c.nextElementSibling && c.nextElementSibling.tagName === 'LABEL') {
                    optLabel = c.nextElementSibling.innerText.trim();
                } else if (c.parentElement && c.parentElement.tagName === 'LABEL') {
                    optLabel = c.parentElement.innerText.trim();
                }
                return optLabel || c.value || '[option]';
            });
            // Ask Gemini
            let answer = cache[label];
            if (!answer) {
                answer = await getGeminiAnswer(label, userCV, geminiApiKey, options, false, cache);
                console.log('Gemini response is >>>', answer);
            }
            // Match Gemini answer(s) to options (case-insensitive, partial match, support multi)
            let matched = [];
            for (let i = 0; i < options.length; i++) {
                if (answer && options[i] && answer.toLowerCase().includes(options[i].toLowerCase())) {
                    matched.push(i);
                }
            }
            if (matched.length) {
                matched.forEach(idx => {
                    group[idx].checked = true;
                    group[idx].dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[EasyApplyPlugin] Checked checkbox for: ${label} => ${options[idx]}`);
                });
            } else if (group.length) {
                group[0].checked = true;
                group[0].dispatchEvent(new Event('change', { bubbles: true }));
                console.warn(`[EasyApplyPlugin] Gemini answer did not match any checkbox option for: ${label}. Fallback to: ${options[0]}`);
            }
            await new Promise(res => setTimeout(res, 1000));
            let isStillBlank = !group.some(c => c.checked);
            if (isStillBlank && !loggedBlankFields.has(group[0])) {
                loggedBlankFields.add(group[0]);
                console.warn('[EasyApplyPlugin] Checkbox group still blank after Gemini:', { label, answer, options });
            }
            continue;
        }

        // Handle single checkboxes (not in a group)
        if (field.type === 'checkbox' && (!field.name || modal.querySelectorAll(`input[type="checkbox"][name='${field.name}']`).length === 1)) {
            if (field.checked) continue;
            // Get label
            let label = '';
            if (field.id) {
                const labelEl = modal.querySelector(`label[for='${field.id}']`);
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label) label = field.name || field.id || '[unknown]';
            
            // Check if this is a terms & conditions or privacy policy checkbox
            const isTermsCheckbox = /terms|conditions|privacy|policy|agree|consent|accept|gdpr|legal/i.test(label);
            
            if (isTermsCheckbox) {
        if ((field.tagName === 'INPUT' && (field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === '')) || field.tagName === 'TEXTAREA') {
            if (field.value) {
                console.log(`[EasyApplyPlugin][Skip] Field "${field.name || field.id}" already filled with value: "${field.value}". Skipping.`);
                continue;
            }
        }
        
            // Get label
            let label = '';
            if (field.id) {
                const labelEl = modal.querySelector(`label[for='${field.id}']`);
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label && field.placeholder) label = field.placeholder;
            if (!label) label = field.name || field.id || '[unknown]';

            // --- NEW: Check user Q&A cache as highest priority ---
            let userQaCache = window.userQaCache || {};
            let answer = undefined;
            // --- Normalize label and Q&A keys for robust matching ---
            function normalizeLabel(str) {
                return (str || '')
                    .replace(/\s+/g, ' ')
                    .replace(/\n/g, ' ')
                    .trim()
                    .toLowerCase();
            }
            const normalizedLabel = normalizeLabel(label);
            const qaKeys = Object.keys(userQaCache);
            let matchedQaKey = qaKeys.find(
                k => normalizeLabel(k) === normalizedLabel
            );
            console.log(`[EasyApplyPlugin][UserQACache] Normalized label: '${normalizedLabel}'. Available Q&A keys:`, qaKeys.map(normalizeLabel));
            if (matchedQaKey) {
                answer = userQaCache[matchedQaKey];
                console.log(`[EasyApplyPlugin][UserQACache] Using user-defined answer for "${label}" (matched key: "${matchedQaKey}"): "${answer}"`);
            } else {
                // --- NEW: Only if no userQACache answer, check plugin cache ---
                answer = cache[label];
                if (answer) {
                    console.log(`[EasyApplyPlugin][Cache] Using cached answer for "${label}": "${answer}"`);
                }
            }
            // Check if this is an experience-related field
            const isExperienceField = /experience|years|how long|how many years|expertise level|skill level|proficiency/i.test(label);
            // Check if this is a numeric field (salary, budget, etc.)
            const isNumericField = 
                field.id?.includes('numeric') || 
                field.classList.contains('numeric') || 
                field.type === 'number' || 
                /salary|compensation|budget|expected|pay|income|wage|figure|amount|number/i.test(label);
            // If no answer in userQACache or plugin cache, call Gemini
            if (!answer) {
                answer = await getGeminiAnswer(label, userCV, geminiApiKey, null, isNumericField, cache);
                console.log('[EasyApplyPlugin][Gemini] Gemini response for "' + label + '":', answer);
                // If it's an experience field and Gemini returns 0 or indicates no experience
                if (isExperienceField && 
                    (answer === '0' || 
                     /^0$|^0 |^0\.|^zero|^no experience|not mentioned|not specified|not found|cannot find|don't have|do not have|no experience|not in|unclear|not provided/i.test(answer))) {
                    // Use the configurable default experience value from config.js
                    const defaultExperience = window.EasyApplyConfig?.defaults?.experienceYears || 4;
                    answer = String(defaultExperience);
                    console.log(`[EasyApplyPlugin] Experience field detected with 0 or no experience. Using default value from config: ${answer} years`);
                }
            }
            // Fallback for phone fields if still blank
            const isPhoneField = /phone|mobile|contact/i.test(label);
            if ((!answer || String(answer).trim() === '') && isPhoneField) {
                answer = '9999999999'; // Default fallback phone number
                console.warn(`[EasyApplyPlugin][Fallback] No answer for phone field "${label}" from user Q&A, cache, or Gemini. Using default: ${answer}`);
            }
            if (answer && String(answer).trim() !== '') {
                field.value = answer;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                field.dispatchEvent(new Event('blur', { bubbles: true }));
                console.log(`[EasyApplyPlugin] Filled text field: ${label} = ${answer.substring(0, 20)}${answer.length > 20 ? '...' : ''}`);
            }
            await new Promise(res => setTimeout(res, 1000));
            let isStillBlank = !field.value;
            if (isStillBlank && !loggedBlankFields.has(field)) {
                loggedBlankFields.add(field);
                console.warn('[EasyApplyPlugin] Text field still blank after Gemini and fallback:', { label, answer });
            }
            continue;
        }
    }
}

// Helper functions for field handling

/**
 * Check if a field is a typeahead field
 * @param {HTMLElement} field - The field to check
 * @returns {boolean} - Whether the field is a typeahead field
 */
function isTypeaheadField(field) {
    if (!field) return false;
    return field.getAttribute('role') === 'combobox' && 
           field.getAttribute('aria-autocomplete') === 'list';
}

/**
 * Check if a field is likely a location field based on its ID or label
 * @param {HTMLElement} field - The field to check
 * @param {string} label - The label text associated with the field
 * @returns {boolean} - Whether the field is likely a location field
 */
function isLocationField(field, label) {
    if (!field || !label) return false;
    
    const locationTerms = ['location', 'city', 'place', 'region', 'country', 'area', 'address'];
    label = label.toLowerCase();
    
    // Check label
    if (locationTerms.some(term => label.includes(term))) return true;
    
    // Check ID and placeholder
    const id = field.id ? field.id.toLowerCase() : '';
    const placeholder = field.placeholder ? field.placeholder.toLowerCase() : '';
    
    if (locationTerms.some(term => id.includes(term) || placeholder.includes(term))) return true;
    
    // Special check for the specific question
    if (label.includes('current location') || label.includes('where are you located')) return true;
    
    return false;
}

/**
 * Handles typeahead/combobox fields by filling the text and selecting an option from the dropdown
 * @param {HTMLInputElement} field - The input field to handle
 * @param {string} value - The value to set
 * @returns {Promise<boolean>} - Whether the field was successfully handled
 */
async function handleTypeaheadField(field, value) {
    try {
        console.log(`[EasyApplyPlugin] Handling typeahead field with value: ${value}`);
        
        // Focus the field to activate the typeahead
        field.focus();
        await new Promise(res => setTimeout(res, 500));
        
        // Clear existing value
        field.value = '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 300));
        
        // Set the new value
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 1000)); // Wait for suggestions to appear
        
        // Check if dropdown is visible
        // Safely access typeaheadSuggestions with fallback
        const typeaheadSuggestions = window.EasyApplyConfig?.selectors?.typeaheadSuggestions || '.basic-typeahead__triggered-content, .search-basic-typeahead__dropdown, .basic-typeahead__selectable';
        const dropdown = document.querySelector(typeaheadSuggestions);
        
        if (dropdown && isElementVisible(dropdown)) {
            console.log('[EasyApplyPlugin] Typeahead dropdown is visible, selecting first option');
            
            // Find the first suggestion
            const suggestions = dropdown.querySelectorAll('li, .basic-typeahead__selectable');
            if (suggestions && suggestions.length > 0) {
                // Click the first suggestion
                suggestions[0].click();
                console.log('[EasyApplyPlugin] Clicked first typeahead suggestion');
                await new Promise(res => setTimeout(res, 500));
                return true;
            }
            
            // If no suggestions found by DOM, try simulating arrow down + enter
            console.log('[EasyApplyPlugin] No suggestions found by DOM, trying keyboard navigation');
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
            await new Promise(res => setTimeout(res, 300));
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
            await new Promise(res => setTimeout(res, 500));
            return true;
        } else {
            console.log('[EasyApplyPlugin] Typeahead dropdown not visible, trying keyboard navigation');
            // Try simulating arrow down + enter even if dropdown isn't detected
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
            await new Promise(res => setTimeout(res, 300));
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
            await new Promise(res => setTimeout(res, 500));
            return true;
        }
    } catch (error) {
        console.error('[EasyApplyPlugin] Error handling typeahead field:', error);
        return false;
    }
}

/**
 * Main automation function that orchestrates the process of finding and applying to jobs.
 * It iterates through job cards on the current page, checks if they are 'Easy Apply' jobs,
 * and if so, clicks the job card, waits for the right pane to load, clicks the 'Easy Apply' button,
 * and then calls `handleEasyApplyForm` to manage the application modal.
 * It can also navigate to the next page of job results if `continueToNextPage` is true.
 * The automation can be stopped by setting `window.easyApplyStop` to true.
 * @async
 * @returns {Promise<void>} A promise that resolves when the automation process is finished or stopped.
 */
async function automateEasyApply() {
    try {
        console.log("[EasyApplyPlugin] Automation started second");
        
        // Track if we need to check for next page
        let continueToNextPage = true;
        
        // Main automation loop - continues until no more pages or user stops
        while (continueToNextPage && !window.easyApplyStop) {
            const jobCards = await getJobCards();
            console.log(`[EasyApplyPlugin] Found ${jobCards.length} job cards`);

            // Filter to only Easy Apply cards
            const easyApplyCards = jobCards.filter(card => isEasyApplyCard(card));
            console.log(`[EasyApplyPlugin] Found ${easyApplyCards.length} Easy Apply job cards`);
            
            if (easyApplyCards.length === 0) {
                console.log('[EasyApplyPlugin] No Easy Apply cards found on current page.');
                // Check if there's a next page available
                if (await goToNextPage()) {
                    console.log('[EasyApplyPlugin] Navigated to next page, continuing automation...');
                    continue; // Start over with the new page
                } else {
                    console.log('[EasyApplyPlugin] No next page available, ending automation.');
                    continueToNextPage = false;
                    break;
                }
            }
            
            // Further filter out already applied jobs
            const unappliedCards = easyApplyCards.filter(card => !isJobAlreadyApplied(card));
            console.log(`[EasyApplyPlugin] Found ${unappliedCards.length} unapplied Easy Apply jobs out of ${easyApplyCards.length} total`);
            
            if (unappliedCards.length === 0) {
                console.log('[EasyApplyPlugin] All visible Easy Apply jobs have already been applied to.');
                
                // Navigate to next page if available
                if (await goToNextPage()) {
                    console.log('[EasyApplyPlugin] Navigated to next page, continuing automation...');
                    continue; // Start over with the new page
                } else {
                    console.log('[EasyApplyPlugin] No next page available, ending automation.');
                    continueToNextPage = false;
                    break;
                }
            }

            // Process each card
            for (let i = 0; i < unappliedCards.length; i++) {
                if (window.easyApplyStop) {
                    console.log('[EasyApplyPlugin] Automation stopped by user.');
                    return;
                }
                
                try {
                    const card = unappliedCards[i];
                    
                    // Double-check that this job hasn't been applied to (in case status changed)
                    if (isJobAlreadyApplied(card)) {
                        console.log(`[EasyApplyPlugin] Job ${i + 1} appears to have been applied to already, skipping.`);
                        continue;
                    }
                    
                    const jobInfo = getJobCardInfo(card);
                    console.log(`[EasyApplyPlugin] Clicking Easy Apply job card ${i + 1}: ${jobInfo.title}`);
                    
                    // Click the card to select it safely
                    try {
                        // Try to find a specific link first for more reliable clicking
                        const cardLink = card.querySelector('.job-card-job-posting-card-wrapper__card-link');
                        if (cardLink) {
                            cardLink.click();
                            console.log('[EasyApplyPlugin] Clicked job card link to select job.');
                        } else {
                            card.click();
                            console.log('[EasyApplyPlugin] Clicked job card to select job.');
                        }
                    } catch (clickError) {
                        console.error('[EasyApplyPlugin] Error clicking job card:', clickError);
                        continue;  // Skip to next job if click fails
                    }
                    
                    // Wait for job details to load
                    console.log('[EasyApplyPlugin] Waiting for job details to load...');
                    await new Promise(res => setTimeout(res, 2000));
                    
                    try {
                        await waitForSelector('.jobs-details__main-content', 10000);
                        console.log('[EasyApplyPlugin] Job details loaded');
                        const easyApplyBtn = await waitForEasyApplyButton();
                        
                        if (easyApplyBtn) {
                            console.log(`[EasyApplyPlugin] Found Easy Apply button for job ${i + 1}`);
                            easyApplyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await new Promise(res => setTimeout(res, 1000));
                            easyApplyBtn.click();
                            console.log('[EasyApplyPlugin] Clicked Easy Apply button');
                            await new Promise(res => setTimeout(res, 2000));
                            await handleEasyApplyForm();
                        } else {
                            console.log(`[EasyApplyPlugin] Job ${i + 1} does NOT have Easy Apply button - may be already applied`);
                            // Check if job is marked as applied in the right pane
                            const appliedStatus = document.querySelector('.jobs-details-top-card__apply-status');
                            if (appliedStatus && appliedStatus.innerText.includes('Applied')) {
                                console.log(`[EasyApplyPlugin] Confirmed job ${i + 1} is already applied, skipping...`);
                            }
                        }
                    } catch (e) {
                        console.log("[EasyApplyPlugin] Error loading job details:", e.message);
                        continue;
                    }
                    
                    // Wait before moving to next job
                    const waitMs = 2000 + Math.floor(Math.random() * 2000);
                    console.log(`[EasyApplyPlugin] Waiting ${waitMs / 1000} seconds before next job...`);
                    await new Promise(res => setTimeout(res, waitMs));
                    
                } catch (jobError) {
                    console.error(`[EasyApplyPlugin] Error processing job ${i + 1}:`, jobError);
                    continue; // Skip to next job if there's an error
                }
            }
            
            // Check if we should continue to next page after processing all jobs on current page
            if (continueToNextPage && !window.easyApplyStop) {
                // Try to navigate to next page
                if (await goToNextPage()) {
                    console.log('[EasyApplyPlugin] Processed all jobs on current page, navigating to next page...');
                    continue; // Continue the loop with the new page
                } else {
                    console.log('[EasyApplyPlugin] No more pages available, ending automation.');
                    break;
                }
            }
        } // End of while loop
        
        console.log("[EasyApplyPlugin] Automation finished");
    } catch (error) {
        console.error("[EasyApplyPlugin] Fatal error in automation:", error);
        console.log("[EasyApplyPlugin] Automation stopped due to error");
    }
}

    
/**
 * Listens for messages from the popup script (`popup.js`).
 * - Handles 'startAutomation': Resets the stop flag and calls `automateEasyApply()` to begin the automation.
 * - Handles 'stopAutomation': Sets the `window.easyApplyStop` flag to true, which signals ongoing automation processes to halt.
 * @param {object} request - The message sent by the calling script.
 * @param {chrome.runtime.MessageSender} sender - Information about the script that sent the message.
 * @param {function} sendResponse - Function to call to send a response to the message sender.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'stopAutomation') {
        window.easyApplyStop = true;
    }
    if (request.action === 'startAutomation') {
        window.easyApplyStop = false;
        automateEasyApply();
    }
});


}
}