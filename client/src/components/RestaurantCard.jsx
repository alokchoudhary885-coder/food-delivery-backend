import { Link } from 'react-router-dom';

export default function RestaurantCard({ restaurant }) {
  const {
    _id, name, cuisineType = [], image,
    rating = 0, deliveryFee = 0,
    address, isActive = true,
  } = restaurant;

  const city = address?.city || '';
  const imgSrc = image || `https://placehold.co/400x220/1A1A2E/FF6B35?text=${encodeURIComponent(name)}`;

  return (
    <Link to={`/restaurants/${_id}`} className="restaurant-card">
      <div className="restaurant-img-wrap">
        <img src={imgSrc} alt={name} className="restaurant-img" />
        {!isActive && <div className="closed-badge">Closed</div>}
        {deliveryFee === 0 && <div className="free-delivery">Free Delivery</div>}
      </div>

      <div className="restaurant-info">
        <h3 className="restaurant-name">{name}</h3>

        {cuisineType.length > 0 && (
          <p className="restaurant-cuisine">
            {cuisineType.slice(0, 3).join(' • ')}
          </p>
        )}

        <div className="restaurant-meta">
          {rating > 0 && (
            <span className="meta-item">
              ⭐ {Number(rating).toFixed(1)}
            </span>
          )}
          {city && (
            <span className="meta-item">
              📍 {city}
            </span>
          )}
          <span className="meta-item">
            🛵 {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
          </span>
        </div>
      </div>

      <style>{`
        .restaurant-card {
          display: block;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .restaurant-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-card);
          border-color: rgba(255,107,53,0.3);
        }
        .restaurant-img-wrap { position: relative; height: 180px; overflow: hidden; }
        .restaurant-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.4s ease;
        }
        .restaurant-card:hover .restaurant-img { transform: scale(1.05); }
        .closed-badge {
          position: absolute; top: 10px; left: 10px;
          background: rgba(0,0,0,0.75); color: #aaa;
          font-size: 11px; font-weight: 600; padding: 3px 10px;
          border-radius: 20px;
        }
        .free-delivery {
          position: absolute; top: 10px; right: 10px;
          background: rgba(34,197,94,0.85); color: white;
          font-size: 11px; font-weight: 600; padding: 3px 10px;
          border-radius: 20px;
        }
        .restaurant-info { padding: 14px 16px 16px; }
        .restaurant-name {
          font-size: 1rem; font-weight: 700;
          color: var(--color-text); margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .restaurant-cuisine {
          font-size: 0.8rem; color: var(--color-text-muted);
          margin-bottom: 10px;
        }
        .restaurant-meta {
          display: flex; gap: 12px; flex-wrap: wrap;
        }
        .meta-item {
          font-size: 0.78rem; color: var(--color-text-muted);
          display: flex; align-items: center; gap: 3px;
        }
      `}</style>
    </Link>
  );
}
