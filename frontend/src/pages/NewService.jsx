import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Lightbulb, Globe, Database, Radio, ShieldCheck } from 'lucide-react';
import { createRequest } from '../services/api';

const BLUEPRINTS = [
  {
    id: 'rest',
    label: 'Simple REST API',
    Icon: Globe,
    color: '#3b82f6',
    description: 'Lightweight HTTP service with basic endpoints',
    prompt: 'A product catalog service with GET /products (paginated, filterable by category), POST /products, GET /products/{id}, PUT /products/{id}, and DELETE /products/{id} endpoints. Include input validation, error handling, and an in-memory or SQLite store.',
  },
  {
    id: 'crud',
    label: 'CRUD Microservice',
    Icon: Database,
    color: '#10b981',
    description: 'Full create-read-update-delete with persistence',
    prompt: 'A user management service with full CRUD operations, email uniqueness validation, bcrypt password hashing, PostgreSQL integration via SQLAlchemy, and pagination support. Include a search endpoint and soft-delete capability.',
  },
  {
    id: 'event',
    label: 'Event-Driven Service',
    Icon: Radio,
    color: '#f59e0b',
    description: 'Async message consumer with queue processing',
    prompt: 'An order notification service that consumes order events from a message queue, sends email and SMS notifications via SendGrid and Twilio, tracks delivery status with retry logic, and exposes a REST API for notification history and preferences.',
  },
  {
    id: 'secure',
    label: 'Secure Financial Service',
    Icon: ShieldCheck,
    color: '#ef4444',
    description: 'High-security service with full audit trail',
    prompt: 'A payment processing microservice with Stripe integration, idempotency keys to prevent duplicate charges, PCI-DSS-aware data handling (no raw card data stored), a full audit trail for every transaction, RBAC with admin and customer roles, webhook signature verification, and end-to-end request signing.',
  },
];

const EXAMPLES = [
  'A user authentication service with JWT tokens, refresh token rotation, and OAuth2 with Google and GitHub',
  'A payment processing microservice with Stripe integration, idempotency keys, and audit logging',
  'An inventory management service with real-time stock updates, low-stock alerts, and webhooks',
  'A notification service that sends emails, SMS, and push notifications with delivery tracking',
];

export default function NewService() {
  const [description, setDescription] = useState('');
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  function selectBlueprint(bp) {
    if (selectedBlueprint?.id === bp.id) {
      setSelectedBlueprint(null);
    } else {
      setSelectedBlueprint(bp);
      setDescription(bp.prompt);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await createRequest(description.trim());
      const { requestId } = res.data;
      navigate(`/developer/plan/${requestId}`);
    } catch {
      setError('Failed to create request. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Zap size={28} style={{ color: 'var(--accent-blue-light)' }} />
          <h1 className="page-title">New Microservice</h1>
        </div>
        <p className="page-subtitle">
          Describe what your microservice should do, or start from a blueprint. The platform generates production-ready code aligned with your organisation's policy.
        </p>
      </div>

      <div className="page-body" style={{ maxWidth: 800 }}>

        {/* Blueprint selector */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title">Service Blueprints</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Pick a starting point — you can edit the description below
            </span>
          </div>
          <div
            className="card-body"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}
          >
            {BLUEPRINTS.map((bp) => {
              const { Icon } = bp;
              const active = selectedBlueprint?.id === bp.id;
              return (
                <button
                  key={bp.id}
                  onClick={() => selectBlueprint(bp)}
                  disabled={submitting}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    border: `1px solid ${active ? bp.color : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    outline: 'none',
                    boxShadow: active ? `0 0 0 1px ${bp.color}33` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: `${bp.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} style={{ color: bp.color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>
                      {bp.label}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {bp.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description form */}
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Service Description</span>
              {selectedBlueprint && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: `${selectedBlueprint.color}22`,
                    color: selectedBlueprint.color,
                    fontWeight: 500,
                  }}
                >
                  {selectedBlueprint.label} blueprint
                </span>
              )}
            </div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">What should this microservice do?</label>
                <p className="form-description">
                  Be specific about features, integrations, and behaviours. The more detail you provide, the better the generated code will be.
                </p>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder="e.g. A user authentication service that handles registration, login, JWT token refresh, and OAuth2 with Google and GitHub..."
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setSelectedBlueprint(null); }}
                  disabled={submitting}
                  required
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--error-dim)',
                    border: '1px solid var(--error)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--error)',
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {description.length} characters
                </span>
                <button
                  className="btn btn-primary btn-lg"
                  type="submit"
                  disabled={submitting || !description.trim()}
                >
                  {submitting ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      Generate Plan
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Example prompts */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Lightbulb size={16} style={{ color: 'var(--warning)' }} />
              Example Descriptions
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="btn btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  whiteSpace: 'normal',
                  height: 'auto',
                  padding: 'var(--space-3) var(--space-4)',
                }}
                onClick={() => { setDescription(ex); setSelectedBlueprint(null); }}
                disabled={submitting}
              >
                <ArrowRight size={14} style={{ flexShrink: 0, color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{ex}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
