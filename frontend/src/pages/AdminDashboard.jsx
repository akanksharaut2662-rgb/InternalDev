import { useState, useEffect } from 'react';
import {
  Save, RotateCcw, CheckCircle, AlertCircle, Settings,
  Code2, Layers, Shield, FileText, Activity, ShieldCheck, Palette,
  ChevronDown, Plus, Trash2,
} from 'lucide-react';
import { getPolicy, updatePolicy, getPolicyDefaults } from '../services/api';

// Section definitions — order and membership are hard-coded so the UI works
// even when old DynamoDB profiles don't have a "section" property.
const SECTIONS = [
  {
    key: 'stack',
    title: 'Stack & Conventions',
    icon: Code2,
    description: 'Language, framework, and service naming',
    fields: ['language', 'framework', 'namingConvention'],
  },
  {
    key: 'architecture',
    title: 'Architecture Standards',
    icon: Layers,
    description: 'Structural patterns and API contracts',
    fields: ['architecturePattern', 'apiResponseFormat'],
  },
  {
    key: 'security',
    title: 'Security Policy',
    icon: Shield,
    description: 'Authentication, authorization, and token settings',
    fields: ['auth', 'authType', 'jwtExpiry', 'rbac'],
  },
  {
    key: 'logging',
    title: 'Logging Policy',
    icon: FileText,
    description: 'Log format, required fields, and severity levels',
    fields: ['logging', 'logFormat', 'logRequiredFields', 'logLevel'],
  },
  {
    key: 'observability',
    title: 'Observability',
    icon: Activity,
    description: 'Metrics, monitoring stack, and health checks',
    fields: ['monitoring', 'observabilityTool', 'healthEndpoint'],
  },
  {
    key: 'codestyle',
    title: 'Code Style',
    icon: Palette,
    description: 'Naming conventions and library governance',
    fields: ['codeNamingClasses', 'codeNamingVariables', 'allowedLibraries', 'forbiddenLibraries'],
  },
  {
    key: 'compliance',
    title: 'Compliance & Deployment',
    icon: ShieldCheck,
    description: 'Audit logging and container standards',
    fields: ['auditLogging', 'dockerSupport'],
  },
];

