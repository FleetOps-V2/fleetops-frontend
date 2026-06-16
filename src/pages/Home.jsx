import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import {
  Truck, Wrench, ClipboardList, Network, Database, Activity
} from 'lucide-react';

const FEATURES = [
  {
    icon: Truck,
    title: 'Fleet Management',
    desc: 'Register vehicles, track mileage, monitor insurance expiry, and manage documents.',
    aws: ['ECS Fargate', 'RDS PostgreSQL', 'ElastiCache Redis', 'Amazon S3'],
    link: '/vehicles',
    color: '#3b82f6',
    roles: ['DRIVER','MANAGER','ADMIN','ROLE_DRIVER','ROLE_MANAGER','ROLE_ADMIN'],
  },
  {
    icon: Wrench,
    title: 'Maintenance Center',
    desc: 'Task queues, service-due overrides, and automated daily background notifications.',
    aws: ['EventBridge', 'AWS Lambda', 'Amazon SNS'],
    link: '/maintenance',
    color: '#f59e0b',
    roles: ['DRIVER','MANAGER','ADMIN','ROLE_DRIVER','ROLE_MANAGER','ROLE_ADMIN'],
  },
  {
    icon: ClipboardList,
    title: 'Service Requests',
    desc: 'Multi-stage approval process: OPEN → APPROVED → ASSIGNED → IN_PROGRESS → COMPLETED.',
    aws: ['AWS Step Functions', 'RDS PostgreSQL'],
    link: '/requests',
    color: '#10b981',
    roles: ['DRIVER','MANAGER','ADMIN','ROLE_DRIVER','ROLE_MANAGER','ROLE_ADMIN'],
  },
  {
    icon: Network,
    title: 'VPC Architecture Map',
    desc: 'Visual blueprint mapping core application features to supporting AWS resources.',
    aws: ['VPC', 'Subnets', 'Security Groups', 'AWS Architectures'],
    link: '/architecture',
    color: '#8b5cf6',
    roles: ['ADMIN','ROLE_ADMIN'],
  },
];

const STATS = [
  { value: '5', label: 'Microservices' },
  { value: '3', label: 'Security Roles' },
  { value: '6', label: 'Request States' },
];

export default function Home() {
  const { state } = useContext(AppContext);
  const navigate = useNavigate();

  const visibleFeatures = FEATURES.filter(f =>
    !state.isAuthenticated || f.roles.includes(state.role)
  );

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', position: 'relative' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: '20px', padding: '4px 14px', marginBottom: '1.5rem',
          fontSize: '0.82rem', color: '#60a5fa', fontWeight: 600,
        }}>
          <span className="pulse-dot pulse-green" />
          Cloud-Native Fleet Management Platform
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.25rem' }}>
          <span className="gradient-text">FleetOps</span>
          <br />
          <span style={{ color: 'var(--text-primary)' }}>Enterprise</span>
        </h1>

        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto 2.5rem' }}>
          A production-grade fleet management platform built to scale. Business features are backed by high-availability AWS cloud-native services.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {state.isAuthenticated ? (
            <>
              <button className="btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }} onClick={() => navigate('/dashboard')}>
                Fleet Dashboard
              </button>
              {state.role === 'ADMIN' && (
                <button className="btn-secondary" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }} onClick={() => navigate('/architecture')}>
                  VPC Architecture
                </button>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className="btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}>Sign In</Link>
              <Link to="/vehicles" className="btn-secondary" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}>View Fleet</Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Enterprise Modules</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Every module solves a real business problem, supported by optimized cloud architectures.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {visibleFeatures.map(f => {
            const Icon = f.icon;
            return (
              <Link key={f.title} to={f.link} className="feature-card" style={{ '--card-color': f.color }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <Icon size={28} strokeWidth={1.5} color={f.color} />
                </div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>{f.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {f.aws.map(s => <span key={s} className="aws-badge" style={{ fontSize: '0.7rem' }}>{s}</span>)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Why Each Service */}
      <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--glass-border)', padding: '3rem 1.5rem' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.4rem' }}>
            Business Requirement → Cloud Integration
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            A visual overview of how FleetOps requirements align directly with native AWS resources.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              { req: 'Vehicle lists queried thousands of times per day', svc: 'Distributed Cache (ElastiCache)', why: 'Memory cache reduces database read operations. 5-minute TTL.', color: '#f59e0b' },
              { req: 'Insurance expires — nobody checks manually', svc: 'Alert Scheduler (EventBridge + Lambda)', why: 'Daily cron scheduler triggers lambda scans to publish manager alert notifications.', color: '#ec4899' },
              { req: 'Store RC, Insurance, Fitness Cert per vehicle', svc: 'Secure Storage (Amazon S3)', why: 'Documents stored in private S3 bucket. Lifecycle moves aging items to Glacier to save cost.', color: '#3b82f6' },
              { req: 'Manage request workflows across stages safely', svc: 'State Machine (Step Functions)', why: 'Orchestrates approvals and tasks without hardcoding state checks.', color: '#8b5cf6' },
              { req: 'Process rapid real-time vehicle GPS coordinates', svc: 'IoT Queue (SQS FIFO + DynamoDB)', why: 'Decouples heavy writes from core DB; stores points in NoSQL tables.', color: '#06b6d4' },
            ].map(item => (
              <div key={item.svc} className="glass-panel" style={{ padding: '1.1rem' }}>
                <span className="aws-badge" style={{ marginBottom: '0.6rem', display: 'inline-block', borderColor: item.color + '55', color: item.color, background: item.color + '15' }}>
                  {item.svc}
                </span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  <strong style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Requirement</strong><br />
                  {item.req}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--accent-success)' }}>
                  <Activity size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  {item.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
