/**
 * @fileoverview Main coordinator class for form filling operations.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * FormFiller is the main coordinator class that manages form filling
 * operations. It orchestrates specialized field handlers, detects fields,
 * and provides a high-level API for filling forms.
 * 
 * @class
 */
class FormFiller {
  /**
   * Create a new FormFiller instance
   * 
   * @param {HTMLElement} modalElement - The modal element containing the form
   * @param {Object} config - Configuration object
   * @param {Function} getGeminiAnswer - Function to get answers from Gemini API
   * @param {string} userCV - User's CV text
   * @param {string} geminiApiKey - Gemini API key
   * @param {Object} qaCache - Cache of question/answer pairs
   * @param {Object} settings - User settings for form filling
   */
  constructor(modalElement, config, getGeminiAnswer, userCV, geminiApiKey, qaCache, settings = {}) {
    this.modalElement = modalElement;
    this.config = config || {};
    this.getGeminiAnswer = getGeminiAnswer;
    this.userCV = userCV || '';
    this.geminiApiKey = geminiApiKey || '';
    this.qaCache = qaCache || {};
    
    // User settings for form filling
    this.settings = {
      phoneNumber: settings.phoneNumber || '',
      mobileNumber: settings.mobileNumber || '',
      countryCode: settings.countryCode || '+1',
      email: settings.email || '',
      firstName: settings.firstName || '',
      lastName: settings.lastName || '',
      ...settings
    };
    
    this._logPrefix = '[EasyApplyPlugin][FormFiller]';
    
    // Initialize dependencies
    this._initializeDependencies();
    
    // Create field handlers
    this._createFieldHandlers();
    
    this._log('FormFiller initialized');
  }
  
  /**
   * Initialize dependencies used by field handlers
   * 
   * @private
   */
  _initializeDependencies() {
    try {
    // Create field detector
    this.fieldDetector = new FieldDetector(this.config);
    
    // Create cache manager
    this.cacheManager = new CacheManager(this.qaCache);
    
    // Create error handler
      this.errorHandler = new ErrorHandler('FormFiller');
      
      // Create DOM utils if available
      if (typeof DOMUtils === 'function') {
        this.domUtils = new DOMUtils(this.errorHandler);
        this._log('DOMUtils initialized');
      }
    
    // Create Gemini client
    this.geminiClient = new GeminiClient(
      this.getGeminiAnswer,
      this.geminiApiKey,
      this.userCV
    );
    
    // Create dependency injection container
    this.dependencies = {
      cacheManager: this.cacheManager,
      geminiClient: this.geminiClient,
      errorHandler: this.errorHandler,
      fieldDetector: this.fieldDetector,
        domUtils: this.domUtils,
      config: this.config
    };
    } catch (error) {
      console.error(`${this._logPrefix} Error initializing dependencies:`, error);
      // Create minimal dependencies to avoid further errors
      this.dependencies = {
        config: this.config || {}
      };
    }
  }
  
  /**
   * Create field handlers
   * 
   * @private
   * @returns {Array<Object>} - Array of field handler instances
   */
  _createFieldHandlers() {
    // Create dependencies object for field handlers
    const dependencies = {
      config: this.config,
      getGeminiAnswer: this.getGeminiAnswer,
      userCV: this.userCV,
      geminiApiKey: this.geminiApiKey,
      qaCache: this.qaCache,
      settings: this.settings,
      log: (msg) => this._log(msg),
      logError: (msg, error) => this._logError(msg, error)
    };
    
    this.dependencies = dependencies;
    
    // Create and return field handlers
    this.fieldHandlers = [
      new CountryFieldHandler(this.dependencies),
      new TypeaheadFieldHandler(this.dependencies),
      new RadioButtonFieldsetHandler(this.dependencies), // Add the fieldset handler before individual radio buttons
      new TextFieldHandler(this.dependencies),
      new SelectFieldHandler(this.dependencies),
      new RadioGroupHandler(this.dependencies),
      new CheckboxFieldHandler(this.dependencies)
    ];
    
    return this.fieldHandlers;
  }
  
