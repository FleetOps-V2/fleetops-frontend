import React, { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Navigation, Play, Radio, Database, ShieldAlert } from 'lucide-react';
import { logAudit } from '../utils/AuditLogger';
import { pushNotification } from '../components/NotificationCenter';
import { trackingAPI } from '../services/api';

/**
 * GPS Simulator seed — defines the vehicles that the simulator will animate.
 * These match real vehicles in the database (by vehicleId + vehicleNumber).
 *
 * Phase 5 Note:
 *   In Phase 5, this simulator is replaced by real IoT GPS devices or a
 *   dedicated simulator Lambda function. The backend API (/api/tracking/ping)
 *   and the polling logic (getLivePositions) do NOT change.
 */
const SIMULATOR_VEHICLES = [
  { vehicleId: 1, vehicleNumber: 'KL07AB1234', driverName: 'Rajesh Kumar',   route: 'Chennai → Bangalore', baseCoords: { lat: 12.9716, lng: 77.5946 }, baseSpeed: 65 },
  { vehicleId: 2, vehicleNumber: 'KL08CD5678', driverName: 'Sandeep Varma',  route: 'Mumbai → Pune',        baseCoords: { lat: 18.5204, lng: 73.8567 }, baseSpeed: 0  },
  { vehicleId: 3, vehicleNumber: 'KL09EF4321', driverName: 'Manpreet Singh', route: 'Delhi → Jaipur',       baseCoords: { lat: 26.9124, lng: 75.7873 }, baseSpeed: 82 },
];

const POLL_INTERVAL_MS  = 3000;  // How often the frontend fetches latest positions
const PING_INTERVAL_MS  = 4000;  // How often the simulator sends a new ping to backend

