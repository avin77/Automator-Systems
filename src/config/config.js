/**
 * @fileoverview Global configuration settings
 * Central place for all configuration parameters, timing values, and settings
 * @author EasyApplyPlugin Team
 * @version 2.0.0
 */

/**
 * Global configuration settings for the LinkedIn Easy Apply plugin
 */
const EasyApplyConfig = {
  /**
   * Debug flags - control detailed logging in different areas
   */
  debug: {
    enabled: true,
    jobDetection: true,
    formFilling: true,
    geminiApi: true,
    domOperations: false,
    timing: false,
    selectors: false
  },
  
  /**
   * Timing configurations - all times in milliseconds
   */
  timing: {
    // Core timing values
    shortDelay: 500,       // Very short delay for minor UI updates
    normalDelay: 1000,     // Standard delay between most operations
    longDelay: 2000,       // Longer delay for more complex operations
    pageLoadDelay: 3000,   // Delay after page navigation
    
    // Specific operation timings
    clickDelay: 800,           // Delay after clicking buttons/elements
    afterFormSubmitDelay: 1500, // Delay after submitting a form
    afterPageChangeDelay: 2500, // Delay after significant UI changes
    modalTransitionDelay: 1200, // Delay for modal transitions
    
    // Typeahead and dropdown delays
    typeaheadDelay: 300,        // Delay between typing characters
    dropdownSelectionDelay: 700, // Delay after selecting from a dropdown
    
    // Retries and timeouts
    formElementTimeout: 10000,  // Maximum time to wait for form elements to appear
    pageLoadTimeout: 15000,     // Maximum time to wait for page to load
    apiResponseTimeout: 12000,  // Maximum time to wait for API responses
    
    // Retry configurations
    maxRetries: 3,              // Maximum number of retry attempts
    retryDelayBase: 1000,       // Base delay between retries (increases with each retry)
    
    // Progress detection
    progressCheckInterval: 2000, // Interval to check for progress updates
    maxTimeWithoutProgress: 30000 // Maximum time allowed without progress
  },
  
  /**
   * Application configuration
   */
  application: {
    // Maximum number of jobs to apply to in one session
    maxJobsPerSession: 25,
    
    // Whether to skip jobs that have already been applied to
    skipAppliedJobs: true,
    
    // Whether to continue on the next page after processing all jobs on current page
    continueToNextPage: true,
    
    // Maximum number of pages to process
    maxPages: 5,
    
    // Whether to save application data
    saveApplicationData: true,
    
    // Application flow control
    stopOnError: false,         // Whether to stop on errors
    skipOnMissingRequiredField: true // Skip applications with missing required fields
  },
  
  /**
   * Gemini API configuration
   */
  geminiApi: {
    // Maximum tokens for different request types
    maxTokensShortResponse: 50,
    maxTokensMediumResponse: 150,
    maxTokensLongResponse: 500,
    
    // Temperature settings for different question types
    temperatureFactual: 0.2,   // Factual questions like work experience
    temperatureCreative: 0.6,  // Creative fields like summaries
    
    // Default user context values
    defaultLocation: 'India',
    defaultCurrency: 'INR',
    defaultWorkAuthorization: 'India',
    defaultExperience: 4,
    defaultJobType: 'Full-time'
  },
  
  /**
   * Form field mappings and preferences
   */
  formFields: {
    // Common field type mappings
    resumeFields: ['resume', 'cv', 'attachment'],
    coverLetterFields: ['cover letter', 'coverletter', 'letter of introduction'],
    
    // Radio button preferences
    preferYes: true,  // Prefer "Yes" for yes/no questions
    
    // Default selections for common fields
    workTypes: ['Full-time', 'Permanent', 'Remote'],
    noticePeriod: '2 weeks',
    
    // Required field handling
    fillAllRequiredFields: true,
    requireConfirmationForSalary: true
  },
  
  /**
   * Progress tracking
   */
  progressTracking: {
    enabled: true,
    stuckThresholdSeconds: 30,
    checkIntervalSeconds: 2,
    
    // Form completion progress thresholds
    lowProgressThreshold: 0.3,  // 30% completed
    mediumProgressThreshold: 0.6, // 60% completed
    highProgressThreshold: 0.9   // 90% completed
  },
  
  /**
   * Storage settings
   */
  storage: {
    // Key names for chrome.storage
    userSettingsKey: 'easyApplyUserSettings',
    applicationHistoryKey: 'easyApplyHistory',
    cacheKey: 'easyApplyCache',
    questionCacheKey: 'easyApplyQACache',
    
    // Maximum items to store
    maxHistoryItems: 500,
    maxCacheItems: 200
  }
};

// Make the config available in the global scope if in a browser
if (typeof window !== 'undefined') {
  window.EasyApplyConfig = EasyApplyConfig;
}

// Export for CommonJS modules
if (typeof module !== 'undefined') {
  module.exports = EasyApplyConfig;
} 