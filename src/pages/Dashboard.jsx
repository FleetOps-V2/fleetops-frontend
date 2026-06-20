import React, { useState, useEffect, useContext } from 'react';
import { vehicleAPI, taskAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { AppContext } from '../context/AppContext';
import { pushNotification } from '../components/NotificationCenter';
import { Truck, CheckCircle, Wrench, AlertTriangle, ShieldAlert, Calendar, Activity, Bell, Zap } from 'lucide-react';

const Dashboard = () => {
  const { state } = useContext(AppContext);
  const [stats, setStats] = useState(null);
  const [insuranceAlerts, setInsuranceAlerts] = useState([]);
  const [serviceAlerts, setServiceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggeringSNS, setTriggeringSNS] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, insRes, svcRes] = await Promise.all([
        vehicleAPI.getDashboard(),
        vehicleAPI.getInsuranceAlerts(),
        vehicleAPI.getServiceAlerts()
      ]);
      setStats(statsRes.data);
      setInsuranceAlerts(Array.isArray(insRes.data) ? insRes.data : []);
      setServiceAlerts(Array.isArray(svcRes.data) ? svcRes.data : []);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleBroadcastAlarms = async () => {
    setTriggeringSNS(true);
    try {
      const res = await taskAPI.broadcastAlarms();
      const { insuranceAlarmsPublished = 0, serviceAlarmsPublished = 0 } = res.data;

      if (insuranceAlarmsPublished > 0) {
        pushNotification('danger',
          `Insurance Alarm Broadcast`,
          `${insuranceAlarmsPublished} vehicle(s) — SNS notification sent to subscribed managers.`,
          'Amazon SNS');
      }
      if (serviceAlarmsPublished > 0) {
        pushNotification('warning',
          `Service Overdue Broadcast`,
          `${serviceAlarmsPublished} vehicle(s) — SNS notification sent to subscribed managers.`,
          'Amazon SNS');
      }
      if (insuranceAlarmsPublished === 0 && serviceAlarmsPublished === 0) {
        pushNotification('success', 'Fleet Health: OK',
          'EventBridge cron check complete — 0 exceptions found.', 'Amazon SNS');
      }
    } catch (err) {
      pushNotification('danger', 'Broadcast Failed',
        err.response?.data?.message || err.message || 'Failed to publish alarms to SNS');
    } finally {
      setTriggeringSNS(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const statCards = [
    { title: 'Total Fleet',      value: stats?.total ?? 0,             Icon: Truck,        color: 'var(--accent-primary)',  bg: 'rgba(59,130,246,0.1)' },
    { title: 'Active',           value: stats?.active ?? 0,            Icon: CheckCircle,  color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.1)' },
    { title: 'In Service',       value: stats?.inService ?? 0,         Icon: Wrench,       color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.1)' },
    { title: 'Breakdown',        value: stats?.breakdown ?? 0,          Icon: AlertTriangle, color: 'var(--accent-danger)', bg: 'rgba(239,68,68,0.1)' },
    { title: 'Exp. Insurance',   value: stats?.insuranceExpiring ?? 0, Icon: ShieldAlert,  color: '#f97316',              bg: 'rgba(249,115,22,0.1)' },
    { title: 'Service Due',      value: stats?.serviceDue ?? 0,        Icon: Calendar,     color: '#06b6d4',              bg: 'rgba(6,182,212,0.1)' },
  ];

  const isAdmin = state.role === 'ADMIN' || state.role === 'ROLE_ADMIN';
  const showTechnicalControls = isAdmin;

  return (
    <div className="container" style={{ paddingBottom: '3rem' }}>

      {/* Header strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>Fleet Manager Dashboard</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time operational KPIs sourced directly from active fleet registry records.
          </p>
        </div>
        {showTechnicalControls && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cache-pill cache-hit" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={13} strokeWidth={2.5} /> Memory Cache: ACTIVE
            </span>
            <button
              className="btn-primary btn-sm"
              onClick={handleBroadcastAlarms}
              disabled={triggeringSNS}
              aria-busy={triggeringSNS}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Bell size={13} strokeWidth={2} />
              {triggeringSNS ? 'Triggering...' : 'Run Diagnostics Check'}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {statCards.map((card, i) => {
          const Icon = card.Icon;
          return (
            <div key={i} className="glass-panel" style={{
              padding: '1.25rem 1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              borderTop: `2px solid ${card.color}`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: card.bg, borderRadius: '0 0 0 100%', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</span>
                <Icon size={20} strokeWidth={1.5} color={card.color} style={{ opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Fleet Composition Bar */}
      {stats && stats.total > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={15} strokeWidth={2} />Fleet Health Composition
            </span>
            {showTechnicalControls && <span className="aws-badge" style={{ fontSize: '0.65rem' }}>Cache Synced</span>}
          </div>
          <div style={{ display: 'flex', height: '12px', borderRadius: '8px', overflow: 'hidden', gap: '2px' }}>
            {[
              { val: stats.active, color: 'var(--accent-success)' },
              { val: stats.inService, color: 'var(--accent-warning)' },
              { val: stats.breakdown, color: 'var(--accent-danger)' },
            ].map(({ val, color }, i) => val > 0 ? (
              <div key={i} style={{ flex: val, background: color, transition: 'flex 0.5s ease', borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : '0' }} />
            ) : null)}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span><span style={{ color: 'var(--accent-success)' }}>■</span> Active ({stats.active})</span>
            <span><span style={{ color: 'var(--accent-warning)' }}>■</span> In Service ({stats.inService})</span>
            <span><span style={{ color: 'var(--accent-danger)' }}>■</span> Breakdown ({stats.breakdown})</span>
          </div>
        </div>
      )}

      {/* Alerts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>

        {/* Insurance Alerts */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: `3px solid var(--accent-danger)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={16} strokeWidth={2} color="var(--accent-danger)" /> Insurance Expiry Alarms
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Vehicles expiring within 30 days</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              {showTechnicalControls && <span className="aws-badge" style={{ fontSize: '0.65rem', color: '#ec4899', background: 'rgba(236,72,153,0.1)', borderColor: 'rgba(236,72,153,0.2)' }}>EventBridge → Lambda → SNS</span>}
              {insuranceAlerts.length > 0 && (
                <span aria-live="polite" style={{ fontSize: '0.72rem', color: 'var(--accent-danger)', fontWeight: 700 }}>{insuranceAlerts.length} ALARM{insuranceAlerts.length > 1 ? 'S' : ''}</span>
              )}
            </div>
          </div>
          {insuranceAlerts.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CheckCircle size={15} strokeWidth={2} color="var(--accent-success)" /> All vehicle insurance policies are valid
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {insuranceAlerts.map(v => (
                <div key={v.id} className="alert-card danger" style={{ fontSize: '0.85rem' }}>
                  <div>
                    <strong>{v.brand} {v.model}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.78rem' }}>({v.vehicleNumber})</span><br/>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Expires: <strong>{v.insuranceExpiry}</strong></span>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.3)',
                  }}>ALARM</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service Due Alerts */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: `3px solid var(--accent-warning)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={16} strokeWidth={2} color="var(--accent-warning)" /> Service Overdue Alarms
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mileage threshold exceeded</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              {showTechnicalControls && <span className="aws-badge" style={{ fontSize: '0.65rem', color: '#ec4899', background: 'rgba(236,72,153,0.1)', borderColor: 'rgba(236,72,153,0.2)' }}>EventBridge → Lambda → SNS</span>}
              {serviceAlerts.length > 0 && (
                <span aria-live="polite" style={{ fontSize: '0.72rem', color: 'var(--accent-warning)', fontWeight: 700 }}>{serviceAlerts.length} ALARM{serviceAlerts.length > 1 ? 'S' : ''}</span>
              )}
            </div>
          </div>
          {serviceAlerts.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CheckCircle size={15} strokeWidth={2} color="var(--accent-success)" /> No vehicles are currently due for routine service
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {serviceAlerts.map(v => {
                const pct = Math.min(100, Math.round(((v.currentMileage ?? 0) / (v.nextServiceMileage || 1)) * 100));
                return (
                  <div key={v.id} className="alert-card warning" style={{ fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{v.brand} {v.model}</strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.78rem' }}>({v.vehicleNumber})</span>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                        background: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)', border: '1px solid rgba(245,158,11,0.3)',
                      }}>ALARM</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {(v.currentMileage ?? 0).toLocaleString()} km / {(v.nextServiceMileage ?? 0).toLocaleString()} km threshold
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--accent-danger)' : 'var(--accent-warning)', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
