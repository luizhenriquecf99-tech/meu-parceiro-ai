import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, User, Image as ImageIcon, Loader2, Phone, Ghost, ShieldAlert,
  ChevronRight, LogOut, LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import { useVoice } from './hooks/useVoice';
import { getAIResponse } from './lib/ai';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  const { user, profile, loading: authLoading, logout } = useAuth();
  const { isConversationActive, isListening, transcript, interimText, toggleConversation, speak, resumeListening, isTtsReady } = useVoice();
  
  const [messages, setMessages] = useState([]);
  const [language, setLanguage] = useState('English');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const fileInputRef = useRef(null);
  const lastCallTime = useRef(0);
  const pendingText = useRef('');

  // Voice Interaction Logic
  useEffect(() => {
    if (!transcript || !transcript.text || isAiThinking) return;
    
    const newPart = transcript.text.trim();
    pendingText.current = pendingText.current 
      ? pendingText.current + ' ' + newPart 
      : newPart;

    const isOkTrigger = /\bok\b/gi.test(newPart);
    const textToSend = pendingText.current.trim();
    if (!textToSend) return;

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
    const now = Date.now();
    const timeSinceLast = now - lastCallTime.current;
    if (timeSinceLast < 3000) {
      await new Promise(r => setTimeout(r, 3000 - timeSinceLast));
    }
    lastCallTime.current = Date.now();

    const newMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    
    setIsAiThinking(true);
    
    const aiResponse = await getAIResponse(
      updatedMessages, 
      profile?.username || 'Gossip Friend', 
      language,
      selectedImage?.split(',')[1]
    );
    
    setIsAiThinking(false);
    setSelectedImage(null);

    if (aiResponse && aiResponse.trim().length > 0) {
      setMessages(prev => [...prev, { role: 'buddy', content: aiResponse }]);
      speak(aiResponse);
    } else {
      resumeListening();
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'English' ? 'Spanish' : 'English');
  };

  if (authLoading) return <div className="loading-screen"><Loader2 className="animate-spin" /></div>;

  // New Hybrid Auth Gate
  if (!user) return <AuthScreen />;

  const isAdmin = profile?.role === 'admin';
  const isActive = profile?.is_active || isAdmin;

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div 
            key="locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="locked-screen glass-card text-center"
          >
            <ShieldAlert size={48} className="neon-icon" />
            <h2>Acesso Pendente 🍿</h2>
            <p>Seu parceiro ainda não fofocou com o seu administrador! Seu acesso está sendo analisado.</p>
            <button className="btn-secondary" onClick={logout}>Sair</button>
          </motion.div>
        ) : showAdmin && isAdmin ? (
          <AdminDashboard key="admin" onBack={() => setShowAdmin(false)} />
        ) : (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="call-screen"
          >
            <div className="header">
              {isAdmin ? (
                <button className="icon-btn secondary" onClick={() => setShowAdmin(true)}><LayoutDashboard size={20} /></button>
              ) : (
                <button className="icon-btn secondary"><Settings size={20} /></button>
              )}
              
              <div className="buddy-brand">
                 <Ghost size={20} />
                 <h2 className="buddy-name">Meu Parceiro</h2>
              </div>
              
              <button className="icon-btn secondary" onClick={logout}><LogOut size={20}/></button>
            </div>

            <div className="main-interaction">
              <div className={`avatar-container ${isConversationActive ? 'animate-pulse' : ''}`}>
                <div className={`glow-orb ${isListening ? 'listening' : ''} ${isAiThinking ? 'thinking' : ''}`}></div>
                {isAiThinking && <Loader2 className="ai-loader animate-spin" />}
              </div>
              
              <div className="transcript-preview">
                {interimText && <p className="interim-text">"{interimText}..."</p>}
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

            <div className="controls-footer glass">
              <div className="upper-controls">
                <button className="icon-btn secondary" onClick={() => fileInputRef.current.click()}><ImageIcon size={24} /></button>
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                   const file = e.target.files[0];
                   if (file) {
                     const reader = new FileReader();
                     reader.onloadend = () => setSelectedImage(reader.result);
                     reader.readAsDataURL(file);
                   }
                }} />
                
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
                  className={`mic-btn ${isConversationActive ? 'active' : ''}`}
                  onClick={toggleConversation}
                >
                  <Phone size={32} />
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
