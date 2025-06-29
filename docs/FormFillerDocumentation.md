# Form Filler System Documentation

## Overview

The Form Filler System is a modular framework for automatically filling out LinkedIn's Easy Apply job application forms. It combines AI-powered suggestions from Google's Gemini API with form automation to streamline the job application process.

## Architecture

The system is built on a modular architecture that separates concerns:

1. **FormFiller**: The main coordinator that orchestrates the form filling process
2. **FieldDetector**: Identifies and categorizes form fields
3. **CacheManager**: Manages previously used answers for reuse
4. **GeminiClient**: Interfaces with the Gemini API for AI-generated answers
5. **FieldHandlers**: Specialized handlers for different field types
6. **Validators**: Ensures field values meet required criteria

## Usage

### Basic Usage

```javascript
// Create a new FormFiller instance
const formFiller = new FormFiller(
  document.querySelector('.job-application-modal'), // Modal element
  config,                                          // Configuration
  getGeminiAnswer,                                 // Function to get answers from Gemini
  userCV,                                          // User's CV data
  geminiApiKey,                                    // Gemini API key
  qnaCache                                         // Question/answer cache
);

// Fill the entire form
await formFiller.fillForm();
```

### Configuration Options

The FormFiller accepts a configuration object that controls its behavior:

```javascript
const config = {
  // Delays in milliseconds
  delays: {
    typeaheadFocus: 500,      // Delay after focusing a typeahead field
    typeaheadClear: 300,      // Delay after clearing a typeahead field
    typeaheadInput: 1000,     // Delay after typing in a typeahead field
    typeaheadKeydown: 300,    // Delay after pressing arrow down in a typeahead field
    typeaheadEnter: 500,      // Delay after pressing enter in a typeahead field
    typeaheadClick: 500,      // Delay after clicking a typeahead suggestion
    radioClick: 200,          // Delay after clicking a radio button
    selectChange: 200,        // Delay after changing a select field
    textInput: 200,           // Delay after filling a text field
    checkbox: 200,            // Delay after clicking a checkbox
    afterField: 100           // Delay after processing a field
  },
  
  // Default values for common fields
  defaults: {
    defaultPhoneNumber: "8860753300",
    defaultCity: "Bengaluru",
    defaultCountry: "India",
    defaultLocation: "Bengaluru, Karnataka, India"
  },
  
  // Minimum content lengths
  minCoverLetterLength: 300,  // Minimum length for cover letters
  minSummaryLength: 150,      // Minimum length for summary fields
  
  // Experience settings
  minExperienceYears: 2,      // Minimum years of experience
  defaultExperienceYears: 4,  // Default years of experience
  
  // Field detection keywords
  experienceKeywords: ['year of experience', 'years of experience', 'experience in'],
  summaryKeywords: ['summary', 'describe', 'explain', 'detail', 'elaborate'],
  locationKeywords: ['location', 'city', 'country', 'state', 'province'],
  termsKeywords: ['terms', 'conditions', 'privacy', 'policy', 'consent']
};
```

### Using Field Handlers Directly

You can use individual field handlers for specific scenarios:

```javascript
// Get a field handler for a specific field
const field = document.querySelector('#location-field');
const label = formFiller.fieldDetector.getLabelForField(field);
const fieldType = formFiller.fieldDetector.detectFieldType(field, label);

// For a country field
if (fieldType.isCountry) {
  const countryHandler = formFiller.getFieldHandler('country');
  await countryHandler.handle(field, label);
}

// For a typeahead field
if (fieldType.isTypeahead) {
  const typeaheadHandler = formFiller.getFieldHandler('typeahead');
  await typeaheadHandler.handle(field, label, "New York, NY, USA");
}
```

### Working with the Cache

The CacheManager helps you store and retrieve previous answers:

```javascript
// Get a value from cache
const answer = formFiller.cacheManager.getValue("Where are you located?");

// Store a value in cache
formFiller.cacheManager.setValue("Where are you located?", "New York, NY, USA");

// Find similar questions in cache
const similarQuestions = formFiller.cacheManager.findSimilarQuestions("Where do you live?");
```

### Error Handling

The system includes built-in error handling:

```javascript
// Check if a field has an error
const hasError = formFiller.errorHandler.hasError(field);

// Get the error message for a field
const errorMessage = formFiller.errorHandler.getErrorMessage(field);

// Register an error observer
formFiller.errorHandler.registerObserver((field, error) => {
  console.log(`Error in field ${field.id}: ${error}`);
});
```

## Extending the System

### Creating a Custom Field Handler

You can create custom field handlers by extending the FieldHandlerBase class:

```javascript
class CustomFieldHandler extends FieldHandlerBase {
  constructor(dependencies) {
    super(dependencies);
  }
  
  async handle(field, label, value = null) {
    // Custom handling logic
    console.log(`Handling custom field: ${label}`);
    
    // Get a value if none provided
    if (!value) {
      value = await this.dependencies.geminiClient.getValue(label);
    }
    
    // Set the field value
    field.value = value;
    this.dispatchEvent(field, 'input');
    this.dispatchEvent(field, 'change');
    
    return true;
  }
  
  canHandle(field, fieldType) {
    // Return true if this handler can handle the field
    return field.hasAttribute('data-custom-field');
  }
}

// Register the custom handler
formFiller.registerFieldHandler('custom', new CustomFieldHandler(dependencies));
```

### Creating a Custom Validator

You can create custom validators by extending the ValidatorBase class:

```javascript
class CustomValidator extends ValidatorBase {
  validate(field, value) {
    // Custom validation logic
    if (value.includes('required-text')) {
      return { valid: true };
    } else {
      return {
        valid: false,
        message: 'Value must include "required-text"'
      };
    }
  }
}

// Register the custom validator
formFiller.registerValidator('custom', new CustomValidator());
```

## Best Practices

### 1. Field Detection

- Always use the FieldDetector to identify fields rather than hardcoding types
- Consider the context of fields, not just their HTML type
- Use appropriate keywords for different field categories

### 2. Form Filling

- Process fields in priority order (country first, then required fields)
- Verify field visibility before attempting to fill
- Check for existing values before filling
- Use appropriate delays between actions

### 3. Error Handling

- Always check for errors after filling a field
- Use the ErrorHandler to get standardized error messages
- Implement appropriate retry strategies for failed fields

### 4. Performance

- Minimize unnecessary DOM operations
- Use event batching when possible
- Implement progressive filling for large forms

### 5. Caching

- Cache all successfully used values
- Implement cache normalization for similar questions
- Consider local storage for persistent caching

## Troubleshooting

### Common Issues

1. **Fields not being filled**: Check field visibility and detection
2. **Typeahead fields not working**: Ensure proper delays and dropdown detection
3. **Errors not being detected**: Check error message selectors
4. **Gemini not providing useful answers**: Review prompt formatting

### Debugging

The system includes extensive logging:

```javascript
// Enable verbose logging
formFiller.setLogLevel('verbose');

// Log specific field handling
formFiller.logFieldHandling(document.querySelector('#problem-field'));
```

## API Reference

See the full API documentation for details on all classes, methods, and properties. 