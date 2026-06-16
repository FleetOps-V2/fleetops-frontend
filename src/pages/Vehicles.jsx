import React, { useState, useEffect, useContext } from 'react';
import { vehicleAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import VehicleCard from '../components/VehicleCard';
import VehicleSkeleton from '../components/VehicleSkeleton';
import { useNavigate } from 'react-router-dom';
import { logAudit } from '../utils/AuditLogger';
import { Zap, Database, Trash2, Truck } from 'lucide-react';

const Vehicles = () => {
  const { state } = useContext(AppContext);
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  // Bug 3 Fix: Redis starts COLD (cache miss) on first load.
  // Only becomes a hit after the first successful RDS query warms ElastiCache.
  const [cacheHit, setCacheHit] = useState(false);
  const [fetchTime, setFetchTime] = useState(0);
  const [flushingCache, setFlushingCache] = useState(false);
  const loadCount = React.useRef(0);

  const loadVehicles = async (forceMiss = false) => {
    setLoading(true);
    setLoadError('');
    const startTime = performance.now();
    try {
      const res = await vehicleAPI.getVehicles();
      if (!Array.isArray(res.data)) {
        setVehicles([]);
        setLoadError('Unexpected API response while loading vehicles. Please refresh or re-login.');
        return;
      }
      setVehicles(res.data);
      
      const endTime = performance.now();
      const elapsed = Math.round(endTime - startTime);
      setFetchTime(elapsed);
      
      if (forceMiss) {
        // Explicit flush — cache was evicted, next read is from RDS
        setCacheHit(false);
      } else if (loadCount.current === 0) {
        // Cold start — cache is empty, this IS the RDS query that warms it
        setCacheHit(false);
      } else {
        // Subsequent reads — ElastiCache serves from memory
        setCacheHit(true);
      }
      loadCount.current += 1;
    } catch (err) {
      console.error("Failed to load vehicles", err);
      setVehicles([]);
      setLoadError(err.response?.data || err.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleRequestService = (vehicle) => {
    navigate('/requests', { state: { createForVehicle: vehicle } });
  };

  const handleFlushCache = () => {
    setFlushingCache(true);
    // Log CloudTrail event
    logAudit(state.username || 'anonymous', 'CacheEvict', 'ElastiCache:vehicles', 'Flushed Redis key cache entries for vehicles list');
    
    setTimeout(() => {
      setFlushingCache(false);
      loadVehicles(true); // force cache miss representation
    }, 800);
  };

  const isAdmin = state.role === 'ADMIN' || state.role === 'ROLE_ADMIN';
  const showCacheMonitor = isAdmin;

  return (
    <div className="container">
      {/* Distributed Cache Monitor Panel */}
      {showCacheMonitor && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Distributed Cache Monitor</h3>
              <span className="aws-badge" style={{ fontSize: '0.65rem' }}>In-Memory Cache</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Query response time: <strong style={{ color: 'var(--text-primary)' }}>{fetchTime} ms</strong>. 
              Backend Cache Config: <code style={{ color: 'var(--accent-purple)', fontSize: '0.75rem' }}>@Cacheable("vehicles")</code> key: <code style={{ color: 'var(--accent-purple)', fontSize: '0.75rem' }}>'all'</code>.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {cacheHit ? (
              <span className="cache-pill cache-hit" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={12} strokeWidth={2.5} /> Cache Hit (In-Memory)
              </span>
            ) : (
              <span className="cache-pill cache-miss" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Database size={12} strokeWidth={2} /> Cache Miss (Database Query)
              </span>
            )}

            <button 
              className="btn-secondary btn-sm" 
              onClick={handleFlushCache} 
              disabled={flushingCache || loading}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Trash2 size={13} strokeWidth={2} />
              {flushingCache ? 'Flushing Cache...' : 'Flush Cache'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Fleet Vehicles</h2>
      </div>
      
      {loadError && (
        <div className="glass-panel" style={{ marginBottom: '1rem', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '0.75rem' }}>
          {loadError}
        </div>
      )}

      <div className="grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <VehicleSkeleton key={i} />)
        ) : vehicles.length > 0 ? (
          vehicles.map(v => (
            <VehicleCard key={v.id} vehicle={v} onRequestService={() => handleRequestService(v)} />
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Truck size={48} strokeWidth={1.5} color="var(--text-muted)" />
            </div>
            <h3>No vehicles found</h3>
            <p>Ensure the database is seeded and microservices are running.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Vehicles;
