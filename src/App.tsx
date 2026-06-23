import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Garden from './components/Garden';

export default function App() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-2 border-petal-violet/25 border-t-petal-pink animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <Garden /> : <Login />;
}
