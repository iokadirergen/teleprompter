/**
 * Voice-Synced Teleprompter - Backend Server
 * 
 * This server handles speech-to-text transcription using OpenAI's Whisper API
 * and performs fuzzy matching against the script to determine if the user
 * is on-script or off-script.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const OpenAI = require('openai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'teleprompter-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from root directory
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '/')));

/**
 * Normalize text for matching: lowercase and remove punctuation
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity score between transcript and script window
 * Uses word overlap and order awareness
 * 
 * @param {string} transcript - The recognized speech text
 * @param {string[]} scriptWords - Array of words from the script window
 * @returns {Object} { score: number, matchedIndex: number|null }
 */
function calculateMatch(transcript, scriptWords) {
  const transcriptNormalized = normalizeText(transcript);
  const transcriptTokens = transcriptNormalized.split(' ').filter(w => w.length > 0);

  if (transcriptTokens.length === 0) {
    return { score: 0, matchedIndex: null };
  }

  let bestScore = 0;
  let bestIndex = null;

  // Try to find the best matching position in the script window
  for (let i = 0; i < scriptWords.length; i++) {
    let matchCount = 0;
    let position = i;

    // Try to match transcript tokens sequentially
    for (let j = 0; j < transcriptTokens.length && position < scriptWords.length; j++) {
      const scriptWord = normalizeText(scriptWords[position]);
      const transcriptWord = transcriptTokens[j];

      // Exact match
      if (scriptWord === transcriptWord) {
        matchCount++;
        position++;
      }
      // Partial match (for longer words)
      else if (scriptWord.includes(transcriptWord) || transcriptWord.includes(scriptWord)) {
        matchCount += 0.5;
        position++;
      }
      // Allow skipping one word in script (for minor deviations)
      else if (position + 1 < scriptWords.length) {
        const nextScriptWord = normalizeText(scriptWords[position + 1]);
        if (nextScriptWord === transcriptWord) {
          matchCount += 0.8;
          position += 2;
        } else {
          position++;
        }
      }
    }

    // Calculate score as percentage of transcript words matched
    const score = matchCount / transcriptTokens.length;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { score: bestScore, matchedIndex: bestIndex };
}

/**
 * POST /transcribe
 * 
 * Accepts audio blob and script context, returns transcription and matching result
 * PROTECTED: Requires authentication
 */
app.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get script context from request
    const scriptWindow = JSON.parse(req.body.scriptWindow || '[]');
    const currentIndex = parseInt(req.body.currentIndex || '0');
    const threshold = parseFloat(req.body.threshold || '0.6');

    console.log(`Transcribing audio chunk... (current index: ${currentIndex})`);

    // Transcribe audio using Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      language: 'en', // Change if needed
      response_format: 'json'
    });

    const transcript = transcription.text || '';
    console.log(`Transcript: "${transcript}"`);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // If no transcript, return paused state
    if (!transcript.trim()) {
      return res.json({
        transcript: '',
        confidence: 0,
        matchedIndex: null,
        state: 'PAUSED'
      });
    }

    // Perform matching against script window
    const matchResult = calculateMatch(transcript, scriptWindow);

    console.log(`Match score: ${matchResult.score.toFixed(2)} (threshold: ${threshold})`);

    // Determine state based on match score
    const state = matchResult.score >= threshold ? 'RUNNING' : 'PAUSED';

    // Calculate absolute matched index if match found
    let absoluteMatchedIndex = null;
    if (matchResult.matchedIndex !== null && state === 'RUNNING') {
      absoluteMatchedIndex = currentIndex + matchResult.matchedIndex;
    }

    res.json({
      transcript: transcript,
      confidence: matchResult.score,
      matchedIndex: absoluteMatchedIndex,
      state: state
    });

  } catch (error) {
    console.error('Transcription error:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Transcription failed',
      details: error.message
    });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * POST /api/login
 * Admin login endpoint
 */
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    req.session.adminEmail = email;

    // Log activity
    logActivity('Admin login', { email });

    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

/**
 * POST /api/logout
 * Admin logout endpoint
 */
app.post('/api/logout', (req, res) => {
  const email = req.session.adminEmail;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }

    // Log activity
    logActivity('Admin logout', { email });

    res.json({ success: true, message: 'Logged out successfully' });
  });
});

/**
 * GET /api/check-auth
 * Check if user is authenticated
 */
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    res.json({ authenticated: true, email: req.session.adminEmail });
  } else {
    res.json({ authenticated: false });
  }
});

// ============================================
// ADMIN ENDPOINTS (Protected)
// ============================================

/**
 * GET /api/admin/scripts
 * Get all saved scripts
 */
app.get('/api/admin/scripts', requireAuth, (req, res) => {
  try {
    const scripts = JSON.parse(fs.readFileSync('./data/scripts.json', 'utf8'));
    res.json(scripts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load scripts' });
  }
});

/**
 * POST /api/admin/scripts
 * Create a new script
 */
app.post('/api/admin/scripts', requireAuth, (req, res) => {
  try {
    const { title, content } = req.body;
    const scripts = JSON.parse(fs.readFileSync('./data/scripts.json', 'utf8'));

    const newScript = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    scripts.push(newScript);
    fs.writeFileSync('./data/scripts.json', JSON.stringify(scripts, null, 2));

    logActivity('Script created', { title, id: newScript.id });

    res.json(newScript);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create script' });
  }
});

/**
 * PUT /api/admin/scripts/:id
 * Update an existing script
 */
app.put('/api/admin/scripts/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const scripts = JSON.parse(fs.readFileSync('./data/scripts.json', 'utf8'));

    const index = scripts.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Script not found' });
    }

    scripts[index] = {
      ...scripts[index],
      title,
      content,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync('./data/scripts.json', JSON.stringify(scripts, null, 2));

    logActivity('Script updated', { title, id });

    res.json(scripts[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update script' });
  }
});

/**
 * DELETE /api/admin/scripts/:id
 * Delete a script
 */
app.delete('/api/admin/scripts/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const scripts = JSON.parse(fs.readFileSync('./data/scripts.json', 'utf8'));

    const index = scripts.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const deletedScript = scripts.splice(index, 1)[0];
    fs.writeFileSync('./data/scripts.json', JSON.stringify(scripts, null, 2));

    logActivity('Script deleted', { title: deletedScript.title, id });

    res.json({ success: true, message: 'Script deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

/**
 * GET /api/admin/activity
 * Get activity logs
 */
app.get('/api/admin/activity', requireAuth, (req, res) => {
  try {
    const activity = JSON.parse(fs.readFileSync('./data/activity.json', 'utf8'));
    // Return last 100 activities
    res.json(activity.slice(-100).reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load activity logs' });
  }
});

/**
 * Helper function to log activity
 */
function logActivity(action, details = {}) {
  try {
    const activity = JSON.parse(fs.readFileSync('./data/activity.json', 'utf8'));
    activity.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      details
    });

    // Keep only last 1000 activities
    if (activity.length > 1000) {
      activity.splice(0, activity.length - 1000);
    }

    fs.writeFileSync('./data/activity.json', JSON.stringify(activity, null, 2));
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`🎙️  Teleprompter server running on http://localhost:${PORT}`);
  console.log(`📝 Make sure to set OPENAI_API_KEY in .env file`);
});
