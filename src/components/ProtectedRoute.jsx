import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children }) => {
  const { user, checking } = useAuthStore();

  // Saved session is being verified against the database (fresh role & page access)
  if (checking) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-white">
        <div className="w-9 h-9 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Checking your access...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
