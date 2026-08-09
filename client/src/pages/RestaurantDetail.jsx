import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import MenuItemCard from '../components/MenuItemCard';
import CartConflictModal from '../components/CartConflictModal';
import { SkeletonMenuCard } from '../components/SkeletonCard';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';

export default function RestaurantDetail() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const totalItems  = useCartStore((s) => s.totalItems());
  const { user }    = useAuthStore();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rRes, mRes] = await Promise.all([
          api.get(`/restaurants/${id}`),
          api.get(`/restaurants/${id}/menu`),
        ]);
        setRestaurant(rRes.data.data?.restaurant);
        setMenu(mRes.data.data?.menuItems || []);
      } catch {
        toast.error('Restaurant load nahi ho saka');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="page">
      <div className="container" style={{ paddingTop: '2rem' }}>
        <div className="skeleton" style={{ height: 240, borderRadius: 18, marginBottom: 24 }} />
        <div className="grid-menu">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonMenuCard key={i} />)}
        </div>
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="page"><div className="empty-state"><div className="icon">🍽️</div><h3>Restaurant nahi mila</h3></div></div>
  );

  const imgSrc = restaurant.image || `https://placehold.co/1200x300/1A1A2E/FF6B35?text=${encodeURIComponent(restaurant.name)}`;

  return (
    <div className="page">
      {/* Hero Banner */}
      <div className="restaurant-banner">
        <img src={imgSrc} alt={restaurant.name} className="banner-img" />
        <div className="banner-overlay" />
        <div className="banner-content container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="banner-title">{restaurant.name}</h1>
            <div className="banner-meta">
              {restaurant.cuisineType?.map((c) => (
                <span key={c} className="badge badge-orange">{c}</span>
              ))}
              {restaurant.rating > 0 && <span className="meta-pill">⭐ {restaurant.rating}</span>}
              <span className="meta-pill">🛵 ₹{restaurant.deliveryFee} delivery</span>
              {restaurant.address?.city && <span className="meta-pill">📍 {restaurant.address.city}</span>}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Menu Header */}
        <div className="menu-section-header">
          <h2 className="heading-3">🍽️ Menu</h2>
          {user?.role === 'customer' && totalItems > 0 && (
            <Link to="/cart" className="btn btn-primary btn-sm">
              🛒 View Cart ({totalItems})
            </Link>
          )}
        </div>

        {menu.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🍽️</div>
            <h3>Menu items nahi hain abhi</h3>
          </div>
        ) : (
          <motion.div
            className="grid-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {menu.map((item) => (
              <MenuItemCard
                key={item._id}
                item={item}
                restaurantId={restaurant._id}
                restaurantName={restaurant.name}
              />
            ))}
          </motion.div>
        )}
      </div>

      <CartConflictModal />

      <style>{`
        .restaurant-banner { position: relative; height: 260px; overflow: hidden; margin-top: 0; }
        .banner-img { width: 100%; height: 100%; object-fit: cover; }
        .banner-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(15,14,23,0.95) 0%, rgba(15,14,23,0.3) 100%); }
        .banner-content { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; padding-bottom: 1.5rem; }
        .banner-title { font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 800; margin-bottom: 0.75rem; }
        .banner-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .meta-pill { background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
        .menu-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      `}</style>
    </div>
  );
}
