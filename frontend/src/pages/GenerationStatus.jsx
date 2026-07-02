import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader, ArrowRight, Clock } from 'lucide-react';
import { getRequestStatus } from '../services/api';

const STEPS = [
  { key: 'PENDING',    label: 'Request Created',      desc: 'Your request is queued for processing.' },
  { key: 'GENERATING', label: 'Generating Code',      desc: 'AI is generating code based on your policy.' },
  { key: 'VALIDATING', label: 'Validating Governance', desc: 'Running governance and compliance checks.' },
  { key: 'COMPLETED',  label: 'Ready to Download',    desc: 'Your microservice code is ready.' },
];

const STEP_ORDER = ['PENDING', 'GENERATING', 'VALIDATING', 'COMPLETED'];

function stepIndex(status) {
  if (status === 'FAILED') return -1;
  // Backend uses GENERATING which covers both steps 1 and 2
  if (status === 'COMPLETED') return 3;
  if (status === 'GENERATING') return 1;
  return 0;
}

export default function GenerationStatus() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('PENDING');
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await getRequestStatus(requestId);
        const data = res.data;
        setStatus(data.status);
        setDetails(data);

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(intervalRef.current);
          clearInterval(timerRef.current);
        }
      } catch {
        setError('Failed to fetch status. Retrying...');
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(timerRef.current);
    };
  }, [requestId]);

  const activeStep = stepIndex(status);
  const isFailed = status === 'FAILED';
  const isCompleted = status === 'COMPLETED';

  function formatElapsed(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          {isCompleted ? (
            <CheckCircle size={28} style={{ color: 'var(--success)' }} />
          ) : isFailed ? (
            <AlertCircle size={28} style={{ color: 'var(--error)' }} />
          ) : (
            <Loader size={28} style={{ color: 'var(--accent-blue-light)', animation: 'spin 1s linear infinite' }} />
          )}
          <h1 className="page-title">
            {isCompleted ? 'Generation Complete' : isFailed ? 'Generation Failed' : 'Generating...'}
          </h1>
        </div>
        <p className="page-subtitle">
          Request ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue-light)' }}>{requestId}</span>
          &nbsp;·&nbsp;
          <Clock size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
          &nbsp;{formatElapsed(elapsed)} elapsed
        </p>
      </div>

      <div className="page-body" style={{ maxWidth: 700 }}>

        {/* Step tracker */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title">Progress</span>
            <span className={`badge ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : 'badge-info'}`}>
              {status}
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {STEPS.map((step, i) => {
                const isDone = activeStep > i;
                const isActive = activeStep === i;
                const isFutureStep = activeStep < i;

                return (
                  <div
                    key={step.key}
                    style={{
                      display: 'flex',
                      gap: 'var(--space-4)',
                      paddingBottom: i < STEPS.length - 1 ? 'var(--space-6)' : 0,
                      position: 'relative',
                    }}
                  >
                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 19,
                          top: 40,
                          bottom: 0,
                          width: 2,
                          background: isDone ? 'var(--success)' : 'var(--border-default)',
                          transition: 'background 0.4s',
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid',
                        borderColor: isDone ? 'var(--success)' : isActive ? 'var(--accent-blue)' : 'var(--border-default)',
                        background: isDone ? 'var(--success)' : isActive ? 'var(--accent-blue-dim)' : 'var(--bg-surface)',
                        transition: 'all 0.4s',
                        zIndex: 1,
                      }}
                    >
                      {isDone ? (
                        <CheckCircle size={18} color="white" />
                      ) : isActive && !isFailed ? (
                        <Loader size={18} color="var(--accent-blue-light)" style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: isFutureStep ? 'var(--text-muted)' : 'var(--text-tertiary)' }}>
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Text */}
                    <div style={{ paddingTop: 8 }}>
                      <div
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: isDone ? 'var(--success)' : isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        {step.label}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error */}
        {isFailed && (
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--error-dim)',
              border: '1px solid var(--error)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
            }}
          >
            <AlertCircle size={20} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Generation failed</div>
              <div style={{ fontSize: 'var(--text-xs)', marginTop: 2, opacity: 0.8 }}>
                {details?.errorMessage || 'An unexpected error occurred. Please try creating a new request.'}
              </div>
            </div>
          </div>
        )}

        {/* Poll feedback */}
        {error && !isFailed && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        {/* Stats when completed */}
        {isCompleted && details?.stats && (
          <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
            {details.stats.filesGenerated && (
              <div className="stat-card">
                <div className="stat-value">{details.stats.filesGenerated}</div>
                <div className="stat-label">Files Generated</div>
              </div>
            )}
            {details.stats.validationPassed !== undefined && (
              <div className="stat-card">
                <div className="stat-value">{details.stats.validationPassed ? '✓' : '✗'}</div>
                <div className="stat-label">Governance</div>
              </div>
            )}
            {details.stats.linesOfCode && (
              <div className="stat-card">
                <div className="stat-value">{details.stats.linesOfCode}</div>
                <div className="stat-label">Lines of Code</div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {isCompleted && (
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            onClick={() => navigate(`/developer/results/${requestId}`)}
          >
            View Results &amp; Download
            <ArrowRight size={18} />
          </button>
        )}

        {isFailed && (
          <button
            className="btn btn-secondary btn-lg"
            style={{ width: '100%' }}
            onClick={() => navigate('/developer/new')}
          >
            Create New Request
          </button>
        )}

        {!isCompleted && !isFailed && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Auto-refreshing every 3 seconds...
          </div>
        )}
      </div>
    </>
  );
}
