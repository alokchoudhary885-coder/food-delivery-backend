import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => setProfile(data.data?.user))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out!');
    navigate('/login');
  };

  const u = profile || user;

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '480px' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="profile-card glass">
            <div className="profile-avatar">
              {u?.name?.charAt(0).toUpperCase()}
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>{u?.name}</h1>
            <p className="text-muted" style={{ marginBottom: '12px' }}>{u?.email}</p>
            <span className="badge badge-orange" style={{ marginBottom: '2rem' }}>
              {u?.role === 'owner' ? '🏪 Restaurant Owner' : '🛒 Customer'}
            </span>

            <div className="profile-info">
              {u?.phone && (
                <div className="info-row">
                  <span className="text-muted">📞 Phone</span>
                  <span>{u.phone}</span>
                </div>
              )}
              <div className="info-row">
                <span className="text-muted">📅 Joined</span>
                <span>{u?.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            </div>

            <button className="btn btn-danger btn-full" style={{ marginTop: '2rem' }} onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        .profile-card { padding: 2.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .profile-avatar {
          width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--color-orange), var(--color-pink));
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem; font-weight: 800; color: white;
        }
        .profile-info { width: 100%; display: flex; flex-direction: column; gap: 12px; text-align: left; }
        .info-row { display: flex; justify-content: space-between; font-size: 0.9rem; padding: 10px 14px; background: var(--color-surface); border-radius: 10px; }
      `}</style>
    </div>
  );
}
