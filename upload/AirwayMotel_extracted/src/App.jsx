import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import CheckInPage from './pages/CheckInPage';
import RoomStatusPage from './pages/RoomStatusPage';
import CheckoutPage from './pages/CheckoutPage';
import GuestHistoryPage from './pages/GuestHistoryPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

import MobileScanPage from './pages/MobileScanPage';
import StayDetailsPage from './pages/StayDetailsPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Admin Routes */}
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="check-in" element={<CheckInPage />} />
            <Route path="stay/:stayId" element={<StayDetailsPage />} />
            <Route path="rooms" element={<RoomStatusPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="guests" element={<GuestHistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          <Route path="/scan" element={<MobileScanPage />} />
        </Routes>
    </AuthProvider>
  );
}

export default App;
