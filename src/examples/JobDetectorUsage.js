/**
 * @fileoverview Example usage of the JobDetectorV2 implementation
 * This file demonstrates how to use the new selector framework and job detector
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Initialize the job detector with necessary components
 * @returns {JobDetectorV2} Initialized job detector
 */
function initializeJobDetector() {
  // Create an error handler for logging
  const errorHandler = new ErrorHandler('JobDetection');
  
  // Create the DOM selector engine
  const selectorEngine = new DOMSelectorEngine(errorHandler);
  
  // Configuration with debug flags
  const config = {
    debug: {
      jobDetection: true
    }
  };
  
  // Create the job detector
  const jobDetector = new JobDetectorV2(errorHandler, config);
  
  return jobDetector;
}

/**
 * Find Easy Apply jobs on the current page
 * @param {boolean} includeNonEasyApply - Whether to include non-Easy Apply jobs if no Easy Apply jobs found
 * @returns {Promise<Array>} Array of job card info objects
 */
async function findEasyApplyJobs(includeNonEasyApply = false) {
  try {
    console.log('[JobDetection] Finding Easy Apply jobs...');
    
    // Initialize the job detector
    const jobDetector = initializeJobDetector();
    
    // Get all Easy Apply job cards
    const jobCards = jobDetector.getEasyApplyJobCards(includeNonEasyApply);
    
    console.log(`[JobDetection] Found ${jobCards.length} job cards to process`);
    
    // Extract job information from cards
    const jobInfos = jobCards.map(card => jobDetector.getJobCardInfo(card));
    
    // Log the job information
    console.log('[JobDetection] Job information:');
    jobInfos.forEach((job, index) => {
      console.log(`[JobDetection] Job ${index + 1}: ${job.title} at ${job.company} (${job.location})`);
      console.log(`[JobDetection] Easy Apply: ${job.isEasyApply}, Already Applied: ${job.isApplied}`);
    });
    
    return jobInfos;
  } catch (error) {
    console.error('[JobDetection] Error finding Easy Apply jobs:', error);
    return [];
  }
}

/**
 * Navigate to the next page of job results
 * @param {Function} isElementVisible - Function to check if element is visible
 * @returns {Promise<boolean>} Whether navigation was successful
 */
async function goToNextPage(isElementVisible) {
  try {
    console.log('[JobDetection] Looking for next page button...');
    
    // Initialize the job detector
    const jobDetector = initializeJobDetector();
    
    // Get the next page button
    const nextButton = jobDetector.getNextPageButton(isElementVisible);
    
    if (nextButton) {
      console.log('[JobDetection] Found next page button, clicking...');
      nextButton.click();
      
      // Wait for page to load
      console.log('[JobDetection] Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return true;
    } else {
      console.log('[JobDetection] No next page button found');
      return false;
    }
  } catch (error) {
    console.error('[JobDetection] Error navigating to next page:', error);
    return false;
  }
}

/**
 * Process all Easy Apply jobs across multiple pages
 * @param {number} maxPages - Maximum number of pages to process
 * @param {boolean} includeNonEasyApply - Whether to include non-Easy Apply jobs
 * @returns {Promise<Array>} Array of all job infos
 */
async function processAllJobPages(maxPages = 5, includeNonEasyApply = false) {
  try {
    console.log(`[JobDetection] Processing up to ${maxPages} pages of jobs...`);
    
    const allJobs = [];
    let currentPage = 1;
    
    // Define isElementVisible function
    const isElementVisible = (element) => {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             element.offsetWidth > 0 &&
             element.offsetHeight > 0;
    };
    
    // Process jobs on initial page
    console.log(`[JobDetection] Processing page ${currentPage}...`);
    const initialJobs = await findEasyApplyJobs(includeNonEasyApply);
    allJobs.push(...initialJobs);
    
    // Process subsequent pages
    while (currentPage < maxPages) {
      // Go to next page
      const success = await goToNextPage(isElementVisible);
      
      if (!success) {
        console.log('[JobDetection] Could not navigate to next page, stopping');
        break;
      }
      
      // Increment page counter
      currentPage++;
      console.log(`[JobDetection] Processing page ${currentPage}...`);
      
      // Find jobs on this page
      const pageJobs = await findEasyApplyJobs(includeNonEasyApply);
      allJobs.push(...pageJobs);
      
      // If no jobs found on this page, stop
      if (pageJobs.length === 0) {
        console.log('[JobDetection] No jobs found on this page, stopping');
        break;
      }
    }
    
    console.log(`[JobDetection] Processed ${currentPage} pages, found ${allJobs.length} total jobs`);
    return allJobs;
  } catch (error) {
    console.error('[JobDetection] Error processing job pages:', error);
    return [];
  }
}

// Export the functions for use in other modules
if (typeof module !== 'undefined') {
  module.exports = {
    initializeJobDetector,
    findEasyApplyJobs,
    goToNextPage,
    processAllJobPages
  };
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.JobDetectionExample = {
    initializeJobDetector,
    findEasyApplyJobs,
    goToNextPage,
    processAllJobPages
  };
} 