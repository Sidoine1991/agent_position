import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { createClient } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Agents from './pages/Agents';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Map from './pages/Map';
import LoadingSpinner from './components/LoadingSpinner';

// Hooks
import { useAuth } from './hooks/useAuth';
import { usePWA } from './hooks/usePWA';

// Utils
// import { supabaseUrl, supabaseAnonKey } from './utils/supabase';

// Create Supabase client (unused for now)
// const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const { user, loading, signOut } = useAuth();
  const { isOnline, updateAvailable, updateServiceWorker } = usePWA();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle service worker updates
  useEffect(() => {
    if (updateAvailable) {
      // Show update notification
      console.log('Update available');
    }
  }, [updateAvailable]);

  // Handle online/offline status
  useEffect(() => {
    if (!isOnline) {
      console.log('App is offline');
    }
  }, [isOnline]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-primary-50">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        {/* Update notification */}
        {updateAvailable && (
          <div className="bg-primary-600 text-white px-4 py-2 text-center">
            <span>Une mise à jour est disponible. </span>
            <button
              onClick={updateServiceWorker}
              className="underline hover:no-underline font-medium"
            >
              Mettre à jour maintenant
            </button>
          </div>
        )}

        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-yellow-500 text-white px-4 py-2 text-center">
            <span>Mode hors ligne - Certaines fonctionnalités peuvent être limitées</span>
          </div>
        )}

        {user ? (
          <div className="flex h-screen">
            {/* Sidebar */}
            <Sidebar 
              isOpen={sidebarOpen} 
              onClose={() => setSidebarOpen(false)} 
              user={user}
            />
            
            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Navbar */}
              <Navbar 
                onMenuClick={() => setSidebarOpen(true)}
                user={user}
                onSignOut={signOut}
              />
              
              {/* Page content */}
              <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-neutral-50 to-primary-50">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/map" element={<Map />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
