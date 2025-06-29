/**
 * @fileoverview Utility class for detecting field types and characteristics.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * FieldDetector is responsible for identifying field types and characteristics
 * such as labels, visibility, and specific field purposes (country, city, etc.).
 * 
 * @class
 */
class FieldDetector {
  /**
   * Creates a new field detector
   * 
   * @param {Object} config - Configuration options
   */
  constructor(config) {
    this.config = config || {};
    
    // Initialize keyword lists from config or use defaults
    this.experienceKeywords = this.config.experienceKeywords || [
      'year of experience', 'years of experience', 'experience in'
    ];
    
    this.summaryKeywords = this.config.summaryKeywords || [
      'summary', 'describe', 'explain', 'detail', 'elaborate'
    ];
    
    this.locationKeywords = this.config.locationKeywords || [
      'location', 'city', 'country', 'state', 'province'
    ];
    
    this.termsKeywords = this.config.termsKeywords || [
      'terms', 'conditions', 'privacy', 'policy', 'consent'
    ];
    
    this._logPrefix = '[EasyApplyPlugin][FieldDetector]';
  }
  
  /**
   * Get the label text for a field
   * 
   * @param {HTMLElement} field - The field to get the label for
   * @returns {string} - The label text or a default string if not found
   */
  getLabelForField(field) {
    if (!field) return '[Unknown Field]';
    let labelText = '';

    // 1. Direct label via `for` attribute
    if (field.id) {
      const labelEl = document.querySelector(`label[for='${field.id}']`);
      if (labelEl && labelEl.innerText) labelText = labelEl.innerText.trim();
    }

    // 2. `aria-label`
    if (!labelText && field.getAttribute('aria-label')) {
      labelText = field.getAttribute('aria-label').trim();
    }
    
    // 3. `aria-labelledby`
    if (!labelText && field.getAttribute('aria-labelledby')) {
      const labelledbyIds = field.getAttribute('aria-labelledby').split(' ');
      const labelTexts = labelledbyIds.map(id => {
        const el = document.getElementById(id);
        return el ? el.innerText.trim() : '';
      }).filter(text => text);
      
      if (labelTexts.length > 0) {
        labelText = labelTexts.join(' ');
      }
    }

    // 4. Placeholder
    if (!labelText && field.placeholder) {
      labelText = field.placeholder.trim();
    }
    
    // 5. Parent element's label (common in LinkedIn)
    if (!labelText) {
      const parentLabelElement = field.closest('div.fb-dash-form-element__label, div.artdeco-form-item__label, div.jobs-form-element__label');
      if (parentLabelElement && parentLabelElement.innerText) {
        labelText = parentLabelElement.innerText.trim();
      } else {
        const grandParent = field.closest('.artdeco-form-item, .fb-dash-form-element, .jobs-form-element');
        if (grandParent) {
          const potentialLabel = grandParent.querySelector('label, .fb-form-element-label, .artdeco-form-item__label, .jobs-form-element__label');
          if (potentialLabel && potentialLabel.innerText) {
            if (!potentialLabel.hasAttribute('for') || potentialLabel.getAttribute('for') === field.id) {
              labelText = potentialLabel.innerText.trim();
            }
          }
        }
      }
    }
    
    // 6. Fallback to name or id
    if (!labelText && field.name) labelText = field.name.trim();
    if (!labelText && field.id) labelText = field.id.trim();
    
    return labelText || '[Unknown Field]';
  }
  
