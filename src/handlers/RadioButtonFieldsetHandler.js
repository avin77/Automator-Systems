/**
 * @fileoverview Specialized handler for fieldsets containing radio button groups in forms.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Specialized handler for fieldsets containing radio button groups. This handler
 * provides specific logic for interacting with radio buttons at the fieldset level.
 * 
 * @class
 * @extends FieldHandlerBase
 */
class RadioButtonFieldsetHandler extends FieldHandlerBase {
  /**
   * Creates a new radio button fieldset handler
   * 
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    super(dependencies);
    this._logPrefix = '[EasyApplyPlugin][RadioButtonFieldsetHandler]';
  }
  
  /**
   * Determines if this handler can handle the given field
   * 
   * @param {HTMLElement} field - The field to check
   * @param {Object} fieldType - Object containing field type information
   * @returns {boolean} - Whether this handler can handle the field
   */
  canHandle(field, fieldType) {
    // Check if it's a fieldset
    if (field.tagName !== 'FIELDSET') return false;
    
    // Check if it contains radio buttons
    const radioButtons = field.querySelectorAll('input[type="radio"]');
    return radioButtons && radioButtons.length > 0;
  }
  
  /**
   * Handle a radio button fieldset by selecting the appropriate option
   * 
   * @param {HTMLElement} fieldset - The fieldset containing radio buttons
   * @param {string} label - The field label
   * @param {string} [value=null] - Optional value to use
   * @returns {Promise<boolean>} - Whether handling was successful
   */
  async handle(fieldset, label, value = null) {
    try {
      // Get all radio buttons in the fieldset
      const radioButtons = fieldset.querySelectorAll('input[type="radio"]');
      
      if (!radioButtons || radioButtons.length === 0) {
        this._log(`No radio buttons found in fieldset`);
        return false;
      }
      
      // Get the question label from the legend
      let questionLabel = label;
      const legend = fieldset.querySelector('legend');
      if (legend) {
        const legendText = this._getTextContent(legend);
        if (legendText) {
          questionLabel = legendText;
        }
      }
      
      this._log(`Handling radio button fieldset: "${questionLabel}" with ${radioButtons.length} options`);
      
      // Get all option labels
      const options = [];
      for (const radio of radioButtons) {
        const optionLabel = this._getRadioButtonLabel(radio);
        if (optionLabel) {
          options.push({
            element: radio,
            label: optionLabel,
            value: radio.value
          });
        }
      }
      
      this._log(`Found ${options.length} labeled options`);
      
      // Determine if this is a consent/agreement field
      const isConsent = 
        questionLabel.toLowerCase().includes('agree') || 
        questionLabel.toLowerCase().includes('consent') || 
        questionLabel.toLowerCase().includes('terms') || 
        questionLabel.toLowerCase().includes('privacy') ||
        this.config.termsKeywords?.some(keyword => 
          questionLabel.toLowerCase().includes(keyword.toLowerCase())
        );
      
      // For consent questions, always select "Yes" or affirmative option
      if (isConsent) {
        const affirmativeTerms = ['yes', 'agree', 'accept', 'true', 'y', 'oui', 'si', 'ja'];
        for (const option of options) {
          if (affirmativeTerms.some(term => option.label.toLowerCase().includes(term))) {
            this._log(`Selected affirmative option for consent question: "${option.label}"`);
            await this._selectRadioOption(option.element);
            return true;
          }
        }
      }
      
      // Build option list for AI to choose from
      const optionLabels = options.map(o => o.label);
      
             // Get the answer from Gemini
      let selectedOption = null;
      
      // Use provided value if available
      if (value) {
        this._log(`Using provided value: "${value}"`);
        // Find the option that best matches the provided value
        selectedOption = this._findBestMatchingOption(options, value);
      } else {
        // Log the question and options for debugging
        console.log(`[EasyApplyPlugin][RadioFieldset] 🔍 Processing question: "${questionLabel}"`);
        console.log(`[EasyApplyPlugin][RadioFieldset] Options (${options.length}):`);
        options.forEach((opt, idx) => {
          console.log(`[EasyApplyPlugin][RadioFieldset]   ${idx+1}. ${opt.label}`);
        });
        
        // Use AI to get an appropriate answer
        const answer = await this._getFieldValue(questionLabel, {
          optionsList: optionLabels,
          isRadioGroup: true,
          isConsent,
          providedValue: value
        });
        
        if (answer) {
          console.log(`[EasyApplyPlugin][RadioFieldset] ✅ Got answer from AI: "${answer}"`);
          selectedOption = this._findBestMatchingOption(options, answer);
          
          if (selectedOption) {
            console.log(`[EasyApplyPlugin][RadioFieldset] 📌 Matched to option: "${selectedOption.label}"`);
          } else {
            console.log(`[EasyApplyPlugin][RadioFieldset] ⚠️ Couldn't match AI answer to any option`);
          }
        } else {
          console.log(`[EasyApplyPlugin][RadioFieldset] ❌ No answer received from AI`);
        }
      }
      
      // If no option was selected by AI, use appropriate fallback
      if (!selectedOption) {
        // For experience/skill level questions, select highest option
        if (this._isSkillLevelQuestion(questionLabel)) {
          selectedOption = this._selectHighestSkillLevel(options);
        } 
        // For years of experience, select a moderate amount
        else if (this._isYearsOfExperienceQuestion(questionLabel)) {
          selectedOption = this._selectModerateExperience(options);
        }
        // For language proficiency, select highest
        else if (this._isLanguageProficiencyQuestion(questionLabel)) {
          selectedOption = this._selectHighestProficiency(options);
        }
        // Default: select first option
        else {
          this._log(`No specific answer, selecting first option`);
          selectedOption = options[0];
        }
      }
      
             if (selectedOption) {
        console.log(`[EasyApplyPlugin][RadioFieldset] 🟢 Selected option: "${selectedOption.label}"`);
        await this._selectRadioOption(selectedOption.element);
        return true;
      }
      
      // If we couldn't find a matching option, select the first option as fallback
      if (options.length > 0) {
        console.log(`[EasyApplyPlugin][RadioFieldset] ⚠️ No matching option found, selecting first option as fallback: "${options[0].label}"`);
        await this._selectRadioOption(options[0].element);
        return true;
      }
      
      console.log(`[EasyApplyPlugin][RadioFieldset] ❌ Failed to handle radio button fieldset: no options available`);
      return false;
    } catch (error) {
      this._logError('Error handling radio button fieldset:', error);
      return false;
    }
  }
  
