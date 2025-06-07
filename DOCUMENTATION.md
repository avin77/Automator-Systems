# LinkedIn Easy Apply Automator - Documentation

## 1. Introduction

The LinkedIn Easy Apply Automator is a Chrome extension designed to streamline the job application process on LinkedIn. It automates filling out Easy Apply forms using a provided CV, a Q&A cache for recurring questions, and integration with the Gemini AI API for generating answers to new questions. The primary goal is to save users time by handling repetitive data entry.

## 2. Plugin Architecture

The extension is composed of several key files:

*   **`manifest.json`**: The manifest file is the entry point of the Chrome extension. It defines the extension's properties, permissions (like accessing LinkedIn pages, storage), background scripts, content scripts, and popup UI.
*   **`popup.html` & `popup.js`**: These files create and manage the user interface that appears when the extension icon is clicked. 
    *   `popup.html` defines the structure of the popup (buttons for starting/stopping automation, input fields for API key, CV, Q&A cache).
    *   `popup.js` handles user interactions within the popup, such as saving settings to `chrome.storage.local` and sending messages to `content.js` to initiate or halt the automation process.
*   **`content.js`**: This is the core script of the extension, injected directly into LinkedIn web pages. It contains all the logic for:
    *   Interacting with the LinkedIn DOM (finding job cards, buttons, form fields).
    *   Managing the multi-step Easy Apply modal.
    *   Identifying and filling blank form fields using various strategies (direct input, Gemini API, cached answers).
    *   Communicating with the Gemini API via `fetch` requests.
    *   Handling the main automation loop for processing multiple jobs and pages.
    *   Listening for messages from `popup.js`.
*   **`config.js`**: This file stores various configuration parameters for the extension, such as timeouts, retry limits, default values for certain fields, and CSS selectors for DOM elements. It makes the extension more adaptable to UI changes on LinkedIn and allows for easier tuning of its behavior. The configuration is typically exposed via the `window.EasyApplyConfig` object in `content.js`.

## 3. Core Workflow

The automation process follows these general steps:

1.  **Initialization**:
    *   `content.js` is injected into LinkedIn job search pages.
    *   Configuration from `config.js` is loaded.
    *   The user opens the extension popup (`popup.html`/`popup.js`) to configure settings (CV, Gemini API Key, Q&A cache) and start the automation.

2.  **Starting Automation**:
    *   The user clicks the "Start Automation" button in the popup.
    *   `popup.js` sends a `{ action: 'startAutomation' }` message to `content.js`.

3.  **Automation Begins (`content.js`)**:
    *   The `chrome.runtime.onMessage.addListener` in `content.js` receives the message.
    *   The `window.easyApplyStop` flag is set to `false`.
    *   The main `automateEasyApply()` function is invoked.
    *   A console log `[EasyApplyPlugin] Automation started second` confirms initiation.

4.  **Job Processing Loop (`automateEasyApply`)**:
    *   `automateEasyApply()` iterates through job cards on the current LinkedIn job search page using `getJobCards()`.
    *   For each job card:
        *   It checks if the job has already been applied to using `isJobAlreadyApplied()`.
        *   The job card is clicked to load details in the right-hand pane.
        *   `waitForRightPaneToMatch()` ensures the correct job details are loaded by comparing info from `getJobCardInfo()` (from card) and `getRightPaneJobInfo()` (from pane).
        *   `waitForEasyApplyButton()` attempts to find the "Easy Apply" button in the job details pane.
        *   If the "EasyApply" button is found, it's clicked.
        *   The `handleEasyApplyForm()` function is called to manage the application modal.
    *   After processing all jobs on the page, if configured, `goToNextPage()` navigates to the next page of job results, and the loop continues.

5.  **Handling the Easy Apply Modal (`handleEasyApplyForm`)**:
    *   This function manages the multi-step application process within the LinkedIn Easy Apply modal.
    *   It waits for the modal to become visible using `waitForModalToBeVisible()`.
    *   It enters a loop to handle each step of the form (up to `maxFormSteps` from `config.js`).
    *   In each step:
        *   `fillAllBlankFieldsInModal()` is called to identify and populate empty form fields.
        *   **Field Filling Logic (`fillAllBlankFieldsInModal`)**: 
            *   Identifies all visible input fields, select dropdowns, and textareas.
            *   For each blank field, it determines the question/label.
            *   Special handling for:
                *   Terms & Conditions checkboxes (auto-checked).
                *   Location fields (uses specific logic, potentially typeahead handling).
                *   Years of experience (uses specific logic, default values from `config.js`).
            *   For other fields, `getGeminiAnswer()` is called.
            *   `getGeminiAnswer()`: Constructs a detailed prompt using the user's CV, Q&A cache, and the current question. It calls the Gemini API, processes the response, and updates the Q&A cache for future use.
            *   The field is then filled with the obtained answer.
        *   After attempting to fill fields, `handleEasyApplyForm` looks for action buttons:
            *   **Resume Selection**: If it's the resume step, `handleResumeSelection()` is called.
            *   **Navigation**: It attempts to click "Next" or "Review" buttons using `clickButtonByText()` and then waits for the modal content to update using `waitForNextStep()`.
            *   **Submission**: If a "Submit application" button is found, it's clicked. The function then continues to look for a "Done" button or a success popup.
            *   **Completion**: If a "Done" button appears, it's clicked, and the modal handling for that job application concludes.