const Tracking = () => {
  const { state } = useContext(AppContext);
  const [vehicles, setVehicles]           = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isSimulating, setIsSimulating]   = useState(true);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [queueCount, setQueueCount]       = useState(0);
  const [loading, setLoading]             = useState(true);
  const [pollingError, setPollingError]   = useState(null);
  const timeRef = useRef(0);

  // ─── GPS Simulator: posts real pings to /api/tracking/ping ──────────────────
  useEffect(() => {
    if (!isSimulating) return;

    const pingInterval = setInterval(async () => {
      timeRef.current += 1;
      const t = timeRef.current;

      for (const sim of SIMULATOR_VEHICLES) {
        // Animate coordinates in an elliptical orbit around the base point
        const angle     = (t * 0.08 + sim.vehicleId * 2.1) % (2 * Math.PI);
        const latitude  = sim.baseCoords.lat + Math.sin(angle) * 0.04;
        const longitude = sim.baseCoords.lng + Math.cos(angle) * 0.05;

        // Vary speed slightly each tick
        const speedDelta = Math.floor(Math.random() * 9) - 4;
        const speed      = sim.baseSpeed === 0 ? 0 : Math.max(45, Math.min(110, sim.baseSpeed + speedDelta));
        const engineTemp = 78 + Math.floor(Math.random() * 18);

        const payload = {
          vehicleId:          sim.vehicleId,
          vehicleNumber:      sim.vehicleNumber,
          driverName:         sim.driverName,
          latitude:           parseFloat(latitude.toFixed(6)),
          longitude:          parseFloat(longitude.toFixed(6)),
          speed,
          engineTemp,
          routeDescription:   sim.route,
        };

        try {
          await trackingAPI.ping(payload);

          const msgId = `msg-${Math.random().toString(16).substr(2, 8)}`;
          setTelemetryLogs(prev => [
            {
              timestamp: new Date().toLocaleTimeString(),
              msgId,
              latency: `${28 + Math.floor(Math.random() * 20)}ms`,
              size: '274 bytes',
              text: `Ping stored: ${sim.vehicleNumber} — Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}, Speed: ${speed} km/h`,
            },
            ...prev.slice(0, 19)
          ]);

          setQueueCount(c => Math.min(10, c + 1));
          setTimeout(() => setQueueCount(c => Math.max(0, c - 1)), 1200);

        } catch {
          // Silently skip failed pings — network may be briefly unavailable
        }
      }
    }, PING_INTERVAL_MS);

    return () => clearInterval(pingInterval);
  }, [isSimulating]);

  // ─── Live Position Polling: reads from /api/tracking/live ───────────────────
  useEffect(() => {
    let isMounted = true;
    let pollTimeout;

    const poll = async () => {
      try {
        const res = await trackingAPI.getLive();
        const data = Array.isArray(res.data) ? res.data : [];
        if (!isMounted) return;
        
        setVehicles(data);
        setPollingError(null);
        
        setSelectedVehicle(prev => {
          if (data.length > 0 && !prev) return data[0];
          if (prev) {
            const updated = data.find(v => v.vehicleId === prev.vehicleId);
            return updated || prev;
          }
          return prev;
        });
      } catch (err) {
        if (!isMounted) return;
        setPollingError('Live feed disconnected. Retrying...');
      } finally {
        if (isMounted) {
          setLoading(false);
          pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();
    return () => {
      isMounted = false;
      clearTimeout(pollTimeout);
    };
  }, []);

  const handleManualPing = async () => {
    if (!selectedVehicle) return;
    const sim = SIMULATOR_VEHICLES.find(s => s.vehicleId === selectedVehicle.vehicleId);
    if (!sim) return;

    logAudit(state.username, 'SendMessage', `tracking/ping/${selectedVehicle.vehicleNumber}`,
      `Manual telemetry trigger for vehicle ${selectedVehicle.vehicleNumber}`);

    const payload = {
      vehicleId:     selectedVehicle.vehicleId,
      vehicleNumber: selectedVehicle.vehicleNumber,
      driverName:    selectedVehicle.driverName,
      latitude:      selectedVehicle.latitude,
      longitude:     selectedVehicle.longitude,
      speed:         selectedVehicle.speed,
      engineTemp:    selectedVehicle.engineTemp,
      routeDescription: sim.route,
    };

    try {
      await trackingAPI.ping(payload);
      pushNotification('success', 'Telemetry Sent', `Manual ping stored for ${selectedVehicle.vehicleNumber}.`, 'Tracking API');
    } catch {
      pushNotification('danger', 'Ping Failed', `Could not send manual ping for ${selectedVehicle.vehicleNumber}.`, 'Tracking API');
    }
  };

  // Map coordinate normalizer — converts lat/lng to % position within the canvas
  const toMapPos = (lat, lng) => ({
    x: Math.max(4, Math.min(96, ((lng - 70) / 20) * 100)),
    y: Math.max(4, Math.min(96, 100 - ((lat - 8) / 22) * 100)),
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'SPEEDING':  return 'var(--accent-danger)';
      case 'EN_ROUTE':  return 'var(--accent-success)';
      case 'BREAKDOWN': return '#f97316';
      default:          return 'var(--text-muted)';
    }
  };

  return (
    <div className="container">
      {/* Infrastructure Pipeline Header */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Telemetry Ingestion Pipeline</h3>
            <span className="aws-badge" style={{ fontSize: '0.65rem' }}>Real Backend</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            GPS Simulator → <code style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>POST /api/tracking/ping</code>
            &nbsp;→ PostgreSQL&nbsp;→&nbsp;
            <code style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>GET /api/tracking/live</code>
            &nbsp;→ UI
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Phase 5: SQS FIFO → Lambda → DynamoDB (same API contract, backend only changes)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {pollingError && (
            <span className="aws-badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <ShieldAlert size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
              {pollingError}
            </span>
          )}
          <span className="aws-badge" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16,185,129,0.2)' }}>
            Polling every {POLL_INTERVAL_MS / 1000}s
          </span>
        </div>
      </div>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Real-Time GPS Telemetry</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            GPS simulator posting live pings to backend. Positions fetched every {POLL_INTERVAL_MS / 1000}s.
          </p>
        </div>
        <button
          className={`btn-${isSimulating ? 'secondary' : 'primary'}`}
          onClick={() => setIsSimulating(!isSimulating)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Play size={14} style={{ transform: isSimulating ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          {isSimulating ? 'Pause Simulator' : 'Resume Simulator'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>

        {/* Map + Status Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Map Canvas */}
          <div className="glass-panel" style={{ height: '400px', position: 'relative', overflow: 'hidden', padding: 0 }}>
            {/* Grid background */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--glass-border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.3 }} />
            {/* Road lines */}
            <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
              <path d="M 50,100 Q 250,50 400,200 T 700,300" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <path d="M 100,300 C 300,350 400,100 650,150" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            </svg>

            {/* Vehicle markers — fed from real API data */}
            {vehicles.map(v => {
              const pos = toMapPos(v.latitude, v.longitude);
              const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
              return (
                <div
                  key={v.vehicleId}
                  onClick={() => setSelectedVehicle(v)}
                  style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', cursor: 'pointer', zIndex: isSelected ? 10 : 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <div style={{ background: isSelected ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `2px solid ${getStatusColor(v.status)}`, borderRadius: '50%', padding: '8px', boxShadow: isSelected ? '0 0 15px var(--accent-primary)' : 'none', transition: 'all 0.3s ease' }}>
                    <Navigation size={14} style={{ transform: `rotate(${(v.speed || 0) > 0 ? 45 : 0}deg)`, color: isSelected ? '#fff' : 'var(--text-primary)' }} />
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', color: '#fff', marginTop: '4px', whiteSpace: 'nowrap', border: '1px solid var(--glass-border)' }}>
                    {v.vehicleNumber}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Waiting for first ping...</span>
              </div>
            )}

            {/* HUD */}
            <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(0,0,0,0.8)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="pulse-dot pulse-green" />
                <span>{isSimulating ? 'Simulator Active' : 'Simulator Paused'}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Pending writes: <strong>{queueCount} pings</strong>
              </div>
            </div>
          </div>

          {/* Selected Vehicle Detail */}
          {selectedVehicle && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Radio size={16} color="var(--accent-primary)" /> {selectedVehicle.vehicleNumber}
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: `${getStatusColor(selectedVehicle.status)}22`, color: getStatusColor(selectedVehicle.status), border: `1px solid ${getStatusColor(selectedVehicle.status)}44` }}>
                  {selectedVehicle.status}
                </span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Driver',       value: selectedVehicle.driverName || '—' },
                  { label: 'Coordinates',  value: `${selectedVehicle.latitude?.toFixed(4)}N, ${selectedVehicle.longitude?.toFixed(4)}E`, mono: true },
                  { label: 'Speed',        value: `${selectedVehicle.speed ?? 0} km/h`, color: getStatusColor(selectedVehicle.status) },
                  { label: 'Engine Temp',  value: `${selectedVehicle.engineTemp ?? '—'}°C` },
                  { label: 'Route',        value: selectedVehicle.routeDescription || '—' },
                ].map(card => (
                  <div key={card.label} style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.label}</div>
                    <strong style={{ fontSize: '0.88rem', fontFamily: card.mono ? 'monospace' : 'inherit', color: card.color || 'var(--text-primary)' }}>
                      {card.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '1.25rem', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', display: 'block' }}>Send Manual Ping</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POST current position to /api/tracking/ping</span>
                </div>
                <button className="btn-primary" onClick={handleManualPing} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                  Dispatch Ping
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Log Stream */}
        <div className="glass-panel" style={{ height: '610px', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={15} color="var(--accent-purple)" /> Backend Ping Log
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Real writes: vehicle_telemetry table (PostgreSQL → DynamoDB in Phase 5)
            </p>
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {telemetryLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '2rem' }}>
                {isSimulating ? 'Starting simulator...' : 'Simulator paused. Resume to send pings.'}
              </div>
            ) : telemetryLogs.map((log, idx) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '6px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-purple)', marginBottom: '4px' }}>
                  <span>[{log.timestamp}]</span>
                  <span>{log.latency}</span>
                </div>
                <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{log.text}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                  Payload: {log.size} | ID: {log.msgId}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Tracking;
