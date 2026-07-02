import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shield, AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import AdminOverview from './pages/AdminOverview';
import AdminDashboard from './pages/AdminDashboard';
import DeveloperPortal from './pages/DeveloperPortal';
import DeveloperPolicyView from './pages/DeveloperPolicyView';
import NewService from './pages/NewService';
import GenerationPlanPage from './pages/GenerationPlanPage';
import GenerationStatus from './pages/GenerationStatus';
import ResultsDashboard from './pages/ResultsDashboard';
import './index.css';

const ADMIN_PASSWORD = 'admin123';

function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Shield size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 'var(--text-sm)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function AdminPasswordModal({ onSuccess, onCancel }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPwd('');
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">
          <Shield size={22} />
        </div>
        <div className="modal-title">Admin Access</div>
        <div className="modal-subtitle">Enter the admin password to continue.</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter admin password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(false); }}
              autoFocus
            />
            {error && (
              <div className="modal-error">
                <AlertCircle size={12} />
                Incorrect password — please try again.
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!pwd}>
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('idp-role') || 'developer');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  function handleAdminClick() {
    if (role === 'admin') return;
    setShowPasswordModal(true);
  }

  function handleAdminSuccess() {
    setShowPasswordModal(false);
    setRole('admin');
    localStorage.setItem('idp-role', 'admin');
  }

  function handleAdminCancel() {
    setShowPasswordModal(false);
  }

  function handleRoleChange(newRole) {
    setRole(newRole);
    localStorage.setItem('idp-role', newRole);
  }

  return (
    <BrowserRouter>
      {showPasswordModal && (
        <AdminPasswordModal onSuccess={handleAdminSuccess} onCancel={handleAdminCancel} />
      )}

      <Layout role={role} onRoleChange={handleRoleChange} onAdminClick={handleAdminClick}>
        <Routes>
          <Route path="/" element={<Navigate to={role === 'admin' ? '/admin' : '/developer/requests'} replace />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/policy" element={<AdminDashboard />} />
          <Route path="/admin/requests" element={<DeveloperPortal adminView />} />
          <Route path="/admin/audit" element={<PlaceholderPage title="Audit Logs" subtitle="Audit log viewer coming soon." />} />

          {/* Developer routes */}
          <Route path="/developer" element={<Navigate to="/developer/requests" replace />} />
          <Route path="/developer/requests" element={<DeveloperPortal />} />
          <Route path="/developer/compliance" element={<DeveloperPolicyView />} />
          <Route path="/developer/new" element={<NewService />} />
          <Route path="/developer/plan/:requestId" element={<GenerationPlanPage />} />
          <Route path="/developer/status/:requestId" element={<GenerationStatus />} />
          <Route path="/developer/results/:requestId" element={<ResultsDashboard />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
