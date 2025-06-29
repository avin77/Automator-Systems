/**
 * @fileoverview Specialized handler for text input fields in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for text input fields. This handler
 * provides specific logic for interacting with text inputs and textareas.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class TextFieldHandler extends FieldHandlerBase {
  /**
   * Creates a new text field handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][TextFieldHandler]';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    // Don't handle typeahead fields
    if (fieldType.isTypeahead) return false;
    
    // Don't handle radio buttons in fieldsets
    if (field.tagName === 'INPUT' && field.type === 'radio') return false;
    
    // Don't handle fields that are part of a radio button fieldset
    if (field.closest('fieldset')?.querySelector('input[type="radio"]')) return false;
    
    // Handle text inputs and textareas, but not specialized fields
    if (field.tagName === 'TEXTAREA') return true;
    
    if (field.tagName === 'INPUT') {
      const inputType = field.type.toLowerCase();
      return inputType === 'text' || 
             inputType === 'email' || 
             inputType === 'tel' || 
             inputType === 'url' || 
             inputType === 'number' || 
             inputType === 'search';
    }
    
    return false;
  }
  
  /**
   * Handle a text field by filling it with an appropriate value
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    this._log(`Handling text field: "${label}"`);
    
    // Determine field characteristics
    const isPhone = 
      label.toLowerCase().includes('phone') || 
      label.toLowerCase().includes('mobile') || 
      (field.id && field.id.toLowerCase().includes('phone')) || 
      field.type === 'tel';
    
    const isExperience = 
      label.toLowerCase().includes('experience') || 
      label.toLowerCase().includes('years') || 
      this.config.experienceKeywords?.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      );
    
    const isSummary = 
      field.tagName === 'TEXTAREA' || 
      label.toLowerCase().includes('summary') || 
      label.toLowerCase().includes('cover letter') || 
      label.toLowerCase().includes('additional information') || 
      this.config.summaryKeywords?.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      );
    
    // Get the appropriate value
    const textValue = await this._getFieldValue(label, {
      providedValue: value,
      isPhone,
      isExperience,
      isSummary
    });
    
    if (!textValue) {
      this._log(`No value available for text field: "${label}"`);
      return false;
    }
    
    try {
      // Set the field value
      field.value = textValue;
      this._dispatchEvent(field, 'input');
      this._dispatchEvent(field, 'change');
      
      // For textarea fields, also trigger blur to save content
      if (field.tagName === 'TEXTAREA') {
        field.focus();
        await this._delay(50);
        field.blur();
        this._dispatchEvent(field, 'blur');
      }
      
      await this._delay(this.delays.textInput || 200);
      
      // Check for validation errors
      const errorMessage = this._getFieldErrorMessage(field);
      if (errorMessage) {
        this._log(`Error after setting text value: "${errorMessage}"`);
        return false;
      }
      
      return true;
    } catch (error) {
      this._logError('Error handling text field:', error);
      return false;
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = TextFieldHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.TextFieldHandler = TextFieldHandler;
} 