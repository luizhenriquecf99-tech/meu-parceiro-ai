import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, UserCheck, UserX, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboard = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setUsers(data);
    setLoading(false);
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    setActionLoading(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', userId);

    if (!error) {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_active: !currentStatus } : u
      ));
    }
    setActionLoading(null);
  };

  return (
    <div className="admin-dashboard glass-card">
      <div className="admin-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <h2>Gestão de Fofoqueiros</h2>
        <div className="admin-stats">
          Total: {users.length} | Ativos: {users.filter(u => u.is_active).length}
        </div>
      </div>

      <div className="admin-user-list">
        {loading ? (
          <div className="admin-loading"><Loader2 className="animate-spin" /> Carregando parceiros...</div>
        ) : users.length === 0 ? (
          <p className="no-users">Ninguém se cadastrou ainda. Fofoca vazia! 🍿</p>
        ) : (
          users.map(u => (
            <div key={u.id} className={`admin-user-card ${u.role === 'admin' ? 'admin-highlight' : ''}`}>
               <div className="user-info">
                 <div className="user-main">
                    <UserCheck size={18} className="user-icon" />
                    <strong>{u.username}</strong>
                    {u.role === 'admin' && <span className="dev-badge">Admin</span>}
                 </div>
                 <div className="user-sub">
                    <Mail size={12} /> {u.email || 'Admin Account'}
                 </div>
               </div>

               {u.role !== 'admin' && (
                 <div className="user-actions">
                   <button 
                     className={`btn-status ${u.is_active ? 'active' : 'pending'}`}
                     onClick={() => toggleUserStatus(u.id, u.is_active)}
                     disabled={actionLoading === u.id}
                   >
                     {actionLoading === u.id ? (
                       <Loader2 className="animate-spin size={14}" />
                     ) : u.is_active ? (
                       <><ShieldCheck size={14} /> Ativo</>
                     ) : (
                       <><UserX size={14} /> Liberar</>
                     )}
                   </button>
                 </div>
               )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
