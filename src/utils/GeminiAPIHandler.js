/**
 * @fileoverview Gemini API handler for intelligent form completion
 * Provides context-aware AI responses for job application questions
 * Handles complex question types with customizable context and preferences
 * @author EasyApplyPlugin Team
 * @version 1.0.0
 */

/**
 * Enhanced Gemini API handler with contextual awareness and caching
 */
class GeminiAPIHandler {
  /**
   * Create a new GeminiAPIHandler
   * @param {Object} errorHandler - Error handler for logging
   * @param {Object} userContext - User context information like location, salary preferences
   * @param {Object} qaCache - Cache of previously answered questions
   */
  constructor(errorHandler, userContext = {}, qaCache = {}) {
    this.errorHandler = errorHandler;
    this.logPrefix = '[GeminiAPI]';
    this.userContext = userContext;
    this.qaCache = qaCache;
    
    // Default user context if not provided
    this.userContext = {
      location: this.userContext.location || 'India',
      preferredCurrency: this.userContext.preferredCurrency || 'INR',
      preferredSalary: this.userContext.preferredSalary || '',
      workAuthorization: this.userContext.workAuthorization || 'India',
      currentCountry: this.userContext.currentCountry || 'India',
      preferredJobType: this.userContext.preferredJobType || 'Full-time',
      yearsOfExperience: this.userContext.yearsOfExperience || 4
    };
  }

  /**
   * Get answer from Gemini API for a form question
   * 
   * @param {string} question - The question to answer
   * @param {string} cv - User's CV text
   * @param {string} apiKey - Gemini API key
   * @param {string[]|null} optionsList - List of options to choose from
   * @param {boolean} numericOnly - Whether to return only a numeric answer
   * @param {boolean} isSummaryField - Whether this is a summary/cover letter field
   * @param {boolean} isSpecificallyCoverLetter - Whether this is specifically a cover letter
   * @returns {Promise<string>} - The answer from Gemini
   */
  async getAnswer(question, cv, apiKey, optionsList = null, numericOnly = false, isSummaryField = false, isSpecificallyCoverLetter = false) {
    try {
      this._log(`🔍 Processing question: "${question}"`);
      
      // Check cache first
      if (this.qaCache && this.qaCache[question]) {
        this._log(`📋 Using cached answer for: "${question}"`);
        return this.qaCache[question];
      }
      
      // Construct the prompt
      let prompt = this._constructPrompt(
        question, 
        cv, 
        optionsList, 
        numericOnly, 
        isSummaryField, 
        isSpecificallyCoverLetter
      );
      
      // Truncate CV in the log message to avoid clutter
      const truncatedCV = cv.substring(0, 50) + (cv.length > 50 ? '...' : '');
      this._log(`📤 Sending prompt to Gemini API: 
Question: ${question}
CV (truncated): ${truncatedCV}
Has options: ${optionsList ? 'Yes' : 'No'}
Numeric only: ${numericOnly ? 'Yes' : 'No'}
Is summary field: ${isSummaryField ? 'Yes' : 'No'}
Is cover letter: ${isSpecificallyCoverLetter ? 'Yes' : 'No'}`);
      
      // Call the Gemini API
      const answer = await this._callGeminiAPI(prompt, apiKey);
      
      // Clean and format the answer
      const cleanAnswer = this._cleanAnswer(answer, optionsList, numericOnly);
      
      // Save to cache
      this._saveToCache(question, cleanAnswer);
      
      console.log(`[EasyApplyPlugin][Gemini][ContentScript] For question "${question}", Gemini answered: "${cleanAnswer}"`);
      
      return cleanAnswer;
    } catch (error) {
      this._logError('❌ Error getting answer:', error);
      
      // Provide a sensible fallback
      return this._getFallbackAnswer(question, optionsList, isSummaryField);
    }
  }

