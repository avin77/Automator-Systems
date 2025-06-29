// Helper to get/set from chrome.storage.local
function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// UI Elements
const cvTextarea = document.getElementById('cv');
const saveCvBtn = document.getElementById('save-cv');
const cvStatus = document.getElementById('cv-status');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const apiStatus = document.getElementById('api-status');
const qaQuestion = document.getElementById('qa-question');
const qaAnswer = document.getElementById('qa-answer');
const addQaBtn = document.getElementById('add-qa');
const qaList = document.getElementById('qa-list');
const startBtn = document.getElementById('start-automation');
const processAllJobsBtn = document.getElementById('process-all-jobs');
const automationStatus = document.getElementById('automation-status');
const stopBtn = document.getElementById('stop-automation');
const debugBtn = document.getElementById('debug-button');
const processNonEasyApplyCheckbox = document.getElementById('process-non-easy-apply');
const debugApplyBtn = document.getElementById('debug-apply-button');

// Load stored data
async function loadData() {
  const { cv, geminiApiKey, qaCache, processNonEasyApply } = await getStorage(['cv', 'geminiApiKey', 'qaCache', 'processNonEasyApply']);
  if (cv) cvTextarea.value = cv;
  if (geminiApiKey) apiKeyInput.value = geminiApiKey;
  if (processNonEasyApply !== undefined) processNonEasyApplyCheckbox.checked = processNonEasyApply;
  renderQaList(qaCache || {});
  console.log('[EasyApplyPlugin] Loaded persisted data:', {
    cv: cv ? cv.slice(0, 100) + (cv.length > 100 ? '...' : '') : '(none)',
    apiKey: geminiApiKey ? geminiApiKey.slice(0, 6) + '...' : '(none)',
    qaCount: qaCache ? Object.keys(qaCache).length : 0,
    processNonEasyApply: processNonEasyApply
  });
}

// Save CV
saveCvBtn.onclick = async () => {
  await setStorage({ cv: cvTextarea.value });
  cvStatus.textContent = 'CV saved!';
  setTimeout(() => (cvStatus.textContent = ''), 1500);
  console.log('[EasyApplyPlugin] CV persisted:', cvTextarea.value.slice(0, 100) + (cvTextarea.value.length > 100 ? '...' : ''));
};

// Save API Key
saveApiKeyBtn.onclick = async () => {
  await setStorage({ geminiApiKey: apiKeyInput.value });
  apiStatus.textContent = 'API key saved!';
  setTimeout(() => (apiStatus.textContent = ''), 1500);
  console.log('[EasyApplyPlugin] API key persisted:', apiKeyInput.value ? apiKeyInput.value.slice(0, 6) + '...' : '(none)');
};

// Save process non-Easy Apply setting
processNonEasyApplyCheckbox.onchange = async () => {
  await setStorage({ processNonEasyApply: processNonEasyApplyCheckbox.checked });
  console.log('[EasyApplyPlugin] Process non-Easy Apply setting persisted:', processNonEasyApplyCheckbox.checked);
};

// Add Q&A
addQaBtn.onclick = async () => {
  const q = qaQuestion.value.trim();
  const a = qaAnswer.value.trim();
  if (!q || !a) return;
  const { qaCache } = await getStorage(['qaCache']);
  const cache = qaCache || {};
  cache[q] = a;
  await setStorage({ qaCache: cache });
  qaQuestion.value = '';
  qaAnswer.value = '';
  renderQaList(cache);
  console.log(`[EasyApplyPlugin] Q&A added and persisted. Total Q&A: ${Object.keys(cache).length}`);
};

// Edit/Delete Q&A
function renderQaList(cache) {
  qaList.innerHTML = '';
  Object.entries(cache).forEach(([q, a]) => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `<span class="qa-q">Q:</span> ${q}<span class="qa-a">A: ${a}</span>`;
    const actions = document.createElement('span');
    actions.className = 'qa-actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      qaQuestion.value = q;
      qaAnswer.value = a;
    };
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      const { qaCache } = await getStorage(['qaCache']);
      const cache = qaCache || {};
      delete cache[q];
      await setStorage({ qaCache: cache });
      renderQaList(cache);
      console.log(`[EasyApplyPlugin] Q&A deleted and persisted. Total Q&A: ${Object.keys(cache).length}`);
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    div.appendChild(actions);
    qaList.appendChild(div);
  });
}

