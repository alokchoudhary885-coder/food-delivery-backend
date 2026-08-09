import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

const STATUS_OPTIONS = ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

export default function OwnerDashboard() {
  const { user } = useAuthStore();
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tab, setTab] = useState('orders'); // 'orders' | 'menu'
  const [loading, setLoading] = useState(false);

  // Load owner's restaurants
  useEffect(() => {
    api.get('/restaurants/my-restaurants')
      .then(({ data }) => {
        const list = data.data?.restaurants || [];
        setRestaurants(list);
        if (list.length > 0) setSelectedRestaurant(list[0]);
      })
      .catch(() => toast.error('Restaurants load nahi ho sake'));
  }, []);

  // Load orders + menu when restaurant changes
  useEffect(() => {
    if (!selectedRestaurant) return;
    setLoading(true);
    Promise.all([
      api.get(`/orders/restaurant/${selectedRestaurant._id}`),
      api.get(`/restaurants/${selectedRestaurant._id}/menu`),
    ]).then(([ordRes, menuRes]) => {
      setOrders(ordRes.data.data?.orders || []);
      setMenuItems(menuRes.data.data?.menuItems || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedRestaurant]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, status } : o));
      toast.success(`Status updated: ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!confirm('Ye item delete karna chahte ho?')) return;
    try {
      await api.delete(`/menu/${itemId}`);
      setMenuItems((prev) => prev.filter((i) => i._id !== itemId));
      toast.success('Item deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading-2" style={{ marginBottom: '0.5rem' }}>🏪 Owner Dashboard</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Welcome, {user?.name}</p>
        </motion.div>

        {/* Restaurant Selector */}
        {restaurants.length > 1 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <select
              className="form-select" style={{ maxWidth: 320 }}
              value={selectedRestaurant?._id}
              onChange={(e) => setSelectedRestaurant(restaurants.find((r) => r._id === e.target.value))}
            >
              {restaurants.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
        )}

        {restaurants.length === 0 && !loading && (
          <div className="empty-state">
            <div className="icon">🏪</div>
            <h3>Koi restaurant nahi hai</h3>
            <p>Pehle ek restaurant create karo</p>
          </div>
        )}

        {selectedRestaurant && (
          <>
            {/* Restaurant Info */}
            <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedRestaurant.name}</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{selectedRestaurant.address?.city} • ₹{selectedRestaurant.deliveryFee} delivery</p>
              </div>
              <span className={`badge ${selectedRestaurant.isActive ? 'badge-green' : 'badge-red'}`}>
                {selectedRestaurant.isActive ? '🟢 Active' : '🔴 Inactive'}
              </span>
            </div>

            {/* Tabs */}
            <div className="dash-tabs">
              {['orders', 'menu'].map((t) => (
                <button key={t} className={`dash-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'orders' ? `📦 Orders (${orders.length})` : `🍽️ Menu (${menuItems.length})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
              </div>
            ) : tab === 'orders' ? (
              <div style={{ marginTop: '1.5rem' }}>
                {orders.length === 0 ? (
                  <div className="empty-state"><div className="icon">📦</div><h3>Koi order nahi aaya abhi</h3></div>
                ) : orders.map((order) => (
                  <div key={order._id} className="order-row glass">
                    <div className="order-row-info">
                      <div className="order-row-id">#{order._id.slice(-8).toUpperCase()}</div>
                      <div className="order-row-items text-muted">
                        {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--color-orange)' }}>₹{order.grandTotal}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className={`badge status-${order.status}`}>{order.status.replace('_', ' ')}</span>
                      <select
                        className="form-select"
                        style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}
                        value={order.status}
                        onChange={(e) => updateStatus(order._id, e.target.value)}
                        disabled={order.status === 'delivered' || order.status === 'cancelled'}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid-menu" style={{ marginTop: '1.5rem' }}>
                {menuItems.length === 0 ? (
                  <div className="empty-state"><div className="icon">🍽️</div><h3>Menu items nahi hain</h3></div>
                ) : menuItems.map((item) => (
                  <div key={item._id} className="glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                      <div className="text-orange" style={{ fontWeight: 700 }}>₹{item.price}</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteMenuItem(item._id)}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .dash-tabs { display: flex; gap: 8px; }
        .dash-tab { padding: 10px 20px; border-radius: 10px; font-size: 0.875rem; font-weight: 600; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted); transition: all 0.2s; cursor: pointer; }
        .dash-tab.active { background: rgba(255,107,53,0.15); border-color: var(--color-orange); color: var(--color-orange); }
        .order-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; margin-bottom: 10px; gap: 12px; flex-wrap: wrap; }
        .order-row-id { font-size: 0.8rem; font-weight: 700; margin-bottom: 4px; }
        .order-row-items { font-size: 0.78rem; margin-bottom: 4px; }
      `}</style>
    </div>
  );
}