  /**
   * Construct a prompt for Gemini API
   * 
   * @private
   * @param {string} question - The question to answer
   * @param {string} cv - User's CV text
   * @param {string[]|null} optionsList - List of options to choose from
   * @param {boolean} numericOnly - Whether to return only a numeric answer
   * @param {boolean} isSummaryField - Whether this is a summary/cover letter field
   * @param {boolean} isSpecificallyCoverLetter - Whether this is specifically a cover letter
   * @returns {string} - The constructed prompt
   */
  _constructPrompt(question, cv, optionsList, numericOnly, isSummaryField, isSpecificallyCoverLetter) {
    // Base prompt with CV
    let prompt = `Based on my CV: ${cv}\n\n`;
    
    // Add context information
    prompt += `Context Information:
- My current location: ${this.userContext.location}
- My preferred currency: ${this.userContext.preferredCurrency}
- My work authorization: ${this.userContext.workAuthorization}
- My years of experience: ${this.userContext.yearsOfExperience}
- My preferred job type: ${this.userContext.preferredJobType}

Question: ${question}\n\n`;
    
    // Add specific handling for common question types
    if (this._containsAnyOf(question, ['salary', 'compensation', 'pay', 'expect', 'expectation'])) {
      prompt += `For salary-related questions:
- If the question asks for salary in USD but my preferred currency is ${this.userContext.preferredCurrency}, please convert appropriately
- My salary range is ${this.userContext.preferredSalary || "competitive and based on market rates"}
- If specific currencies are mentioned in the question, please answer in those currencies\n\n`;
    }
    
    if (this._containsAnyOf(question, ['location', 'relocate', 'based in', 'where are you', 'address', 'city', 'country', 'state'])) {
      prompt += `For location-related questions:
- I am currently located in ${this.userContext.location}
- If the question asks if I'm located in a specific country or city, compare with my current location
- For questions about whether I can relocate, my answer is generally "Yes, for the right opportunity"\n\n`;
    }
    
    if (this._containsAnyOf(question, ['authorized', 'legally', 'right to work', 'work permit', 'sponsor', 'visa'])) {
      prompt += `For work authorization questions:
- I am authorized to work in ${this.userContext.workAuthorization}
- If the question asks if I'm authorized to work in a specific country, compare with my work authorization
- If the country matches my authorization, answer "Yes"
- If the country doesn't match my authorization, answer "No, I would need sponsorship"\n\n`;
    }
    
    if (this._containsAnyOf(question, ['notice period', 'start date', 'join', 'available', 'availability'])) {
      prompt += `For availability questions:
- My notice period is 2 weeks
- I am available to start immediately for the right opportunity
- For specific start date questions, I can start within 2-4 weeks\n\n`;
    }
    
    if (this._containsAnyOf(question, ['experience', 'years', 'worked'])) {
      prompt += `For experience-related questions:
- I have ${this.userContext.yearsOfExperience} years of relevant experience
- For specific technology questions, check my CV for exact experience with that technology
- If the question asks for a minimum experience level, answer based on my actual experience\n\n`;
    }
    
    // Handle options list
    if (optionsList && optionsList.length > 0) {
      prompt += `Please choose the best option from the following list that matches my profile and preferences:\n`;
      optionsList.forEach((opt, index) => {
        prompt += `${index + 1}. ${opt}\n`;
      });
      
      // For selection questions with Yes/No options, prefer Yes for most cases
      const hasYesOption = optionsList.some(opt => 
        opt.toLowerCase() === 'yes' || 
        opt.toLowerCase().includes('yes,') || 
        opt.toLowerCase() === 'i do'
      );
      
      if (hasYesOption && this._containsAnyOf(question, [
        'are you comfortable', 'are you authorized', 'are you able', 
        'can you', 'do you have', 'are you willing', 'would you'
      ])) {
        prompt += `\nFor questions about my capabilities, authorizations, or willingness, please assume I am answering YES unless there's a clear reason not to based on my CV or context information.`;
      }
      
      prompt += `\nRespond with ONLY the option number or the exact text of the option.`;
    } else if (numericOnly) {
      prompt += `Please respond with ONLY a number.`;
    } else if (isSummaryField) {
      if (isSpecificallyCoverLetter) {
        prompt += `Please write a professional, concise cover letter explaining why I'm a good fit for this role based on my experience. Keep it to around 1000 characters, focusing on my most relevant skills and achievements.`;
      } else {
        prompt += `Please provide a concise professional summary based on my CV. Keep it to around 800 characters, highlighting my key skills and experiences. Make it directly relevant to this job application.`;
      }
    } else {
      prompt += `Please provide a direct, concise answer based on my CV and the context information. Keep your response short and to the point.`;
    }
    
    return prompt;
  }