  /**
   * Select a radio button and dispatch appropriate events
   * 
   * @private
   * @param {HTMLElement} radio - The radio button to select
   */
  async _selectRadioOption(radio) {
    radio.checked = true;
    this._dispatchEvent(radio, 'click');
    this._dispatchEvent(radio, 'change');
    await this._delay(this.delays.radioClick || 200);
  }
  
  /**
   * Checks if the question is about skill or proficiency level
   * 
   * @private
   * @param {string} question - The question text
   * @returns {boolean} - Whether it's a skill level question
   */
  _isSkillLevelQuestion(question) {
    const skillLevelKeywords = [
      'skill level', 'proficiency', 'expertise', 'competency', 'competence', 
      'how skilled', 'how proficient', 'how good', 'level of skill',
      'rate your', 'skill rating'
    ];
    
    return skillLevelKeywords.some(keyword => 
      question.toLowerCase().includes(keyword)
    );
  }
  
  /**
   * Checks if the question is about years of experience
   * 
   * @private
   * @param {string} question - The question text
   * @returns {boolean} - Whether it's a years of experience question
   */
  _isYearsOfExperienceQuestion(question) {
    const yearsKeywords = [
      'years of experience', 'years experience', 'how long', 'how many years',
      'experience in years', 'work experience', 'job experience'
    ];
    
    return yearsKeywords.some(keyword => 
      question.toLowerCase().includes(keyword)
    );
  }
  
  /**
   * Checks if the question is about language proficiency
   * 
   * @private
   * @param {string} question - The question text
   * @returns {boolean} - Whether it's a language proficiency question
   */
     _isLanguageProficiencyQuestion(question) {
     const languageKeywords = [
       'language', 'proficiency', 'speak', 'written', 'oral', 'verbal', 
       'writing', 'reading', 'fluency', 'fluent', 'bilingual',
       'a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'cefr', 'native'
     ];
     
     // Check for any language name in the question
     const languageNames = [
       'english', 'spanish', 'french', 'german', 'italian', 'portuguese',
       'russian', 'mandarin', 'chinese', 'japanese', 'korean', 'arabic',
       'hindi', 'bengali', 'vietnamese', 'thai', 'turkish', 'dutch'
     ];
     
     return languageKeywords.some(keyword => question.toLowerCase().includes(keyword)) ||
            languageNames.some(language => question.toLowerCase().includes(language));
   }
  
  /**
   * Selects the highest skill level option
   * 
   * @private
   * @param {Array<Object>} options - The available options
   * @returns {Object} - The selected option
   */
  _selectHighestSkillLevel(options) {
    // Keywords that indicate high skill levels, in descending order
    const highSkillKeywords = [
      'expert', 'advanced', 'proficient', 'experienced', 'skilled',
      'intermediate', 'beginner', 'novice', 'basic', 'no experience'
    ];
    
    // Try to find the highest skill level option
    for (const keyword of highSkillKeywords) {
      for (const option of options) {
        if (option.label.toLowerCase().includes(keyword)) {
          this._log(`Selected highest skill level: "${option.label}" (matching "${keyword}")`);
          return option;
        }
      }
    }
    
    // If no skill level keywords found, try numerical values (higher is better)
    const numericalOptions = options.filter(option => 
      /\d+/.test(option.label) || /\d+/.test(option.value)
    );
    
    if (numericalOptions.length > 0) {
      // Sort by numerical value, descending
      numericalOptions.sort((a, b) => {
        const aMatch = a.label.match(/\d+/) || a.value.match(/\d+/);
        const bMatch = b.label.match(/\d+/) || b.value.match(/\d+/);
        
        if (aMatch && bMatch) {
          return parseInt(bMatch[0], 10) - parseInt(aMatch[0], 10);
        }
        return 0;
      });
      
      this._log(`Selected highest numerical option: "${numericalOptions[0].label}"`);
      return numericalOptions[0];
    }
    
    // Default to last option, which is often the highest
    this._log(`No skill level keyword matches, using last option as default highest`);
    return options[options.length - 1];
  }
  
