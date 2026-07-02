import { NavLink } from 'react-router-dom';
import {
  Terminal, LayoutDashboard, ClipboardList, ShieldCheck,
  Settings, FileText, Shield, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const ADMIN_MAIN = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/admin/requests', icon: ClipboardList,   label: 'Service Requests' },
];

const ADMIN_ADMIN = [
  { to: '/admin/policy', icon: Settings,  label: 'Policy Profile' },
  { to: '/admin/audit',  icon: FileText,  label: 'Audit Logs' },
];

const DEV_MAIN = [
  { to: '/developer/requests',   icon: ClipboardList, label: 'Service Requests' },
  { to: '/developer/compliance', icon: ShieldCheck,   label: 'Policy Compliance' },
];

function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout({ children, role, onRoleChange, onAdminClick }) {
  const location = useLocation();

  const links = role === 'admin' ? ADMIN_MAIN : DEV_MAIN;
  const adminLinks = role === 'admin' ? ADMIN_ADMIN : [];

  return (
    <div className="app-layout">
      {/* ── Top header ── */}
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-icon">
            <Terminal size={18} />
          </div>
          <div>
            <div className="header-logo-text">PolicyCraft</div>
            <div className="header-logo-sub">Internal Developer Platform</div>
          </div>
        </div>

        <div className="header-divider" />
        <div className="header-spacer" />

        <div className="header-tabs">
          <button
            className={`header-tab${role === 'admin' ? ' active' : ''}`}
            onClick={onAdminClick}
          >
            <Shield size={14} />
            Admin
          </button>
          <button
            className={`header-tab${role === 'developer' ? ' active' : ''}`}
            onClick={() => onRoleChange('developer')}
          >
            <User size={14} />
            Developer
          </button>
        </div>

      </header>

      {/* ── App body ── */}
      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <div className="sidebar-section-label">Main</div>
              {links.map((l) => (
                <SidebarLink key={l.to} {...l} />
              ))}
            </div>

            {role === 'admin' && (
              <div className="sidebar-section">
                <div className="sidebar-section-label">Administration</div>
                {adminLinks.map((l) => (
                  <SidebarLink key={l.to} {...l} />
                ))}
              </div>
            )}
          </nav>

          <div className="sidebar-brand">
            <Terminal />
            PolicyCraft
          </div>
        </aside>

        {/* Page content */}
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
