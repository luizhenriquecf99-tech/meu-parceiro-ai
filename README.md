# 🍻 Bar Buddy AI

**Bar Buddy AI** is a premium, voice-first language learning platform. It's designed to be your "Bar Psychologist"—a supportive, opinionated friend who helps you practice English or Spanish while engaging in meaningful, casual conversations.

## ✨ Features

- **Voice-First Experience**: Optimized for hands-free use during runs or commutes.
- **Premium Voice (Kokoro TTS)**: High-quality, natural-sounding voice synthesis running entirely in your browser (no extra API costs!).
- **"Bar Psychologist" Persona**: A unique AI personality that listens, gives opinions, and corrects your language naturally.
- **Multimodal (Vision)**: Upload screenshots or news to discuss them with your Buddy.
- **SaaS Ready**: Built-in authentication and access control for up to 10 users via Supabase.
- **PWA Support**: Install it on your phone like a native app.

## 🚀 Quick Start

1. **Clone & Install**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file based on `.env.example`:
   ```bash
   VITE_GEMINI_API_KEY=your_key
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   ```

3. **Database Setup**:
   Run the SQL provided in the `master_guide.md` in your Supabase SQL Editor.

4. **Run Locally**:
   ```bash
   npm run dev
   ```

## 🛠️ Tech Stack

- **Frontend**: Vite + React + Framer Motion
- **AI**: Gemini 1.5 Flash (Google AI Studio)
- **Voice**: Kokoro-js (WASM) + Web Speech API
- **Backend/Auth**: Supabase

---
Built with ❤️ by Antigravity for Luiz.
