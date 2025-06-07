// Helper functions for handling typeahead/combobox fields

/**
 * Handles typeahead/combobox fields by filling the text and selecting an option from the dropdown
 * @param {HTMLInputElement} field - The input field to handle
 * @param {string} value - The value to set
 * @returns {Promise<boolean>} - Whether the field was successfully handled
 */
async function handleTypeaheadField(field, value) {
    try {
        console.log(`[EasyApplyPlugin] Handling typeahead field with value: ${value}`);
        
        // Focus the field to activate the typeahead
        field.focus();
        await new Promise(res => setTimeout(res, 500));
        
        // Clear existing value
        field.value = '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 300));
        
        // Set the new value
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 1000)); // Wait for suggestions to appear
        
        // Check if dropdown is visible
        const { typeaheadSuggestions } = window.EasyApplyConfig.selectors;
        const dropdown = document.querySelector(typeaheadSuggestions);
        
        if (dropdown && isElementVisible(dropdown)) {
            console.log('[EasyApplyPlugin] Typeahead dropdown is visible, selecting first option');
            
            // Find the first suggestion
            const suggestions = dropdown.querySelectorAll('li, .basic-typeahead__selectable');
            if (suggestions && suggestions.length > 0) {
                // Click the first suggestion
                suggestions[0].click();
                console.log('[EasyApplyPlugin] Clicked first typeahead suggestion');
                await new Promise(res => setTimeout(res, 500));
                return true;
            }
            
            // If no suggestions found by DOM, try simulating arrow down + enter
            console.log('[EasyApplyPlugin] No suggestions found by DOM, trying keyboard navigation');
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
            await new Promise(res => setTimeout(res, 300));
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
            await new Promise(res => setTimeout(res, 500));
            return true;
        } else {
            console.log('[EasyApplyPlugin] Typeahead dropdown not visible, trying keyboard navigation');
            // Try simulating arrow down + enter even if dropdown isn't detected
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 40 })); // Arrow down
            await new Promise(res => setTimeout(res, 300));
            field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13 })); // Enter
            await new Promise(res => setTimeout(res, 500));
            return true;
        }
    } catch (error) {
        console.error('[EasyApplyPlugin] Error handling typeahead field:', error);
        return false;
    }
}

/**
 * Check if a field is a typeahead field
 * @param {HTMLElement} field - The field to check
 * @returns {boolean} - Whether the field is a typeahead field
 */
function isTypeaheadField(field) {
    return field.getAttribute('role') === 'combobox' && 
           field.getAttribute('aria-autocomplete') === 'list';
}

/**
 * Check if a field is likely a location field based on its ID or label
 * @param {HTMLElement} field - The field to check
 * @param {string} label - The label text associated with the field
 * @returns {boolean} - Whether the field is likely a location field
 */
function isLocationField(field, label) {
    if (!field || !label) return false;
    
    const locationTerms = ['location', 'city', 'place', 'region', 'country', 'area'];
    label = label.toLowerCase();
    
    // Check label
    if (locationTerms.some(term => label.includes(term))) return true;
    
    // Check ID
    const id = field.id.toLowerCase();
    if (locationTerms.some(term => id.includes(term))) return true;
    
    return false;
}
