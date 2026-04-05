import { useState, useCallback, useEffect, useRef } from 'react';

export const useVoice = () => {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isTtsReady] = useState(true);
  const isSpeakingRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const lastInterimRef = useRef('');
  const langRef = useRef('pt-BR');

  // Create and start a NEW recognition session each time
  const startListeningSession = useCallback(() => {
    if (!conversationActiveRef.current || isSpeakingRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = langRef.current;
    rec.maxAlternatives = 1;

    let gotFinalResult = false;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          gotFinalResult = true;
          lastInterimRef.current = '';
          setInterimText('');
          setTranscript({ text: text, ts: Date.now() }); // Using object with timestamp to force React update even if text is identical
          setIsListening(false);
        } else {
          lastInterimRef.current = text;
          setInterimText(text);
        }
      }
    };

    rec.onstart = () => {
      setIsListening(true);
      setInterimText('');
      lastInterimRef.current = '';
    };

    rec.onend = () => {
      setIsListening(false);
      
      // If we never got a final result but have interim text, use that
      if (!gotFinalResult && lastInterimRef.current.trim()) {
        setTranscript({ text: lastInterimRef.current.trim(), ts: Date.now() });
        lastInterimRef.current = '';
        setInterimText('');
        return; 
      }

      // If no result at all, restart listening after a pause
      if (!gotFinalResult && conversationActiveRef.current && !isSpeakingRef.current) {
        setTimeout(() => startListeningSession(), 500);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Normal - user just didn't say anything yet, will restart via onend
        return;
      }
      console.error("Voice error:", e.error);
      setIsListening(false);
    };

    try {
      rec.start();
    } catch(e) {
      // Retry after a short delay
      setTimeout(() => startListeningSession(), 1000);
    }
  }, []);

  // Toggle conversation on/off (Alexa-style)
  const toggleConversation = useCallback((lang = 'pt-BR') => {
    if (isConversationActive) {
      // Turn OFF
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      setIsListening(false);
      setInterimText('');
      window.speechSynthesis.cancel();
    } else {
      // Turn ON
      langRef.current = lang;
      conversationActiveRef.current = true;
      setIsConversationActive(true);
      setTranscript(null);
      setInterimText('');
      startListeningSession();
    }
  }, [isConversationActive, startListeningSession]);

  // Resume listening (called after AI finishes speaking)
  const resumeListening = useCallback(() => {
    if (!conversationActiveRef.current) return;
    setTimeout(() => startListeningSession(), 600);
  }, [startListeningSession]);

  // Speak using native browser voice
  const speak = useCallback(async (text) => {
    if (!text) {
      resumeListening();
      return;
    }
    isSpeakingRef.current = true;
    setInterimText('');

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      await new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = 'en-US';
        utterance.rate = 0.72; // ~15% slower than previous 0.85 for better study pace

        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v =>
          v.name.includes('Google') && v.lang.startsWith('en')
        ) || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;

        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
             isResolved = true;
             resolve();
          }
        };

        // 1. Keep reference to prevent GC
        window._spokenUtterances = window._spokenUtterances || [];
        window._spokenUtterances.push(utterance);
        
        // 2. Max timeout (min 2s, 150ms/char)
        const timeoutMs = Math.max(2000, trimmed.length * 150);
        setTimeout(doResolve, timeoutMs);

        utterance.onend = doResolve;
        utterance.onerror = (e) => {
          console.error("Speech error", e);
          doResolve();
        };
        
        // Fix for silent speech engine freeze in Chrome/Edge
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      });
    }

    isSpeakingRef.current = false;
    resumeListening();
  }, [resumeListening]);

  return {
    isConversationActive,
    isListening,
    transcript,
    interimText,
    toggleConversation,
    speak,
    resumeListening,
    isTtsReady
  };
};