  /**
   * Check if a field is visible and can be interacted with
   * 
   * @param {HTMLElement} field - The field to check
   * @returns {boolean} - Whether the field is visible
   */
  isElementVisible(field) {
    if (!field) return false;
    if (!field.isConnected) return false;
    
    const style = window.getComputedStyle(field);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    // Check if field has zero dimensions, but exclude radio/checkboxes which might be styled with zero size
    if (field.offsetWidth === 0 || field.offsetHeight === 0) {
      if (!(field.tagName === 'INPUT' && (field.type === 'radio' || field.type === 'checkbox'))) {
        return false;
      }
    }
    
    // Check if any parent is hidden
    let parent = field.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
        return false;
      }
      parent = parent.parentElement;
    }
    
    return true;
  }
  
  /**
   * Check if a field is blank/empty
   * 
   * @param {HTMLElement} field - The field to check
   * @returns {boolean} - Whether the field is blank
   */
  isFieldBlank(field) {
    const fieldType = field.type ? field.type.toLowerCase() : field.tagName.toLowerCase();
    
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      return !field.checked;
    } else if (fieldType === 'select-one' || fieldType === 'select') {
      return field.selectedIndex === -1 || 
             field.value === '' || 
             (field.options[field.selectedIndex] && 
              (field.options[field.selectedIndex].text.toLowerCase().includes('select') || 
               field.options[field.selectedIndex].text.trim() === '' ||
               field.options[field.selectedIndex].disabled));
    } else {
      return !field.value || field.value.trim() === '';
    }
  }
  
  /**
   * Detect the type and characteristics of a field
   * 
   * @param {HTMLElement} field - The field to detect
   * @param {string} label - The field label
   * @returns {Object} - Object with field type information
   */
  detectFieldType(field, label) {
    const labelLower = label.toLowerCase();
    const fieldType = field.type ? field.type.toLowerCase() : field.tagName.toLowerCase();
    const fieldId = field.id ? field.id.toLowerCase() : '';
    
    // Create result object with all characteristics
    const result = {
      isText: fieldType === 'text' || fieldType === 'textarea',
      isSelect: fieldType === 'select-one' || fieldType === 'select',
      isRadio: fieldType === 'radio',
      isCheckbox: fieldType === 'checkbox',
      isTypeahead: field.getAttribute('role') === 'combobox' && field.getAttribute('aria-autocomplete') === 'list',
      isCountry: this._isCountryField(field, label),
      isCity: this._isCityField(field, label),
      isPhone: this._isPhoneField(field, label),
      isExperience: this._isExperienceField(field, label),
      isSummary: this._isSummaryField(field, label),
      isConsent: this._isConsentField(field, label)
    };
    
    return result;
  }
  
  /**
   * Check if a field is a country field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is a country field
   */
  _isCountryField(field, label) {
    const labelLower = label.toLowerCase();
    const fieldId = field.id ? field.id.toLowerCase() : '';
    
    // Check for country indicators in label
    if (labelLower.includes('country') || 
        labelLower === 'country' || 
        labelLower.includes('country name') || 
        labelLower.includes('country/region')) {
      return true;
    }
    
    // Check for country indicators in ID
    if (fieldId.includes('country') && !fieldId.includes('countrycode')) {
      return true;
    }
    
    // For select fields, check if options contain country names
    if (field.tagName === 'SELECT' && field.options.length > 10) {
      const commonCountries = ['india', 'united states', 'canada', 'australia', 'united kingdom'];
      let countryCount = 0;
      
      for (let i = 0; i < Math.min(field.options.length, 20); i++) {
        const optionText = field.options[i].text.toLowerCase();
        if (commonCountries.some(country => optionText.includes(country))) {
          countryCount++;
        }
      }
      
      // If multiple common countries found in options, likely a country field
      if (countryCount >= 3) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a field is a city field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is a city field
   */
  _isCityField(field, label) {
    const labelLower = label.toLowerCase();
    const fieldId = field.id ? field.id.toLowerCase() : '';
    
    return labelLower.includes('city') || 
           labelLower === 'city' || 
           fieldId.includes('city');
  }
  
  /**
   * Check if a field is a phone field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is a phone field
   */
  _isPhoneField(field, label) {
    const labelLower = label.toLowerCase();
    const fieldId = field.id ? field.id.toLowerCase() : '';
    const fieldType = field.type ? field.type.toLowerCase() : '';
    
    return labelLower.includes('phone') || 
           labelLower.includes('mobile') || 
           fieldId.includes('phone') || 
           fieldType === 'tel';
  }
  
  /**
   * Check if a field is an experience field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is an experience field
   */
  _isExperienceField(field, label) {
    const labelLower = label.toLowerCase();
    
    return labelLower.includes('experience') || 
           labelLower.includes('years') || 
           this.experienceKeywords.some(keyword => 
             labelLower.includes(keyword.toLowerCase())
           );
  }
  
  /**
   * Check if a field is a summary field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is a summary field
   */
  _isSummaryField(field, label) {
    const labelLower = label.toLowerCase();
    
    return field.tagName === 'TEXTAREA' || 
           labelLower.includes('summary') || 
           labelLower.includes('cover letter') || 
           labelLower.includes('additional information') || 
           this.summaryKeywords.some(keyword => 
             labelLower.includes(keyword.toLowerCase())
           );
  }
  
  /**
   * Check if a field is a consent field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The field label
   * @returns {boolean} - Whether the field is a consent field
   */
  _isConsentField(field, label) {
    const labelLower = label.toLowerCase();
    
    return labelLower.includes('agree') || 
           labelLower.includes('consent') || 
           labelLower.includes('terms') || 
           labelLower.includes('privacy') ||
           this.termsKeywords.some(keyword => 
             labelLower.includes(keyword.toLowerCase())
           );
  }
  
  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    console.log(`${this._logPrefix} ${message}`);
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = FieldDetector;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.FieldDetector = FieldDetector;
} 