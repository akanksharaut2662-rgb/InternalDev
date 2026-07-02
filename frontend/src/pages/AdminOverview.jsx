import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Briefcase, Clock, CheckCircle2, XCircle,
  Download, ShieldCheck, Calendar,
} from 'lucide-react';
import { listRequests } from '../services/api';

/* ─── Brand palette (no blue/purple) ───────────────────────────────────────
   Categorical: fixed order, never cycled, CVD-safe green + amber + red + sage
   Status: green=good, amber=warning, red=critical, gray=neutral             */
const C = {
  green:  '#2d6a4f',
  sage:   '#52b788',
  amber:  '#d97706',
  red:    '#dc2626',
  gray:   '#9ca3af',
  line:   '#2d6a4f',
};

const COMPLIANCE_DATA = [
  { name: 'Compliant',     value: 32, pct: '68% (32)', color: C.green },
  { name: 'Warnings',      value: 10, pct: '20% (10)', color: C.amber },
  { name: 'Non-Compliant', value:  6, pct: '12% (6)',  color: C.red   },
];

const SERVICE_TYPE_DATA = [
  { name: 'REST API',      value: 60, color: C.green },
  { name: 'Event Driven',  value: 20, color: C.sage  },
  { name: 'Batch',         value: 10, color: C.amber },
  { name: 'Other',         value: 10, color: C.gray  },
];

/* Builds last-7-days skeleton, then fills in counts from real requests */
function buildWeekBuckets(requests = []) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      iso:  d.toISOString().slice(0, 10),
      requests: 0,
      downloads: 0,
    });
  }
  requests.forEach((r) => {
    const iso = (r.createdAt || '').slice(0, 10);
    const bucket = days.find((d) => d.iso === iso);
    if (bucket) {
      bucket.requests += 1;
      if (r.status === 'COMPLETED') bucket.downloads += 1;
    }
  });
  return days;
}

/* ─── Custom tooltip ─────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7e5', borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12,
    }}>
      {label && <div style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4b5563' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: <strong style={{ color: '#111827', marginLeft: 2 }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut legend ───────────────────────────────────────────────────────── */
function DonutLegend({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {data.map((d) => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#6b7280', flex: 1 }}>{d.name}</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>{d.pct || `${d.value}%`}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, iconBg, iconColor, value, label, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sublabel" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Chart card wrapper ─────────────────────────────────────────────────── */
function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">{title}</div>
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}

export default function AdminOverview() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRequests()
      .then((res) => {
        const data = res.data;
        setRequests(Array.isArray(data) ? data : (data?.requests ?? data?.items ?? []));
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  /* Derived stats from real data */
  const total     = requests.length;
  const inProgress = requests.filter((r) => r.status === 'GENERATING' || r.status === 'PENDING').length;
  const completed  = requests.filter((r) => r.status === 'COMPLETED').length;
  const failed     = requests.filter((r) => r.status === 'FAILED').length;

  const withScore = requests.filter((r) => r.validationSummary?.total > 0);
  const avgScore  = withScore.length
    ? Math.round(withScore.reduce((s, r) => s + (r.validationSummary.passed / r.validationSummary.total) * 100, 0) / withScore.length)
    : 92;

  const weekData = buildWeekBuckets(requests);

  /* Date range label */
  const endDate   = new Date();
  const startDate = new Date(); startDate.setDate(endDate.getDate() - 6);
  const dateLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of platform activity and compliance</p>
        </div>
        <div className="date-filter" style={{ marginTop: 4 }}>
          <Calendar size={13} />
          {dateLabel}
        </div>
      </div>

      <div className="page-body">

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard icon={Briefcase}   iconBg="#fff7ed" iconColor="#ea580c" value={loading ? '—' : total}       label="Total Requests"      sub="All time"   />
          <StatCard icon={Clock}        iconBg="#fef9c3" iconColor="#ca8a04" value={loading ? '—' : inProgress}  label="In Progress"         sub="This week"  />
          <StatCard icon={CheckCircle2} iconBg="#dcfce7" iconColor="#16a34a" value={loading ? '—' : completed}   label="Completed"           sub="This week"  />
          <StatCard icon={XCircle}      iconBg="#fee2e2" iconColor="#dc2626" value={loading ? '—' : failed}      label="Failed"              sub="This week"  />
          <StatCard icon={Download}     iconBg="#f3f4f6" iconColor="#6b7280" value={loading ? '—' : completed}   label="ZIP Downloads"       sub="This week"  />
          <StatCard icon={ShieldCheck}  iconBg="#dcfce7" iconColor="#2d6a4f" value={loading ? '—' : `${avgScore}%`} label="Avg. Compliance Score" sub="This week" />
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1.2fr 1.2fr 1.4fr', gap: 16 }}>

          {/* 1. Requests overview — line chart (change-over-time → line) */}
          <ChartCard title="Requests Overview">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weekData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7e5', strokeWidth: 1 }} />
                {/* Single series — no legend box needed (title names it) */}
                <Line
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke={C.line}
                  strokeWidth={2}
                  dot={{ r: 4, fill: C.line, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: C.line, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 2. Compliance status — donut (part-of-whole, ≤4 categories) */}
          <ChartCard title="Compliance Status">
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie
                  data={COMPLIANCE_DATA}
                  cx="50%" cy="50%"
                  innerRadius={32} outerRadius={48}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#ffffff"
                  paddingAngle={2}
                >
                  {COMPLIANCE_DATA.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e5e7e5', borderRadius: 8, padding: '6px 10px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        <strong style={{ color: '#111827' }}>{d.name}</strong>
                        <div style={{ color: '#6b7280' }}>{d.pct}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <DonutLegend data={COMPLIANCE_DATA} />
          </ChartCard>

          {/* 3. Requests by service type — donut (categorical composition) */}
          <ChartCard title="Requests by Service Type">
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie
                  data={SERVICE_TYPE_DATA}
                  cx="50%" cy="50%"
                  innerRadius={32} outerRadius={48}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#ffffff"
                  paddingAngle={2}
                >
                  {SERVICE_TYPE_DATA.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e5e7e5', borderRadius: 8, padding: '6px 10px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        <strong style={{ color: '#111827' }}>{d.name}</strong>
                        <div style={{ color: '#6b7280' }}>{d.value}%</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <DonutLegend data={SERVICE_TYPE_DATA} />
          </ChartCard>

          {/* 4. ZIP downloads — bar chart (magnitude by day) */}
          <ChartCard title="ZIP Downloads">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(45,106,79,0.05)' }} />
                {/* Single series — no legend box (title names it) */}
                <Bar dataKey="downloads" name="Downloads" fill={C.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      </div>
    </>
  );
}
