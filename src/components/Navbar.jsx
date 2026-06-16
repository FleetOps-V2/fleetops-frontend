import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import TaskDrawer from './TaskDrawer';
import NotificationCenter from './NotificationCenter';
import { 
  Truck, LayoutDashboard, ClipboardList, Wrench, ShieldCheck, LogOut, 
  Menu, Radio
} from 'lucide-react';

const Navbar = () => {
  const { state, dispatch } = useContext(AppContext);
  const navigate = useNavigate();
  const [isTaskOpen, setIsTaskOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  const isManager = state.role === 'MANAGER' || state.role === 'ROLE_MANAGER';
  const isAdmin   = state.role === 'ADMIN'   || state.role === 'ROLE_ADMIN';
  const isDriver  = state.role === 'DRIVER'  || state.role === 'ROLE_DRIVER';

  const iconProps = { size: 15, strokeWidth: 2, style: { verticalAlign: 'middle', marginRight: '4px' } };

  return (
    <>
      <nav className="glass" style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 100,
        display: 'flex', justifyContent: 'space-between', padding: '0.875rem 2rem',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={20} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />
            FleetOps
          </Link>

          {/* Vehicles – all authenticated users */}
          {state.isAuthenticated && (
            <Link to="/vehicles" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Truck {...iconProps} />Vehicles
            </Link>
          )}

          {/* Requests – all authenticated users */}
          {state.isAuthenticated && (
            <Link to="/requests" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ClipboardList {...iconProps} />Requests
            </Link>
          )}

          {/* Maintenance – all authenticated users */}
          {state.isAuthenticated && (
            <Link to="/maintenance" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wrench {...iconProps} />Maintenance
            </Link>
          )}

          {/* GPS Tracking – all authenticated users */}
          {state.isAuthenticated && (
            <Link to="/tracking" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio {...iconProps} />GPS Tracking
            </Link>
          )}

          {/* Dashboard – Manager and Admin */}
          {(isManager || isAdmin) && (
            <Link to="/dashboard" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LayoutDashboard {...iconProps} />Dashboard
            </Link>
          )}

        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {state.isAuthenticated ? (
            <>
              {/* Admin Console */}
              {isAdmin && (
                <Link to="/admin" style={{ color: 'var(--accent-primary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={15} strokeWidth={2} style={{ verticalAlign: 'middle' }} />Admin Console
                </Link>
              )}

              {/* Driver task drawer */}
              {isDriver && (
                <button className="btn-secondary" onClick={() => setIsTaskOpen(true)} style={{ position: 'relative', padding: '0.35rem 0.8rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Menu size={14} strokeWidth={2} />Tasks
                  {state.cartItemsCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-8px', right: '-8px',
                      background: 'var(--accent-primary)', color: '#fff',
                      borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', lineHeight: 1.2
                    }}>{state.cartItemsCount}</span>
                  )}
                </button>
              )}

              <NotificationCenter />

              <span style={{ color: 'var(--glass-border)' }}>|</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {state.username}
                <small style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({state.role})</small>
              </span>
              <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', transition: 'color 0.2s' }}>
                <LogOut size={13} strokeWidth={2} />Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary" style={{ padding: '0.45rem 1.2rem', fontSize: '0.88rem' }}>Sign In</Link>
          )}
        </div>
      </nav>

      <TaskDrawer isOpen={isTaskOpen} onClose={() => setIsTaskOpen(false)} />
    </>
  );
};

export default Navbar;
