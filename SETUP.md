# 🚀 Quick Setup Guide

## Step 1: Install Node.js

You need Node.js to run this application. Download and install it:

**Windows:**
1. Go to https://nodejs.org/
2. Download the LTS version (recommended)
3. Run the installer
4. Restart your terminal/command prompt

**Verify installation:**
```bash
node --version
npm --version
```

## Step 2: Install Dependencies

Open a terminal in the `teleprompter` folder and run:

```bash
npm install
```

This will install:
- `express` - Web server
- `multer` - File upload handling
- `openai` - Whisper API client
- `dotenv` - Environment variables
- `cors` - Cross-origin requests

## Step 3: Configure API Key

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   PORT=3000
   ```

**Get an API key:**
- Visit https://platform.openai.com/api-keys
- Sign up or log in
- Create a new secret key
- Copy and paste it into `.env`

## Step 4: Run the Application

```bash
npm start
```

You should see:
```
🎙️  Teleprompter server running on http://localhost:3000
📝 Make sure to set OPENAI_API_KEY in .env file
```

## Step 5: Open in Browser

Navigate to: **http://localhost:3000**

## Step 6: Use the Teleprompter

1. **Paste your script** into the text area
2. Click **Load Script**
3. Click **▶ Start** and grant microphone permission
4. **Start reading** your script out loud
5. Watch as words highlight and scroll automatically!

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

### "OPENAI_API_KEY is not set"
- Make sure you created the `.env` file
- Check that your API key is correct
- Don't include quotes around the key

### "Could not access microphone"
- Grant microphone permission in browser
- Check browser settings (chrome://settings/content/microphone)
- Use HTTPS in production (HTTP works on localhost)

### Server won't start
- Make sure port 3000 is not already in use
- Try changing PORT in `.env` to 3001 or another port

---

**Need help?** Check the full [README.md](README.md) for detailed documentation.
