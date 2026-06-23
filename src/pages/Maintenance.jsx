import React, { useState, useEffect, useContext } from 'react';
import { taskAPI, vehicleAPI, requestAPI, aiAPI, mediaAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { pushNotification } from '../components/NotificationCenter';
import ConfirmModal from '../components/ConfirmModal';
import { logAudit } from '../utils/AuditLogger';
import { ListTodo, PlusCircle, Archive, Bell, CalendarRange, Wrench, HardDrive, Image, Server, Brain } from 'lucide-react';

const extractError = (err, fallback) => {
  const data = err.response?.data;
  return (typeof data === 'string' ? data : data?.message || data?.error || null)
    || err.message || fallback;
};

const Maintenance = () => {
  const { state } = useContext(AppContext);
  const [queue, setQueue] = useState(null);
  const [insuranceAlerts, setInsuranceAlerts] = useState([]);
  const [serviceAlerts, setServiceAlerts] = useState([]);
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Form states for manually adding to driver task queue
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState('ROUTINE_SERVICE');
  const [taskDesc, setTaskDesc] = useState('');

  // AI Fleet Advisor states
  const [fleetAnalysis, setFleetAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [addingToQueue, setAddingToQueue] = useState('');

  // EFS Shared storage states
  const [efsPhotos, setEfsPhotos] = useState([]);
  const [selectedEfsVehicle, setSelectedEfsVehicle] = useState('');
  const [efsNode, setEfsNode] = useState('ec2-us-east-1a-node-01');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [efsFile, setEfsFile] = useState(null);

  const handleEfsUpload = async (e) => {
    e.preventDefault();
    if (!selectedEfsVehicle || !efsFile) return;
    setUploadingPhoto(true);

    const v = vehicles.find(item => item.id.toString() === selectedEfsVehicle) || vehicles[0];

    try {
      const res = await mediaAPI.uploadFile(v.vehicleNumber, efsNode, efsFile);
      const newPhoto = { id: Date.now(), ...res.data };
      setEfsPhotos(prev => [newPhoto, ...prev]);
      setEfsFile(null);

      logAudit(
        state.username,
        'WriteSharedFile',
        `efs://fleetops-shared-filesystem/${res.data.filename}`,
        `Uploaded inspection photo from EC2 node ${efsNode} to shared EFS mount`
      );

      pushNotification(
        'success',
        'EFS Write Complete',
        `${res.data.filename} written to EFS partition — instantly readable across all EC2 target groups.`,
        'AWS EFS'
      );
    } catch (err) {
      pushNotification('danger', 'EFS Upload Failed', extractError(err, 'Failed to write file to EFS partition'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const loadData = async () => {
    try {
      setLoadError('');
      const [queueRes, insRes, svcRes, vRes, catalogRes] = await Promise.all([
        taskAPI.getQueue(),
        vehicleAPI.getInsuranceAlerts(),
        vehicleAPI.getServiceAlerts(),
        vehicleAPI.getVehicles(),
        mediaAPI.getCatalog().catch(() => ({ data: [] })),
      ]);
      setQueue(queueRes.data);
      setInsuranceAlerts(Array.isArray(insRes.data) ? insRes.data : []);
      setServiceAlerts(Array.isArray(svcRes.data) ? svcRes.data : []);
      setEfsPhotos(Array.isArray(catalogRes.data) ? catalogRes.data.map((f, i) => ({ id: i, ...f })) : []);

      const fleet = Array.isArray(vRes.data) ? vRes.data : [];
      setVehicles(fleet);
      if (fleet.length > 0) {
        setSelectedVehicle(fleet[0].id.toString());
        setSelectedEfsVehicle(fleet[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load maintenance center data", err);
      setLoadError(extractError(err, 'Failed to load maintenance data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setSubmitting(true);

    const vehicleId = parseInt(selectedVehicle);
    const vehicle = vehicles.find(v => v.id === vehicleId);

    try {
      const res = await taskAPI.addTask({
        vehicleId,
        taskType: selectedTaskType,
        description: taskDesc || `${selectedTaskType} pending request`
      });
      setQueue(res.data);
      setTaskDesc('');
      
      // Log CloudTrail Event
      logAudit(
        state.username, 
        'PutTask', 
        `Vehicle ${vehicle?.vehicleNumber || vehicleId}`, 
        `Added pending ${selectedTaskType} maintenance task to queue`
      );

      pushNotification(
        'info',
        'Queue Updated',
        `Added pending ${selectedTaskType} task for ${vehicle?.vehicleNumber} to queue.`
      );
    } catch (err) {
      pushNotification('danger', 'Task Failed', extractError(err, 'Failed to add task'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveTask = async (taskId, vNum, tType) => {
    setActionLoading(`remove:${taskId}`);
    try {
      const res = await taskAPI.removeTask(taskId);
      setQueue(res.data);
      
      // Log CloudTrail Event
      logAudit(
        state.username, 
        'DeleteTask', 
        `Vehicle ${vNum}`, 
        `Removed pending ${tType} maintenance task from queue`
      );
    } catch (err) {
      pushNotification('danger', 'Remove Failed', extractError(err, 'Failed to remove task'));
    } finally {
      setActionLoading('');
    }
  };

  const handleClearQueue = () => {
    setConfirmClear(true);
  };

  const confirmClearQueueAction = async () => {
    setConfirmClear(false);
    setActionLoading('clear');
    try {
      const res = await taskAPI.clearQueue();
      setQueue(res.data);
      
      // Log CloudTrail Event
      logAudit(
        state.username, 
        'ClearQueue', 
        `Queue:${state.username}`, 
        'Cleared all pending maintenance tasks'
      );
      pushNotification('success', 'Queue Cleared', 'All pending maintenance tasks have been cleared.');
    } catch (err) {
      pushNotification('danger', 'Clear Failed', extractError(err, 'Failed to clear queue'));
    } finally {
      setActionLoading('');
    }
  };

  const handleAnalyseFleet = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await aiAPI.getFleetAnalysis();
      setFleetAnalysis(res.data);
      pushNotification('success', 'Fleet Analysis Complete', `Health score: ${res.data.fleetHealthScore}/100`, 'Amazon Bedrock');
    } catch (err) {
      const msg = err.response?.status === 403
        ? 'Fleet analysis requires Manager or Admin role.'
        : extractError(err, 'Fleet analysis failed');
      setAiError(msg);
      pushNotification('danger', 'Analysis Failed', msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddRecommendationToQueue = async (rec) => {
    const key = `ai:${rec.vehicleId}:${rec.taskType}`;
    setAddingToQueue(key);
    try {
      const res = await taskAPI.addTask({
        vehicleId: rec.vehicleId,
        taskType: rec.taskType,
        description: rec.action,
      });
      setQueue(res.data);
      pushNotification('info', 'Added to Queue', `${rec.vehicleNumber} — ${rec.taskType} queued.`, 'Amazon Bedrock');
    } catch (err) {
      pushNotification('danger', 'Queue Failed', extractError(err, 'Failed to add task'));
    } finally {
      setAddingToQueue('');
    }
  };

  const handleRaiseRequestFromQueue = async (task, vNum) => {
    setActionLoading(`raise:${task.id}`);
    try {
      await requestAPI.createRequest({
        vehicleId: task.vehicleId,
        vehicleNumber: vNum || '',
        requestType: task.taskType || 'ROUTINE_SERVICE',
        description: task.description || 'Formalized from pending task queue'
      });

      // Remove from task queue since it's now formalized
      const res = await taskAPI.removeTask(task.id);
      setQueue(res.data);

      pushNotification(
        'success',
        'Request Formalized',
        `Successfully escalated ${task.taskType} for ${vNum} into a real Service Request.`
      );

      // Log CloudTrail Event
      logAudit(
        state.username, 
        'CreateRequest', 
        `Vehicle ${vNum}`, 
        `Escalated task queue item into an official Service Request`
      );
    } catch (err) {
      pushNotification('danger', 'Escalation Failed', extractError(err, 'Failed to escalate request'));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const driverTasks = queue?.tasks || [];

  return (
    <div className="container">


      <h2 style={{ marginBottom: '2rem' }}>Maintenance Center</h2>

      {loadError && (
        <div className="glass-panel" style={{ marginBottom: '1rem', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '0.75rem' }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
        
        {/* Real Driver Maintenance Task Queue */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ListTodo size={16} strokeWidth={2} color="var(--accent-primary)" /> My Pending Queue
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Persistence Layer: PostgreSQL (`pending_tasks` table)</p>
            </div>
            {driverTasks.length > 0 && (
              <button 
                className="btn-danger btn-sm"
                onClick={handleClearQueue}
                disabled={actionLoading === 'clear'}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              >
                Clear All
              </button>
            )}
          </div>

          {driverTasks.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--glass-border)', borderRadius: '8px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Archive size={36} strokeWidth={1.5} color="var(--text-muted)" />
              </div>
              <strong>Task Queue is Empty</strong>
              <p style={{ fontSize: '0.8rem' }}>Add pending tasks below or wait for EventBridge automated exceptions.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
              {driverTasks.map(task => {
                const vehicle = vehicles.find(v => v.id === task.vehicleId);
                const vNum = vehicle ? vehicle.vehicleNumber : `ID: ${task.vehicleId}`;
                return (
                  <div key={task.id} className="alert-card info" style={{ fontSize: '0.85rem' }}>
                    <div>
                      <strong>{vNum} — {task.taskType}</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>{task.description}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        className="btn-primary btn-sm"
                        disabled={actionLoading === `raise:${task.id}`}
                        onClick={() => handleRaiseRequestFromQueue(task, vNum)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Escalate
                      </button>
                      <button 
                        className="btn-secondary btn-sm"
                        disabled={actionLoading === `remove:${task.id}`}
                        onClick={() => handleRemoveTask(task.id, vNum, task.taskType)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--accent-danger)' }}
                      >
                        🗙
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add task manually form */}
          <form onSubmit={handleAddTask} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PlusCircle size={14} strokeWidth={2} /> Push New Maintenance Item
            </h4>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicle</label>
                <select 
                  value={selectedVehicle} 
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.brand})</option>
                  ))}
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Task Type</label>
                <select 
                  value={selectedTaskType} 
                  onChange={(e) => setSelectedTaskType(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  <option value="ROUTINE_SERVICE">ROUTINE_SERVICE</option>
                  <option value="BREAKDOWN">BREAKDOWN</option>
                  <option value="TIRE_CHANGE">TIRE_CHANGE</option>
                  <option value="OIL_CHANGE">OIL_CHANGE</option>
                  <option value="BATTERY">BATTERY</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notes / Description</label>
              <input 
                type="text" 
                value={taskDesc} 
                onChange={(e) => setTaskDesc(e.target.value)} 
                placeholder="Describe the issue..."
                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-secondary" 
              disabled={submitting || !selectedVehicle}
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
            >
              {submitting ? 'Adding...' : 'Push to Database'}
            </button>
          </form>
        </div>

        {/* Active Alarms Driven by EventBridge Cron Rule */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bell size={16} strokeWidth={2} color="var(--accent-warning)" /> Daily Maintenance Alarm Exceptions
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            
            {/* Expiring Insurance Warning exceptions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Insurance Expiry Alerts ({insuranceAlerts.length})</strong>
                <span className="aws-badge red" style={{ fontSize: '0.6rem' }}>SNS Broadcast</span>
              </div>
              {insuranceAlerts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                  ✓ All fleet vehicles possess long-term valid insurance.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {insuranceAlerts.map(v => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <div>
                        <strong>{v.vehicleNumber}</strong><br />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Expires: {v.insuranceExpiry}</span>
                      </div>
                      <span className="aws-badge red" style={{ fontSize: '0.65rem' }}>ALERT: Expiring</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overdue Routine Service exceptions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service Due Alerts ({serviceAlerts.length})</strong>
                <span className="aws-badge red" style={{ fontSize: '0.6rem' }}>SNS Broadcast</span>
              </div>
              {serviceAlerts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                  ✓ All vehicles running safely below maintenance mileage threshold.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {serviceAlerts.map(v => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <div>
                        <strong>{v.vehicleNumber}</strong><br />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Mileage: {v.currentMileage} km / Next: {v.nextServiceMileage} km</span>
                      </div>
                      <span className="aws-badge red" style={{ fontSize: '0.65rem' }}>ALERT: Service Due</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Fleet Maintenance Advisor — Amazon Bedrock */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginTop: '2rem', borderTop: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={20} color="var(--accent-primary)" /> Fleet Maintenance Advisor
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Powered by Amazon Bedrock
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {fleetAnalysis && (
              <div style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '1rem',
                background: fleetAnalysis.fleetHealthScore >= 80 ? 'rgba(34,197,94,0.15)' : fleetAnalysis.fleetHealthScore >= 60 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                color: fleetAnalysis.fleetHealthScore >= 80 ? 'var(--accent-success)' : fleetAnalysis.fleetHealthScore >= 60 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                border: `1px solid ${fleetAnalysis.fleetHealthScore >= 80 ? 'rgba(34,197,94,0.3)' : fleetAnalysis.fleetHealthScore >= 60 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                Fleet Health: {fleetAnalysis.fleetHealthScore}/100
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleAnalyseFleet}
              disabled={aiLoading}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {aiLoading ? (
                <>
                  <span className="spinner-sm" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Analysing...
                </>
              ) : (
                <><Brain size={14} /> Analyse Fleet</>
              )}
            </button>
          </div>
        </div>

        {aiError && (
          <div style={{ padding: '0.75rem', border: '1px solid var(--accent-danger)', borderRadius: '6px', color: 'var(--accent-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {aiError}
          </div>
        )}

        {fleetAnalysis ? (
          <>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {fleetAnalysis.summary}
            </p>

            {fleetAnalysis.recommendations && fleetAnalysis.recommendations.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {fleetAnalysis.recommendations.map((rec, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '8px',
                    padding: '1rem',
                    borderLeft: `4px solid ${rec.priority === 'HIGH' ? 'var(--accent-danger)' : rec.priority === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{rec.vehicleNumber}</strong>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: rec.priority === 'HIGH' ? 'rgba(239,68,68,0.15)' : rec.priority === 'MEDIUM' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                        color: rec.priority === 'HIGH' ? 'var(--accent-danger)' : rec.priority === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--accent-success)',
                      }}>{rec.priority}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.taskType}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{rec.action}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{rec.reasoning}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Confidence: <strong style={{ color: rec.confidence >= 80 ? 'var(--accent-success)' : rec.confidence >= 60 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>{rec.confidence}%</strong>
                      </span>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={addingToQueue === `ai:${rec.vehicleId}:${rec.taskType}`}
                        onClick={() => handleAddRecommendationToQueue(rec)}
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
                      >
                        {addingToQueue === `ai:${rec.vehicleId}:${rec.taskType}` ? 'Adding...' : '+ Queue'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-success)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', background: 'rgba(34,197,94,0.05)' }}>
                <strong>Fleet is Healthy</strong>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No maintenance actions required at this time.</p>
              </div>
            )}
          </>
        ) : (
          !aiLoading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--glass-border)', borderRadius: '8px' }}>
              <Brain size={36} strokeWidth={1.5} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
              <p style={{ margin: 0 }}>Click <strong>Analyse Fleet</strong> to get AI-powered maintenance recommendations.</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Results are cached for 15 minutes.</p>
            </div>
          )
        )}
      </div>

      {/* Shared EFS Media Vault Section */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginTop: '2rem', borderTop: '4px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardDrive size={20} color="var(--accent-purple)" /> Shared Inspection Media Vault
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Shared Filesystem Mount: <code style={{ color: 'var(--accent-purple)' }}>/var/www/fleetops/shared-media</code> mounted to Elastic File System ID: <code style={{ color: 'var(--accent-purple)' }}>{import.meta.env.VITE_EFS_ID || 'N/A'}</code>
            </p>
          </div>
          <span className="aws-badge" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(168,85,247,0.2)', fontSize: '0.75rem' }}>
            Multi-AZ Active-Active mount
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Gallery View */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Synced Media Catalog ({efsPhotos.length} files)</strong>
              <small style={{ color: 'var(--text-muted)' }}>Status: RW mounted</small>
            </div>
            
            {efsPhotos.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1.5px dashed var(--glass-border)', borderRadius: '8px' }}>
                <Image size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>No media files written to EFS mount directory.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {efsPhotos.map(photo => (
                  <div key={photo.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Server size={12} color="var(--accent-purple)" />
                      <span style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{photo.uploaderNode}</span>
                    </div>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                      📸 {photo.filename}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Vehicle: <strong>{photo.vehicleNum}</strong><br/>
                      Size: {photo.size}<br/>
                      Path: <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--accent-primary)' }}>{photo.mountPoint}/{photo.filename}</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px', paddingTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>POSIX lock: None</span>
                      <span>{photo.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EFS write panel — real disk write to shared mount */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '1.25rem', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>Write new Inspection Photo</h4>
            
            <form onSubmit={handleEfsUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Target Vehicle</label>
                <select
                  value={selectedEfsVehicle}
                  onChange={(e) => setSelectedEfsVehicle(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  required
                >
                  <option value="" disabled>-- Select Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.brand})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Client Server Host (EC2 Node)</label>
                <select
                  value={efsNode}
                  onChange={(e) => setEfsNode(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  <option value="ec2-us-east-1a-node-01">ec2-us-east-1a-node-01 (AZ-A)</option>
                  <option value="ec2-us-east-1b-node-02">ec2-us-east-1b-node-02 (AZ-B)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Inspection Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEfsFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '100%' }}
                  required
                />
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', borderLeft: '3px solid var(--accent-warning)' }}>
                <strong>Verification Point:</strong> Any file created here triggers a disk write to EFS. Check the catalog instantly to see it visible on the opposite client host.
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={uploadingPhoto || !selectedEfsVehicle || !efsFile}
                style={{ fontSize: '0.8rem', padding: '0.6rem' }}
              >
                {uploadingPhoto ? 'Writing to Shared Mount...' : 'Write File to EFS Partition'}
              </button>
            </form>
          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={confirmClear}
        title="Clear Queue"
        message="Clear all tasks from your queue?"
        onConfirm={confirmClearQueueAction}
        onCancel={() => setConfirmClear(false)}
        confirmText="Clear All"
      />
    </div>
  );
};

export default Maintenance;
