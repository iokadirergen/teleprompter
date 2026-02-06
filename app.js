/**
 * Voice-Synced Teleprompter - Frontend Application
 * 
 * Handles audio capture, script tokenization, matching logic,
 * highlighting, auto-scroll, and state management.
 */

// Configuration
const CONFIG = {
    serverUrl: 'http://localhost:3000',
    chunkDuration: 1500, // 1.5 seconds
    matchingWindow: 30,  // words
    matchThreshold: 0.6, // 60% similarity required
    scrollOffset: 0.4    // Keep current word at 40% from top
};

// Application state
const state = {
    status: 'IDLE', // IDLE, RUNNING, PAUSED
    scriptWords: [],
    currentWordIndex: 0,
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingInterval: null
};

// DOM elements
const elements = {
    // Input section
    scriptInput: document.getElementById('scriptInput'),
    loadScriptBtn: document.getElementById('loadScriptBtn'),
    inputSection: document.getElementById('inputSection'),

    // Teleprompter section
    teleprompterSection: document.getElementById('teleprompterSection'),
    scriptDisplay: document.getElementById('scriptDisplay'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    resetBtn: document.getElementById('resetBtn'),
    editScriptBtn: document.getElementById('editScriptBtn'),

    // Status and info
    statusIndicator: document.getElementById('statusIndicator'),
    warningBanner: document.getElementById('warningBanner'),
    progressText: document.getElementById('progressText'),
    lastTranscript: document.getElementById('lastTranscript')
};

/**
 * Initialize the application
 */
async function init() {
    // Check authentication first
    await checkAuth();

    // Event listeners
    elements.loadScriptBtn.addEventListener('click', loadScript);
    elements.startBtn.addEventListener('click', startTeleprompter);
    elements.stopBtn.addEventListener('click', stopTeleprompter);
    elements.resetBtn.addEventListener('click', resetPosition);
    elements.editScriptBtn.addEventListener('click', editScript);

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    console.log('✅ Teleprompter initialized');
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
    try {
        const response = await fetch(`${CONFIG.serverUrl}/api/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            // Redirect to login
            window.location.href = '/admin-login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin-login.html';
    }
}

/**
 * Logout user
 */
async function logout() {
    try {
        await fetch(`${CONFIG.serverUrl}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/admin-login.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

/**
 * Load and tokenize the script
 */
function loadScript() {
    const scriptText = elements.scriptInput.value.trim();

    if (!scriptText) {
        alert('Please enter a script first!');
        return;
    }

    // Tokenize script into words
    state.scriptWords = scriptText.split(/\s+/).filter(word => word.length > 0);

    if (state.scriptWords.length === 0) {
        alert('Script is empty!');
        return;
    }

    // Create tokenized display
    elements.scriptDisplay.innerHTML = state.scriptWords
        .map((word, index) =>
            `<span class="word" data-word-index="${index}">${word}</span>`
        )
        .join(' ');

    // Add click handlers to words
    document.querySelectorAll('.word').forEach(wordEl => {
        wordEl.addEventListener('click', () => {
            const index = parseInt(wordEl.dataset.wordIndex);
            jumpToWord(index);
        });
    });

    // Show teleprompter section
    elements.inputSection.style.display = 'none';
    elements.teleprompterSection.style.display = 'block';

    // Reset state
    state.currentWordIndex = 0;
    updateUI();

    console.log(`📝 Script loaded: ${state.scriptWords.length} words`);
}

/**
 * Start the teleprompter
 */
async function startTeleprompter() {
    try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize MediaRecorder
        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
        });

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.mediaRecorder.onstop = async () => {
            if (state.audioChunks.length > 0) {
                await processAudioChunk();
            }
        };

        // Start recording in chunks
        startRecordingLoop();

        // Update state
        state.status = 'RUNNING';
        updateUI();

        console.log('🎙️ Teleprompter started');

    } catch (error) {
        console.error('Error starting teleprompter:', error);
        alert('Could not access microphone. Please grant permission and try again.');
    }
}

/**
 * Start continuous recording loop
 */
function startRecordingLoop() {
    state.isRecording = true;

    const recordChunk = () => {
        if (!state.isRecording) return;

        state.audioChunks = [];
        state.mediaRecorder.start();

        setTimeout(() => {
            if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
                state.mediaRecorder.stop();
            }

            // Schedule next chunk
            if (state.isRecording) {
                setTimeout(recordChunk, 100); // Small gap between chunks
            }
        }, CONFIG.chunkDuration);
    };

    recordChunk();
}

