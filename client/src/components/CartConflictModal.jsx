import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useCartStore from '../store/cartStore';

export default function CartConflictModal() {
  const [pending, setPending] = useState(null);
  const replaceCart = useCartStore((s) => s.replaceCart);

  useEffect(() => {
    const handler = () => {
      setPending(window.__cartConflict || null);
    };
    window.addEventListener('cart-conflict', handler);
    return () => window.removeEventListener('cart-conflict', handler);
  }, []);

  if (!pending) return null;

  const handleReplace = () => {
    replaceCart(pending.item, pending.restaurantId, pending.restaurantName);
    window.__cartConflict = null;
    setPending(null);
  };

  return (
    <div className="overlay" onClick={() => setPending(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '12px' }}>🛒</div>
        <h3 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.1rem' }}>
          Cart mein doosre restaurant ke items hain
        </h3>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '24px', lineHeight: 1.6 }}>
          Aapke cart mein <strong style={{ color: 'var(--color-orange)' }}>
            {useCartStore.getState().restaurantName}
          </strong> ke items hain.
          Naye item add karne se purana cart clear ho jayega.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost btn-full" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button className="btn btn-primary btn-full" onClick={handleReplace}>
            Clear &amp; Add
          </button>
        </div>
      </div>
    </div>
  );
}
