import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../lib/api';
import { useAuth } from '../store/AuthContext';

export default function Nav() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  return (
    <header className="top"><div className="wrap">
      <Link className="logo" to="/">{APP_NAME}</Link>
      <nav className="main">
        <Link to="/search">Jobs</Link>
        <Link to="/collections">Collections</Link>
        <Link to="/companies">Companies</Link>
        {user?.role === 'seeker' && <><Link to="/saved">Saved</Link><Link to="/alerts">Alerts</Link><Link to="/tracker">Tracker</Link><Link to="/matches">My matches</Link><Link to="/profile">Profile</Link></>}
        {user?.role === 'recruiter' && <><Link to="/recruiter">Employer dashboard</Link><Link to="/recruiter/claim">Claim company</Link></>}
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {!user && <><Link to="/login">Login</Link><Link to="/signup">Sign up</Link></>}
        {user && <button className="btn small secondary" onClick={() => { void logout().then(() => nav('/')); }}>Logout ({user.name})</button>}
      </nav>
    </div></header>
  );
}
