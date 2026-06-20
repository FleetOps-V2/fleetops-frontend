import React, { useEffect, useState, useContext } from 'react';
import { requestAPI, vehicleAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { logAudit } from '../utils/AuditLogger';
import { pushNotification } from '../components/NotificationCenter';
import { Truck, HardHat } from 'lucide-react';

const extractError = (err, fallback) => {
  const data = err.response?.data;
  return (typeof data === 'string' ? data : data?.message || data?.error || null)
    || err.message || fallback;
};

const StepFunctionsTimeline = ({ currentStatus, executionArn }) => {
  const steps = ['OPEN', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
  const currentIndex = steps.indexOf(currentStatus);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1.25rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>AWS Step Functions State Machine Execution</span>
        <span className="aws-badge" style={{ fontSize: '0.62rem', background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
          title={executionArn || `fleetops-workflow-${currentStatus.toLowerCase()}`}>
          {executionArn ? executionArn.split(':').slice(-1)[0] : `fleetops-workflow-${currentStatus.toLowerCase()}`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', width: '100%', padding: '0 10px' }}>
        {/* Connecting line */}
        <div style={{ position: 'absolute', top: '10px', left: '20px', right: '20px', height: '2px', background: 'var(--glass-border)', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '10px', left: '20px', width: `${(Math.max(0, currentIndex) / (steps.length - 1)) * 96}%`, height: '2px', background: 'var(--accent-primary)', zIndex: 2, transition: 'width 0.4s ease' }} />

        {steps.map((step, idx) => {
          const isPassed = idx < currentIndex;
          const isActive = idx === currentIndex;

          let stepColor = 'var(--text-muted)';
          let circleBg = 'var(--bg-elevated)';
          let borderStyle = '1px solid var(--glass-border)';

          if (isPassed) {
            stepColor = 'var(--accent-primary)';
            circleBg = 'var(--accent-primary)';
            borderStyle = '1px solid var(--accent-primary)';
          } else if (isActive) {
            stepColor = 'var(--accent-success)';
            circleBg = 'var(--bg-elevated)';
            borderStyle = '2px solid var(--accent-success)';
          }

          return (
            <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, position: 'relative' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: circleBg, border: borderStyle,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isActive ? '0 0 8px var(--accent-success)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                {isPassed && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                {isActive && <div className="pulse-dot pulse-green" style={{ width: '6px', height: '6px' }} />}
              </div>
              <span style={{ fontSize: '0.62rem', color: stepColor, marginTop: '4px', fontWeight: isActive ? 700 : 500, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                {step.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Requests = () => {
  const { state: appContextState } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehiclesMap, setVehiclesMap] = useState({});
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [assignModal, setAssignModal] = useState({ open: false, requestId: null, technician: '' });
  const [completeModal, setCompleteModal] = useState({ open: false, requestId: null, resolutionNotes: '', downtimeHours: '' });

  useEffect(() => {
    const handleInitialState = async () => {
      if (location.state?.createForVehicle) {
        try {
          const v = location.state.createForVehicle;
          await requestAPI.createRequest({
            vehicleId: v.id,
            vehicleNumber: v.vehicleNumber,
            requestType: v.status === 'BREAKDOWN' ? 'BREAKDOWN' : 'ROUTINE_SERVICE',
            priority: v.status === 'BREAKDOWN' ? 'CRITICAL' : 'MEDIUM',
            description: 'Automated service request'
          });
          // Clear history state so refresh doesn't trigger it again
          navigate(location.pathname, { replace: true, state: {} });
        } catch (e) {
          pushNotification('danger', 'Request Failed', 'Failed to create request: ' + extractError(e, 'unknown error'));
        }
      }

      if (location.state?.source === 'queue') {
        const items = Array.isArray(location.state.items) ? location.state.items : [];
        if (items.length > 0) {
          let failures = 0;
          for (const item of items) {
            try {
              await requestAPI.createRequest({
                vehicleId: item.vehicleId,
                vehicleNumber: item.vehicleNumber || '',
                requestType: item.requestType || 'ROUTINE_SERVICE',
                description: item.notes || 'Created from pending task queue'
              });
            } catch (e) {
              failures += 1;
              console.error('Failed to create request from queue item', item, e);
            }
          }
          if (failures > 0) {
            pushNotification('warning', 'Partial Success', `${failures} queue item(s) failed to formalize into requests.`);
          }
        }
        window.history.replaceState({}, document.title);
        navigate(location.pathname, { replace: true, state: {} });
      }

      loadRequests();
    };

    handleInitialState();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [reqsRes, vRes] = await Promise.all([
        requestAPI.getRequests(),
        vehicleAPI.getVehicles() // In real app, only fetch needed
      ]);

      const requestList = Array.isArray(reqsRes.data) ? reqsRes.data : [];
      const vehicleList = Array.isArray(vRes.data) ? vRes.data : [];

      if (!Array.isArray(reqsRes.data) || !Array.isArray(vRes.data)) {
        setLoadError('Unexpected API response while loading requests. Please refresh or re-login.');
      }

      const vMap = {};
      vehicleList.forEach(v => vMap[v.id] = v);
      setVehiclesMap(vMap);
      setRequests(requestList);
    } catch (err) {
      console.error("Failed to load requests", err);
      setLoadError(err.response?.data || err.message || 'Failed to load requests');
      setRequests([]);
      setVehiclesMap({});
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    OPEN: 'var(--text-primary)',
    PENDING_APPROVAL: 'var(--accent-warning)',
    APPROVED: 'var(--accent-success)',
    ASSIGNED: 'var(--accent-info)',
    IN_PROGRESS: 'var(--accent-warning)',
    COMPLETED: 'var(--accent-success)',
    REJECTED: 'var(--accent-danger)',
  };

  const isManagerOrAdmin = ['MANAGER', 'ROLE_MANAGER', 'ADMIN', 'ROLE_ADMIN'].includes(appContextState.role);

  const handleStatusUpdate = async (id, status) => {
    const req = requests.find(r => r.id === id);
    try {
      setActionLoading(`${id}:${status}`);
      await requestAPI.updateStatus(id, status);
      // CloudTrail: log every state machine transition
      logAudit(
        appContextState.username,
        `UpdateRequestStatus`,
        `Request #${id} (${req?.vehicleNumber || req?.vehicleId})`,
        `Status transition: ${req?.status} → ${status}`
      );
      await loadRequests();
      pushNotification('success', 'Status Updated', 'Request status updated successfully.');
    } catch (err) {
      pushNotification('danger', 'Update Failed', extractError(err, 'Failed to update status'));
    } finally {
      setActionLoading('');
    }
  };

  const handleAssign = async (id, technician) => {
    if (!technician?.trim()) {
      pushNotification('warning', 'Missing Input', 'Technician username is required');
      return;
    }
    try {
      setActionLoading(`${id}:ASSIGN`);
      await requestAPI.assignTechnician(id, technician.trim());
      // CloudTrail: log technician assignment
      logAudit(
        appContextState.username,
        'AssignTechnician',
        `Request #${id}`,
        `Assigned technician: ${technician.trim()}`
      );
      await loadRequests();
      setAssignModal({ open: false, requestId: null, technician: '' });
      pushNotification('success', 'Technician Assigned', 'Technician has been assigned to the request.');
    } catch (err) {
      pushNotification('danger', 'Assignment Failed', extractError(err, 'Failed to assign technician'));
    } finally {
      setActionLoading('');
    }
  };

  const handleComplete = async (id, resolutionNotes, downtimeHoursInput) => {
    const downtimeHours = downtimeHoursInput === '' ? null : Number(downtimeHoursInput);
    if (downtimeHoursInput !== '' && Number.isNaN(downtimeHours)) {
      pushNotification('warning', 'Invalid Input', 'Downtime hours must be a number');
      return;
    }
    try {
      setActionLoading(`${id}:COMPLETE`);
      await requestAPI.completeRequest(id, { resolutionNotes, downtimeHours });
      // CloudTrail: log request completion
      logAudit(
        appContextState.username,
        'CompleteRequest',
        `Request #${id}`,
        `Resolution: "${resolutionNotes}". Downtime: ${downtimeHours ?? 0}h`
      );
      await loadRequests();
      setCompleteModal({ open: false, requestId: null, resolutionNotes: '', downtimeHours: '' });
      pushNotification('success', 'Request Completed', 'The service request has been marked as completed.');
    } catch (err) {
      pushNotification('danger', 'Completion Failed', extractError(err, 'Failed to complete request'));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="container" style={{ paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>Service Requests</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            State machine: OPEN → PENDING_APPROVAL → ASSIGNED → IN_PROGRESS → COMPLETED
          </p>
        </div>
        <span className="aws-badge" style={{ fontSize: '0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>Audit Logged</span>
      </div>
      {loadError && (
        <div className="glass-panel" style={{ marginBottom: '1rem', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '0.75rem' }}>
          {loadError}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
          <h3 style={{ color: 'var(--text-primary)' }}>No requests found</h3>
          <p style={{ fontSize: '0.875rem' }}>Service requests will appear here once submitted.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {requests.map(req => {
            const v = vehiclesMap[req.vehicleId];
            const priorityColor = req.priority === 'CRITICAL' ? 'var(--accent-danger)' : req.priority === 'HIGH' ? '#f97316' : req.priority === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--text-muted)';
            return (
              <div key={req.id} className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderLeft: `3px solid ${statusColors[req.status] || 'var(--glass-border)'}` }}>

                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>Request #{req.id}</h3>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>{req.requestType}</span>
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, background: `${priorityColor}18`, border: `1px solid ${priorityColor}40`, color: priorityColor }}>{req.priority}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Created: {req.createdAt ? new Date(req.createdAt).toLocaleString('en-IN') : 'N/A'}
                      {req.requestedBy && <span style={{ marginLeft: '0.75rem' }}>by <strong style={{ color: 'var(--text-secondary)' }}>{req.requestedBy}</strong></span>}
                    </p>
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: '14px', fontSize: '0.72rem', fontWeight: 700,
                    background: `${statusColors[req.status] || 'rgba(255,255,255,0.1)'}20`,
                    color: statusColors[req.status] || 'var(--text-primary)',
                    border: `1px solid ${statusColors[req.status] || 'var(--glass-border)'}40`,
                    whiteSpace: 'nowrap',
                  }}>{req.status}</span>
                </div>
                
                {/* Body details */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Truck size={14} strokeWidth={2} style={{ flexShrink: 0 }} /><strong>{v ? `${v.brand} ${v.model}` : req.vehicleNumber}</strong>{v && <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({v.vehicleNumber})</span>}</span>
                  {req.assignedTechnician && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><HardHat size={14} strokeWidth={2} style={{ flexShrink: 0 }} />Tech: <strong style={{ color: 'var(--accent-info)' }}>{req.assignedTechnician}</strong></span>}
                </div>
                {req.description && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.875rem', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', borderLeft: '2px solid var(--glass-border)' }}>
                    {req.description}
                  </div>
                )}
                <StepFunctionsTimeline currentStatus={req.status} executionArn={req.stepFunctionsExecutionArn} />
                {isManagerOrAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    {req.status === 'OPEN' && (
                      <button className="btn-secondary" disabled={actionLoading === `${req.id}:PENDING_APPROVAL`} onClick={() => handleStatusUpdate(req.id, 'PENDING_APPROVAL')}>
                        {actionLoading === `${req.id}:PENDING_APPROVAL` ? 'Moving...' : 'Move to Pending Approval'}
                      </button>
                    )}
                    {req.status === 'PENDING_APPROVAL' && (
                      <>
                        <button className="btn-primary" disabled={actionLoading === `${req.id}:APPROVED`} onClick={() => handleStatusUpdate(req.id, 'APPROVED')}>
                          {actionLoading === `${req.id}:APPROVED` ? 'Approving...' : 'Approve'}
                        </button>
                        <button className="btn-secondary" disabled={actionLoading === `${req.id}:REJECTED`} onClick={() => handleStatusUpdate(req.id, 'REJECTED')}>
                          {actionLoading === `${req.id}:REJECTED` ? 'Rejecting...' : 'Reject'}
                        </button>
                      </>
                    )}
                    {req.status === 'APPROVED' && (
                      <button className="btn-primary" disabled={actionLoading === `${req.id}:ASSIGN`}
                        onClick={() => setAssignModal({ open: true, requestId: req.id, technician: req.assignedTechnician || '' })}>
                        Assign Technician
                      </button>
                    )}
                    {req.status === 'ASSIGNED' && (
                      <button className="btn-primary" disabled={actionLoading === `${req.id}:IN_PROGRESS`} onClick={() => handleStatusUpdate(req.id, 'IN_PROGRESS')}>
                        {actionLoading === `${req.id}:IN_PROGRESS` ? 'Starting...' : 'Start Work'}
                      </button>
                    )}
                    {req.status === 'IN_PROGRESS' && (
                      <button className="btn-primary" disabled={actionLoading === `${req.id}:COMPLETE`}
                        onClick={() => setCompleteModal({ open: true, requestId: req.id, resolutionNotes: req.resolutionNotes || '', downtimeHours: req.downtimeHours ?? '' })}>
                        Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Assign Technician</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Technician Username</label>
            <input
              type="text"
              value={assignModal.technician}
              onChange={(e) => setAssignModal((prev) => ({ ...prev, technician: e.target.value }))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setAssignModal({ open: false, requestId: null, technician: '' })}>Cancel</button>
              <button
                className="btn-primary"
                disabled={actionLoading === `${assignModal.requestId}:ASSIGN`}
                onClick={() => handleAssign(assignModal.requestId, assignModal.technician)}
              >
                {actionLoading === `${assignModal.requestId}:ASSIGN` ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {completeModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Complete Request</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Resolution Notes</label>
            <textarea
              rows={4}
              value={completeModal.resolutionNotes}
              onChange={(e) => setCompleteModal((prev) => ({ ...prev, resolutionNotes: e.target.value }))}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <label style={{ display: 'block', marginTop: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Downtime Hours (optional)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={completeModal.downtimeHours}
              onChange={(e) => setCompleteModal((prev) => ({ ...prev, downtimeHours: e.target.value }))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setCompleteModal({ open: false, requestId: null, resolutionNotes: '', downtimeHours: '' })}>Cancel</button>
              <button
                className="btn-primary"
                disabled={actionLoading === `${completeModal.requestId}:COMPLETE`}
                onClick={() => handleComplete(completeModal.requestId, completeModal.resolutionNotes, completeModal.downtimeHours)}
              >
                {actionLoading === `${completeModal.requestId}:COMPLETE` ? 'Completing...' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Requests;
