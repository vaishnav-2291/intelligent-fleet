import React from 'react';
import { FleetProvider, useFleet } from './context/FleetContext';
import { LoginPage } from './components/login/LoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';

const AppContent = () => {
  const { currentUser, toast, clearToast } = useFleet();

  // Toast type icon mapping
  const toastIcons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
  };

  const toastBg = {
    success: 'bg-[#16161A] border-emerald-500/40 text-emerald-200',
    info: 'bg-[#16161A] border-sky-500/40 text-sky-200',
    warning: 'bg-[#16161A] border-amber-500/40 text-amber-200',
    error: 'bg-[#16161A] border-rose-500/40 text-rose-200'
  };

  return (
    <div className="relative min-h-screen">
      {/* View Routing based on currentUser — authenticatedRole is authoritative */}
      {!currentUser ? (
        <LoginPage />
      ) : String(currentUser.authenticatedRole || '').toUpperCase() === 'DRIVER' ? (
        /* Real DRIVER — always render Driver Portal, never Admin Dashboard */
        <DriverDashboard />
      ) : currentUser.role === 'driver' ? (
        /* Admin/Manager previewing driver view */
        <DriverDashboard />
      ) : (
        <AdminDashboard />
      )}

      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fadeIn" role="status" aria-live="polite">
          <div className={`px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center space-x-3 text-xs font-semibold max-w-md ${toastBg[toast.type] || toastBg.info}`}>
            {toastIcons[toast.type] || toastIcons.info}
            <span className="flex-1 text-sm font-medium text-[#F5F5F5]">{toast.message}</span>
            <button
              type="button"
              onClick={clearToast}
              className="p-1 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <FleetProvider>
      <AppContent />
    </FleetProvider>
  );
}
