/**
 * @fileoverview Specialized handler for checkbox fields in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for checkbox fields. This handler
 * provides specific logic for interacting with checkboxes.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class CheckboxFieldHandler extends FieldHandlerBase {
  /**
   * Creates a new checkbox field handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][CheckboxFieldHandler]';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    return field.tagName === 'INPUT' && field.type === 'checkbox';
  }
  
  /**
   * Handle a checkbox field by setting its appropriate state
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string|boolean} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    this._log(`Handling checkbox field: "${label}"`);
    
    // Determine if this is a consent/agreement checkbox
    const isConsent = 
      label.toLowerCase().includes('agree') || 
      label.toLowerCase().includes('consent') || 
      label.toLowerCase().includes('terms') || 
      label.toLowerCase().includes('privacy') ||
      this.config.termsKeywords?.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      );
    
    // For consent checkboxes, always check them
    if (isConsent) {
      this._log(`Consent checkbox detected, checking it`);
      field.checked = true;
      this._dispatchEvent(field, 'click');
      this._dispatchEvent(field, 'change');
      await this._delay(this.delays.checkbox || 200);
      return true;
    }
    
    // Get the appropriate value
    let checkboxValue;
    
    if (value !== null) {
      // Use provided value if available
      checkboxValue = typeof value === 'boolean' ? value : 
                     (value.toLowerCase() === 'yes' || 
                      value.toLowerCase() === 'true' || 
                      value.toLowerCase() === 'checked');
    } else {
      // Otherwise, get value from cache or Gemini
      const stringValue = await this._getFieldValue(label, {
        isConsent
      });
      
      checkboxValue = stringValue && 
                     (stringValue.toLowerCase() === 'yes' || 
                      stringValue.toLowerCase() === 'true' || 
                      stringValue.toLowerCase() === 'checked');
    }
    
    try {
      // Set the checkbox state
      if (checkboxValue) {
        this._log(`Checking checkbox for: "${label}"`);
        field.checked = true;
      } else {
        this._log(`Leaving checkbox unchecked for: "${label}"`);
        field.checked = false;
      }
      
      this._dispatchEvent(field, 'click');
      this._dispatchEvent(field, 'change');
      await this._delay(this.delays.checkbox || 200);
      
      return true;
    } catch (error) {
      this._logError('Error handling checkbox field:', error);
      return false;
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = CheckboxFieldHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.CheckboxFieldHandler = CheckboxFieldHandler;
} 