  /**
   * Fill all fields in the form
   * 
   * @returns {Promise<boolean>} - Whether filling was successful
   */
  async fillForm() {
    try {
      this._log('Starting form filling');
      
      // Find all visible fields in the modal
      const fields = this._findVisibleFields();
      
      if (!fields.length) {
        this._log('No visible fields found in modal');
        return true; // Nothing to fill, so technically successful
      }
      
      this._log(`Found ${fields.length} visible fields`);
      
      // Process fields in priority order
      const success = await this._processFieldsInPriorityOrder(fields);
      
      // Final check and retry for any required blank fields
      if (success) {
        await this._retryRequiredBlankFields();
      }
      
      this._log('Form filling completed');
      return success;
    } catch (error) {
      this._logError('Error filling form:', error);
      return false;
    }
  }
  
  /**
   * Find all visible input fields in the modal that are part of the current step
   * 
   * @private
   * @returns {Array<HTMLElement>} - Array of visible field elements
   */
  _findVisibleFields() {
    if (!this.modalElement) return [];
    
    try {
      // First, try to find the current active step/panel
      let activePanel = null;
      
      // Common LinkedIn step/panel selectors
      const panelSelectors = [
        '.jobs-easy-apply-content div[aria-hidden="false"]',
        '.jobs-easy-apply-content .jobs-easy-apply-form-section__content',
        '.jobs-easy-apply-content .jobs-easy-apply-form-element',
        '.jobs-easy-apply-content .displayed',
        '.jobs-easy-apply-content .active',
        '.artdeco-modal__content div[aria-hidden="false"]',
        '.artdeco-modal__content .active-step',
        '.artdeco-modal__content .active-panel',
        // Additional selectors for LinkedIn's new form structure
        '.artdeco-modal__content',
        '.jobs-easy-apply-modal__content',
        '.artdeco-modal div[class*="form"]',
        '.artdeco-modal form',
        'div[data-test-modal] form',
        'div[data-test-modal] .ph5'
      ];
      
      // Try to find the active panel
      for (const selector of panelSelectors) {
        const panels = this.domUtils ? 
          this.domUtils.querySelectorAll(selector, this.modalElement) : 
          this.modalElement.querySelectorAll(selector);
          
        if (panels && panels.length > 0) {
          activePanel = panels[0];
          this._log(`Found active panel using selector: ${selector}`);
          break;
        }
      }
      
      // If no specific active panel found, use the entire modal
      const searchContext = activePanel || this.modalElement;
      this._log(`Searching for fields in ${activePanel ? 'active panel' : 'entire modal'}`);
      
      // Query all potential form fields using multiple approaches
      let potentialFields = [];
      
      // Approach 1: Standard form elements
      const standardSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';
      
      // Approach 2: LinkedIn specific selectors
      const linkedInSelectors = [
        // Input fields with specific classes
        '.artdeco-text-input--input',
        'input.fb-dash-form-element__text-input',
        // Select fields
        '.fb-dash-form-element__select-dropdown',
        // Textarea fields
        '.artdeco-text-input--textarea'
      ].join(', ');
      
      // Approach 3: Fields with specific attributes
      const attributeSelectors = [
        '[id*="firstName"]', 
        '[id*="lastName"]',
        '[id*="email"]',
        '[id*="phone"]',
        '[id*="country"]',
        '[aria-label*="phone"]',
        '[aria-label*="email"]',
        '[aria-label*="name"]',
        '[placeholder*="phone"]',
        '[placeholder*="email"]',
        '[placeholder*="name"]'
      ].join(', ');
      
      // Approach 4: Fieldsets with radio buttons or checkboxes
      const fieldsetSelector = 'fieldset:has(input[type="radio"]), fieldset:has(input[type="checkbox"])';
      
      // Combine all approaches
      if (this.domUtils) {
        // Use DOMUtils for safer querying
        const standardFields = this.domUtils.querySelectorAll(standardSelector, searchContext);
        const linkedInFields = this.domUtils.querySelectorAll(linkedInSelectors, searchContext);
        const attributeFields = this.domUtils.querySelectorAll(attributeSelectors, searchContext);
        
        // Try to query fieldsets - use a fallback if :has selector isn't supported
        let fieldsets = [];
        try {
          fieldsets = this.domUtils.querySelectorAll(fieldsetSelector, searchContext);
        } catch (e) {
          // Fallback for browsers that don't support :has selector
          const allFieldsets = this.domUtils.querySelectorAll('fieldset', searchContext);
          fieldsets = Array.from(allFieldsets).filter(fieldset => 
            fieldset.querySelector('input[type="radio"]') || fieldset.querySelector('input[type="checkbox"]')
          );
        }
        
        // Combine and deduplicate fields
        const allFields = [...standardFields, ...linkedInFields, ...attributeFields, ...fieldsets];
        potentialFields = [...new Set(allFields)];
      } else {
        // Fallback to direct DOM querying
        const standardFields = Array.from(searchContext.querySelectorAll(standardSelector));
        const linkedInFields = Array.from(searchContext.querySelectorAll(linkedInSelectors));
        const attributeFields = Array.from(searchContext.querySelectorAll(attributeSelectors));
        
        // Try to query fieldsets - use a fallback if :has selector isn't supported
        let fieldsets = [];
        try {
          fieldsets = Array.from(searchContext.querySelectorAll(fieldsetSelector));
        } catch (e) {
          // Fallback for browsers that don't support :has selector
          const allFieldsets = Array.from(searchContext.querySelectorAll('fieldset'));
          fieldsets = allFieldsets.filter(fieldset => 
            fieldset.querySelector('input[type="radio"]') || fieldset.querySelector('input[type="checkbox"]')
          );
        }
        
        // Combine and deduplicate fields
        const allFields = [...standardFields, ...linkedInFields, ...attributeFields, ...fieldsets];
        potentialFields = [...new Set(allFields)];
      }
      
      this._log(`Found ${potentialFields.length} potential fields using multiple selectors`);
      
      // Look for fields in form containers if none found directly
      if (potentialFields.length === 0) {
        this._log('No fields found with direct selectors, looking in form containers');
        
        // Find form containers
        const formContainers = this.domUtils ? 
          this.domUtils.querySelectorAll('.fb-dash-form-element, .artdeco-text-input--container', this.modalElement) : 
          this.modalElement.querySelectorAll('.fb-dash-form-element, .artdeco-text-input--container');
        
        for (const container of formContainers) {
          const containerFields = this.domUtils ? 
            this.domUtils.querySelectorAll('input, select, textarea', container) : 
            container.querySelectorAll('input, select, textarea');
          
          potentialFields = [...potentialFields, ...containerFields];
        }
        
        this._log(`Found ${potentialFields.length} fields in form containers`);
      }
      
      // Filter for visible fields using a more thorough visibility check
      const visibleFields = potentialFields.filter(field => {
        // Skip null or undefined fields
        if (!field) return false;
        
        // Basic visibility check
        const isVisible = this.domUtils ? 
          this.domUtils.isElementVisible(field) : 
          this.fieldDetector.isElementVisible(field);
          
        if (!isVisible) return false;
        
        // Additional checks for multi-step forms
        
        // 1. Check if field is in a hidden container
        let parent = field.parentElement;
        let isInHiddenContainer = false;
        
        while (parent && parent !== this.modalElement) {
          // Check for common hidden attributes
          if (parent.getAttribute('aria-hidden') === 'true' || 
              parent.hasAttribute('hidden') ||
              parent.style.display === 'none' ||
              parent.style.visibility === 'hidden' ||
              parent.classList.contains('hidden') ||
              parent.classList.contains('inactive') ||
              parent.classList.contains('not-displayed')) {
            isInHiddenContainer = true;
            break;
          }
          parent = parent.parentElement;
        }
        
        // 2. Check if field is actually interactive
        const isInteractive = !field.disabled && !field.readOnly;
        
        return isVisible && !isInHiddenContainer && isInteractive;
      });
      
      this._log(`Found ${visibleFields.length} visible fields out of ${potentialFields.length} potential fields`);
      
      // Log details of each visible field for debugging
      visibleFields.forEach((field, index) => {
        const fieldType = field.type || field.tagName.toLowerCase();
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const label = this.fieldDetector.getLabelForField(field);
        
        this._log(`Visible field ${index + 1}: type=${fieldType}, id=${fieldId}, name=${fieldName}, label="${label}"`);
      });
      
      return visibleFields;
    } catch (error) {
      this._logError('Error finding visible fields:', error);
      return [];
    }
  }
  
