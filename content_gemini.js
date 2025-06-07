let easyApplyStop = false;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startAutomation') {
    easyApplyStop = false;
    handleEasyApplyQuestions();
  }
  if (request.action === 'stopAutomation') {
    easyApplyStop = true;
    console.log('[EasyApplyPlugin] Automation stopped by user.');
  }
});

function getFieldLabel(field, modal) {
  if (field.getAttribute('aria-label')) return field.getAttribute('aria-label');
  if (field.placeholder) return field.placeholder;
  // Try label[for]
  const label = modal.querySelector(`label[for='${field.id}']`);
  if (label) return label.innerText.trim();
  // Try parent label
  if (field.parentElement && field.parentElement.tagName === 'LABEL') return field.parentElement.innerText.trim();
  // Try legend for fieldset
  if (field.closest('fieldset')) {
    const legend = field.closest('fieldset').querySelector('legend');
    if (legend) return legend.innerText.trim();
    // Or div with label class inside fieldset
    const divLabel = field.closest('fieldset').querySelector('div[data-test-checkbox-form-title="true"], .fb-dash-form-element__label');
    if (divLabel) return divLabel.innerText.trim();
  }
  // Try question text above
  let prev = field.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL' || prev.className.includes('jobs-easy-apply-form-section__grouping')) return prev.innerText.trim();
    prev = prev.previousElementSibling;
  }
  return '';
}

function isFieldFilled(field) {
  if (field.type === 'checkbox' || field.type === 'radio') {
    return field.checked;
  } else if (field.tagName === 'SELECT') {
    return field.selectedIndex > 0;
  } else {
    return !!field.value;
  }
}

function isFieldMandatory(field, modal) {
  // Required attribute or label/legend contains *
  if (field.hasAttribute('required')) return true;
  const label = getFieldLabel(field, modal);
  return label && label.includes('*');
}

