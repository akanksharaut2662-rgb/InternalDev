import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, ArrowRight, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { getRequestPlan, triggerGeneration } from '../services/api';

export default function GenerationPlanPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRequestPlan(requestId)
      .then((res) => {
        const data = res.data;
        setPlan(data);
        // Pre-select all artifacts that are enabled by default
        const initial = {};
        (data.artifacts || []).forEach((a) => {
          initial[a.key] = a.defaultSelected !== false;
        });
        setSelected(initial);
      })
      .catch(() => setError('Failed to load generation plan.'))
      .finally(() => setLoading(false));
  }, [requestId]);

  function toggleArtifact(key) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    const selectedArtifacts = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setSubmitting(true);
    try {
      await triggerGeneration(requestId, selectedArtifacts);
      navigate(`/developer/status/${requestId}`);
    } catch {
      setError('Failed to trigger generation. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Generation Plan</h1>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="page-header">
        <h1 className="page-title">Generation Plan</h1>
        <div className="card" style={{ margin: '2rem' }}>
          <div className="card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--error)' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const policyProfile = plan?.policyProfile || {};
  const artifactOptions = plan?.artifacts || [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <ClipboardList size={28} style={{ color: 'var(--accent-blue-light)' }} />
          <h1 className="page-title">Generation Plan</h1>
        </div>
        <p className="page-subtitle">
          Review what will be generated based on your organization's policy, then select the artifacts you want.
        </p>
      </div>

      <div className="page-body">
        {/* Progress tracker */}
        <div className="progress-tracker" style={{ marginBottom: 'var(--space-8)' }}>
          {['Describe', 'Review Plan', 'Generate', 'Results'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div className={`progress-step ${i === 1 ? 'active' : i < 1 ? 'completed' : ''}`} style={{ flex: 'none' }}>
                <div className="progress-step-icon">
                  {i < 1 ? <CheckCircle size={16} /> : i + 1}
                </div>
                <div className="progress-step-label">{step}</div>
              </div>
              {i < 3 && <div className={`progress-connector ${i < 1 ? 'completed' : ''}`} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-8)', alignItems: 'start' }}>

          {/* Policy summary */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Policy Applied</span>
              <span className="badge badge-info">Active Profile</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {Object.entries(policyProfile).map(([key, field]) => {
                if (!field || field.value === undefined) return null;
                const displayVal = typeof field.value === 'boolean'
                  ? (field.value ? 'Enabled' : 'Disabled')
                  : String(field.value);
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                      {field.label || key}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: displayVal === 'Enabled' ? 'var(--success)' : displayVal === 'Disabled' ? 'var(--text-muted)' : 'var(--text-primary)',
                        textAlign: 'right',
                        maxWidth: '55%',
                      }}
                    >
                      {displayVal}
                    </span>
                  </div>
                );
              })}
              {Object.keys(policyProfile).length === 0 && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No policy profile loaded.</p>
              )}
            </div>
          </div>

          {/* Artifact selection */}
          <div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Package size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                  Select Artifacts
                </span>
                <span className="badge badge-neutral">{selectedCount} / {artifactOptions.length} selected</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {artifactOptions.map((artifact) => {
                  const isChecked = !!selected[artifact.key];
                  return (
                    <label
                      key={artifact.key}
                      className={`checkbox-item ${isChecked ? 'checked' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={isChecked}
                        onChange={() => toggleArtifact(artifact.key)}
                      />
                      <div>
                        <div className="checkbox-label">{artifact.name || artifact.label || artifact.key}</div>
                        {artifact.description && (
                          <div className="checkbox-desc">{artifact.description}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
                {artifactOptions.length === 0 && (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No artifact options available.</p>
                )}
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--error-dim)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--error)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              style={{ marginTop: 'var(--space-5)', width: '100%' }}
              onClick={handleGenerate}
              disabled={submitting || selectedCount === 0}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Starting Generation...
                </>
              ) : (
                <>
                  Generate {selectedCount} Artifact{selectedCount !== 1 ? 's' : ''}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
