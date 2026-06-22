import React, { useState } from 'react';
import { 
  FileText, Shield, Bell, Network, Play, Eye, HelpCircle, 
  MapPin, Clock, Server, CheckCircle2, ChevronRight, Activity, ArrowRight
} from 'lucide-react';

const ARCHITECTURE_FLOWS = [
  {
    id: 'vehicle-docs',
    title: 'Vehicle Document Storage',
    desc: 'Drivers and managers upload RC Books, insurance certificates, fitness certificates, and permits — stored directly in S3 via presigned URLs.',
    steps: [
      { name: '1. FleetOps Client', service: 'React Frontend — Vehicle Card', desc: 'User selects a document type and file. The browser requests a presigned PUT URL from the vehicle-service backend.' },
      { name: '2. Presigned URL', service: 'Vehicle Service — POST /api/documents/presigned-url', desc: 'Spring Boot generates a 15-minute presigned S3 PUT URL using IRSA credentials. Returns { uploadUrl, key } to the browser.' },
      { name: '3. Direct S3 Upload', service: 'Browser → Amazon S3 (presigned PUT)', desc: 'The browser PUTs the file bytes directly to S3. No file data passes through Spring Boot, keeping the pod stateless.' },
      { name: '4. List Documents', service: 'Vehicle Service — GET /api/documents/vehicle/{id}', desc: 'Frontend polls S3 object list via the backend, which calls ListObjectsV2 scoped to the vehicle number prefix.' }
    ],
    awsDetails: [
      { name: 'Amazon S3 Bucket', value: 'fleetops-prod-vehicle-docs', desc: 'KMS-encrypted, versioned. Object key: {vehicleNumber}/{docType}/{timestamp}-{filename}.' },
      { name: 'S3 Bucket Policy', value: 'Private — no public access', desc: 'All access via IRSA presigned URLs only. Block public ACLs enforced.' },
      { name: 'Lifecycle Policy', value: 'STANDARD_IA after 30 days, expire at 365', desc: 'Old versions of overwritten documents archived then purged automatically.' }
    ]
  },
  {
    id: 'documents',
    title: 'Maintenance Media Storage',
    desc: 'Maintenance team uploads service photos, inspection reports, and vehicle condition media for record-keeping.',
    steps: [
      { name: '1. FleetOps Client', service: 'React Frontend / CloudFront', desc: 'Maintenance staff uploads a file via the Maintenance Center document interface.' },
      { name: '2. Security Guard', service: 'AWS WAF & JWT Auth Filter', desc: 'WAF inspects the request at edge; JWT filter validates the Bearer token before the upload reaches the service.' },
      { name: '3. Core Storage', service: 'Maintenance Service → Amazon EFS', desc: 'POST /api/media/* writes the file to the EFS shared mount at /var/www/fleetops/shared-media. Persists across pod restarts.' },
      { name: '4. Durable Mount', service: 'EFS Access Point (KMS encrypted)', desc: 'EFS access point scoped to /fleetops (uid:1000) provides ReadWriteMany access — all maintenance-service pod replicas share the same file storage.' }
    ],
    awsDetails: [
      { name: 'Amazon EFS File System', value: 'fleetops-prod (CSI driver mounted)', desc: 'ReadWriteMany persistent volume shared across all maintenance-service pods.' },
      { name: 'EFS Access Point', value: '/fleetops (uid:1000, gid:1000)', desc: 'Scoped access point with KMS encryption at rest.' },
      { name: 'AWS WAF WebACL', value: 'fleetops-web-acl', desc: 'Edge defense protecting against malicious uploads or injection attacks.' }
    ]
  },
  {
    id: 'alerts',
    title: 'Maintenance & Expiry Alerts',
    desc: 'Automated warnings sent to fleet managers when a vehicle’s insurance policy or routine maintenance is overdue.',
    steps: [
      { name: '1. Time Trigger', service: 'Amazon EventBridge Schedule', desc: 'Daily cron trigger running at 06:00 UTC to evaluate database dates.' },
      { name: '2. Evaluation Script', service: 'AWS Lambda (fleetops-expiry-checker)', desc: 'Lightweight serverless function querying database and filtering expiring items.' },
      { name: '3. Alert Publisher', service: 'Amazon SNS (fleetops-alerts-topic)', desc: 'Publishes notification message to active subscription topics.' },
      { name: '4. Manager Receives', service: 'Email & SMS Subscriptions', desc: 'Fleet managers receive notifications instantly on their configured channels.' }
    ],
    awsDetails: [
      { name: 'Amazon EventBridge Rule', value: 'daily-insurance-cron', desc: 'Cron expression: cron(0 6 * * ? *)' },
      { name: 'AWS Lambda Runtime', value: 'Node.js 22.x (256 MB RAM)', desc: 'Serverless compute executing database scans.' },
      { name: 'Amazon SNS Topic', value: 'fleetops-alerts-topic', desc: 'Publishes alarms to subscribed SMS and emails.' }
    ]
  },
  {
    id: 'workflows',
    title: 'Request Approval Workflows',
    desc: 'Orchestrates the 6-stage lifecycle of service requests: OPEN → APPROVED → ASSIGNED → IN_PROGRESS → COMPLETED.',
    steps: [
      { name: '1. Request Opened', service: 'FleetOps Core API', desc: 'Manager submits a new maintenance ticket in the app.' },
      { name: '2. Orchestrator', service: 'AWS Step Functions (fleetops-request-workflow)', desc: 'Triggers state machine instance to control state flow.' },
      { name: '3. State Tracking', service: 'Step Functions Execution Record', desc: 'Step Functions records each stage transition: OPEN → PENDING_APPROVAL → APPROVED → ASSIGNED → IN_PROGRESS → COMPLETED. Execution ARN stored on the request entity.' },
      { name: '4. Maintenance Dispatch', service: 'Maintenance Service REST API', desc: 'On ASSIGNED status, request-service calls POST /api/tasks/add on maintenance-service to create a task in the technician\'s queue.' }
    ],
    awsDetails: [
      { name: 'AWS Step Functions Machine', value: 'fleetops-request-workflow', desc: 'Amazon States Language (ASL) workflow definition.' },
      { name: 'Execution History', value: '90-day persistence logs', desc: 'Enables auditing of transitions and processing latency.' },
      { name: 'Status Sync', value: 'Vehicle Service PATCH /status', desc: 'Vehicle status updated to IN_SERVICE or ACTIVE as request progresses.' }
    ]
  },
  {
    id: 'telemetry',
    title: 'GPS Tracking Telemetry Pipeline',
    desc: 'Processes real-time coordinate pings from fleet vehicles and serves live positions to the dashboard.',
    steps: [
      { name: '1. Simulator Ping', service: 'Frontend GPS Simulator', desc: 'Frontend sends GPS pings every 4 seconds to the tracking API for each active vehicle.' },
      { name: '2. Tracking API', service: 'Vehicle Service — POST /api/tracking/ping', desc: 'Spring Boot endpoint receives the ping, derives status from speed (IDLE / EN_ROUTE / SPEEDING), and persists to PostgreSQL.' },
      { name: '3. Persistence', service: 'RDS PostgreSQL — vehicle_telemetry table', desc: 'Telemetry rows stored with vehicleId, lat/lng, speed, engineTemp, and recordedAt. Indexed for fast per-vehicle queries.' },
      { name: '4. Live Dashboard', service: 'GET /api/tracking/live — polled every 3s', desc: 'Frontend polls the live endpoint which returns the latest position per vehicle. Map markers update in real time.' }
    ],
    awsDetails: [
      { name: 'RDS PostgreSQL 15', value: 'vehicle_telemetry table', desc: 'Indexed on vehicle_id and recorded_at for fast latest-per-vehicle queries.' },
      { name: 'Amazon EKS Pod', value: 'fleetops-vehicle-service', desc: 'Spring Boot service handling ping ingestion and live position queries via IRSA.' },
      { name: 'Phase 5 Path', value: 'SQS FIFO → Lambda → DynamoDB', desc: 'Same API contract (/api/tracking/ping, /api/tracking/live) — only the backend implementation changes.' }
    ]
  }
];

