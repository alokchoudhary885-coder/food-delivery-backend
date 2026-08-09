import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import { ProtectedRoute, OwnerRoute, CustomerRoute } from './components/ProtectedRoute';

// Pages
import Home            from './pages/Home';
import Login           from './pages/Login';
import Register        from './pages/Register';
import Restaurants     from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Cart            from './pages/Cart';
import MyOrders        from './pages/MyOrders';
import OwnerDashboard  from './pages/OwnerDashboard';
import Profile         from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A1A2E',
            color: '#EAEAF0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#FF6B35', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Public */}
        <Route path="/"            element={<Home />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/register"    element={<Register />} />
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />

        {/* Protected — any logged-in user */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Customer only */}
        <Route path="/cart"   element={<CustomerRoute><Cart /></CustomerRoute>} />
        <Route path="/orders" element={<CustomerRoute><MyOrders /></CustomerRoute>} />

        {/* Owner only */}
        <Route path="/dashboard" element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
