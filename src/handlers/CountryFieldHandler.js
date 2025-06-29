/**
 * @fileoverview Specialized handler for country selection fields in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for country selection fields. This handler
 * provides specific logic for identifying and selecting country options
 * in form fields.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class CountryFieldHandler extends FieldHandlerBase {
  /**
   * Creates a new country field handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][CountryFieldHandler]';
    
    // Common country names and their alternatives
    this.countryMap = {
      'india': ['india', 'bharat', 'in'],
      'united states': ['united states', 'usa', 'us', 'united states of america', 'america'],
      'united kingdom': ['united kingdom', 'uk', 'great britain', 'england'],
      'canada': ['canada', 'ca'],
      'australia': ['australia', 'aus'],
      'germany': ['germany', 'deutschland', 'de'],
      'france': ['france', 'fr'],
      'japan': ['japan', 'jp'],
      'china': ['china', 'cn']
      // Add more countries as needed
    };
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    return fieldType.isCountry;
  }
  
  /**
   * Handle a country field by selecting the appropriate option
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    this._log(`Handling country field: "${label}"`);
    
    // Get the country value from cache, Gemini, or default
    const countryValue = await this._getFieldValue(label, {
      providedValue: value,
      isCountry: true
    });
    
    if (!countryValue) {
      this._log(`No country value available for field: "${label}"`);
      return false;
    }
    
    try {
      // Handle based on field type
      if (field.tagName === 'SELECT') {
        return await this._handleCountrySelect(field, countryValue);
      } else if (field.tagName === 'INPUT' && 
                field.getAttribute('role') === 'combobox' && 
                field.getAttribute('aria-autocomplete') === 'list') {
        // Typeahead field
        return await this._handleCountryTypeahead(field, countryValue);
      } else if (field.tagName === 'INPUT' && field.type === 'text') {
        // Simple text input
        field.value = countryValue;
        this._dispatchEvent(field, 'input');
        this._dispatchEvent(field, 'change');
        await this._delay(this.delays.textInput || 200);
        return true;
      }
      
      this._log(`Unsupported country field type: ${field.tagName}`);
      return false;
    } catch (error) {
      this._logError('Error handling country field:', error);
      return false;
    }
  }
  
  /**
   * Handle a country select dropdown
   * 
   * @private
   * @param {HTMLSelectElement} field - The select field
   * @param {string} countryValue - The country value to select
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async _handleCountrySelect(field, countryValue) {
    const options = Array.from(field.options);
    if (!options.length) {
      this._log('No options found in country select');
      return false;
    }
    
    // Filter out placeholder options
    const availableOptions = options.filter(opt => 
      !opt.disabled && 
      opt.text.trim() !== '' && 
      !opt.text.toLowerCase().includes('select')
    );
    
    if (!availableOptions.length) {
      this._log('No valid options in country select');
      return false;
    }
    
    // Try to find exact match first (case insensitive)
    const countryLower = countryValue.toLowerCase();
    
    // First, try exact matches
    for (const opt of availableOptions) {
      if (opt.text.toLowerCase() === countryLower ||
          opt.value.toLowerCase() === countryLower) {
        this._log(`Selected exact match country option: "${opt.text}"`);
        field.value = opt.value;
        this._dispatchEvent(field, 'change');
        await this._delay(this.delays.selectChange || 200);
        return true;
      }
    }
    
    // Next, try normalized country name matching
    const normalizedCountry = this._getNormalizedCountry(countryLower);
    if (normalizedCountry) {
      for (const opt of availableOptions) {
        const optTextLower = opt.text.toLowerCase();
        if (this._isCountryMatch(optTextLower, normalizedCountry)) {
          this._log(`Selected normalized country match: "${opt.text}" for "${countryValue}"`);
          field.value = opt.value;
          this._dispatchEvent(field, 'change');
          await this._delay(this.delays.selectChange || 200);
          return true;
        }
      }
    }
    
    // If still no match, try a more fuzzy approach with includes
    for (const opt of availableOptions) {
      if (opt.text.toLowerCase().includes(countryLower) || 
          countryLower.includes(opt.text.toLowerCase())) {
        this._log(`Selected partial match country: "${opt.text}" for "${countryValue}"`);
        field.value = opt.value;
        this._dispatchEvent(field, 'change');
        await this._delay(this.delays.selectChange || 200);
        return true;
      }
    }
    
    // If we get here and there's still no match, use the first non-placeholder option
    this._log(`No country match found, using first option: "${availableOptions[0].text}"`);
    field.value = availableOptions[0].value;
    this._dispatchEvent(field, 'change');
    await this._delay(this.delays.selectChange || 200);
    
    return true;
  }
  
  /**
   * Handle a country typeahead field
   * 
   * @private
   * @param {HTMLInputElement} field - The typeahead field
   * @param {string} countryValue - The country value to enter
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async _handleCountryTypeahead(field, countryValue) {
    this._log(`Setting country typeahead field to: "${countryValue}"`);
    
    // Focus the field
    field.focus();
    await this._delay(this.delays.typeaheadFocus || 500);
    
    // Clear existing value
    field.value = '';
    this._dispatchEvent(field, 'input');
    await this._delay(this.delays.typeaheadClear || 300);
    
    // Set the country value
    field.value = countryValue;
    this._dispatchEvent(field, 'input');
    await this._delay(this.delays.typeaheadInput || 1000); // Wait for suggestions
    
    // Try to select from dropdown if visible
    const typeaheadSuggestionsSelector = this.config.selectors?.typeaheadSuggestions || 
                                         '.basic-typeahead__triggered-content, .search-basic-typeahead__dropdown, .basic-typeahead__selectable';
    const dropdown = document.querySelector(typeaheadSuggestionsSelector);
    
    if (dropdown && this._isElementVisible(dropdown)) {
      this._log('Country typeahead dropdown is visible, selecting first option');
      
      // Find the first suggestion
      const suggestions = dropdown.querySelectorAll('li, .basic-typeahead__selectable');
      if (suggestions && suggestions.length > 0) {
        // Click the first suggestion
        suggestions[0].click();
        this._log('Clicked first country suggestion');
        await this._delay(this.delays.typeaheadClick || 500);
        return true;
      }
      
      // If no suggestions found by DOM, try keyboard navigation
      this._log('No country suggestions found, trying keyboard navigation');
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
      await this._delay(this.delays.typeaheadKeydown || 300);
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
      await this._delay(this.delays.typeaheadEnter || 500);
    } else {
      // No dropdown visible, try keyboard navigation anyway
      this._log('Country typeahead dropdown not visible, trying keyboard navigation');
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
      await this._delay(this.delays.typeaheadKeydown || 300);
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
      await this._delay(this.delays.typeaheadEnter || 500);
    }
    
    return true;
  }
  
  /**
   * Get a normalized country name
   * 
   * @private
   * @param {string} countryInput - The country input to normalize
   * @returns {string|null} - The normalized country name or null if not found
   */
  _getNormalizedCountry(countryInput) {
    for (const [normalized, alternatives] of Object.entries(this.countryMap)) {
      if (alternatives.some(alt => countryInput.includes(alt) || alt.includes(countryInput))) {
        return normalized;
      }
    }
    return null;
  }
  
  /**
   * Check if a country name matches a normalized country
   * 
   * @private
   * @param {string} optionText - The option text to check
   * @param {string} normalizedCountry - The normalized country name
   * @returns {boolean} - Whether the country names match
   */
  _isCountryMatch(optionText, normalizedCountry) {
    const alternatives = this.countryMap[normalizedCountry] || [];
    return alternatives.some(alt => 
      optionText.includes(alt) || 
      alt.includes(optionText) || 
      optionText === normalizedCountry ||
      normalizedCountry.includes(optionText)
    );
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = CountryFieldHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.CountryFieldHandler = CountryFieldHandler;
} 