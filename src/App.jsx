import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, PhoneOff, Settings, User, Image as ImageIcon, Loader2, Phone } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useVoice } from './hooks/useVoice';
import { getAIResponse } from './lib/ai';
import './App.css';

function App() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isConversationActive, isListening, transcript, interimText, toggleConversation, speak, resumeListening, isTtsReady } = useVoice();
  
  const [userName, setUserName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [messages, setMessages] = useState([]);
  const [language, setLanguage] = useState('English');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fileInputRef = useRef(null);
  const lastCallTime = useRef(0);
  const pendingText = useRef('');

  // When transcript arrives, accumulate or send
  useEffect(() => {
    if (!transcript || !transcript.text || isAiThinking) return;
    
    // Accumulate text
    const newPart = transcript.text.trim();
    pendingText.current = pendingText.current 
      ? pendingText.current + ' ' + newPart 
      : newPart;

    // "OK" Trigger: Send immediately if user says "OK"
    const isOkTrigger = /\bok\b/gi.test(newPart);
    const textToSend = pendingText.current.trim();
    if (!textToSend) return;

    // Debounce: 2 seconds of silence normally, or instant if "OK"
    const waitTime = isOkTrigger ? 0 : 2000;

    const timeoutId = setTimeout(() => {
      if (pendingText.current) {
        const finalText = pendingText.current.trim();
        pendingText.current = '';
        handleUserVoice(finalText);
      }
    }, waitTime);

    return () => clearTimeout(timeoutId);
  }, [transcript]);

  const handleUserVoice = async (text) => {
    // Anti-Quota Guard: Don't allow requests faster than 3 seconds
    const now = Date.now();
    const timeSinceLast = now - lastCallTime.current;
    if (timeSinceLast < 3000) {
      console.warn("Throttling to save quota...");
      // If too fast, wait until 3s have passed
      await new Promise(r => setTimeout(r, 3000 - timeSinceLast));
    }
    lastCallTime.current = Date.now();

    const newMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    
    setIsAiThinking(true);
    
    const aiResponse = await getAIResponse(
      updatedMessages, 
      profile?.username || userName, 
      language,
      selectedImage?.split(',')[1]
    );
    
    setIsAiThinking(false);
    setSelectedImage(null);

    // Only speak and store if we got a real response
    if (aiResponse && aiResponse.trim().length > 0) {
      setMessages(prev => [...prev, { role: 'buddy', content: aiResponse }]);
      speak(aiResponse);
    } else {
      // Empty response (quota issue) - resume listening anyway
      resumeListening();
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'English' ? 'Spanish' : 'English');
  };

  if (authLoading) return <div className="loading-screen"><Loader2 className="animate-spin" /></div>;

  const isActive = profile?.is_active ?? false;

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {!isLogged ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="login-screen glass-card"
          >
            <h1 className="title-gradient">Meu Parceiro AI</h1>
            <p className="subtitle">Seu amigo fofoqueiro para aprender Inglês e Espanhol.</p>
            
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                const u = new SpeechSynthesisUtterance("");
                window.speechSynthesis.speak(u);
                setIsLogged(true); 
              }}>
              <input 
                type="text" 
                placeholder="Como quer ser chamado?" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
              <button type="submit" className="w-full">Começar Fofoca (Entrar)</button>
            </form>
            
            <div className="access-info">
              <p>Acesso restrito para os primeiros 10 convidados.</p>
            </div>
          </motion.div>
        ) : !isActive ? (
          <div className="locked-screen glass-card text-center">
            <h2>Acesso Pendente</h2>
            <p>Seu acesso ainda não foi liberado pelo Administrador.</p>
          </div>
        ) : (
          <motion.div 
            key="call"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="call-screen"
          >
            <div className="header">
              <button className="icon-btn secondary"><Settings size={20} /></button>
              <h2 className="buddy-name">Meu Parceiro</h2>
              <button className="icon-btn secondary"><User size={20}/></button>
            </div>

            <div className="main-interaction">
              <div className={`avatar-container ${isConversationActive ? 'animate-pulse' : ''}`}>
                <div className={`glow-orb ${isListening ? 'listening' : ''} ${isAiThinking ? 'thinking' : ''}`}></div>
                {isAiThinking && <Loader2 className="ai-loader animate-spin" />}
              </div>
              
              <div className="transcript-preview">
                {/* Show what user is saying in real-time */}
                {interimText && (
                  <p className="interim-text">"{interimText}..."</p>
                )}
                {/* Show last AI message */}
                {!interimText && messages.length > 0 && (
                  <p className="last-message">"{messages[messages.length - 1].content.substring(0, 120)}..."</p>
                )}
              </div>

              <p className="call-status">
                {!isConversationActive ? 'Aperte o botão para iniciar a fofoca' :
                 isListening ? '🎙️ Estou ouvindo...' : 
                 isAiThinking ? '🧠 Pensando...' : 
                 '🔊 Meu Parceiro está falando...'}
              </p>
            </div>

            {selectedImage && (
              <div className="image-preview-float">
                <img src={selectedImage} alt="Upload" />
                <button onClick={() => setSelectedImage(null)}>×</button>
              </div>
            )}

            <div className="controls-footer glass">
              <div className="upper-controls">
                <button 
                  className="icon-btn secondary"
                  onClick={() => fileInputRef.current.click()}
                >
                  <ImageIcon size={24} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  hidden 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
                
                <div className="language-selector" onClick={toggleLanguage}>
                  <span className={language === 'English' ? 'active' : ''}>EN</span>
                  <div className={`toggle-track ${language === 'Spanish' ? 'right' : ''}`}>
                    <div className="toggle-thumb"></div>
                  </div>
                  <span className={language === 'Spanish' ? 'active' : ''}>ES</span>
                </div>
              </div>
              
              <div className="main-controls">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleConversation(language === 'English' ? 'en-US' : 'es-ES')}
                  className={`mic-btn ${isConversationActive ? 'active call-active' : ''}`}
                >
                  {isConversationActive ? <PhoneOff size={32} /> : <Phone size={32} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
