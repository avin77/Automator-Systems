/**
 * @fileoverview Client for interacting with Google's Gemini API.
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * GeminiClient handles interactions with the Gemini API for AI-powered answers.
 * It formats prompts, sends requests, and normalizes responses.
 * 
 * @class
 */
class GeminiClient {
  /**
   * Creates a new Gemini API client
   * 
   * @param {Function} getGeminiAnswer - Function to get answers from Gemini
   * @param {string} apiKey - Gemini API key
   * @param {Object} userCV - User's CV data
   */
  constructor(getGeminiAnswer, apiKey, userCV) {
    this.getGeminiAnswer = getGeminiAnswer;
    this.apiKey = apiKey;
    this.userCV = userCV;
    this._logPrefix = '[EasyApplyPlugin][GeminiClient]';
  }
  
  /**
   * Get a value from the Gemini API
   * 
   * @param {string} label - The question/label to get an answer for
   * @param {Object} options - Options for controlling value retrieval
   * @param {boolean} [options.isCountry=false] - Whether this is a country field
   * @param {boolean} [options.isCity=false] - Whether this is a city field
   * @param {boolean} [options.isPhone=false] - Whether this is a phone field
   * @param {boolean} [options.isExperience=false] - Whether this is an experience field
   * @param {boolean} [options.isSummary=false] - Whether this is a summary field
   * @param {boolean} [options.isConsent=false] - Whether this is a consent field
   * @returns {Promise<string|null>} - The value from Gemini or null if error
   */
  async getValue(label, options = {}) {
    const {
      isCountry = false,
      isCity = false,
      isPhone = false,
      isExperience = false,
      isSummary = false,
      isConsent = false,
      optionsList = null,
      isRadioGroup = false
    } = options;
    
    try {
      // For consent questions, always return "Yes"
      if (isConsent) {
        return "Yes";
      }
      
      // For country fields, use specialized prompt
      if (isCountry) {
        return await this._getCountryValue(label);
      }
      
      // For experience fields, use specialized prompt
      if (isExperience) {
        return await this._getExperienceValue(label);
      }
      
      // For summary fields, use specialized prompt
      if (isSummary) {
        return await this._getSummaryValue(label);
      }
      
      // For radio groups with options, pass the options list to Gemini
      if (isRadioGroup && optionsList) {
        const answer = await this.getGeminiAnswer(
          label, 
          this.userCV, 
          this.apiKey,
          optionsList, // Pass the options list
          false, // numericOnly
          null, // qaCache
          false, // isSummaryField
          false // isSpecificallyCoverLetter
        );
        
        this._log(`Gemini response for radio group "${label}": "${answer}"`);
        return answer;
      }
      
      // For other fields, use generic prompt
      const answer = await this.getGeminiAnswer(
        label, 
        this.userCV, 
        this.apiKey,
        null, // optionsList
        false, // numericOnly
        null, // qaCache
        isSummary, // isSummaryField
        false // isSpecificallyCoverLetter
      );
      
      this._log(`Gemini response for "${label}": "${answer}"`);
      return answer;
    } catch (error) {
      this._logError(`Error getting value from Gemini for "${label}":`, error);
      return null;
    }
  }
  
  /**
   * Get a country value from Gemini
   * 
   * @private
   * @param {string} label - The question/label
   * @returns {Promise<string>} - The country value
   */
  async _getCountryValue(label) {
    const specialPrompt = `Based on my CV: ${this.userCV.substring(0, 500)}
    
Question: ${label}

I need the name of a country (like "India", "United States", etc.) as a direct answer. Please respond with ONLY the country name, nothing else.`;

    try {
      const answer = await this._directGeminiApiCall(specialPrompt);
      this._log(`Gemini country response for "${label}": "${answer}"`);
      
      // Validate country name
      const commonCountries = [
        'India', 'United States', 'United Kingdom', 'Canada', 
        'Australia', 'Germany', 'France', 'Japan', 'China'
      ];
      
      const answerLower = answer.toLowerCase();
      for (const country of commonCountries) {
        if (country.toLowerCase() === answerLower || 
            answerLower.includes(country.toLowerCase())) {
          return country;
        }
      }
      
      // If not recognized, return the raw answer or default to India
      return answer || "India";
    } catch (error) {
      this._logError(`Error getting country value from Gemini:`, error);
      return "India"; // Default fallback
    }
  }
  
  /**
   * Get an experience value from Gemini
   * 
   * @private
   * @param {string} label - The question/label
   * @returns {Promise<string>} - The experience value
   */
  async _getExperienceValue(label) {
    const specialPrompt = `Based on my CV: ${this.userCV.substring(0, 500)}
    
Question: ${label}

I need a number of years of experience (like "4", "5", etc.) as a direct answer. Please respond with ONLY the number, nothing else.`;

    try {
      const answer = await this._directGeminiApiCall(specialPrompt);
      this._log(`Gemini experience response for "${label}": "${answer}"`);
      
      // Try to extract a number
      const numberMatch = answer.match(/\d+/);
      if (numberMatch) {
        const years = parseInt(numberMatch[0]);
        
        // Validate years (ensure it's at least 2)
        if (years >= 2) {
          return years.toString();
        }
      }
      
      // Default to 4 years if no valid number found
      return "4";
    } catch (error) {
      this._logError(`Error getting experience value from Gemini:`, error);
      return "4"; // Default fallback
    }
  }
  
  /**
   * Get a summary value from Gemini
   * 
   * @private
   * @param {string} label - The question/label
   * @returns {Promise<string>} - The summary value
   */
  async _getSummaryValue(label) {
    const isCoverLetter = 
      label.toLowerCase().includes('cover letter') || 
      label.toLowerCase().includes('why are you interested');
    
    const specialPrompt = `Based on my CV: ${this.userCV}
    
Question: ${label}

${isCoverLetter ? 'Please write a professional cover letter' : 'Please provide a detailed summary'} that highlights my relevant skills and experience. Make it professional, concise, and tailored to the job.`;

    try {
      const answer = await this.getGeminiAnswer(
        label, 
        this.userCV, 
        this.apiKey,
        null, // optionsList
        false, // numericOnly
        null, // qaCache
        true, // isSummaryField
        isCoverLetter // isSpecificallyCoverLetter
      );
      
      this._log(`Gemini summary response for "${label}" (${answer.length} chars)`);
      return answer;
    } catch (error) {
      this._logError(`Error getting summary value from Gemini:`, error);
      return "I am a professional with relevant experience and skills for this position. I am excited about this opportunity and believe my background makes me a strong candidate."; // Default fallback
    }
  }
  
  /**
   * Make a direct call to the Gemini API
   * 
   * @private
   * @param {string} prompt - The prompt to send
   * @returns {Promise<string>} - The response text
   */
  async _directGeminiApiCall(prompt) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + this.apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      this._logError('Error calling Gemini API directly:', error);
      return '';
    }
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
  
  /**
   * Log an error message
   * 
   * @private
   * @param {string} message - The error message
   * @param {Error} [error] - Optional error object
   */
  _logError(message, error) {
    console.error(`${this._logPrefix} ${message}`, error || '');
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = GeminiClient;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.GeminiClient = GeminiClient;
}