  /**
   * Process fields in priority order:
   * 1. Country fields first
   * 2. Other required fields
   * 3. Optional fields
   * 
   * @private
   * @param {Array<HTMLElement>} fields - Array of field elements
   * @returns {Promise<boolean>} - Whether processing was successful
   */
  async _processFieldsInPriorityOrder(fields) {
    // Group fields by priority
    const fieldGroups = this._groupFieldsByPriority(fields);
    
    // Process each group in order
    for (const [groupName, groupFields] of Object.entries(fieldGroups)) {
      this._log(`Processing ${groupName} (${groupFields.length} fields)`);
      
      for (const field of groupFields) {
        await this._processField(field);
        
        // Small delay between fields
        await this._delay(this.config.delays?.afterField || 100);
      }
    }
    
    return true;
  }
  
  /**
   * Group fields by priority
   * 
   * @private
   * @param {Array<HTMLElement>} fields - Array of field elements
   * @returns {Object} - Object with field groups
   */
  _groupFieldsByPriority(fields) {
    const countryFields = [];
    const requiredFields = [];
    const optionalFields = [];
    
    for (const field of fields) {
      // Get field label and type
      const label = this.fieldDetector.getLabelForField(field);
      const fieldType = this.fieldDetector.detectFieldType(field, label);
      
      // Check if field is blank
      const isBlank = this.fieldDetector.isFieldBlank(field);
      
      // Skip fields that already have values
      if (!isBlank) continue;
      
      // Determine if field is required
      const isRequired = field.hasAttribute('required') || 
                         field.getAttribute('aria-required') === 'true' ||
                         label.includes('*');
      
      // Group by priority
      if (fieldType.isCountry) {
        countryFields.push({ field, label, fieldType, isRequired });
      } else if (isRequired) {
        requiredFields.push({ field, label, fieldType, isRequired });
      } else {
        optionalFields.push({ field, label, fieldType, isRequired });
      }
    }
    
    return {
      'country fields': countryFields,
      'required fields': requiredFields,
      'optional fields': optionalFields
    };
  }
  
