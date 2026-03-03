import { Navigate } from 'react-router-dom';
import { useStore } from '../store';

export default function AdminRoute({ children }) {
  const user = useStore((state) => state.user);

  // Добавляем проверку, что загрузка завершена и пользователь существует
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/profile" replace />;
  }

  return children;
}