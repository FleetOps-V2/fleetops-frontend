import React, { useState, useEffect } from 'react';
import { vehicleAPI } from '../services/api';
import VehicleCard from '../components/VehicleCard';
import VehicleSkeleton from '../components/VehicleSkeleton';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';

const Vehicles = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadVehicles = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await vehicleAPI.getVehicles();
      if (!Array.isArray(res.data)) {
        setVehicles([]);
        setLoadError('Unexpected API response while loading vehicles. Please refresh or re-login.');
        return;
      }
      setVehicles(res.data);
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

  return (
    <div className="container">
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