  /**
   * Process a single field
   * 
   * @private
   * @param {Object} fieldInfo - Object with field information
   * @param {HTMLElement} fieldInfo.field - The field element
   * @param {string} fieldInfo.label - The field label
   * @param {Object} fieldInfo.fieldType - Object with field type information
   * @param {boolean} fieldInfo.isRequired - Whether the field is required
   * @returns {Promise<boolean>} - Whether processing was successful
   */
  async _processField(fieldInfo) {
    const { field, label, fieldType, isRequired } = fieldInfo;
    
    this._log(`Processing field: "${label}" (required: ${isRequired})`);
    
    // Find appropriate handler
    const handler = this._findHandlerForField(field, fieldType);
    
    if (!handler) {
      this._log(`No handler found for field: "${label}"`);
      return false;
    }
    
    // Handle the field
    try {
      const success = await handler.handle(field, label);
      
      if (success) {
        this._log(`Successfully filled field: "${label}"`);
        
        // Check for errors after filling - only if the method exists
        if (this.errorHandler && typeof this.errorHandler.getErrorMessage === 'function') {
          const errorMessage = this.errorHandler.getErrorMessage(field);
          if (errorMessage) {
            this._log(`Error after filling field "${label}": ${errorMessage}`);
            return false;
          }
        }
        
        return true;
      } else {
        this._log(`Failed to fill field: "${label}"`);
        return false;
      }
    } catch (error) {
      this._logError(`Error handling field "${label}":`, error);
      return false;
    }
  }
  
  /**
   * Find appropriate handler for a field
   * 
   * @private
   * @param {HTMLElement} field - The field element
   * @param {Object} fieldType - Object with field type information
   * @returns {FieldHandlerBase|null} - The appropriate handler or null
   */
  _findHandlerForField(field, fieldType) {
    for (const handler of this.fieldHandlers) {
      if (handler.canHandle(field, fieldType)) {
        return handler;
      }
    }
    return null;
  }
  
