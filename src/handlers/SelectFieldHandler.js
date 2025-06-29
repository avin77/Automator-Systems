/**
 * @fileoverview Specialized handler for select dropdown fields in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for select dropdown fields. This handler
 * provides specific logic for interacting with select dropdowns.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class SelectFieldHandler extends FieldHandlerBase {
  /**
   * Creates a new select field handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][SelectFieldHandler]';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    // Handle select dropdowns, but not specialized fields like country selects
    return field.tagName === 'SELECT' && !fieldType.isCountry;
  }
  
  /**
   * Handle a select field by choosing an appropriate option
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    this._log(`Handling select field: "${label}"`);
    
    // Determine field characteristics
    const isExperience = 
      label.toLowerCase().includes('experience') || 
      label.toLowerCase().includes('years') || 
      this.config.experienceKeywords?.some(keyword => 
        label.toLowerCase().includes(keyword.toLowerCase())
      );
    
    // Get the appropriate value
    const selectValue = await this._getFieldValue(label, {
      providedValue: value,
      isExperience
    });
    
    if (!selectValue) {
      this._log(`No value available for select field: "${label}"`);
      return false;
    }
    
    try {
      // Get available options
      const options = Array.from(field.options);
      if (!options.length) {
        this._log(`No options found for select field: "${label}"`);
        return false;
      }
      
      // Filter out placeholder/disabled options
      const availableOptions = options.filter(opt => 
        !opt.disabled && 
        opt.text.trim() !== '' && 
        !opt.text.toLowerCase().includes('select')
      );
      
      if (!availableOptions.length) {
        this._log(`No valid options for select field: "${label}"`);
        return false;
      }
      
      // Try to find exact match first
      for (const opt of availableOptions) {
        if (opt.text.toLowerCase() === selectValue.toLowerCase() || 
            opt.value.toLowerCase() === selectValue.toLowerCase()) {
          this._log(`Selected exact match option: "${opt.text}"`);
          field.value = opt.value;
          this._dispatchEvent(field, 'change');
          await this._delay(this.delays.selectChange || 200);
          return true;
        }
      }
      
      // Try partial match
      for (const opt of availableOptions) {
        if (opt.text.toLowerCase().includes(selectValue.toLowerCase()) || 
            selectValue.toLowerCase().includes(opt.text.toLowerCase())) {
          this._log(`Selected partial match option: "${opt.text}" for "${selectValue}"`);
          field.value = opt.value;
          this._dispatchEvent(field, 'change');
          await this._delay(this.delays.selectChange || 200);
          return true;
        }
      }
      
      // For experience fields, try to match numbers
      if (isExperience) {
        const experienceYears = parseInt(selectValue);
        if (!isNaN(experienceYears)) {
          // Try to find an option with the same number or closest above
          let bestOption = null;
          let bestDiff = Infinity;
          
          for (const opt of availableOptions) {
            const optionYears = parseInt(opt.text);
            if (!isNaN(optionYears)) {
              // Prefer options that are >= the target years but closest
              if (optionYears >= experienceYears && optionYears - experienceYears < bestDiff) {
                bestOption = opt;
                bestDiff = optionYears - experienceYears;
              }
            }
          }
          
          if (bestOption) {
            this._log(`Selected experience option: "${bestOption.text}" for ${experienceYears} years`);
            field.value = bestOption.value;
            this._dispatchEvent(field, 'change');
            await this._delay(this.delays.selectChange || 200);
            return true;
          }
        }
      }
      
      // If no match found, use first valid option
      this._log(`No match found, using first option: "${availableOptions[0].text}"`);
      field.value = availableOptions[0].value;
      this._dispatchEvent(field, 'change');
      await this._delay(this.delays.selectChange || 200);
      
      return true;
    } catch (error) {
      this._logError('Error handling select field:', error);
      return false;
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = SelectFieldHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.SelectFieldHandler = SelectFieldHandler;
} 