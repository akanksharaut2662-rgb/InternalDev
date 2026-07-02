import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MoreVertical, CheckCircle2, Clock, XCircle,
  AlertCircle, Briefcase,
} from 'lucide-react';
import { listRequests } from '../services/api';

/* ─── Circular compliance ring ───────────────────────────────────────────── */
function ComplianceRing({ passed, total }) {
  if (passed == null || total == null || total === 0) {
    return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>;
  }
  const pct = Math.round((passed / total) * 100);
  const r = 13, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={34} height={34} viewBox="0 0 34 34">
        <circle cx={17} cy={17} r={r} fill="none" stroke="#e5e7e5" strokeWidth={3} />
        <circle
          cx={17} cy={17} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 17 17)"
        />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = {
    COMPLETED:  { label: 'Completed',   icon: CheckCircle2, cls: 'badge-completed'  },
    GENERATING: { label: 'In Progress', icon: Clock,        cls: 'badge-generating' },
    PENDING:    { label: 'Pending',     icon: Clock,        cls: 'badge-pending'    },
    FAILED:     { label: 'Failed',      icon: XCircle,      cls: 'badge-failed'     },
  }[status] ?? { label: status, icon: Clock, cls: 'badge-neutral' };
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.cls}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

/* ─── Row action dropdown ────────────────────────────────────────────────── */
function RowActions({ request, onNavigate }) {
  const [open, setOpen] = useState(false);
  const go = (path) => { setOpen(false); onNavigate(path); };
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, background: '#fff', border: '1px solid #e5e7e5', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 160, overflow: 'hidden' }}>
            {request.status === 'COMPLETED' && (
              <button style={MI} onMouseEnter={e => e.target.style.background='#f9faf9'} onMouseLeave={e => e.target.style.background='none'} onClick={(e) => { e.stopPropagation(); go(`/developer/results/${request.requestId}`); }}>View Results</button>
            )}
            {(request.status === 'GENERATING' || request.status === 'PENDING') && (
              <button style={MI} onMouseEnter={e => e.target.style.background='#f9faf9'} onMouseLeave={e => e.target.style.background='none'} onClick={(e) => { e.stopPropagation(); go(`/developer/status/${request.requestId}`); }}>View Status</button>
            )}
            {request.status === 'FAILED' && (
              <button style={MI} onMouseEnter={e => e.target.style.background='#f9faf9'} onMouseLeave={e => e.target.style.background='none'} onClick={(e) => { e.stopPropagation(); go('/developer/new'); }}>Retry Request</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const MI = { display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' };

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function deriveType(req = '') {
  const l = req.toLowerCase();
  if (l.includes('event') || l.includes('queue') || l.includes('message') || l.includes('notification')) return 'Event Driven';
  if (l.includes('batch') || l.includes('job') || l.includes('cron')) return 'Batch';
  if (l.includes('crud') || l.includes('database') || l.includes('storage')) return 'CRUD';
  return 'REST API';
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function DeveloperPortal({ adminView = false }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    listRequests()
      .then((res) => {
        const data = res.data;
        setRequests(Array.isArray(data) ? data : (data?.requests ?? data?.items ?? []));
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false));
  }, []);

  const total      = requests.length;
  const inProgress = requests.filter((r) => r.status === 'GENERATING' || r.status === 'PENDING').length;
  const completed  = requests.filter((r) => r.status === 'COMPLETED').length;
  const failed     = requests.filter((r) => r.status === 'FAILED').length;

  function handleRowClick(req) {
    if (req.status === 'COMPLETED') navigate(`/developer/results/${req.requestId}`);
    else if (req.status === 'GENERATING' || req.status === 'PENDING') navigate(`/developer/status/${req.requestId}`);
  }

  const STATS = [
    { icon: Briefcase,    iconBg: '#fff7ed', iconColor: '#ea580c', value: total,      label: 'Total Requests', sub: 'All time'  },
    { icon: Clock,        iconBg: '#fef9c3', iconColor: '#ca8a04', value: inProgress, label: 'In Progress',    sub: 'Currently' },
    { icon: CheckCircle2, iconBg: '#dcfce7', iconColor: '#16a34a', value: completed,  label: 'Completed',      sub: 'All time'  },
    { icon: XCircle,      iconBg: '#fee2e2', iconColor: '#dc2626', value: failed,     label: 'Failed',         sub: 'All time'  },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {adminView ? 'All service requests across the platform' : 'Your recently generated services'}
        </p>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Stat cards column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STATS.map(({ icon: Icon, iconBg, iconColor, value, label, sub }) => (
              <div key={label} className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon" style={{ background: iconBg }}>
                    <Icon size={17} style={{ color: iconColor }} />
                  </div>
                </div>
                <div className="stat-value" style={{ fontSize: '1.75rem' }}>{loading ? '—' : value}</div>
                <div className="stat-label">{label}</div>
                <div className="stat-sublabel">{sub}</div>
              </div>
            ))}
          </div>

          {/* Recent projects table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Projects</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  List of your recently generated services
                </div>
              </div>
              {!adminView && (
                <button className="btn btn-primary" onClick={() => navigate('/developer/new')}>
                  <Plus size={15} />
                  New Service Request
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <div className="spinner" />
              </div>
            ) : error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 24px', color: 'var(--error)', fontSize: 14 }}>
                <AlertCircle size={16} /> {error}
              </div>
            ) : requests.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <Briefcase size={36} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 12 }} />
                <div className="empty-state-title">No requests yet</div>
                <div className="empty-state-desc">Create your first service request to get started.</div>
                {!adminView && (
                  <button className="btn btn-primary" onClick={() => navigate('/developer/new')}>
                    <Plus size={15} /> New Service Request
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Service Type</th>
                      <th>Status</th>
                      <th>Compliance Score</th>
                      <th>Last Updated</th>
                      <th style={{ width: 48 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.requestId} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(req)}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                            {req.resolvedName
                              ? req.resolvedName.charAt(0).toUpperCase() + req.resolvedName.slice(1).replace(/-/g, ' ')
                              : (req.serviceRequest?.slice(0, 36) ?? req.requestId)}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                            {req.resolvedName ?? '—'}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{deriveType(req.serviceRequest)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <StatusBadge status={req.status} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <ComplianceRing passed={req.validationSummary?.passed} total={req.validationSummary?.total} />
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmt(req.createdAt ?? req.updatedAt)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <RowActions request={req} onNavigate={navigate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
