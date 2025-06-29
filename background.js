// Background service worker for LinkedIn Easy Apply Automator
// Currently not used, but required by manifest v3 

console.log('[EasyApplyPlugin] Background service worker initialized');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[EasyApplyPlugin] Extension installed or updated:', details.reason);
  
  // Initialize default settings if not already set
  chrome.storage.local.get(['cv', 'geminiApiKey', 'qaCache', 'processNonEasyApply'], (result) => {
    // Set default values if not already set
    const defaults = {};
    
    if (!result.cv) {
      defaults.cv = '';
    }
    
    if (!result.geminiApiKey) {
      defaults.geminiApiKey = '';
    }
    
    if (!result.qaCache) {
      defaults.qaCache = {};
    }
    
    if (result.processNonEasyApply === undefined) {
      defaults.processNonEasyApply = false;
    }
    
    // Save defaults if any were set
    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults, () => {
        console.log('[EasyApplyPlugin] Default settings initialized');
      });
    }
  });
});

// Listen for messages from content scripts or popup
// Import the AutomationManager
import automationManager from './src/utils/AutomationManager.js';

// In the message listener, update the stopAutomation handler:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[EasyApplyPlugin] Background received message:', message);
  
  if (message.action === 'getStatus') {
    sendResponse({ status: 'Background service worker is active' });
  } else if (message.action === 'stopAutomation') {
    // Use the automation manager to stop all processes
    automationManager.stop();
    
    console.log('[EasyApplyPlugin] ⛔ AUTOMATION STOP REQUESTED - the process will stop at the next check');
    console.log('[EasyApplyPlugin] Please wait for any current operations to complete...');
    
    sendResponse({ status: 'Automation stop requested' });
  }
  return true;
});
  
  return true; // Keep message channel open for async responses
});