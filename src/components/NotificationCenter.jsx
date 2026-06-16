import React, { useEffect, useRef, useState } from 'react';
import { Bell, MailOpen, ShieldAlert, AlertTriangle, Info, CheckCircle } from 'lucide-react';

/**
 * NotificationCenter — Simulates an SNS notification inbox.
 *
 * Business Requirement:
 *   Operations team needs to be alerted when:
 *   - Insurance expires within 30 days
 *   - Vehicle is overdue for service
 *   - CloudWatch alarm fires (high latency / CPU)
 *
 * AWS Mapping:
 *   EventBridge rule → Lambda → SNS Topic → Email/SMS
 *   In production, SNS delivers to email. Here we simulate
 *   the same events arriving in a real-time inbox.
 *
 * Usage:
 *   Dispatch a global event from anywhere:
 *   window.dispatchEvent(new CustomEvent('fleetops-notification', {
 *     detail: { type: 'warning', title: '...', body: '...' }
 *   }));
 */

const STORAGE_KEY = 'fleetops_sns_inbox';
const MAX = 50;

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function save(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX))); }
  catch {}
}

const TYPE_COLORS = {
  danger:  'var(--accent-danger)',
  warning: 'var(--accent-warning)',
  info:    'var(--accent-info)',
  success: 'var(--accent-success)',
};
const TYPE_ICONS = {
  danger:  <ShieldAlert size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-danger)' }} />,
  warning: <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-warning)' }} />,
  info:    <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-info)' }} />,
  success: <CheckCircle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-success)' }} />
};

export function pushNotification(type, title, body, source = 'SNS') {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    type, title, body, source,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [item, ...load()];
  save(updated);
  window.dispatchEvent(new CustomEvent('fleetops-notification', { detail: item }));
  return item;
}

export default function NotificationCenter() {
  const [items, setItems]   = useState(load);
  const [open, setOpen]     = useState(false);
  const ref                 = useRef(null);

  // Listen for new notifications
  useEffect(() => {
    const handler = () => setItems(load());
    window.addEventListener('fleetops-notification', handler);
    return () => window.removeEventListener('fleetops-notification', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = items.filter(i => !i.read).length;

  const markRead = () => {
    const updated = items.map(i => ({ ...i, read: true }));
    setItems(updated); save(updated);
  };

  const clearAll = () => { localStorage.removeItem(STORAGE_KEY); setItems([]); };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markRead(); }}
        style={{
          background: 'transparent', color: unread > 0 ? 'var(--accent-warning)' : 'var(--text-secondary)',
          fontSize: '1rem', position: 'relative', padding: '6px 10px',
          border: unread > 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
          borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        title="SNS Notification Inbox"
      >
        <Bell size={18} strokeWidth={2} className={unread > 0 ? "spin-icon" : ""} />
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          {/* Header */}
          <div style={{
            padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', borderBottom: '1px solid var(--glass-border)',
            background: 'var(--bg-elevated)',
          }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>SNS Inbox</span>
              <span className="aws-badge" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Amazon SNS</span>
            </div>
            <button onClick={clearAll} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Clear all
            </button>
          </div>

          {/* Items */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <MailOpen size={24} strokeWidth={1.5} color="var(--text-muted)" />
                </div>
                No notifications
              </div>
            ) : items.map(item => (
              <div key={item.id} className="notif-item" style={{
                borderLeft: `3px solid ${TYPE_COLORS[item.type] || 'var(--accent-info)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {TYPE_ICONS[item.type]} {item.title}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(item.timestamp)}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{item.body}</p>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>via {item.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
