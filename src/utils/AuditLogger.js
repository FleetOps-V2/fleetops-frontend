/**
 * AuditLogger — Sends audit events to the backend (auth-service /api/audit/events).
 * The backend logs them as structured JSON to stdout, which EKS Fluent Bit streams
 * to CloudWatch Logs (/fleetops/audit-trail). CloudTrail captures the API calls.
 */

function deriveService(action) {
  if (action.includes('Vehicle'))  return 'fleetops:VehicleService';
  if (action.includes('Request'))  return 'fleetops:RequestService';
  if (action.includes('Task'))     return 'fleetops:MaintenanceService';
  if (action.includes('Login') || action.includes('Logout')) return 'fleetops:AuthService';
  return 'fleetops:AdminConsole';
}

/**
 * Log an audit event — fire-and-forget POST to /api/audit/events.
 * The backend overwrites `user` with the authenticated principal.
 */
export function logAudit(username, action, resource, detail = '', success = true) {
  const entry = {
    eventId:   crypto.randomUUID ? crypto.randomUUID() :
               Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    user:      username || 'anonymous',
    action,
    resource,
    detail,
    sourceIp:  '',
    region:    'us-east-1',
    service:   deriveService(action),
    success,
  };

  // jwt cookie (httpOnly, SameSite=Strict) is sent automatically for same-origin requests
  fetch('/api/audit/events', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(entry),
  }).catch(() => {}); // fire and forget — never block the UI

  return entry;
}
