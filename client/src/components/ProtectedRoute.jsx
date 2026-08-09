import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

// Requires login
export function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Requires owner role
export function OwnerRoute({ children }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'owner') return <Navigate to="/" replace />;
  return children;
}

// Requires customer role
export function CustomerRoute({ children }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'customer') return <Navigate to="/" replace />;
  return children;
}