/**
 * Process audio chunk and send to backend
 */
async function processAudioChunk() {
    if (state.audioChunks.length === 0) return;

    try {
        // Create audio blob
        const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });

        // Get matching window
        const windowStart = state.currentWordIndex;
        const windowEnd = Math.min(
            state.currentWordIndex + CONFIG.matchingWindow,
            state.scriptWords.length
        );
        const scriptWindow = state.scriptWords.slice(windowStart, windowEnd);

        // Send to backend
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');
        formData.append('scriptWindow', JSON.stringify(scriptWindow));
        formData.append('currentIndex', state.currentWordIndex.toString());
        formData.append('threshold', CONFIG.matchThreshold.toString());

        const response = await fetch(`${CONFIG.serverUrl}/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        // Update UI with transcript
        if (result.transcript) {
            elements.lastTranscript.textContent = result.transcript;
        }

        // Handle matching result
        if (result.state === 'RUNNING' && result.matchedIndex !== null) {
            // Match found - advance position
            state.currentWordIndex = result.matchedIndex + 1;
            state.status = 'RUNNING';
            highlightCurrentWord();
            scrollToCurrentWord();
        } else {
            // No match - pause
            state.status = 'PAUSED';
        }

        updateUI();

    } catch (error) {
        console.error('Error processing audio:', error);
        elements.lastTranscript.textContent = 'Error: ' + error.message;
    }
}

/**
 * Stop the teleprompter
 */
function stopTeleprompter() {
    state.isRecording = false;

    if (state.mediaRecorder) {
        if (state.mediaRecorder.state === 'recording') {
            state.mediaRecorder.stop();
        }

        // Stop all tracks
        state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        state.mediaRecorder = null;
    }

    state.status = 'IDLE';
    updateUI();

    console.log('⏹️ Teleprompter stopped');
}

/**
 * Reset to beginning
 */
function resetPosition() {
    state.currentWordIndex = 0;
    highlightCurrentWord();
    scrollToCurrentWord();
    updateUI();

    console.log('↻ Position reset');
}

/**
 * Jump to specific word
 */
function jumpToWord(index) {
    state.currentWordIndex = index;
    highlightCurrentWord();
    scrollToCurrentWord();
    updateUI();

    console.log(`⤴️ Jumped to word ${index}`);
}

/**
 * Return to script editing
 */
function editScript() {
    stopTeleprompter();
    elements.teleprompterSection.style.display = 'none';
    elements.inputSection.style.display = 'block';
}

/**
 * Highlight the current word
 */
function highlightCurrentWord() {
    const wordElements = document.querySelectorAll('.word');

    wordElements.forEach((wordEl, index) => {
        wordEl.classList.remove('current', 'spoken');

        if (index < state.currentWordIndex) {
            wordEl.classList.add('spoken');
        } else if (index === state.currentWordIndex) {
            wordEl.classList.add('current');
        }
    });
}

/**
 * Auto-scroll to keep current word in view
 */
function scrollToCurrentWord() {
    if (state.status !== 'RUNNING') return;

    const currentWordEl = document.querySelector(`[data-word-index="${state.currentWordIndex}"]`);
    if (!currentWordEl) return;

    const container = elements.scriptDisplay;
    const wordRect = currentWordEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate target scroll position (keep word at 40% from top)
    const targetOffset = containerRect.height * CONFIG.scrollOffset;
    const scrollTop = container.scrollTop + (wordRect.top - containerRect.top) - targetOffset;

    container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
    });
}

/**
 * Update UI based on current state
 */
function updateUI() {
    // Update status indicator
    elements.statusIndicator.className = 'status-indicator ' + state.status.toLowerCase();
    elements.statusIndicator.querySelector('.status-text').textContent = state.status;

    // Update warning banner
    if (state.status === 'PAUSED' && state.isRecording) {
        elements.warningBanner.classList.add('show');
    } else {
        elements.warningBanner.classList.remove('show');
    }

    // Update buttons
    elements.startBtn.disabled = state.status !== 'IDLE';
    elements.stopBtn.disabled = state.status === 'IDLE';

    // Update progress
    elements.progressText.textContent =
        `${state.currentWordIndex} / ${state.scriptWords.length} words`;

    // Update highlighting
    highlightCurrentWord();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
