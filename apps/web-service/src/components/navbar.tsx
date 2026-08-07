import { Link, useNavigate } from 'react-router-dom';
import { getRolePath, useAuth } from '../auth/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <Link className="brand" to={getRolePath(user.role)}>
        Call Reservation System
      </Link>
      <div className="navbar-session">
        <span className="role-badge">{user.role}</span>
        <span className="session-email">{user.email}</span>
        <button className="button button-secondary" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

export default Navbar;