// Check if we're on a LinkedIn jobs page
async function checkIfOnLinkedInJobsPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url.includes('linkedin.com/jobs');
  } catch (error) {
    console.error('[EasyApplyPlugin] Error checking current page:', error);
    return false;
  }
}

// Start Automation
startBtn.onclick = async () => {
  automationStatus.textContent = 'Starting...';
  
  // Check if we're on a LinkedIn jobs page
  const isOnJobsPage = await checkIfOnLinkedInJobsPage();
  if (!isOnJobsPage) {
    automationStatus.textContent = 'Not on LinkedIn jobs page!';
    setTimeout(() => (automationStatus.textContent = ''), 3000);
    return;
  }
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'startAutomation',
      processNonEasyApply: processNonEasyApplyCheckbox.checked
    }, response => {
      if (chrome.runtime.lastError) {
        automationStatus.textContent = 'Error: Content script not ready!';
        setTimeout(() => (automationStatus.textContent = ''), 3000);
        console.error('[EasyApplyPlugin] Error sending message:', chrome.runtime.lastError);
        return;
      }
      
      automationStatus.textContent = 'Automation started!';
      setTimeout(() => (automationStatus.textContent = ''), 1500);
      console.log('[EasyApplyPlugin] Automation started message sent. Process non-Easy Apply:', processNonEasyApplyCheckbox.checked);
    });
  });
};

// Process All Jobs
processAllJobsBtn.onclick = async () => {
  automationStatus.textContent = 'Starting...';
  
  // Check if we're on a LinkedIn jobs page
  const isOnJobsPage = await checkIfOnLinkedInJobsPage();
  if (!isOnJobsPage) {
    automationStatus.textContent = 'Not on LinkedIn jobs page!';
    setTimeout(() => (automationStatus.textContent = ''), 3000);
    return;
  }
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'processAllJobs'
    }, response => {
      if (chrome.runtime.lastError) {
        automationStatus.textContent = 'Error: Content script not ready!';
        setTimeout(() => (automationStatus.textContent = ''), 3000);
        console.error('[EasyApplyPlugin] Error sending message:', chrome.runtime.lastError);
        return;
      }
      
      automationStatus.textContent = 'Processing all jobs started!';
      setTimeout(() => (automationStatus.textContent = ''), 1500);
      console.log('[EasyApplyPlugin] Process all jobs message sent.');
    });
  });
};

// Stop Automation
stopBtn.onclick = async () => {
  automationStatus.textContent = 'Stopping...';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAutomation' }, response => {
      if (chrome.runtime.lastError) {
        automationStatus.textContent = 'Error: Content script not ready!';
        setTimeout(() => (automationStatus.textContent = ''), 3000);
        console.error('[EasyApplyPlugin] Error sending message:', chrome.runtime.lastError);
        return;
      }
      
      automationStatus.textContent = 'Automation stopped!';
      setTimeout(() => (automationStatus.textContent = ''), 1500);
      console.log('[EasyApplyPlugin] Automation stopped message sent.');
    });
  });
};

// Debug Job Detection
debugBtn.onclick = async () => {
  automationStatus.textContent = 'Debugging...';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'debugJobDetection' }, response => {
      if (chrome.runtime.lastError) {
        automationStatus.textContent = 'Error: Content script not ready!';
        setTimeout(() => (automationStatus.textContent = ''), 3000);
        console.error('[EasyApplyPlugin] Error sending message:', chrome.runtime.lastError);
        return;
      }
      
      automationStatus.textContent = 'Debug completed! Check console.';
      setTimeout(() => (automationStatus.textContent = ''), 3000);
      console.log('[EasyApplyPlugin] Job detection debug completed:', response);
    });
  });
};

// Debug Apply Button
debugApplyBtn.onclick = async () => {
  automationStatus.textContent = 'Debugging Apply Button...';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'debugEasyApplyButton' }, response => {
      if (chrome.runtime.lastError) {
        automationStatus.textContent = 'Error: Content script not ready!';
        setTimeout(() => (automationStatus.textContent = ''), 3000);
        console.error('[EasyApplyPlugin] Error sending message:', chrome.runtime.lastError);
        return;
      }
      
      automationStatus.textContent = 'Apply Button debug completed! Check console.';
      setTimeout(() => (automationStatus.textContent = ''), 3000);
      console.log('[EasyApplyPlugin] Easy Apply button debug completed:', response);
    });
  });
};

// On load
loadData(); 