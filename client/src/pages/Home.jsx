import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const features = [
  { icon: '🍕', title: 'Huge Menu', desc: 'Thousands of dishes from top restaurants' },
  { icon: '⚡', title: 'Fast Delivery', desc: 'Fresh food delivered in 30 minutes' },
  { icon: '💳', title: 'Easy Payment', desc: 'Pay online or cash on delivery' },
];

const cuisines = ['🍕 Pizza', '🍔 Burgers', '🍱 Biryani', '🌮 Tacos', '🍜 Noodles', '🧁 Desserts'];

export default function Home() {
  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="hero-badge badge badge-orange">🔥 Fast & Fresh Delivery</div>
            <h1 className="hero-title">
              Hunger khatam,<br />
              <span className="gradient-text">khushi shuru!</span>
            </h1>
            <p className="hero-sub">
              Best restaurants, fastest delivery, lowest prices — sab ek jagah.
            </p>
            <div className="hero-actions">
              <Link to="/restaurants" className="btn btn-primary btn-lg">
                Explore Restaurants →
              </Link>
              <Link to="/register" className="btn btn-ghost btn-lg">
                Join Free
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="hero-image"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <img
              src="https://placehold.co/520x400/1A1A2E/FF6B35?text=🍕+FoodRush"
              alt="Delicious food"
            />
          </motion.div>
        </div>
      </section>

      {/* Cuisines */}
      <section className="container" style={{ paddingBottom: '4rem' }}>
        <h2 className="heading-2" style={{ marginBottom: '1.5rem' }}>
          What are you craving?
        </h2>
        <div className="cuisine-chips">
          {cuisines.map((c) => (
            <Link key={c} to="/restaurants" className="cuisine-chip">{c}</Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <h2 className="heading-2" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            Why choose <span className="gradient-text">FoodRush?</span>
          </h2>
          <div className="features-grid">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="feature-card glass"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass">
            <h2 className="heading-2">Ready to order?</h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              Join thousands of happy customers today!
            </p>
            <Link to="/restaurants" className="btn btn-primary btn-lg">
              Order Now 🚀
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .home-page { padding-top: 70px; }
        .hero {
          min-height: 88vh;
          display: flex; align-items: center;
          background: radial-gradient(ellipse at 70% 50%, rgba(255,107,53,0.08) 0%, transparent 60%),
                      radial-gradient(ellipse at 20% 80%, rgba(233,69,96,0.06) 0%, transparent 50%);
        }
        .hero .container { display: flex; align-items: center; gap: 4rem; padding-top: 2rem; }
        .hero-content { flex: 1; }
        .hero-badge { margin-bottom: 1.5rem; display: inline-flex; }
        .hero-title { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.15; margin-bottom: 1rem; }
        .hero-sub { font-size: 1.1rem; color: var(--color-text-muted); margin-bottom: 2rem; line-height: 1.6; max-width: 420px; }
        .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
        .hero-image { flex: 1; display: flex; justify-content: center; }
        .hero-image img { border-radius: 24px; box-shadow: 0 30px 80px rgba(255,107,53,0.2); max-width: 480px; width: 100%; }
        .cuisine-chips { display: flex; flex-wrap: wrap; gap: 12px; }
        .cuisine-chip {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-full); padding: 10px 20px;
          font-size: 0.9rem; font-weight: 500; transition: all 0.2s;
        }
        .cuisine-chip:hover { border-color: var(--color-orange); color: var(--color-orange); transform: translateY(-2px); }
        .features-section { padding: 4rem 0; background: rgba(255,255,255,0.01); }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
        .feature-card { padding: 2rem; text-align: center; }
        .feature-icon { font-size: 2.5rem; margin-bottom: 1rem; }
        .feature-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
        .feature-card p { font-size: 0.875rem; color: var(--color-text-muted); line-height: 1.6; }
        .cta-section { padding: 4rem 0; }
        .cta-card { padding: 4rem; text-align: center; background: linear-gradient(135deg, rgba(255,107,53,0.08), rgba(233,69,96,0.05)); }
        @media (max-width: 768px) {
          .hero .container { flex-direction: column; text-align: center; }
          .hero-actions { justify-content: center; }
          .hero-image { display: none; }
        }
      `}</style>
    </div>
  );
}
