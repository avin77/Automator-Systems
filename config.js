// Configuration file for LinkedIn Easy Apply Automator

window.EasyApplyConfig = {
    // Timeouts (in seconds)
    timeouts: {
        // General selector timeouts
        defaultWait: 10,              // Default timeout for most operations
        elementVisibilityTimeout: 10,  // Timeout for waiting for elements to be visible
        modalVisibilityTimeout: 10,    // Timeout for waiting for modals to appear
        modalHiddenTimeout: 10,        // Timeout for waiting for modals to disappear
        buttonClickTimeout: 5,         // Timeout for waiting for buttons to be clickable
        
        // Application process timeouts
        afterSubmitDelay: 5,           // Delay after clicking Submit before checking for confirmation
        applicationSentPollingInterval: 1, // Interval between checks for Application Sent popup
        applicationSentPollingDuration: 30, // Total duration to poll for Application Sent popup
        afterDoneClickDelay: 5,        // Delay after clicking Done before checking if modal closed
        postApplicationPopupDelay: 2,  // Delay before checking for post-application popups
        doneButtonModalPolling: 7,    // Seconds to poll for Done button modal
        
        // Form handling timeouts
        fieldFillDelay: 0.5,           // Delay after filling each form field
        betweenFieldCheckDelay: 0.2,   // Delay between checking if fields are filled
        betweenButtonClicksDelay: 2,   // Base delay between button clicks
        geminiApiTimeout: 5            // Timeout for Gemini API calls
    },
    
    // Retry counts
    retries: {
        modalVisibility: 3,              // Attempts to check if modal is visible
        nextButtonClick: 7,              // Attempts to click Next button
        submitApplicationClick: 3,       // Attempts to click Submit Application button
        doneButtonClick: 5,              // Attempts to click Done button
        formFill: 10,                    // Attempts to fill form fields
        maxFormSteps: 10                 // Maximum number of form steps (Next/Review clicks) before stopping
    },
    
    // Form filling defaults
    defaults: {
        experienceYears: 4,              // Default years of experience to use when Gemini returns an invalid or too low value
        minimumExperienceYears: 2        // Minimum years of experience from Gemini/Cache before defaulting to experienceYears
    },
    
    // Selectors
    selectors: {
        // Application sent popup selectors
        applicationSentModal: '[data-test-modal][aria-labelledby="post-apply-modal"], .artdeco-modal.artdeco-modal--layer-default[size="medium"]',
        applicationSentHeader: 'h2#post-apply-modal, .artdeco-modal__header h2',
        applicationSentSuccessIcon: 'svg[data-test-icon="signal-success"], .jpac-modal-header-icon svg',
        applicationSentMessage: '.jpac-modal-header.t-20.t-bold, .artdeco-modal__content h3',
        doneButton: '.artdeco-button--primary, button.artdeco-button--primary, button.artdeco-button--2.artdeco-button--primary',
        
        // Close button selectors
        closeButtons: [
            'button[aria-label="Dismiss"]',
            'button[data-test-modal-close-btn]',
            'button.artdeco-modal__dismiss',
            'button svg use[href="#close-medium"]',
            'button svg use[href="#close"]',
            '.artdeco-modal__dismiss',
            '[data-test-modal-close-btn]'
        ],
        
        // Modal selectors
        modalContainers: [
            '.jobs-easy-apply-content',
            '.jobs-easy-apply-modal',
            '.jobs-easy-apply-content__wrapper',
            '[data-test-modal]'
        ],
        
        // Special field type detection
        typeaheadField: 'input[role="combobox"][aria-autocomplete="list"]',
        typeaheadSuggestions: '.basic-typeahead__triggered-content, .search-basic-typeahead__dropdown, .basic-typeahead__selectable'
    }
};

// Export configuration (if needed for other contexts, though primarily for window scope here)
try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window.EasyApplyConfig;
    }
} catch (e) {
    // Ignore export errors in browser context
}