  /**
   * Retry filling any required fields that are still blank
   * 
   * @private
   * @returns {Promise<boolean>} - Whether all required fields are filled
   */
  async _retryRequiredBlankFields() {
    this._log('Checking for remaining required blank fields');
    
    // Find all visible fields again
    const fields = this._findVisibleFields();
    
    // Check for required blank fields
    const requiredBlankFields = [];
    
    for (const field of fields) {
      // Check if field is required
      const isRequired = field.hasAttribute('required') || 
                         field.getAttribute('aria-required') === 'true';
      
      if (!isRequired) continue;
      
      // Check if field is blank
      const isBlank = this.fieldDetector.isFieldBlank(field);
      
      if (isBlank) {
        const label = this.fieldDetector.getLabelForField(field);
        const fieldType = this.fieldDetector.detectFieldType(field, label);
        
        requiredBlankFields.push({ field, label, fieldType, isRequired: true });
      }
    }
    
    if (requiredBlankFields.length === 0) {
      this._log('No required blank fields remaining');
      return true;
    }
    
    this._log(`Found ${requiredBlankFields.length} required blank fields, retrying`);
    
    // Retry each required blank field
    for (const fieldInfo of requiredBlankFields) {
      await this._processField(fieldInfo);
      await this._delay(this.config.delays?.afterField || 100);
    }
    
    return true;
  }
  
  /**
   * Wait for a specified amount of time
   * 
   * @private
   * @param {number} ms - The number of milliseconds to wait
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    if (this.errorHandler && typeof this.errorHandler.logInfo === 'function') {
      this.errorHandler.logInfo(message);
    } else {
    console.log(`${this._logPrefix} ${message}`);
    }
  }
  
  /**
   * Log an error message
   * 
   * @private
   * @param {string} message - The error message
   * @param {Error} error - The error object
   */
  _logError(message, error) {
    if (this.errorHandler && typeof this.errorHandler.logError === 'function') {
      this.errorHandler.logError(message, error);
    } else {
    console.error(`${this._logPrefix} ${message}`, error || '');
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    try {
      // Clean up field handlers
      if (this.fieldHandlers) {
        for (const handler of this.fieldHandlers) {
          if (handler && typeof handler.dispose === 'function') {
            handler.dispose();
          }
        }
        this.fieldHandlers = null;
      }
      
      // Clean up dependencies
      this.fieldDetector = null;
      this.cacheManager = null;
      this.geminiClient = null;
      this.domUtils = null;
      
      // Remove references to DOM elements
      this.modalElement = null;
      
      this._log('Resources disposed');
    } catch (error) {
      console.error(`${this._logPrefix} Error during disposal:`, error);
    }
  }

  /**
   * Handle phone number field
   * 
   * @param {HTMLElement} field - The phone number input field
   * @param {string} label - The label text for the field
   * @returns {boolean} - Whether the field was successfully handled
   */
  handlePhoneNumberField(field, label) {
    try {
      // Get field identifiers for logging
      const fieldId = field.id || '';
      const fieldName = field.name || '';
      this._log(`Handling phone number field: ${label || fieldName || fieldId}`);
      
      // Skip if field is already filled
      if (field.value && field.value.length > 5) {
        this._log('Phone field already has a value, skipping');
        return true;
      }
      
      // Determine if this is a country code field or a phone number field
      const isCountryCode = this._isCountryCodeField(field, label);
      
      if (isCountryCode) {
        this._log('This appears to be a country code field');
        return this._handleCountryCodeField(field);
      }
      
      // Check if this is a mobile/cell phone field
      const isMobileField = this._isMobilePhoneField(field, label);
      
      // Get phone number from settings
      let phoneNumber = '';
      if (isMobileField && this.settings.mobileNumber) {
        phoneNumber = this.settings.mobileNumber;
        this._log('Using mobile number for this field');
      } else if (this.settings.phoneNumber) {
        phoneNumber = this.settings.phoneNumber;
        this._log('Using regular phone number for this field');
      } else {
        this._log('No phone number found in settings, using default');
        phoneNumber = '9876543210'; // Default fallback
      }
      
      if (!phoneNumber) {
        this._log('No phone number available, skipping');
        return false;
      }
      
      // Format phone number based on field requirements
      let formattedNumber = this._formatPhoneNumber(phoneNumber, field);
      
      this._log(`Filling phone field with: ${formattedNumber}`);
      this._fillField(field, formattedNumber);
      return true;
    } catch (error) {
      this._logError('Error handling phone number field:', error);
      return false;
    }
  }
  
  /**
   * Check if a field is a country code field
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The label text
   * @returns {boolean} - Whether this is a country code field
   */
  _isCountryCodeField(field, label) {
    // Check field type
    if (field.tagName.toLowerCase() === 'select') {
      return true; // Most selects in phone sections are country codes
    }
    
    // Check label text
    if (label) {
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('country code') || 
          lowerLabel.includes('country') && lowerLabel.includes('code')) {
        return true;
      }
    }
    
    // Check field attributes
    const fieldId = (field.id || '').toLowerCase();
    const fieldName = (field.name || '').toLowerCase();
    const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
    
    return fieldId.includes('country') || 
           fieldName.includes('country') || 
           ariaLabel.includes('country') ||
           fieldId.includes('phoneNumber-country') ||
           fieldName.includes('phoneNumber-country');
  }
  