6.  **Application Submission & Confirmation**:
    *   After the "Submit application" button is clicked, the system waits for confirmation.
    *   `isApplicationSentPopupVisible()` can detect the "Application sent" popup.
    *   The "Done" button on the success popup is clicked to close it.

7.  **Loop Continuation or Termination**:
    *   `automateEasyApply()` proceeds to the next job on the page or the next page of results.
    *   The automation stops if `window.easyApplyStop` is set to `true` (e.g., by the user clicking "Stop Automation" in the popup), if an unrecoverable error occurs, or if all jobs/pages are processed.

## 4. Key Functions in `content.js`

Below is a summary of some of the critical functions within `content.js`. (Refer to JSDoc comments in the source code for detailed parameters and behavior).

*   **`automateEasyApply()`**: The main function orchestrating the entire job application process across multiple jobs and pages.
*   **`handleEasyApplyForm()`**: Manages the step-by-step process of filling out and submitting a single Easy Apply application within its modal.
*   **`fillAllBlankFieldsInModal(...)`**: Identifies all blank fields in the current modal step and uses various strategies (Gemini API, cache, specific handlers) to fill them.
*   **`getGeminiAnswer(...)`**: Constructs prompts and interacts with the Gemini API to get answers for form questions based on the user's CV and Q&A cache.
*   **`waitForSelector(selector, timeout)`**: Utility to wait for a specific DOM element to appear.
*   **`isElementVisible(element)`**: Utility to check if a DOM element is currently visible.
*   **`waitForModalToBeVisible(timeout)` / `waitForModalToBeHidden(timeout)`**: Waits for the Easy Apply modal to appear or disappear.
*   **`clickButtonByText(text)` / `waitForButtonByText(text, timeout, container)`**: Utilities to find and interact with buttons based on their text content.
*   **`getJobCards()`**: Retrieves job listing elements from the search results page.
*   **`getJobCardInfo(card)` / `getRightPaneJobInfo()`**: Extract job title and company from a job card and the details pane, respectively.
*   **`waitForRightPaneToMatch(cardInfo, timeout)`**: Ensures the job details pane has loaded content matching the selected job card.
*   **`handleResumeSelection()`**: Manages the resume selection step in the modal.
*   **`isApplicationSentPopupVisible()`**: Detects the "Application Sent" confirmation popup.
*   **`chrome.runtime.onMessage.addListener(...)`**: Listens for messages from `popup.js` to start or stop the automation.

## 5. Configuration (`config.js`)

`config.js` plays a vital role in making the extension adaptable and configurable without needing to modify the core `content.js` logic frequently. It typically defines:

*   **`timeouts`**: Durations for various polling actions (e.g., waiting for elements, API responses).
*   **`retries`**: Number of attempts for certain actions (e.g., clicking a button, form steps).
*   **`selectors`**: CSS selectors for key elements on LinkedIn pages, which can change with LinkedIn UI updates.
*   **`defaults`**: Default values for certain fields (e.g., years of experience if Gemini API fails or returns a low number).
*   **`keywords`**: Lists of keywords for identifying specific field types (e.g., location, experience, summary).

This externalization of parameters helps in maintaining and updating the extension more efficiently.

## 6. Error Handling and Logging

The extension incorporates error handling through `try...catch` blocks in critical functions. Errors are logged to the browser's developer console using `console.error()` or `console.log()` with an `[EasyApplyPlugin]` prefix.

*   **Gemini API Errors**: Handled in `getGeminiAnswer()`, with fallbacks for certain field types (e.g., default experience years).
*   **DOM Interaction Errors**: Timeouts for `waitForSelector`, `waitForElementVisible`, etc., prevent indefinite hanging if elements are not found.
*   **Automation Flow Errors**: Errors during job processing or modal handling are caught to allow the automation to attempt to continue with the next job or stop gracefully.
*   **Logging**: Detailed console logs track the automation's progress, decisions made (e.g., field filling, button clicks), API calls, and any errors encountered. This is crucial for debugging and understanding the extension's behavior.

This documentation provides a high-level overview. For specific implementation details, refer to the JSDoc comments within the `content.js` source code.