  /**
   * Selects a moderate experience level (not too high, not too low)
   * 
   * @private
   * @param {Array<Object>} options - The available options
   * @returns {Object} - The selected option
   */
  _selectModerateExperience(options) {
    // Prefer options with 3-5 years of experience
    const moderateYears = ['3', '4', '5', '3-5', '2-5'];
    
    for (const year of moderateYears) {
      for (const option of options) {
        if (option.label.includes(year)) {
          this._log(`Selected moderate experience: "${option.label}" (matching "${year}")`);
          return option;
        }
      }
    }
    
    // If we can't find a moderate option, aim for the middle of the list
    const middleIndex = Math.floor(options.length / 2);
    this._log(`Selected middle option as moderate experience: "${options[middleIndex].label}"`);
    return options[middleIndex];
  }
  
  /**
   * Selects the highest language proficiency option
   * 
   * @private
   * @param {Array<Object>} options - The available options
   * @returns {Object} - The selected option
   */
     _selectHighestProficiency(options) {
    // Keywords that indicate high language proficiency, in descending order of preference
    const proficiencyKeywords = [
      'native', 'fluent', 'bilingual', 'c2', 'c1', 'advanced', 'b2', 'upper intermediate',
      'intermediate', 'b1', 'a2', 'beginner', 'a1', 'basic', 'elementary', 'none'
    ];
    
    // Try to find the highest proficiency level
    for (const keyword of proficiencyKeywords) {
      for (const option of options) {
        if (option.label.toLowerCase().includes(keyword)) {
          this._log(`Selected proficiency level: "${option.label}" (matching "${keyword}")`);
          return option;
        }
      }
    }
    
    // If we have 4-5 options, the highest (native/fluent) is typically last or second-to-last
    if (options.length >= 4) {
      const highestOption = options[options.length - 1];
      this._log(`Selected highest proficiency option by position: "${highestOption.label}"`);
      return highestOption;
    }
    
    // Default to last option if nothing else works
    this._log(`No proficiency keyword matches, using last option as default`);
    return options[options.length - 1];
  }
  
  /**
   * Find the option that best matches the provided answer
   * 
   * @private
   * @param {Array<Object>} options - Available options
   * @param {string} answer - Answer to match
   * @returns {Object|null} - Best matching option or null
   */
  _findBestMatchingOption(options, answer) {
    if (!answer) return null;
    
    // First try exact match
    for (const option of options) {
      if (option.label.toLowerCase() === answer.toLowerCase()) {
        this._log(`Found exact match: "${option.label}"`);
        return option;
      }
    }
    
    // Then try includes match
    for (const option of options) {
      if (option.label.toLowerCase().includes(answer.toLowerCase()) || 
          answer.toLowerCase().includes(option.label.toLowerCase())) {
        this._log(`Found partial match: "${option.label}" for "${answer}"`);
        return option;
      }
    }
    
    // Try matching the first few words
    const answerFirstWords = answer.split(' ').slice(0, 3).join(' ').toLowerCase();
    for (const option of options) {
      const optionFirstWords = option.label.split(' ').slice(0, 3).join(' ').toLowerCase();
      if (optionFirstWords.includes(answerFirstWords) || answerFirstWords.includes(optionFirstWords)) {
        this._log(`Found first words match: "${option.label}" for "${answer}"`);
        return option;
      }
    }
    
    this._log(`No match found for answer: "${answer}"`);
    return null;
  }
  
  /**
   * Get text content from an element, removing any hidden spans
   * 
   * @private
   * @param {HTMLElement} element - Element to get text from
   * @returns {string} - Cleaned text content
   */
  _getTextContent(element) {
    if (!element) return '';
    
    // Clone element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove hidden elements
    const hiddenElements = clone.querySelectorAll('.visually-hidden, [aria-hidden="true"]');
    for (const hidden of hiddenElements) {
      hidden.remove();
    }
    
    return clone.textContent.trim();
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
      if (label) {
        return this._getTextContent(label);
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
      return this._getTextContent(clone);
    }
    
    // Check for a label as a sibling
    let sibling = radio.nextElementSibling;
    if (sibling && (sibling.tagName === 'LABEL' || 
                   sibling.classList.contains('t-14') ||
                   sibling.classList.contains('artdeco-text-input--label') || 
                   sibling.classList.contains('fb-dash-form-element__label'))) {
      return this._getTextContent(sibling);
    }
    
    return '';
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = RadioButtonFieldsetHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.RadioButtonFieldsetHandler = RadioButtonFieldsetHandler;
} 