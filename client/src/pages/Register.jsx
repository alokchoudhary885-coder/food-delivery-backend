import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', phone: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      return toast.error('Password kam se kam 8 characters ka hona chahiye');
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.data.user, data.data.token);
      toast.success(`Welcome, ${data.data.user.name}! 🎉`);
      navigate(data.data.user.role === 'owner' ? '/dashboard' : '/restaurants');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card glass"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-logo">🍕 <span className="gradient-text">FoodRush</span></div>
        <h1 className="auth-title">Create account</h1>
        <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '0.9rem' }}>
          Join thousands of food lovers
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input id="reg-name" type="text" className="form-input" placeholder="Alok Kumar"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="reg-email" type="email" className="form-input" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input id="reg-phone" type="tel" className="form-input" placeholder="+91 98765 43210"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="reg-password" type="password" className="form-input" placeholder="Min 8 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">I am a</label>
            <div className="role-toggle">
              {['customer', 'owner'].map((r) => (
                <button
                  key={r} type="button"
                  className={`role-btn ${form.role === r ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, role: r })}
                >
                  {r === 'customer' ? '🛒 Customer' : '🏪 Restaurant Owner'}
                </button>
              ))}
            </div>
          </div>

          <button id="reg-submit" type="submit" className="btn btn-primary btn-full btn-lg"
            disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Pehle se account hai?{' '}
          <Link to="/login" style={{ color: 'var(--color-orange)', fontWeight: 600 }}>Login</Link>
        </p>
      </motion.div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at center, rgba(255,107,53,0.06) 0%, transparent 65%);
          padding: 100px 1rem 2rem;
        }
        .auth-card { width: 100%; max-width: 440px; padding: 2.5rem; }
        .auth-logo { font-size: 1.5rem; font-weight: 800; margin-bottom: 1.5rem; }
        .auth-title { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.4rem; }
        .auth-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .role-toggle { display: flex; gap: 8px; }
        .role-btn {
          flex: 1; padding: 10px; border-radius: 10px; font-size: 0.85rem; font-weight: 600;
          background: var(--color-surface); border: 1px solid var(--color-border);
          color: var(--color-text-muted); transition: all 0.2s; cursor: pointer;
        }
        .role-btn.active {
          background: rgba(255,107,53,0.15); border-color: var(--color-orange);
          color: var(--color-orange);
        }
      `}</style>
    </div>
  );
}
