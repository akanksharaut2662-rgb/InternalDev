export function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function deriveType(req = '') {
  const l = req.toLowerCase();
  if (l.includes('event') || l.includes('queue') || l.includes('message') || l.includes('notification')) return 'Event Driven';
  if (l.includes('batch') || l.includes('job') || l.includes('cron')) return 'Batch';
  if (l.includes('crud') || l.includes('database') || l.includes('storage')) return 'CRUD';
  return 'REST API';
}
