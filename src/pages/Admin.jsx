import React, { useState, useEffect, useCallback, useContext } from 'react';
import { vehicleAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import { logAudit } from '../utils/AuditLogger';
import { pushNotification } from '../components/NotificationCenter';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, Search, Pencil, Trash2, X, Loader, CheckCircle, Wrench, AlertTriangle, Archive } from 'lucide-react';

const STATUS_CONFIG = {
  ACTIVE:     { color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.12)',  label: 'Active' },
  IN_SERVICE: { color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.12)', label: 'In Service' },
  BREAKDOWN:  { color: 'var(--accent-danger)',  bg: 'rgba(239,68,68,0.12)',   label: 'Breakdown' },
  RETIRED:    { color: 'var(--text-muted)',      bg: 'rgba(255,255,255,0.06)', label: 'Retired' },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.RETIRED;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      letterSpacing: '0.04em',
    }}>{cfg.label.toUpperCase()}</span>
  );
};

const Admin = () => {
  const { state } = useContext(AppContext);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    vehicleNumber: '', brand: '', model: '', type: 'SUV',
    status: 'ACTIVE', currentMileage: 0, assignedDriverId: ''
  });
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (search.trim()) params.search = search;
      if (statusFilter.trim()) params.status = statusFilter;
      const res = await vehicleAPI.getVehicles(params);
      if (!Array.isArray(res.data)) {
        setVehicles([]);
        setLoadError('Unexpected API response. Please refresh or re-login.');
        return;
      }
      setVehicles(res.data);
    } catch (err) {
      setVehicles([]);
      setLoadError(err.response?.data || err.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchVehicles(), 500);
    return () => clearTimeout(t);
  }, [search, statusFilter, fetchVehicles]);

  const triggerDelete = (id) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const confirmDeleteAction = async () => {
    const id = confirmDelete.id;
    const vehicle = vehicles.find(v => v.id === id);
    setConfirmDelete({ isOpen: false, id: null });
    if (!vehicle) return;

    try {
      setActionLoading(`delete-${id}`);
      await vehicleAPI.deleteVehicle(id);
      setVehicles(vehicles.filter(v => v.id !== id));
      logAudit(state.username, 'DeleteVehicle', vehicle?.vehicleNumber || `Vehicle#${id}`,
        `Retired ${vehicle?.brand} ${vehicle?.model} from the fleet registry`);
      pushNotification('success', 'Vehicle Retired', `${vehicle.vehicleNumber} has been removed.`);
    } catch {
      pushNotification('danger', 'Retire Failed', 'Failed to retire vehicle.');
    } finally { 
      setActionLoading(null); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading('save');
      if (editingVehicle) {
        await vehicleAPI.updateVehicle(editingVehicle.id, formData);
        logAudit(state.username, 'UpdateVehicle', formData.vehicleNumber || `Vehicle#${editingVehicle.id}`,
          `Updated: status=${formData.status}, mileage=${formData.currentMileage}, driver=${formData.assignedDriverId}`);
      } else {
        await vehicleAPI.createVehicle(formData);
        logAudit(state.username, 'CreateVehicle', formData.vehicleNumber,
          `Registered new ${formData.brand} ${formData.model} (${formData.type})`);
      }
      setIsModalOpen(false);
      fetchVehicles();
      pushNotification('success', 'Vehicle Saved', `Vehicle ${formData.vehicleNumber} saved successfully.`);
    } catch { 
      pushNotification('danger', 'Save Failed', 'Failed to save vehicle.');
    } finally { 
      setActionLoading(null); 
    }
  };

  const openEditModal = (v) => { setEditingVehicle(v); setFormData(v); setIsModalOpen(true); };
  const openCreateModal = () => {
    setEditingVehicle(null);
    setFormData({ vehicleNumber: '', brand: '', model: '', type: 'SUV', status: 'ACTIVE', currentMileage: 0, assignedDriverId: '' });
    setIsModalOpen(true);
  };

  // Local filtering on top of server filtering (for demo)
  const displayed = vehicles.filter(v =>
    !search.trim() || v.vehicleNumber?.toLowerCase().includes(search.toLowerCase()) ||
    v.brand?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.assignedDriverId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container" style={{ paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>Fleet Administration</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            All mutations are logged to{' '}
            <span className="aws-badge" style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}>CloudTrail</span>
            {' '}→ visible in Operations Center
          </p>
        </div>
        <button className="btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} strokeWidth={2.5} /> Register Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} strokeWidth={2} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search plate, brand, model, driver..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2rem' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: '160px' }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="IN_SERVICE">In Service</option>
          <option value="BREAKDOWN">Breakdown</option>
          <option value="RETIRED">Retired</option>
        </select>
        {(search || statusFilter) && (
          <button className="btn-secondary btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {displayed.length} vehicle{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loadError && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--accent-danger)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} strokeWidth={2} /> {loadError}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <Loader size={24} strokeWidth={2.5} className="spin-icon" color="var(--accent-primary)" />
            </div>
            Loading fleet registry...
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Archive size={40} strokeWidth={1.5} color="var(--text-muted)" />
            </div>
            <h3 style={{ color: 'var(--text-primary)' }}>No vehicles found</h3>
            <p style={{ fontSize: '0.875rem' }}>Try clearing your filters or register a new vehicle.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
                {['Plate Number', 'Make & Model', 'Type', 'Status', 'Mileage', 'Driver', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{v.vehicleNumber}</span>
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontWeight: 600 }}>{v.brand}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{v.model}</div>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>{v.type}</td>
                  <td style={{ padding: '0.9rem 1rem' }}><StatusPill status={v.status} /></td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {(v.currentMileage ?? 0).toLocaleString()} km
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {v.assignedDriverId || <span style={{ fontStyle: 'italic' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEditModal(v)}
                        style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.22)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                      ><Pencil size={13} strokeWidth={2} /> Edit</button>
                      <button
                        onClick={() => triggerDelete(v.id)}
                        disabled={actionLoading === `delete-${v.id}`}
                        style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: actionLoading === `delete-${v.id}` ? 0.5 : 1, transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
                      >{actionLoading === `delete-${v.id}` ? <Loader size={13} strokeWidth={2} /> : <Trash2 size={13} strokeWidth={2} />} Retire</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, marginBottom: '0.2rem' }}>{editingVehicle ? 'Edit Vehicle' : 'Register Vehicle'}</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  This action will be logged to{' '}
                  <span className="aws-badge" style={{ fontSize: '0.62rem', verticalAlign: 'middle' }}>CloudTrail</span>
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} strokeWidth={2} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plate Number *</label>
                  <input type="text" required placeholder="KL07AB1234" value={formData.vehicleNumber} onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vehicle Type *</label>
                  <select required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={{ width: '100%' }}>
                    {['Sedan', 'SUV', 'Hatchback', 'Van', 'Mini Truck', 'Heavy Truck', 'Bus'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand *</label>
                  <input type="text" required placeholder="Toyota" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model *</label>
                  <input type="text" required placeholder="Innova Crysta" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%' }}>
                    <option value="ACTIVE">Active</option>
                    <option value="IN_SERVICE">In Service</option>
                    <option value="BREAKDOWN">Breakdown</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mileage (km)</label>
                  <input type="number" min="0" value={formData.currentMileage} onChange={e => setFormData({ ...formData, currentMileage: e.target.value })} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Driver Username</label>
                <input type="text" placeholder="e.g. driver1" value={formData.assignedDriverId || ''} onChange={e => setFormData({ ...formData, assignedDriverId: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" disabled={actionLoading === 'save'} style={{ flex: 1, opacity: actionLoading === 'save' ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  {actionLoading === 'save' ? <><Loader size={14} strokeWidth={2} /> Saving...</> : (editingVehicle ? <><CheckCircle size={14} strokeWidth={2} /> Save Changes</> : <><Plus size={14} strokeWidth={2.5} /> Register</>)}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Retire Vehicle"
        message={`Retire vehicle ${vehicles.find(v => v.id === confirmDelete.id)?.vehicleNumber || confirmDelete.id}? This action is logged to CloudTrail.`}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
        confirmText="Retire"
      />
    </div>
  );
};

export default Admin;
