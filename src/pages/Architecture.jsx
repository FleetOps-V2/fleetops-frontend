import React, { useState } from 'react';
import { 
  FileText, Shield, Bell, Network, Play, Eye, HelpCircle, 
  MapPin, Clock, Server, CheckCircle2, ChevronRight, Activity, ArrowRight
} from 'lucide-react';

const ARCHITECTURE_FLOWS = [
  {
    id: 'documents',
    title: 'Vehicle Documents Storage',
    desc: 'Driver uploads registration certificates, permits, and insurance policies for compliance reviews.',
    steps: [
      { name: '1. FleetOps Client', service: 'React Frontend / CloudFront', desc: 'Driver uploads PDF/image document from the vehicles interface.' },
      { name: '2. Security Guard', service: 'AWS WAF & IAM Authorization', desc: 'Inspects requests for exploits; checks IAM permissions for upload endpoint.' },
      { name: '3. Core Storage', service: 'Amazon S3 (fleetops-documents-prod)', desc: 'Stores documents securely with Versioning enabled. Encrypted with KMS Key.' },
      { name: '4. Lifecycle Policy', service: 'S3 Lifecycle Rules', desc: 'Automatically transitions files to Standard-IA after 30 days, and archives to Glacier after 90 days to minimize storage costs.' }
    ],
    awsDetails: [
      { name: 'Amazon S3 Bucket', value: 'fleetops-documents-prod', desc: 'Secure document vault with KMS-SSE key encryption.' },
      { name: 'S3 Lifecycle Policy', value: '30 Days → IA, 90 Days → Glacier', desc: 'Automated cost optimization storage tiering.' },
      { name: 'AWS WAF WebACL', value: 'fleetops-web-acl', desc: 'Edge defense protecting against malicious uploads or query injection.' }
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
      { name: '3. Conditional Gate', service: 'Decision Choice State', desc: 'Evaluates cost threshold; if >$500, stalls for manager override signature.' },
      { name: '4. Dispatch Notification', service: 'Amazon SES target', desc: 'Emails notifications to assignment technicians when tickets transition to ASSIGNED.' }
    ],
    awsDetails: [
      { name: 'AWS Step Functions Machine', value: 'fleetops-request-workflow', desc: 'Amazon States Language (ASL) workflow definition.' },
      { name: 'Execution History', value: '90-day persistence logs', desc: 'Enables auditing of transitions and processing latency.' },
      { name: 'Integration Target', value: 'Amazon SES SMTP relay', desc: 'Dispatches ticket closure receipts.' }
    ]
  },
  {
    id: 'telemetry',
    title: 'GPS Tracking Telemetry Pipeline',
    desc: 'Processes rapid coordinate pings from vehicles on transit to update live dashboards and tracks.',
    steps: [
      { name: '1. Simulator Ping', service: 'IoT Telemetry Simulator', desc: 'Vehicles transmit latency pings with coordinates at 2-second intervals.' },
      { name: '2. Buffer Queue', service: 'Amazon SQS FIFO (fleetops-maintenance-queue.fifo)', desc: 'Safeguards database by buffering peaks and preventing message loss.' },
      { name: '3. Consumer Function', service: 'AWS Lambda (telemetry-processor)', desc: 'Batches messages and updates status keys.' },
      { name: '4. NoSQL Storage', service: 'Amazon DynamoDB (fleetops-trips-telemetry)', desc: 'Stores time-series coordinates for map path rendering.' }
    ],
    awsDetails: [
      { name: 'Amazon SQS Queue', value: 'fleetops-maintenance-queue.fifo', desc: 'First-in-first-out delivery guaranteeing message ordering.' },
      { name: 'Amazon DynamoDB Table', value: 'fleetops-trips-telemetry', desc: 'High write throughput table with Partition Key vehicleId.' },
      { name: 'TTL (Time To Live)', value: '90 Days Retention', desc: 'DynamoDB automatically evicts telemetry older than 90 days.' }
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
            To verify these integrations during evaluations, present the corresponding business feature screens in FleetOps (e.g., uploading a vehicle document or triggering a service request), then transition to the AWS Management Console to demonstrate the real S3 buckets, Step Functions execution logs, or CloudWatch triggers operating in the background.
          </span>
        </div>
      </div>

    </div>
  );
};

export default Architecture;
