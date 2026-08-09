import useCartStore from '../store/cartStore';
import { Link } from 'react-router-dom';

export default function MenuItemCard({ item, restaurantId, restaurantName }) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartItem = cartItems.find((i) => i._id === item._id);

  const handleAdd = () => {
    const result = addItem(item, restaurantId, restaurantName);
    if (result?.conflict) {
      // Store pending item in window for CartConflictModal to pick up
      window.__cartConflict = result.pendingItem;
      window.dispatchEvent(new CustomEvent('cart-conflict'));
    }
  };

  const imgSrc = item.image || `https://placehold.co/300x180/1A1A2E/FF6B35?text=${encodeURIComponent(item.name)}`;

  return (
    <div className={`menu-card ${!item.isAvailable ? 'menu-card--unavailable' : ''}`}>
      <div className="menu-img-wrap">
        <img src={imgSrc} alt={item.name} className="menu-img" />
        {!item.isAvailable && <div className="unavailable-tag">Unavailable</div>}
      </div>

      <div className="menu-info">
        <div className="menu-header">
          <div>
            <h4 className="menu-name">{item.name}</h4>
            {item.description && (
              <p className="menu-desc">{item.description}</p>
            )}
          </div>
          {item.isVeg !== undefined && (
            <span className={`veg-dot ${item.isVeg ? 'veg' : 'nonveg'}`} title={item.isVeg ? 'Veg' : 'Non-Veg'} />
          )}
        </div>

        <div className="menu-footer">
          <span className="menu-price">₹{item.price}</span>
          {item.isAvailable !== false && (
            <button className="add-btn" onClick={handleAdd}>
              {cartItem ? `+ Added (${cartItem.quantity})` : '+ Add'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .menu-card {
          display: flex; gap: 12px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          padding: 14px;
        }
        .menu-card:hover { transform: translateY(-2px); border-color: rgba(255,107,53,0.25); }
        .menu-card--unavailable { opacity: 0.55; }
        .menu-img-wrap { position: relative; flex-shrink: 0; width: 100px; height: 90px; border-radius: 10px; overflow: hidden; }
        .menu-img { width: 100%; height: 100%; object-fit: cover; }
        .unavailable-tag {
          position: absolute; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: #aaa; font-weight: 600;
        }
        .menu-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
        .menu-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
        .menu-name { font-size: 0.95rem; font-weight: 600; color: var(--color-text); }
        .menu-desc { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 3px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .veg-dot { width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; margin-top: 3px; }
        .veg-dot.veg { background: #22C55E; border: 1px solid #16A34A; }
        .veg-dot.nonveg { background: #EF4444; border: 1px solid #DC2626; }
        .menu-footer { display: flex; justify-content: space-between; align-items: center; }
        .menu-price { font-size: 1rem; font-weight: 700; color: var(--color-orange); }
        .add-btn {
          background: rgba(255,107,53,0.15); color: var(--color-orange);
          border: 1px solid rgba(255,107,53,0.35); border-radius: 8px;
          padding: 5px 14px; font-size: 0.8rem; font-weight: 600;
          transition: all 0.2s;
        }
        .add-btn:hover { background: var(--color-orange); color: white; }
      `}</style>
    </div>
  );
}
