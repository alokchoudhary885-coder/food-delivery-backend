import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

function OrderCard({ order }) {
  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <motion.div
      className="order-card glass"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="order-header">
        <div>
          <div className="order-id">Order #{order._id.slice(-8).toUpperCase()}</div>
          <div className="order-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <span className={`badge ${isCancelled ? 'badge-red' : 'badge-orange'} status-${order.status}`}>
          {order.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Restaurant */}
      {order.restaurant && (
        <div className="order-restaurant">
          🍽️ {order.restaurant.name || 'Restaurant'}
        </div>
      )}

      {/* Items */}
      <div className="order-items">
        {order.items?.map((item, i) => (
          <div key={i} className="order-item">
            <span>{item.name} × {item.quantity}</span>
            <span>₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="divider" style={{ margin: '12px 0' }} />

      {/* Total + Payment */}
      <div className="order-footer">
        <div>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Payment: </span>
          <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.7rem' }}>
            {order.paymentStatus === 'paid' ? '✅ Paid' : '⏳ ' + (order.paymentMethod === 'cash_on_delivery' ? 'COD' : 'Pending')}
          </span>
        </div>
        <div className="order-total">₹{order.grandTotal}</div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="status-timeline">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className={`timeline-step ${i <= stepIdx ? 'done' : ''}`}>
              <div className="timeline-dot" />
              {i < STATUS_STEPS.length - 1 && <div className="timeline-line" />}
              <div className="timeline-label">{step.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/orders/my-orders', { params: { page, limit: 5 } });
        setOrders(data.data?.orders || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page]);

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '760px' }}>
        <h1 className="heading-2" style={{ marginBottom: '2rem' }}>📦 My Orders</h1>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📦</div>
            <h3>Koi order nahi hai abhi</h3>
            <p>Apna pehla order place karo!</p>
            <a href="/restaurants" className="btn btn-primary" style={{ marginTop: '1rem' }}>Order Now</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {orders.map((o) => <OrderCard key={o._id} order={o} />)}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="pagination" style={{ marginTop: '2rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>← Prev</button>
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next →</button>
          </div>
        )}
      </div>

      <style>{`
        .order-card { padding: 1.25rem; }
        .order-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .order-id { font-weight: 700; font-size: 0.95rem; }
        .order-date { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px; }
        .order-restaurant { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 10px; }
        .order-items { display: flex; flex-direction: column; gap: 4px; }
        .order-item { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-text-muted); }
        .order-footer { display: flex; justify-content: space-between; align-items: center; }
        .order-total { font-size: 1.1rem; font-weight: 800; color: var(--color-orange); }
        .status-timeline { display: flex; align-items: flex-start; margin-top: 16px; overflow-x: auto; padding-bottom: 4px; }
        .timeline-step { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 60px; position: relative; }
        .timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--color-border); border: 2px solid var(--color-border); transition: all 0.3s; }
        .timeline-step.done .timeline-dot { background: var(--color-orange); border-color: var(--color-orange); }
        .timeline-line { position: absolute; top: 5px; left: 50%; width: 100%; height: 2px; background: var(--color-border); z-index: 0; }
        .timeline-step.done .timeline-line { background: var(--color-orange); }
        .timeline-label { font-size: 0.65rem; color: var(--color-text-muted); margin-top: 6px; text-align: center; text-transform: capitalize; }
        .timeline-step.done .timeline-label { color: var(--color-orange); }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; }
      `}</style>
    </div>
  );
}
