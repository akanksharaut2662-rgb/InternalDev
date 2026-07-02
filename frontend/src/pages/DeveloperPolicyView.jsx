import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { getPolicy, getPolicyDefaults } from '../services/api';

const SECTION_LABELS = {
  stack:        'Stack & Conventions',
  architecture: 'Architecture Standards',
  security:     'Security Policy',
  logging:      'Logging Policy',
  observability:'Observability',
  codestyle:    'Code Style',
  compliance:   'Compliance & Deployment',
  custom:       'Custom Policy Rules',
};

const SECTION_ORDER = ['stack', 'architecture', 'security', 'logging', 'observability', 'codestyle', 'compliance', 'custom'];

function PolicyRow({ field }) {
  const { label, type, value, description } = field;
  const isOn = type === 'toggle' ? (value === true || value === 'true') : null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {type === 'toggle' ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
            background: isOn ? '#dcfce7' : '#f3f4f6',
            color: isOn ? '#16a34a' : '#6b7280',
          }}>
            {isOn ? 'Enabled' : 'Disabled'}
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', fontFamily: 'var(--font-mono)', background: '#f9faf9', padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7e5' }}>
            {value || '—'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DeveloperPolicyView() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getPolicy(), getPolicyDefaults()])
      .then(([policyRes, defaultsRes]) => {
        const saved = policyRes.data.profile;
        const defs  = defaultsRes.data.defaults;
        setProfile(saved ? { ...defs, ...saved } : defs);
      })
      .catch(() => setError('Failed to load policy configuration.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-body" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--error)', fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  // Group fields by section, preserving section order
  const grouped = {};
  Object.entries(profile || {}).forEach(([key, field]) => {
    if (!field || typeof field !== 'object' || !field.label) return;
    const sec = field.section || 'stack';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push({ key, field });
  });

  const orderedSections = SECTION_ORDER.filter((s) => grouped[s]?.length > 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Policy Compliance</h1>
        <p className="page-subtitle">Current engineering standards configured by your organisation's admin.</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Active Policy Profile</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read-only — contact your admin to make changes</div>
          </div>
          <div style={{ padding: '0 24px 8px' }}>
            {orderedSections.map((section, si) => (
              <div key={section}>
                {si > 0 && <div style={{ height: 12 }} />}
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', padding: '8px 0 4px' }}>
                  {SECTION_LABELS[section] || section}
                </div>
                {grouped[section].map(({ key, field }) => (
                  <PolicyRow key={key} field={field} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
