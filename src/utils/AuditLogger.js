/**
 * AuditLogger — CloudTrail-style audit event store using localStorage.
 *
 * Business Requirement:
 *   Management must be able to answer: Who deleted vehicle KL07AB1234?
 *   When? From which IP?
 *
 * AWS Mapping:
 *   In production, these events are automatically captured by AWS CloudTrail
 *   and stored in S3 with 7-year retention. Queryable via Athena.
 *   Here we simulate the same event structure in localStorage so the
 *   CloudTrail Audit Log in Operations Center always has real data.
 */

const STORAGE_KEY = 'fleetops_cloudtrail_events';
const MAX_ENTRIES = 200;

// Simulated source IPs per session (consistent per user, random per session)
const SESSION_IPS = {
  admin1:   '10.0.1.14',
  manager1: '10.0.2.55',
  driver1:  '192.168.1.101',
  driver2:  '192.168.1.102',
  driver3:  '192.168.1.103',
};

function getSourceIp(username) {
  return SESSION_IPS[username] ||
    `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 254) + 1}`;
}

/**
 * Log an audit event.
 * @param {string} username  - The IAM principal (logged-in user)
 * @param {string} action    - e.g. 'CreateVehicle', 'DeleteVehicle', 'ApproveRequest'
 * @param {string} resource  - e.g. 'KL07AB1234', 'Request #42'
 * @param {string} [detail]  - Optional extra context
 * @param {boolean} [success=true] - Whether the action succeeded
 */
export function logAudit(username, action, resource, detail = '', success = true) {
  const entry = {
    eventId:    crypto.randomUUID ? crypto.randomUUID() :
                Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp:  new Date().toISOString(),
    user:       username || 'anonymous',
    action,
    resource,
    detail,
    sourceIp:   getSourceIp(username),
    region:     'ap-south-1',
    service:    deriveService(action),
    success,
  };

  try {
    const existing = getAuditLogs();
    const updated  = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* storage full or unavailable */ }

  return entry;
}

/** Read all audit logs, newest first. */
export function getAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear all audit logs.
 * The purge action itself is preserved as the sole surviving entry,
 * matching real CloudTrail behaviour: you cannot delete the log of a deletion.
 */
export function clearAuditLogs(username) {
  const purgeEntry = logAudit(username, 'PurgeAuditLog', 'CloudTrail', 'Manual log purge by admin');
  // Replace the full log with just the purge record so it's never self-erasing
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([purgeEntry]));
  } catch { /* storage unavailable */ }
}

/** Map action name to the AWS service that would own this event in CloudTrail. */
function deriveService(action) {
  if (action.includes('Vehicle'))  return 'fleetops:VehicleService';
  if (action.includes('Request'))  return 'fleetops:RequestService';
  if (action.includes('Task'))     return 'fleetops:MaintenanceService';
  if (action.includes('Login') || action.includes('Logout')) return 'fleetops:AuthService';
  return 'fleetops:AdminConsole';
}