const Architecture = () => {
  const [activeFlow, setActiveFlow] = useState('documents');

  const selectedFlow = ARCHITECTURE_FLOWS.find(f => f.id === activeFlow);

  return (
    <div className="container" style={{ maxWidth: '1200px', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>FleetOps AWS Architecture</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Review the serverless pipelines and core AWS services backing FleetOps Enterprise capabilities.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
        
        {/* Left Side: Business Flows menu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Core Business Capabilities
          </div>
          {ARCHITECTURE_FLOWS.map(flow => {
            const isCurrent = activeFlow === flow.id;
            return (
              <button
                key={flow.id}
                onClick={() => setActiveFlow(flow.id)}
                className={`tab-item ${isCurrent ? 'active' : ''}`}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  borderRadius: '8px',
                  border: `1.5px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  background: isCurrent ? 'rgba(59,130,246,0.06)' : 'var(--bg-elevated)',
                  transition: 'all 0.15s'
                }}
              >
                <strong style={{ fontSize: '0.88rem', color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                  {flow.title}
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {flow.desc.substring(0, 75)}...
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Flow Details & Diagram */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Detailed Flow Description */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--accent-primary)' }}>{selectedFlow.title}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {selectedFlow.desc}
            </p>
          </div>

          {/* Interactive Pipeline Diagram */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Execution Flow Lifecycle
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedFlow.steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                    color: '#fff', flexShrink: 0, marginTop: '2px'
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{step.service}</strong>
                      <span className="aws-badge" style={{ fontSize: '0.65rem', background: 'var(--bg-surface)' }}>
                        {step.name}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AWS Resource Mapping Details */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Associated Physical AWS Resources
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {selectedFlow.awsDetails.map((detail, idx) => (
                <div key={idx} style={{ padding: '0.85rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
                    {detail.name}
                  </span>
                  <code style={{ fontSize: '0.8rem', color: 'var(--accent-success)', display: 'block', margin: '4px 0', wordBreak: 'break-all' }}>
                    {detail.value}
                  </code>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', lineHeight: 1.3 }}>
                    {detail.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Review Note */}
      <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: 'rgba(59,130,246,0.04)', border: '1.5px dashed rgba(59,130,246,0.2)', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <CheckCircle2 size={24} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '2px' }}>Reviewer Verification Guidance</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            To verify these integrations during evaluations, present the corresponding business feature screens in FleetOps (e.g., uploading a vehicle document from the Vehicle Card to S3, uploading a media file in Maintenance to EFS, triggering a service request through Step Functions, or viewing live GPS positions), then transition to the AWS Management Console to demonstrate the S3 bucket contents, Step Functions execution logs, EFS mount targets, or EventBridge + Lambda triggers operating in the background.
          </span>
        </div>
      </div>

    </div>
  );
};

export default Architecture;
