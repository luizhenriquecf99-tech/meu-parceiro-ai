import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Mail, Lock, User, Ghost } from 'lucide-react';
import { motion } from 'framer-motion';

const AuthScreen = () => {
  const { login, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signUp(email, password, name);
      }
    } catch (err) {
      setError(err.message || 'Erro ao autenticar. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-card glass-card"
      >
        <div className="auth-header">
           <div className="logo-aura">
             <Ghost className="neon-icon" size={40} />
           </div>
           <h1 className="title-gradient">Meu Parceiro AI</h1>
           <p style={{fontSize: '0.7rem', opacity: 0.5, marginTop: '-5px'}}>Versão 2.0 (Gossip Edition)</p>
           <p className="subtitle">
             {isLogin ? 'Bom te ver de novo!' : 'Crie sua conta para começar a fofocar.'}
           </p>
        </div>

        {error && <div className="error-badge">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <User size={18} className="input-icon" />
              <input
                type="text"
                placeholder="Como quer ser chamado?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <Mail size={18} className="input-icon" />
            <input
              type="text"
              placeholder={isLogin ? "E-mail ou Usuário (Admin)" : "Seu E-mail"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Sua senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>

        <div className="auth-footer">
          <button 
            className="text-btn" 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthScreen;
