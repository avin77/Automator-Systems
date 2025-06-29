/**
 * @fileoverview Specialized handler for radio button groups in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for radio button groups. This handler
 * provides specific logic for interacting with radio buttons.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class RadioGroupHandler extends FieldHandlerBase {
  /**
   * Creates a new radio group handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][RadioGroupHandler]';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    return field.tagName === 'INPUT' && field.type === 'radio';
  }
  
  /**
   * Handle a radio button group by selecting the appropriate option
   * 
   * @param {HTMLElement} field - The field to handle
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(field, label, value = null) {
    // Get all radio buttons in the same group
    if (!field.name) {
      this._log(`Radio button has no name, can't find group`);
      return false;
    }
    
    const radioGroup = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
    if (!radioGroup || radioGroup.length === 0) {
      this._log(`No radio buttons found in group: ${field.name}`);
      return false;
    }
    
    this._log(`Handling radio group: "${label}" with ${radioGroup.length} options`);
    
    // Get the fieldset or parent element that contains the radio group
    const fieldset = field.closest('fieldset');
    let groupLabel = label;
    
    // If there's a fieldset with a legend, use that as the group label
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend && legend.innerText.trim()) {
        groupLabel = legend.innerText.trim();
        this._log(`Using fieldset legend as group label: "${groupLabel}"`);
      }
    }
    
    // Determine if this is a consent/agreement field
    const isConsent = 
      groupLabel.toLowerCase().includes('agree') || 
      groupLabel.toLowerCase().includes('consent') || 
      groupLabel.toLowerCase().includes('terms') || 
      groupLabel.toLowerCase().includes('privacy') ||
      this.config.termsKeywords?.some(keyword => 
        groupLabel.toLowerCase().includes(keyword.toLowerCase())
      );
    
    // Get the appropriate value
    const radioValue = await this._getFieldValue(groupLabel, {
      providedValue: value,
      isConsent
    });
    
    if (!radioValue) {
      this._log(`No value available for radio group: "${groupLabel}"`);
      return false;
    }
    
    try {
      // For consent questions, prefer "Yes" or affirmative answers
      if (isConsent) {
        const yesRadio = this._findYesRadio(radioGroup);
        if (yesRadio) {
          this._log(`Selected affirmative option for consent question`);
          yesRadio.checked = true;
          this._dispatchEvent(yesRadio, 'click');
          this._dispatchEvent(yesRadio, 'change');
          await this._delay(this.delays.radioClick || 200);
          return true;
        }
      }
      
      // Try to match the value with radio button labels
      for (const radio of radioGroup) {
        // Get the label for this specific radio button
        const radioLabel = this._getRadioButtonLabel(radio);
        
        if (radioLabel && 
            (radioLabel.toLowerCase() === radioValue.toLowerCase() || 
             radioLabel.toLowerCase().includes(radioValue.toLowerCase()) || 
             radioValue.toLowerCase().includes(radioLabel.toLowerCase()))) {
          
          this._log(`Selected radio option: "${radioLabel}" for value: "${radioValue}"`);
          radio.checked = true;
          this._dispatchEvent(radio, 'click');
          this._dispatchEvent(radio, 'change');
          await this._delay(this.delays.radioClick || 200);
          return true;
        }
      }
      
      // If no match found, use the first option for simplicity
      this._log(`No match found, selecting first radio option`);
      const firstRadio = radioGroup[0];
      firstRadio.checked = true;
      this._dispatchEvent(firstRadio, 'click');
      this._dispatchEvent(firstRadio, 'change');
      await this._delay(this.delays.radioClick || 200);
      
      return true;
    } catch (error) {
      this._logError('Error handling radio group:', error);
      return false;
    }
  }
  
  /**
   * Find the "Yes" or affirmative radio button in a group
   * 
   * @private
   * @param {NodeList} radioGroup - The radio button group
   * @returns {HTMLElement|null} - The "Yes" radio button or null if not found
   */
  _findYesRadio(radioGroup) {
    const affirmativeTerms = ['yes', 'agree', 'accept', 'true', 'y', 'oui', 'si', 'ja'];
    
    for (const radio of radioGroup) {
      const label = this._getRadioButtonLabel(radio);
      if (label && affirmativeTerms.some(term => label.toLowerCase() === term)) {
        return radio;
      }
    }
    
    return null;
  }
  
  /**
   * Get the label text for a specific radio button
   * 
   * @private
   * @param {HTMLElement} radio - The radio button
   * @returns {string} - The label text or empty string if not found
   */
  _getRadioButtonLabel(radio) {
    // Check for an associated label
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label && label.innerText) {
        return label.innerText.trim();
      }
    }
    
    // Check for a label as a parent
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      // Get the text content excluding the radio button's text
      const clone = parentLabel.cloneNode(true);
      const radioClone = clone.querySelector('input[type="radio"]');
      if (radioClone) {
        radioClone.remove();
      }
      return clone.innerText.trim();
    }
    
    // Check for a label as a sibling
    let sibling = radio.nextElementSibling;
    if (sibling && (sibling.tagName === 'LABEL' || 
                   sibling.classList.contains('artdeco-text-input--label') || 
                   sibling.classList.contains('fb-dash-form-element__label'))) {
      return sibling.innerText.trim();
    }
    
    // Check for common LinkedIn patterns
    const parentDiv = radio.parentElement;
    if (parentDiv) {
      const labelDiv = parentDiv.querySelector('.fb-dash-form-element__label, .artdeco-text-input--label');
      if (labelDiv) {
        return labelDiv.innerText.trim();
      }
    }
    
    return '';
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = RadioGroupHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.RadioGroupHandler = RadioGroupHandler;
} 