async function fillMandatoryFieldsWithGemini(modal, cache, userCV, geminiApiKey) {
  // Find all fields that are mandatory (required or label/legend contains *)
  const allFields = Array.from(modal.querySelectorAll('input, textarea, select'));
  for (const field of allFields) {
    if (easyApplyStop) {
      console.log('[EasyApplyPlugin] Automation stopped by user during autofill.');
      return;
    }
    if (!isFieldMandatory(field, modal)) continue;
    if (isFieldFilled(field)) continue;
    const question = getFieldLabel(field, modal);
    if (!question) {
      console.log('[EasyApplyPlugin] Could not determine question for field:', field);
      continue;
    }
    let answer = cache[question];
    let usedGemini = false;
    if (!answer) {
      // Ask Gemini
      answer = await getGeminiAnswer(question, userCV, geminiApiKey);
      usedGemini = true;
      if (answer) {
        // Save to cache
        cache[question] = answer;
        chrome.storage.local.set({ qaCache: cache });
      }
    }
    // Log what we're doing
    console.log('[EasyApplyPlugin] [MANDATORY] Field:', field.type, '| Question:', question);
    if (usedGemini) {
      console.log('[EasyApplyPlugin] Sent to Gemini:', { question, cv: userCV.slice(0, 100) + (userCV.length > 100 ? '...' : '') });
      console.log('[EasyApplyPlugin] Gemini response:', answer);
    }
    if (answer) {
      if (field.type === 'checkbox') {
        if (/yes|agree|true|accept|i do/i.test(answer)) {
          field.checked = true;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Checked checkbox for: ${question}`);
        }
      } else if (field.type === 'radio') {
        const group = modal.querySelectorAll(`input[type="radio"][name='${field.name}']`);
        let found = false;
        group.forEach(radio => {
          const radioLabel = getFieldLabel(radio, modal) || (radio.nextElementSibling && radio.nextElementSibling.innerText.trim());
          if (radioLabel && radioLabel.toLowerCase().includes(answer.trim().toLowerCase())) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            found = true;
            console.log(`[EasyApplyPlugin] Selected radio for: ${question} => ${answer}`);
          }
        });
        if (!found && group.length) {
          group[0].checked = true;
          group[0].dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Fallback: selected first radio for: ${question}`);
        }
      } else if (field.tagName === 'SELECT') {
        let found = false;
        for (let i = 0; i < field.options.length; i++) {
          if (field.options[i].textContent.trim().toLowerCase() === answer.trim().toLowerCase()) {
            field.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) field.selectedIndex = 1;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[EasyApplyPlugin] Selected option for: ${question} => ${field.options[field.selectedIndex].textContent.trim()}`);
      } else {
        field.value = answer;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`[EasyApplyPlugin] Filled: ${question} => ${answer}`);
      }
      await new Promise(res => setTimeout(res, 500));
    }
  }
}

async function handleEasyApplyQuestions() {
  console.log('[EasyApplyPlugin] Starting Gemini Q&A autofill...');
  const { userCV, geminiApiKey, qaCache } = await new Promise(resolve => chrome.storage.local.get(['userCV', 'geminiApiKey', 'qaCache'], resolve));
  if (!userCV || !geminiApiKey) {
    console.log('[EasyApplyPlugin] CV or Gemini API key missing.');
    return;
  }
  const cache = qaCache || {};
  const modal = document.querySelector('.jobs-easy-apply-content, .jobs-easy-apply-modal, .jobs-easy-apply-content__wrapper, [data-test-modal]');
  if (!modal) {
    console.log('[EasyApplyPlugin] No Easy Apply modal found.');
    return;
  }
  await fillMandatoryFieldsWithGemini(modal, cache, userCV, geminiApiKey);
  console.log('[EasyApplyPlugin] Gemini Q&A autofill complete.');
}

async function getGeminiAnswer(question, cv, apiKey) {
  const prompt = `My CV: ${cv}\n\nQuestion: ${question}\n\nAnswer:`;
  try {
    console.log('[EasyApplyPlugin] Gemini API prompt:', prompt);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    console.log('[EasyApplyPlugin] Gemini API error:', e);
    return '';
  }
}

async function fillFieldsFromErrorsOrBlanks(modal, cache, userCV, geminiApiKey) {
  // 1. Scan for error messages
  const errors = Array.from(modal.querySelectorAll('.artdeco-inline-feedback--error'));
  let filledAny = false;
  for (const error of errors) {
    // Try to find the associated field (previous input/select/textarea/checkbox/radio)
    let field = error.previousElementSibling;
    while (field && !['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName)) {
      field = field.previousElementSibling;
    }
    if (field && !isFieldFilled(field)) {
      const question = getFieldLabel(field, modal);
      if (!question) {
        console.log('[EasyApplyPlugin] [ERROR FILL] Could not determine question for field:', field);
        continue;
      }
      let answer = cache[question];
      let usedGemini = false;
      if (!answer) {
        answer = await getGeminiAnswer(question, userCV, geminiApiKey);
        usedGemini = true;
        if (answer) {
          cache[question] = answer;
          chrome.storage.local.set({ qaCache: cache });
        }
      }
      console.log('[EasyApplyPlugin] [ERROR FILL] Field:', field.type, '| Question:', question);
      if (usedGemini) {
        console.log('[EasyApplyPlugin] Sent to Gemini:', { question, cv: userCV.slice(0, 100) + (userCV.length > 100 ? '...' : '') });
        console.log('[EasyApplyPlugin] Gemini response:', answer);
      }
      if (answer) {
        if (field.type === 'checkbox') {
          if (/yes|agree|true|accept|i do/i.test(answer)) {
            field.checked = true;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Checked checkbox for: ${question}`);
          }
        } else if (field.type === 'radio') {
          const group = modal.querySelectorAll(`input[type="radio"][name='${field.name}']`);
          let found = false;
          group.forEach(radio => {
            const radioLabel = getFieldLabel(radio, modal) || (radio.nextElementSibling && radio.nextElementSibling.innerText.trim());
            if (radioLabel && radioLabel.toLowerCase().includes(answer.trim().toLowerCase())) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              found = true;
              console.log(`[EasyApplyPlugin] Selected radio for: ${question} => ${answer}`);
            }
          });
          if (!found && group.length) {
            group[0].checked = true;
            group[0].dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Fallback: selected first radio for: ${question}`);
          }
        } else if (field.tagName === 'SELECT') {
          let found = false;
          for (let i = 0; i < field.options.length; i++) {
            if (field.options[i].textContent.trim().toLowerCase() === answer.trim().toLowerCase()) {
              field.selectedIndex = i;
              found = true;
              break;
            }
          }
          if (!found) field.selectedIndex = 1;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Selected option for: ${question} => ${field.options[field.selectedIndex].textContent.trim()}`);
        } else {
          field.value = answer;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(`[EasyApplyPlugin] Filled: ${question} => ${answer}`);
        }
        await new Promise(res => setTimeout(res, 500));
        filledAny = true;
      }
    }
  }
  // 2. If no errors or nothing filled, scan for blank fields
  if (!filledAny) {
    const allFields = Array.from(modal.querySelectorAll('input, textarea, select'));
    for (const field of allFields) {
      if (!isFieldFilled(field)) {
        const question = getFieldLabel(field, modal);
        if (!question) {
          console.log('[EasyApplyPlugin] [BLANK FILL] Could not determine question for field:', field);
          continue;
        }
        let answer = cache[question];
        let usedGemini = false;
        if (!answer) {
          answer = await getGeminiAnswer(question, userCV, geminiApiKey);
          usedGemini = true;
          if (answer) {
            cache[question] = answer;
            chrome.storage.local.set({ qaCache: cache });
          }
        }
        console.log('[EasyApplyPlugin] [BLANK FILL] Field:', field.type, '| Question:', question);
        if (usedGemini) {
          console.log('[EasyApplyPlugin] Sent to Gemini:', { question, cv: userCV.slice(0, 100) + (userCV.length > 100 ? '...' : '') });
          console.log('[EasyApplyPlugin] Gemini response:', answer);
        }
        if (answer) {
          if (field.type === 'checkbox') {
            if (/yes|agree|true|accept|i do/i.test(answer)) {
              field.checked = true;
              field.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`[EasyApplyPlugin] Checked checkbox for: ${question}`);
            }
          } else if (field.type === 'radio') {
            const group = modal.querySelectorAll(`input[type="radio"][name='${field.name}']`);
            let found = false;
            group.forEach(radio => {
              const radioLabel = getFieldLabel(radio, modal) || (radio.nextElementSibling && radio.nextElementSibling.innerText.trim());
              if (radioLabel && radioLabel.toLowerCase().includes(answer.trim().toLowerCase())) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                found = true;
                console.log(`[EasyApplyPlugin] Selected radio for: ${question} => ${answer}`);
              }
            });
            if (!found && group.length) {
              group[0].checked = true;
              group[0].dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`[EasyApplyPlugin] Fallback: selected first radio for: ${question}`);
            }
          } else if (field.tagName === 'SELECT') {
            let found = false;
            for (let i = 0; i < field.options.length; i++) {
              if (field.options[i].textContent.trim().toLowerCase() === answer.trim().toLowerCase()) {
                field.selectedIndex = i;
                found = true;
                break;
              }
            }
            if (!found) field.selectedIndex = 1;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Selected option for: ${question} => ${field.options[field.selectedIndex].textContent.trim()}`);
          } else {
            field.value = answer;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`[EasyApplyPlugin] Filled: ${question} => ${answer}`);
          }
          await new Promise(res => setTimeout(res, 500));
        }
      }
    }
  }
} 