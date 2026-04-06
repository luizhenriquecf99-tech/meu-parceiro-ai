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
  const toggleConversation = useCallback((langOrEvent) => {
    // If called directly via onClick, the first arg is an Event object.
    const finalLang = typeof langOrEvent === 'string' ? langOrEvent : 'pt-BR';
    
    if (isConversationActive) {
      // Turn OFF
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      setIsListening(false);
      setInterimText('');
      window.speechSynthesis.cancel();
    } else {
      // Turn ON -> iOS Safari Hack: Unlock speech engine synchronously on user click
      const unlockUtterance = new SpeechSynthesisUtterance(" ");
      unlockUtterance.volume = 0;
      unlockUtterance.rate = 10;
      window.speechSynthesis.speak(unlockUtterance);
      
      langRef.current = finalLang;
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
        
        // Simple language detection: Check for common Portuguese letters/accents
        const isPortuguese = /[áéíóúãõçÁÉÍÓÚÃÕÇ]/.test(trimmed) || 
                             /\b(e|o|a|é|você|fofoca|babado|morta|vixi|mas|que)\b/i.test(trimmed);
        
        utterance.lang = isPortuguese ? 'pt-BR' : 'en-US';
        utterance.rate = 0.80; // Slower, professional conversational tone

        const voices = window.speechSynthesis.getVoices();
        
        // Premium neural voices for max fluidity (Edge, Chrome, Safari)
        const premiumPT = ['Francisca Online', 'Antonio Online', 'Google Português do Brasil', 'Luciana', 'Raquel'];
        const premiumEN = ['Aria Online', 'Guy Online', 'Google US English', 'Samantha', 'Victoria'];
        
        let targetList = isPortuguese ? premiumPT : premiumEN;
        let fallbackLang = isPortuguese ? 'pt' : 'en';

        let voice = null;
        // 1. Try to find the absolute best neural voices available
        for (const premiumName of targetList) {
          voice = voices.find(v => v.name.includes(premiumName));
          if (voice) break;
        }
        
        // 2. Fallback to any online/enhanced voice in that language
        if (!voice) {
          voice = voices.find(v => v.lang.startsWith(fallbackLang) && (v.name.includes('Online') || v.name.includes('Google'))) ||
                  voices.find(v => v.lang.startsWith(fallbackLang));
        }

        if (voice) utterance.voice = voice;

        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
             isResolved = true;
             setTimeout(resolve, 150); // Natural pause between sentences
          }
        };

        utterance.onend = doResolve;
        utterance.onerror = doResolve;

        // 1. Keep reference to prevent Garbage Collection
        window._spokenUtterances = window._spokenUtterances || [];
        window._spokenUtterances.push(utterance);
        
        // 2. Safety timeout
        const timeoutMs = Math.max(3000, trimmed.length * 150);
        setTimeout(doResolve, timeoutMs);

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
