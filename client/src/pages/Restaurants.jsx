import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import RestaurantCard from '../components/RestaurantCard';
import { SkeletonCard } from '../components/SkeletonCard';

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  const fetchRestaurants = async (pageNum = 1, q = '') => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: 9 };
      if (q) params.name = q;
      const { data } = await api.get('/restaurants', { params });
      setRestaurants(data.data?.restaurants || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(page, search); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRestaurants(1, search);
  };

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading-2" style={{ marginBottom: '0.5rem' }}>
            🍽️ Restaurants
          </h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>
            Apne area ke best restaurants dhundho
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="search-bar">
            <input
              id="restaurant-search"
              type="text"
              className="form-input"
              placeholder="🔍  Restaurant name dhundho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" id="search-submit">
              Search
            </button>
          </form>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid-restaurants" style={{ marginTop: '2rem' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🍽️</div>
            <h3>Koi restaurant nahi mila</h3>
            <p>Search badlo ya baad mein try karo</p>
          </div>
        ) : (
          <motion.div
            className="grid-restaurants"
            style={{ marginTop: '2rem' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {restaurants.map((r) => (
              <RestaurantCard key={r._id} restaurant={r} />
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← Prev
            </button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next →
            </button>
          </div>
        )}
      </div>

      <style>{`
        .search-bar { display: flex; gap: 12px; max-width: 600px; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 3rem; }
        .page-info { color: var(--color-text-muted); font-size: 0.875rem; }
      `}</style>
    </div>
  );
}
