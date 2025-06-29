/**
 * @fileoverview Specialized handler for typeahead/autocomplete fields in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for typeahead/autocomplete fields. This handler
 * provides specific logic for interacting with typeahead fields that
 * have dropdown suggestions.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class TypeaheadFieldHandler extends FieldHandlerBase {
  /**
   * Creates a new typeahead field handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][TypeaheadFieldHandler]';
    
    // Default selectors for typeahead suggestions
    this.typeaheadSuggestionsSelector = 
      dependencies.config.selectors?.typeaheadSuggestions || 
      '.basic-typeahead__triggered-content, .search-basic-typeahead__dropdown, .basic-typeahead__selectable';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    return field.tagName === 'INPUT' && 
           field.getAttribute('role') === 'combobox' && 
           field.getAttribute('aria-autocomplete') === 'list';
  }
  
  /**
   * Handle a typeahead field by filling it and selecting from dropdown
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    this._log(`Handling typeahead field: "${label}"`);
    
    // Determine if this is a location field
    const isLocationField = 
      label.toLowerCase().includes('location') || 
      label.toLowerCase().includes('city') || 
      label.toLowerCase().includes('country') || 
      (field.id && field.id.toLowerCase().includes('location'));
    
    // Get the appropriate value
    const typeaheadValue = await this._getFieldValue(label, {
      providedValue: value,
      isCity: isLocationField,  // Add isCity flag for proper cache lookup
      isLocation: isLocationField
    });
    
    if (!typeaheadValue) {
      this._log(`No value available for typeahead field: "${label}"`);
      return false;
    }
    
    try {
      this._log(`Setting typeahead field value to: "${typeaheadValue}"`);
      
      // Focus the field to activate the typeahead
      field.focus();
      await this._delay(this.delays.typeaheadFocus || 500);
      
      // Clear existing value
      field.value = '';
      this._dispatchEvent(field, 'input');
      await this._delay(this.delays.typeaheadClear || 300);
      
      // Set the new value
      field.value = typeaheadValue;
      this._dispatchEvent(field, 'input');
      await this._delay(this.delays.typeaheadInput || 1000); // Wait for suggestions to appear
      
      // Check if dropdown is visible
      const dropdown = document.querySelector(this.typeaheadSuggestionsSelector);
      
      if (dropdown && this._isElementVisible(dropdown)) {
        this._log('Typeahead dropdown is visible, selecting first option');
        
        // Find the first suggestion
        const suggestions = dropdown.querySelectorAll('li, .basic-typeahead__selectable');
        if (suggestions && suggestions.length > 0) {
          // Click the first suggestion
          suggestions[0].click();
          this._log('Clicked first typeahead suggestion');
          await this._delay(this.delays.typeaheadClick || 500);
          return true;
        }
        
        // If no suggestions found by DOM, try simulating arrow down + enter
        this._log('No suggestions found by DOM, trying keyboard navigation');
        field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
        await this._delay(this.delays.typeaheadKeydown || 300);
        field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
        await this._delay(this.delays.typeaheadEnter || 500);
        return true;
      } else {
        this._log('Typeahead dropdown not visible, trying keyboard navigation');
        // Try simulating arrow down + enter even if dropdown isn't detected
        field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
        await this._delay(this.delays.typeaheadKeydown || 300);
        field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
        await this._delay(this.delays.typeaheadEnter || 500);
        return true;
      }
    } catch (error) {
      this._logError('Error handling typeahead field:', error);
      return false;
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = TypeaheadFieldHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.TypeaheadFieldHandler = TypeaheadFieldHandler;
} 