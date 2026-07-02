import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download, CheckCircle, XCircle, FileCode, AlertCircle,
  Package, ShieldCheck, ArrowLeft, ExternalLink,
} from 'lucide-react';
import { getRequestDetails, getValidation, getDownloadUrl } from '../services/api';

function FileTypeIcon({ type }) {
  const colors = {
    python: '#3b82f6',
    javascript: '#f59e0b',
    typescript: '#60a5fa',
    yaml: '#8b5cf6',
    markdown: '#94a3b8',
    dockerfile: '#06b6d4',
    toml: '#10b981',
    default: '#64748b',
  };
  return (
    <FileCode
      size={14}
      style={{ color: colors[type] || colors.default, flexShrink: 0 }}
    />
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ResultsDashboard() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [details, setDetails] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    Promise.all([getRequestDetails(requestId), getValidation(requestId)])
      .then(([detailsRes, validationRes]) => {
        setDetails(detailsRes.data);
        setValidation(validationRes.data);
      })
      .catch(() => setError('Failed to load results.'))
      .finally(() => setLoading(false));
  }, [requestId]);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await getDownloadUrl(requestId);
      const { downloadUrl, filename } = res.data;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || `${requestId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setDownloadError('Failed to get download URL. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Results</h1>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-header">
        <h1 className="page-title">Results</h1>
        <div className="card" style={{ margin: '2rem' }}>
          <div className="card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--error)' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const files = details?.generatedFiles || details?.files || [];
  const stats = details?.stats || {};
  const validationResults = validation?.results || [];
  const validationSummary = validation?.summary || {};
  const allPassed = validationSummary.allPassed;
  const passedCount = validationSummary.passed ?? validationResults.filter((r) => r.status === 'PASS').length;
  const failedCount = validationSummary.failed ?? validationResults.filter((r) => r.status !== 'PASS').length;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <Package size={28} style={{ color: 'var(--accent-blue-light)' }} />
              <h1 className="page-title">Results</h1>
              <span className="badge badge-success">
                <CheckCircle size={11} />
                Completed
              </span>
            </div>
            <p className="page-subtitle">
              Request ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue-light)' }}>{requestId}</span>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Preparing...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Download ZIP
                </>
              )}
            </button>
            {downloadError && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)' }}>{downloadError}</span>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="stat-card">
            <div className="stat-value">{files.length || stats.filesGenerated || 0}</div>
            <div className="stat-label">Files Generated</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.linesOfCode || '—'}</div>
            <div className="stat-label">Lines of Code</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: allPassed ? 'var(--success)' : 'var(--warning)' }}>
              {passedCount}/{passedCount + failedCount}
            </div>
            <div className="stat-label">Governance Checks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: allPassed ? 'var(--success)' : 'var(--warning)' }}>
              {allPassed ? '100%' : `${Math.round((passedCount / (passedCount + failedCount)) * 100) || 0}%`}
            </div>
            <div className="stat-label">Compliance Score</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 'var(--space-8)', alignItems: 'start' }}>

          {/* File tree */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Generated Files</span>
              <span className="badge badge-neutral">{files.length} files</span>
            </div>
            <div className="card-body" style={{ padding: 'var(--space-3)' }}>
              {files.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', padding: 'var(--space-3)' }}>
                  No file details available.
                </p>
              ) : (
                <div className="file-tree">
                  {files.map((file) => (
                    <div key={file.path || file.name} className="file-tree-item">
                      <FileTypeIcon type={file.type || file.fileType} />
                      <span className="file-tree-name">{file.path || file.name}</span>
                      <span className="file-tree-size">
                        {file.size ? formatBytes(file.size) : file.lines ? `${file.lines} lines` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Validation report */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldCheck size={16} style={{ color: allPassed ? 'var(--success)' : 'var(--warning)' }} />
                Governance Report
              </span>
              <span className={`badge ${allPassed ? 'badge-success' : 'badge-warning'}`}>
                {allPassed ? 'All Passed' : `${failedCount} Failed`}
              </span>
            </div>
            <div style={{ padding: 0 }}>
              {validationResults.length === 0 ? (
                <div className="card-body">
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No validation results available.</p>
                </div>
              ) : (
                validationResults.map((rule) => {
                  const passed = rule.status === 'PASS';
                  const severity = rule.severity || 'mandatory';

                  // Failed badge style varies by severity
                  const failBadgeClass =
                    severity === 'mandatory' ? 'badge-error' :
                    severity === 'warning'   ? 'badge-warning' :
                                               'badge-neutral';

                  const failLabel =
                    severity === 'mandatory' ? 'Fail' :
                    severity === 'warning'   ? 'Warning' :
                                               'Advisory';

                  // Severity chip (only shown for non-mandatory rules)
                  const severityChip = severity !== 'mandatory' ? (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        background: severity === 'warning' ? 'var(--warning-dim, #78350f22)' : 'var(--bg-hover)',
                        color: severity === 'warning' ? 'var(--warning)' : 'var(--text-muted)',
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {severity}
                    </span>
                  ) : null;

                  return (
                    <div key={rule.rule || rule.name} className="validation-rule">
                      <div className={`validation-icon ${passed ? 'pass' : 'fail'}`}>
                        {passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      </div>
                      <div className="validation-info" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span className="validation-rule-name">{rule.rule || rule.name}</span>
                          {severityChip}
                        </div>
                        {rule.message && (
                          <div className="validation-message">{rule.message}</div>
                        )}
                      </div>
                      <span
                        className={`badge ${passed ? 'badge-success' : failBadgeClass}`}
                        style={{ flexShrink: 0 }}
                      >
                        {passed ? 'Pass' : failLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-8)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button className="btn btn-secondary" onClick={() => navigate('/developer')}>
            <ArrowLeft size={16} />
            Back to My Requests
          </button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={16} />
            Download ZIP
          </button>
        </div>
      </div>
    </>
  );
}
