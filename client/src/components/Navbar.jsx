import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const totalItems = useCartStore((s) => s.totalItems());
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          🍕 <span className="gradient-text">FoodRush</span>
        </Link>

        {/* Desktop Nav */}
        <div className="navbar-links">
          <Link to="/restaurants" className="nav-link">Restaurants</Link>
          {user?.role === 'customer' && (
            <Link to="/orders" className="nav-link">My Orders</Link>
          )}
          {user?.role === 'owner' && (
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
          )}
        </div>

        {/* Right Actions */}
        <div className="navbar-actions">
          {user?.role === 'customer' && (
            <Link to="/cart" className="cart-btn">
              🛒
              {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
            </Link>
          )}

          {user ? (
            <div className="user-menu">
              <button className="user-avatar" onClick={() => setMenuOpen(!menuOpen)}>
                {user.name?.charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-name">{user.name}</div>
                  <div className="dropdown-role badge badge-orange">{user.role}</div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    👤 Profile
                  </Link>
                  <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          background: rgba(15,14,23,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          height: 70px;
        }
        .navbar-inner {
          display: flex; align-items: center; justify-content: space-between;
          height: 100%;
        }
        .navbar-logo {
          font-size: 1.4rem; font-weight: 800;
          display: flex; align-items: center; gap: 6px;
        }
        .navbar-links { display: flex; gap: 2rem; }
        .nav-link {
          color: var(--color-text-muted); font-size: 0.9rem; font-weight: 500;
          transition: color 0.2s;
        }
        .nav-link:hover { color: var(--color-text); }
        .navbar-actions { display: flex; align-items: center; gap: 1rem; }
        .cart-btn {
          position: relative; font-size: 1.3rem;
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 10px; padding: 8px 12px; transition: all 0.2s;
        }
        .cart-btn:hover { border-color: var(--color-orange); }
        .cart-count {
          position: absolute; top: -6px; right: -6px;
          background: var(--color-orange); color: white;
          border-radius: 50%; width: 18px; height: 18px;
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .user-menu { position: relative; }
        .user-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, var(--color-orange), var(--color-pink));
          color: white; font-weight: 700; font-size: 1rem;
          transition: transform 0.2s;
        }
        .user-avatar:hover { transform: scale(1.05); }
        .user-dropdown {
          position: absolute; top: 48px; right: 0; min-width: 180px;
          background: #1A1A2E; border: 1px solid var(--color-border);
          border-radius: 14px; padding: 12px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        .dropdown-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
        .dropdown-role { margin-bottom: 4px; display: inline-block; }
        .dropdown-item {
          display: block; width: 100%; text-align: left;
          padding: 8px 10px; border-radius: 8px;
          font-size: 0.875rem; color: var(--color-text);
          background: none; transition: background 0.15s;
        }
        .dropdown-item:hover { background: var(--color-surface-2); }
        .dropdown-logout { color: var(--color-error); }
        @media (max-width: 768px) {
          .navbar-links { display: none; }
        }
      `}</style>
    </nav>
  );
}
