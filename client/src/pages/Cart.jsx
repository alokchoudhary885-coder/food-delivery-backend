import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useCartStore from '../store/cartStore';

export default function Cart() {
  const { items, restaurantId, restaurantName, subtotal, increment, decrement, removeItem, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [address, setAddress] = useState({ street: '', city: '', state: '', pincode: '' });
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
  const [loading, setLoading] = useState(false);

  const DELIVERY_FEE = 50;
  const grandTotal = subtotal() + DELIVERY_FEE;

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePlaceOrder = async () => {
    if (!address.street || !address.city || !address.state || !address.pincode) {
      return toast.error('Delivery address poora bharo');
    }
    if (items.length === 0) return toast.error('Cart empty hai');

    setLoading(true);
    try {
      // 1. Place order
      const orderBody = {
        restaurant: restaurantId,
        items: items.map((i) => ({ menuItem: i._id, quantity: i.quantity })),
        deliveryAddress: address,
        paymentMethod,
      };
      const { data: orderData } = await api.post('/orders', orderBody);
      const orderId = orderData.data.order._id;

      if (paymentMethod === 'cash_on_delivery') {
        clearCart();
        toast.success('Order placed! 🎉 Cash on delivery.');
        navigate('/orders');
        return;
      }

      // 2. Online payment — create Razorpay order
      const { data: rzpData } = await api.post('/payments/create-order', { orderId });
      const { razorpayOrderId, amount, key_id } = rzpData.data;

      // 3. Load Razorpay script
      const ok = await loadRazorpay();
      if (!ok) { toast.error('Razorpay load nahi hua'); setLoading(false); return; }

      // 4. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: key_id,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'FoodRush',
        description: `Order from ${restaurantName}`,
        theme: { color: '#FF6B35' },
        handler: async (response) => {
          try {
            // 5. Verify payment
            await api.post('/payments/verify', {
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            clearCart();
            toast.success('Payment successful! Order confirmed 🎉');
            navigate('/orders');
          } catch {
            toast.error('Payment verification failed');
          }
        },
        modal: { ondismiss: () => { setLoading(false); toast('Payment cancelled'); } },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order failed');
      setLoading(false);
    }
  };

  if (items.length === 0) return (
    <div className="page">
      <div className="empty-state">
        <div className="icon">🛒</div>
        <h3>Cart khali hai</h3>
        <p>Koi item add karo restaurant se</p>
        <a href="/restaurants" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Restaurants</a>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="container cart-layout">
        {/* Items */}
        <motion.div className="cart-items-col" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="heading-3" style={{ marginBottom: '1.5rem' }}>🛒 Your Cart</h2>
          <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            📍 {restaurantName}
          </p>

          <div className="cart-items">
            {items.map((item) => (
              <div key={item._id} className="cart-item glass">
                <div className="cart-item-info">
                  <h4>{item.name}</h4>
                  <span className="text-orange" style={{ fontWeight: 700 }}>₹{item.price}</span>
                </div>
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => decrement(item._id)}>−</button>
                  <span className="qty-val">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => increment(item._id)}>+</button>
                  <button className="remove-btn" onClick={() => removeItem(item._id)}>🗑️</button>
                </div>
                <div className="cart-item-total">₹{item.price * item.quantity}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Checkout */}
        <motion.div className="cart-checkout-col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          {/* Address */}
          <div className="checkout-section glass">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>📍 Delivery Address</h3>
            <div className="addr-grid">
              {[
                { key: 'street', placeholder: 'Street / Colony' },
                { key: 'city', placeholder: 'City' },
                { key: 'state', placeholder: 'State' },
                { key: 'pincode', placeholder: 'Pincode' },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  id={`addr-${key}`}
                  className="form-input"
                  placeholder={placeholder}
                  value={address[key]}
                  onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                />
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="checkout-section glass">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>💳 Payment Method</h3>
            <div className="role-toggle">
              {[
                { val: 'cash_on_delivery', label: '💵 Cash on Delivery' },
                { val: 'online', label: '💳 Pay Online' },
              ].map(({ val, label }) => (
                <button
                  key={val} type="button"
                  className={`role-btn ${paymentMethod === val ? 'active' : ''}`}
                  onClick={() => setPaymentMethod(val)}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="checkout-section glass">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 700 }}>🧾 Bill Summary</h3>
            <div className="bill-row"><span>Subtotal</span><span>₹{subtotal()}</span></div>
            <div className="bill-row"><span>Delivery Fee</span><span>₹{DELIVERY_FEE}</span></div>
            <div className="divider" />
            <div className="bill-row bill-total"><span>Grand Total</span><span className="text-orange">₹{grandTotal}</span></div>

            <button
              id="place-order-btn"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: '1.25rem' }}
              onClick={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? 'Processing...' : paymentMethod === 'online' ? '💳 Pay ₹' + grandTotal : '🛍️ Place Order'}
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        .cart-layout { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; padding-top: 2rem; padding-bottom: 4rem; align-items: start; }
        .cart-items { display: flex; flex-direction: column; gap: 12px; }
        .cart-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; flex-wrap: wrap; }
        .cart-item-info { flex: 1; min-width: 120px; }
        .cart-item-info h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 2px; }
        .cart-item-controls { display: flex; align-items: center; gap: 8px; }
        .qty-btn { width: 28px; height: 28px; border-radius: 8px; background: var(--color-surface-2); border: 1px solid var(--color-border); color: var(--color-text); font-size: 1rem; font-weight: 700; transition: all 0.15s; }
        .qty-btn:hover { background: var(--color-orange); border-color: var(--color-orange); }
        .qty-val { min-width: 24px; text-align: center; font-weight: 600; font-size: 0.9rem; }
        .remove-btn { background: none; border: none; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s; }
        .remove-btn:hover { opacity: 1; }
        .cart-item-total { font-weight: 700; color: var(--color-orange); min-width: 60px; text-align: right; }
        .checkout-section { padding: 1.25rem; margin-bottom: 1rem; }
        .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bill-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.9rem; color: var(--color-text-muted); }
        .bill-total { font-weight: 700; font-size: 1rem; color: var(--color-text); }
        .role-btn { padding: 10px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted); transition: all 0.2s; cursor: pointer; }
        .role-btn.active { background: rgba(255,107,53,0.15); border-color: var(--color-orange); color: var(--color-orange); }
        @media (max-width: 900px) { .cart-layout { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