  /**
   * Check if a field is specifically for mobile/cell phone
   * 
   * @private
   * @param {HTMLElement} field - The field to check
   * @param {string} label - The label text
   * @returns {boolean} - Whether this is a mobile phone field
   */
  _isMobilePhoneField(field, label) {
    if (!label && !field.id && !field.name && !field.placeholder && !field.getAttribute('aria-label')) {
      return false;
    }
    
    const lowerLabel = (label || '').toLowerCase();
    const fieldId = (field.id || '').toLowerCase();
    const fieldName = (field.name || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
    
    const mobileTerms = ['mobile', 'cell', 'cellular'];
    
    return mobileTerms.some(term => 
      lowerLabel.includes(term) || 
      fieldId.includes(term) || 
      fieldName.includes(term) || 
      placeholder.includes(term) || 
      ariaLabel.includes(term)
    );
  }
  
  /**
   * Handle country code field
   * 
   * @private
   * @param {HTMLElement} field - The country code field
   * @returns {boolean} - Whether the field was successfully handled
   */
  _handleCountryCodeField(field) {
    try {
      // If it's a select element
      if (field.tagName.toLowerCase() === 'select') {
        // Get country code from settings
        const countryCode = this.settings.countryCode || '+1'; // Default to US
        
        // Find the option that contains this country code
        let optionFound = false;
        
        for (let i = 0; i < field.options.length; i++) {
          const option = field.options[i];
          const optionValue = option.value || '';
          const optionText = option.text || '';
          
          // Check if option contains the country code
          if (optionValue.includes(countryCode) || 
              optionText.includes(countryCode) ||
              // Check for country names based on common codes
              (countryCode === '+1' && (optionText.includes('United States') || optionText.includes('Canada'))) ||
              (countryCode === '+44' && optionText.includes('United Kingdom')) ||
              (countryCode === '+91' && optionText.includes('India'))) {
            
            field.selectedIndex = i;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            this._log(`Selected country code option: ${optionText}`);
            optionFound = true;
            break;
          }
        }
        
        // If no matching option found, select the first non-empty option
        if (!optionFound && field.options.length > 1) {
          for (let i = 1; i < field.options.length; i++) { // Start from 1 to skip "Select an option"
            if (field.options[i].value) {
              field.selectedIndex = i;
              field.dispatchEvent(new Event('change', { bubbles: true }));
              this._log(`No exact country code match found, selected: ${field.options[i].text}`);
              break;
            }
          }
        }
        
        return true;
      } 
      // If it's an input field
      else {
        const countryCode = this.settings.countryCode || '+1'; // Default to US
        this._fillField(field, countryCode);
        return true;
      }
    } catch (error) {
      this._logError('Error handling country code field:', error);
      return false;
    }
  }
  
  /**
   * Format phone number based on field requirements
   * 
   * @private
   * @param {string} phoneNumber - The raw phone number
   * @param {HTMLElement} field - The field to format for
   * @returns {string} - The formatted phone number
   */
  _formatPhoneNumber(phoneNumber, field) {
    // Remove all non-numeric characters
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    
    // Check for specific formatting requirements based on field properties
    if (field.maxLength > 0) {
      formattedNumber = formattedNumber.substring(0, field.maxLength);
    }
    
    // If number is too short, pad it
    if (formattedNumber.length < 10) {
      formattedNumber = formattedNumber.padEnd(10, '0');
    }
    
    // If number has country code but field doesn't expect it, remove it
    if (formattedNumber.length > 10 && formattedNumber.startsWith('1') && 
        (field.maxLength === 10 || (field.placeholder && field.placeholder.length === 10))) {
      formattedNumber = formattedNumber.substring(1);
    }
    
    // Some fields expect dashes or specific formatting
    if (field.placeholder) {
      const placeholder = field.placeholder;
      
      // Check if placeholder suggests a specific format
      if (placeholder.includes('-')) {
        // Format like XXX-XXX-XXXX
        if (formattedNumber.length === 10) {
          formattedNumber = `${formattedNumber.substring(0, 3)}-${formattedNumber.substring(3, 6)}-${formattedNumber.substring(6)}`;
        }
      } else if (placeholder.includes('(') && placeholder.includes(')')) {
        // Format like (XXX) XXX-XXXX
        if (formattedNumber.length === 10) {
          formattedNumber = `(${formattedNumber.substring(0, 3)}) ${formattedNumber.substring(3, 6)}-${formattedNumber.substring(6)}`;
        }
      }
    }
    
    return formattedNumber;
  }

  /**
   * Handle the Easy Apply form filling process
   * 
   * @returns {Promise<boolean>} - Whether the form was successfully filled
   */
  async handleEasyApplyForm() {
    try {
      if (!this.modalElement) {
        this._log('No modal element found');
        return false;
      }
      
      this._log('Starting to handle Easy Apply form');
      
      // Find all visible fields in the current step
      const visibleFields = this._findVisibleFields();
      if (!visibleFields || visibleFields.length === 0) {
        this._log('No visible fields found in this step');
        
        // Check if this is a resume selection step
        const isResumeStep = await this.handleResumeSelection();
        if (isResumeStep) {
          this._log('Successfully handled resume selection step');
          return true;
        }
        
        // Check if this is a review step (might have no fields but buttons)
        const reviewButton = this.domUtils.querySelector(
          'button[aria-label="Review your application"], ' +
          'button[aria-label="Review"], ' +
          'button:contains("Review")', 
          this.modalElement
        );
        
        if (reviewButton) {
          this._log('Found review button, this appears to be a review step');
          return true;
        }
        
        this._log('No fields or special steps detected');
        return false;
      }
      
      this._log(`Found ${visibleFields.length} visible fields to process`);
      let fieldsHandled = 0;
      
      // Process each visible field
      for (const field of visibleFields) {
        // Get field type and label
        const fieldType = field.type || field.tagName.toLowerCase();
        const label = this.fieldDetector.getLabelForField(field);
        
        this._log(`Processing field: ${label || field.name || field.id} (${fieldType})`);
        
        // Skip if field is already filled (except checkboxes and radios which need explicit handling)
        if (!['checkbox', 'radio', 'select-one'].includes(fieldType) && 
            field.value && 
            field.value.trim() !== '') {
          this._log('Field already has a value, skipping');
          fieldsHandled++;
          continue;
        }
        
        // Handle field based on its type and label
        let handled = false;
        
        // Handle phone number fields
        if (this.fieldDetector.isPhoneField(field, label)) {
          handled = this.handlePhoneNumberField(field, label);
        }
        // Handle name fields
        else if (this.fieldDetector.isNameField(field, label)) {
          handled = this.handleNameField(field, label);
        }
        // Handle email fields
        else if (this.fieldDetector.isEmailField(field, label)) {
          handled = this.handleEmailField(field, label);
        }
        // Handle address fields
        else if (this.fieldDetector.isAddressField(field, label)) {
          handled = this.handleAddressField(field, label);
        }
        // Handle work experience fields
        else if (this.fieldDetector.isWorkExperienceField(field, label)) {
          handled = this.handleWorkExperienceField(field, label);
        }
        // Handle education fields
        else if (this.fieldDetector.isEducationField(field, label)) {
          handled = this.handleEducationField(field, label);
        }
        // Handle checkbox fields
        else if (fieldType === 'checkbox') {
          handled = this.handleCheckboxField(field, label);
        }
        // Handle radio fields
        else if (fieldType === 'radio') {
          handled = this.handleRadioField(field, label);
        }
        // Handle select/dropdown fields
        else if (fieldType === 'select-one') {
          handled = this.handleSelectField(field, label);
        }
        // Handle text fields that didn't match specific categories
        else if (['text', 'textarea'].includes(fieldType)) {
          handled = this.handleGenericTextField(field, label);
        }
        
        if (handled) {
          fieldsHandled++;
          this._log(`Successfully handled field: ${label || field.name || field.id}`);
        } else {
          this._log(`Could not handle field: ${label || field.name || field.id}`);
        }
      }
      
      this._log(`Handled ${fieldsHandled} out of ${visibleFields.length} fields`);
      
      // Check for "Next" button if we're in a multi-step form
      const nextButton = this.domUtils.querySelector(
        'button[aria-label="Continue to next step"], ' +
        'button[aria-label="Next"], ' +
        'button:contains("Next"), ' +
        'button:contains("Continue"), ' +
        'button.artdeco-button--primary:not([aria-label="Submit application"])', 
        this.modalElement
      );
      
      if (nextButton) {
        this._log('Found Next button, this appears to be a multi-step form');
      }
      
      // Return true if we handled any fields or if this was a special step
      return fieldsHandled > 0 || visibleFields.length === 0;
    } catch (error) {
      this._logError('Error handling Easy Apply form:', error);
      return false;
    }
  }

  /**
   * Handle resume selection step
   * 
   * @returns {Promise<boolean>} - Whether this was a resume selection step
   */
  async handleResumeSelection() {
    try {
      this._log('Checking for resume selection step');
      
      // Check for resume selection elements
      const resumeSelectors = [
        'button[aria-label="Choose Resume"]',
        'button:contains("Choose Resume")',
        'button[data-control-name="choose_resume"]',
        'label:contains("Resume")',
        'h3:contains("Resume")',
        '.jobs-resume-picker',
        '.jobs-document-upload-redesign-container'
      ];
      
      // Try to find resume selection elements
      let resumeElement = null;
      for (const selector of resumeSelectors) {
        resumeElement = this.domUtils.querySelector(selector, this.modalElement);
        if (resumeElement) {
          this._log(`Found resume element with selector: ${selector}`);
          break;
        }
      }
      
      // If no resume elements found, this is not a resume step
      if (!resumeElement) {
        this._log('No resume selection elements found');
        return true; // Return true to continue the process
      }
      
      // Check for resume radio buttons or options
      const resumeOptions = this.domUtils.querySelectorAll(
        'input[type="radio"][name*="resume"], ' +
        '.jobs-resume-picker__resume-btn',
        this.modalElement
      );
      
      if (resumeOptions && resumeOptions.length > 0) {
        // Select the first resume option
        this._log(`Found ${resumeOptions.length} resume options, selecting the first one`);
        
        // Click the first resume option
        await this.domUtils.clickElement(resumeOptions[0]);
        return true;
      }
      
      // Check for resume upload button (if no options found)
      const uploadButton = this.domUtils.querySelector(
        'button[aria-label="Upload Resume"], ' +
        'button:contains("Upload Resume")',
        this.modalElement
      );
      
      if (uploadButton) {
        this._log('Found resume upload button, but automatic upload is not supported');
        // We can't automatically upload a file, so just log and continue
        return true;
      }
      
      this._log('This appears to be a resume step, but could not find specific options');
      return true; // Return true to continue the process
    } catch (error) {
      this._logError('Error handling resume selection:', error);
      return true; // Return true even on error to continue the process
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = FormFiller;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.FormFiller = FormFiller;
} 