function FieldRenderer({ fieldKey, field, onChange, onSubOptionChange }) {
  if (!field) return null;
  const { type, label, description, value, choices } = field;

  const isOn = type === 'toggle' ? (value === true || value === 'true') : false;

  if (type === 'toggle') {
    return (
      <div className="toggle-wrapper" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="toggle-info">
            <div className="toggle-label">{label}</div>
            {description && <div className="toggle-desc">{description}</div>}
          </div>
          <label className="toggle" style={{ flexShrink: 0, marginLeft: 'var(--space-4)' }}>
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => onChange(fieldKey)}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {/* Sub-option: healthEndpoint path */}
        {fieldKey === 'healthEndpoint' && isOn && field.options?.path && (
          <div style={{ paddingLeft: 'var(--space-2)', width: '100%' }}>
            <label className="form-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {field.options.path.label || 'Health Check Path'}
            </label>
            <input
              className="form-input"
              type="text"
              value={field.options.path.value || '/health'}
              onChange={(e) => onSubOptionChange(fieldKey, 'path', e.target.value)}
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>
        )}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">{label}</label>
        {description && <p className="form-description">{description}</p>}
        <div style={{ position: 'relative' }}>
          <select
            className="form-input"
            value={value || ''}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            style={{ appearance: 'none', paddingRight: 'var(--space-8)', cursor: 'pointer' }}
          >
            {(choices || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>
    );
  }

  // text (default)
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      {description && <p className="form-description">{description}</p>}
      <input
        className="form-input"
        type="text"
        value={value || ''}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

const PRESET_POLICIES = [
  {
    value: 'codeCoverage',
    label: 'Code Coverage',
    spec: { type: 'text', label: 'Minimum Code Coverage', description: 'Minimum test coverage percentage required across all modules', value: '80%', section: 'custom' },
  },
  {
    value: 'rateLimit',
    label: 'API Rate Limiting',
    spec: { type: 'text', label: 'API Rate Limit', description: 'Maximum API requests per minute per client', value: '1000 req/min', section: 'custom' },
  },
  {
    value: 'securityScan',
    label: 'Security Scanning',
    spec: { type: 'select', label: 'Security Scanner', description: 'Required security scanning tool in CI pipeline', choices: ['Snyk', 'SonarQube', 'Trivy', 'Checkov'], value: 'Snyk', section: 'custom' },
  },
  {
    value: 'branchProtection',
    label: 'Branch Protection',
    spec: { type: 'toggle', label: 'Branch Protection', description: 'Require PR approval before merging to main branch', value: true, section: 'custom' },
  },
  {
    value: 'depAudit',
    label: 'Dependency Audit',
    spec: { type: 'toggle', label: 'Dependency Audit', description: 'Run vulnerability audit on all dependencies in CI', value: true, section: 'custom' },
  },
  {
    value: 'licenseCompliance',
    label: 'License Compliance',
    spec: { type: 'text', label: 'Allowed Licenses', description: 'Comma-separated list of approved dependency licenses', value: 'MIT, Apache-2.0, BSD-3-Clause', section: 'custom' },
  },
  {
    value: 'docsRequired',
    label: 'Documentation Required',
    spec: { type: 'toggle', label: 'Documentation Required', description: 'Require inline documentation for all public APIs', value: false, section: 'custom' },
  },
  { value: 'other', label: 'Other (custom)', spec: null },
];

export default function AdminDashboard() {
  const [profile, setProfile] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPolicyType, setNewPolicyType] = useState('');
  const [newPolicyLabel, setNewPolicyLabel] = useState('');

  useEffect(() => {
    Promise.all([getPolicy(), getPolicyDefaults()])
      .then(([policyRes, defaultsRes]) => {
        const saved = policyRes.data.profile;
        const defs = defaultsRes.data.defaults;
        // Merge: fill in any new fields not yet saved in DynamoDB
        setProfile(saved ? { ...defs, ...saved } : defs);
        setDefaults(defs);
      })
      .catch(() => setError('Failed to load policy configuration.'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key, value) {
    setProfile((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }

  function handleToggle(key) {
    setProfile((prev) => {
      const current = prev[key].value;
      const toggled = typeof current === 'boolean' ? !current : current !== 'true';
      return { ...prev, [key]: { ...prev[key], value: toggled } };
    });
  }

  function handleSubOptionChange(fieldKey, optionKey, value) {
    setProfile((prev) => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        options: {
          ...prev[fieldKey].options,
          [optionKey]: {
            ...(prev[fieldKey].options?.[optionKey] || {}),
            value,
          },
        },
      },
    }));
  }

  function handleAddPolicy() {
    if (!newPolicyType) return;
    const preset = PRESET_POLICIES.find((o) => o.value === newPolicyType);
    if (!preset) return;

    let newField;
    if (newPolicyType === 'other') {
      if (!newPolicyLabel.trim()) return;
      newField = { type: 'text', label: newPolicyLabel.trim(), value: '', section: 'custom' };
    } else {
      newField = { ...preset.spec };
    }

    const slug = newPolicyType === 'other'
      ? `custom_${newPolicyLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`
      : `custom_${newPolicyType}`;

    setProfile((prev) => ({ ...prev, [slug]: newField }));
    setNewPolicyType('');
    setNewPolicyLabel('');
  }

  function handleRemoveCustomPolicy(key) {
    setProfile((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleReset() {
    setProfile(defaults);
    setSaveStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    try {
      await updatePolicy(profile);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Policy Profile</h1>
        <p className="page-subtitle">Loading configuration...</p>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-header">
        <h1 className="page-title">Policy Profile</h1>
        <div className="card" style={{ margin: '2rem' }}>
          <div className="card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--error)' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Settings size={28} style={{ color: 'var(--accent-blue-light)' }} />
          <h1 className="page-title">Policy Profile</h1>
        </div>
        <p className="page-subtitle">
          Define your organisation's engineering standards. All generated microservices will conform to these policies.
        </p>
      </div>

      <div className="page-body">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const sectionFields = section.fields
              .map((key) => [key, profile?.[key]])
              .filter(([, f]) => f != null);

            if (sectionFields.length === 0) return null;

            return (
              <div className="card" key={section.key}>
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Icon size={16} style={{ color: 'var(--accent-blue-light)' }} />
                    {section.title}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {section.description}
                  </span>
                </div>
                <div
                  className="card-body"
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
                >
                  {sectionFields.map(([key, field]) => (
                    <FieldRenderer
                      key={key}
                      fieldKey={key}
                      field={field}
                      onChange={field.type === 'toggle' ? handleToggle : handleChange}
                      onSubOptionChange={handleSubOptionChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom policy rules (added by admin) */}
        {(() => {
          const customFields = Object.entries(profile || {}).filter(([, f]) => f?.section === 'custom');
          if (customFields.length === 0) return null;
          return (
            <div className="card" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Plus size={16} style={{ color: 'var(--accent-blue-light)' }} />
                  Custom Policy Rules
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Rules added manually by admin
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {customFields.map(([key, field]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <FieldRenderer
                        fieldKey={key}
                        field={field}
                        onChange={field.type === 'toggle' ? handleToggle : handleChange}
                        onSubOptionChange={handleSubOptionChange}
                      />
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Remove rule"
                      style={{ marginTop: 24, padding: '4px 8px', color: 'var(--error)', flexShrink: 0 }}
                      onClick={() => handleRemoveCustomPolicy(key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Add new policy rule */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Plus size={16} style={{ color: 'var(--accent-blue-light)' }} />
              Add Policy Rule
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Extend the policy profile with additional governance rules
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Rule Type</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-input"
                  value={newPolicyType}
                  onChange={(e) => { setNewPolicyType(e.target.value); setNewPolicyLabel(''); }}
                  style={{ appearance: 'none', paddingRight: 'var(--space-8)', cursor: 'pointer' }}
                >
                  <option value="">— Select a rule to add —</option>
                  {PRESET_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {newPolicyType === 'other' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Policy Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Maximum Function Length"
                  value={newPolicyLabel}
                  onChange={(e) => setNewPolicyLabel(e.target.value)}
                />
              </div>
            )}

            <div>
              <button
                className="btn btn-primary"
                onClick={handleAddPolicy}
                disabled={!newPolicyType || (newPolicyType === 'other' && !newPolicyLabel.trim())}
              >
                <Plus size={15} />
                Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-8)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
          <button className="btn btn-secondary" onClick={handleReset} disabled={saving}>
            <RotateCcw size={16} />
            Reset to Defaults
          </button>

          {saveStatus === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--success)' }}>
              <CheckCircle size={16} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Policy saved successfully</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--error)' }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Failed to save — try again</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
