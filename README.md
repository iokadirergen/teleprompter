# 🎙️ Voice-Synced Teleprompter

A professional web-based teleprompter that listens to your voice, highlights the currently spoken word, and automatically pauses when you go off-script.

## Features

✅ **Real-time Speech Recognition** - Uses OpenAI Whisper API for accurate transcription  
✅ **Smart Matching** - Fuzzy matching algorithm detects when you're on or off script  
✅ **Auto Pause/Resume** - Automatically pauses when off-script and resumes when you return  
✅ **Word Highlighting** - Current word highlighted in green, spoken words in gray  
✅ **Auto-Scroll** - Keeps the current word centered on screen  
✅ **Click to Jump** - Click any word to manually set your position  
✅ **Mobile-First Design** - Optimized for phones and tablets  

## Prerequisites

- **Node.js** (v14 or higher)
- **OpenAI API Key** (for Whisper transcription)

## Installation

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   cd teleprompter
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   PORT=3000
   ```

## Getting Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the key and paste it into your `.env` file

## Running the Application

1. **Start the server**
   ```bash
   npm start
   ```

2. **Open your browser**
   
   Navigate to: `http://localhost:3000`

3. **Grant microphone permission** when prompted

## How to Use

### 1. Enter Your Script
- Paste or type your script into the text area
- Click **Load Script**

### 2. Start Recording
- Click **▶ Start** to begin
- Grant microphone permission if prompted
- Start speaking your script

### 3. Reading the Script
- The current word will be highlighted in **green**
- Previously spoken words appear in **gray**
- The script auto-scrolls to keep the current word centered

### 4. Off-Script Detection
- If you deviate from the script, a **warning banner** appears
- The teleprompter automatically **pauses**
- Return to reading the script to **auto-resume**

### 5. Manual Controls
- **⏹ Stop** - Stop recording and return to IDLE
- **↻ Reset** - Jump back to the beginning
- **✏️ Edit Script** - Return to script editing
- **Click any word** - Manually jump to that position

## How It Works

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │  HTTP   │   Node.js    │   API   │   OpenAI    │
│  (Frontend) │ ◄─────► │   Server     │ ◄─────► │   Whisper   │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Workflow

1. **Audio Capture**: MediaRecorder captures 1.5-second audio chunks
2. **Transcription**: Audio sent to backend → Whisper API → text returned
3. **Matching**: Backend compares transcript to 30-word script window
4. **Scoring**: Fuzzy matching calculates similarity score (0-1)
5. **Decision**: 
   - Score ≥ 60% → RUNNING (advance position, highlight, scroll)
   - Score < 60% → PAUSED (show warning, stop scrolling)

### Matching Algorithm

The matching algorithm:
- Normalizes text (lowercase, remove punctuation)
- Compares transcript words to script window
- Allows for minor deviations (skipped words, partial matches)
- Returns best matching position and confidence score

## Configuration

Edit `app.js` to customize:

```javascript
const CONFIG = {
  serverUrl: 'http://localhost:3000',
  chunkDuration: 1500,  // Audio chunk size (ms)
  matchingWindow: 30,   // Words to match against
  matchThreshold: 0.6,  // Minimum similarity (0-1)
  scrollOffset: 0.4     // Scroll position (0-1)
};
```

## Troubleshooting

### "Could not access microphone"
- Grant microphone permission in browser settings
- Use HTTPS in production (required for microphone access)

### "Transcription failed"
- Check your OpenAI API key in `.env`
- Verify you have API credits available
- Check server console for error details

### Poor matching accuracy
- Speak clearly and at a steady pace
- Reduce background noise
- Adjust `matchThreshold` in `app.js` (lower = more lenient)

### Auto-scroll not working
- Ensure state is RUNNING (not PAUSED)
- Check browser console for errors

## Project Structure

```
teleprompter/
├── index.html          # Main HTML structure
├── style.css           # Mobile-first styling
├── app.js              # Frontend logic
├── server.js           # Backend API server
├── package.json        # Dependencies
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Future Enhancements

Potential improvements for future versions:

- 🔊 Adjustable speech rate detection
- 📊 Analytics dashboard (accuracy, pace, pauses)
- 💾 Save/load multiple scripts
- 🎨 Customizable themes and fonts
- 🌐 Multi-language support
- 📱 Native mobile apps
- 👥 Multi-user collaboration
- ☁️ Cloud storage integration

## Technology Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Speech-to-Text**: OpenAI Whisper API
- **Audio**: MediaRecorder API

## License

MIT License - feel free to use and modify for your projects!

## Support

For issues or questions, please check:
- Server console logs
- Browser console (F12)
- OpenAI API status

---

**Happy prompting! 🎬**