  /**
   * Call the Gemini API
   * 
   * @private
   * @param {string} prompt - The prompt to send
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<string>} - Raw response from Gemini
   */
  async _callGeminiAPI(prompt, apiKey) {
    // Track timing
    const startTime = Date.now();
    
    // Call the API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const endTime = Date.now();
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    this._log(`📥 Received response in ${endTime - startTime}ms`);
    
    // Extract the text from the response
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Clean and format the answer
   * 
   * @private
   * @param {string} answer - Raw answer from Gemini
   * @param {string[]|null} optionsList - List of options
   * @param {boolean} numericOnly - Whether to return only a numeric answer
   * @returns {string} - Cleaned answer
   */
  _cleanAnswer(answer, optionsList, numericOnly) {
    let cleanAnswer = answer.trim();
    this._log(`📄 Raw response: "${cleanAnswer}"`);
    
    // For multiple choice, try to extract just the option
    if (optionsList && optionsList.length > 0) {
      // Look for option numbers
      const numberMatch = cleanAnswer.match(/^[0-9]+/);
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[0]) - 1;
        if (optionIndex >= 0 && optionIndex < optionsList.length) {
          this._log(`🔢 Found option number ${numberMatch[0]}, selecting option: "${optionsList[optionIndex]}"`);
          cleanAnswer = optionsList[optionIndex];
        }
      } else {
        // Look for exact option text
        let foundMatch = false;
        for (const option of optionsList) {
          if (cleanAnswer.includes(option)) {
            this._log(`📌 Found exact option text: "${option}"`);
            cleanAnswer = option;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          this._log(`⚠️ Couldn't match response to any option, using first option as fallback: "${optionsList[0]}"`);
          cleanAnswer = optionsList[0];
        }
      }
    }
    
    // For numeric only responses, extract just the number
    if (numericOnly) {
      const numberMatch = cleanAnswer.match(/\d+/);
      if (numberMatch) {
        this._log(`🔢 Extracted number: ${numberMatch[0]}`);
        cleanAnswer = numberMatch[0];
      }
    }
    
    this._log(`✅ Final answer: "${cleanAnswer}"`);
    return cleanAnswer;
  }

  /**
   * Save answer to cache
   * 
   * @private
   * @param {string} question - The question
   * @param {string} answer - The answer
   */
  _saveToCache(question, answer) {
    if (this.qaCache) {
      this.qaCache[question] = answer;
      
      // Save to chrome.storage.local if available
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ qaCache: this.qaCache });
        this._log(`💾 Saved answer to cache`);
      }
    }
  }

  /**
   * Get fallback answer when API fails
   * 
   * @private
   * @param {string} question - The question
   * @param {string[]|null} optionsList - List of options
   * @param {boolean} isSummaryField - Whether this is a summary field
   * @returns {string} - Fallback answer
   */
  _getFallbackAnswer(question, optionsList, isSummaryField) {
    let fallbackAnswer = "";
    
    if (isSummaryField) {
      fallbackAnswer = "I am a skilled professional with relevant experience for this position. My background includes the key skills mentioned in the job description, and I'm excited about the opportunity to contribute to your team.";
    } else if (optionsList && optionsList.length > 0) {
      // For option lists, try to find a "Yes" option or use the first option
      const yesOption = optionsList.find(opt => 
        opt.toLowerCase() === 'yes' || 
        opt.toLowerCase().includes('yes,') ||
        opt.toLowerCase() === 'i do'
      );
      
      fallbackAnswer = yesOption || optionsList[0];
    } else {
      fallbackAnswer = "Yes";
    }
    
    this._log(`🔄 Using fallback answer: "${fallbackAnswer}"`);
    return fallbackAnswer;
  }

  /**
   * Check if text contains any of the given keywords
   * 
   * @private
   * @param {string} text - Text to check
   * @param {string[]} keywords - Keywords to look for
   * @returns {boolean} - Whether text contains any keyword
   */
  _containsAnyOf(text, keywords) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  /**
   * Log an informational message
   * 
   * @private
   * @param {string} message - The message to log
   */
  _log(message) {
    if (this.errorHandler) {
      this.errorHandler.logInfo(`${this.logPrefix} ${message}`);
    } else {
      console.log(`${this.logPrefix} ${message}`);
    }
  }

  /**
   * Log an error message
   * 
   * @private
   * @param {string} message - The error message
   * @param {Error} [error] - Optional error object
   */
  _logError(message, error) {
    if (this.errorHandler) {
      this.errorHandler.logError(message, error);
    } else {
      console.error(`${this.logPrefix} ${message}`, error || '');
    }
  }
}

// Export the class for use in other modules
if (typeof module !== 'undefined') {
  module.exports = GeminiAPIHandler;
}

// Make available in global scope if in browser context
if (typeof window !== 'undefined') {
  window.GeminiAPIHandler = GeminiAPIHandler;
} 