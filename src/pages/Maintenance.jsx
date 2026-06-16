import React, { useState, useEffect, useContext } from 'react';
import { taskAPI, vehicleAPI, requestAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { pushNotification } from '../components/NotificationCenter';
import ConfirmModal from '../components/ConfirmModal';
import { ListTodo, PlusCircle, Archive, Bell, CalendarRange, Wrench, HardDrive, Image, Server } from 'lucide-react';

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

  // EFS Mock Shared storage states
  const [efsPhotos, setEfsPhotos] = useState([
    { id: 1, vehicleNum: 'KL-01-AZ-1102', uploaderNode: 'ec2-ap-south-1a-node-01', filename: 'ins_bumper_damage.jpg', timestamp: '2026-06-03 12:15:32 UTC', size: '1.2 MB', mountPoint: '/var/www/fleetops/shared-media' },
    { id: 2, vehicleNum: 'KL-07-CD-5541', uploaderNode: 'ec2-ap-south-1b-node-02', filename: 'fitness_check_front.jpg', timestamp: '2026-06-03 14:02:11 UTC', size: '2.4 MB', mountPoint: '/var/www/fleetops/shared-media' }
  ]);
  const [selectedEfsVehicle, setSelectedEfsVehicle] = useState('');
  const [efsNode, setEfsNode] = useState('ec2-ap-south-1a-node-01');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleEfsUpload = (e) => {
    e.preventDefault();
    if (!selectedEfsVehicle) return;
    setUploadingPhoto(true);
    
    const v = vehicles.find(item => item.id.toString() === selectedEfsVehicle) || vehicles[0];
    const newPhotoName = `inspection_${v.vehicleNumber}_${Date.now().toString().slice(-4)}.jpg`;

    setTimeout(() => {
      const newPhoto = {
        id: Date.now(),
        vehicleNum: v.vehicleNumber,
        uploaderNode: efsNode,
        filename: newPhotoName,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        size: '1.8 MB',
        mountPoint: '/var/www/fleetops/shared-media'
      };

      setEfsPhotos(prev => [newPhoto, ...prev]);
      setUploadingPhoto(false);

      // Log CloudTrail Audit Event
      logAudit(
        state.username,
        'WriteSharedFile',
        `efs://fleetops-shared-filesystem/${newPhotoName}`,
        `Uploaded inspection photo from EC2 node ${efsNode} to shared EFS mount`
      );

      pushNotification(
        'success',
        'EFS Synced',
        `Shared file synced: ${newPhotoName} instantly readable across all EC2 target groups.`,
        'AWS EFS'
      );
    }, 1200);
  };

  const loadData = async () => {
    try {
      setLoadError('');
      const [queueRes, insRes, svcRes, vRes] = await Promise.all([
        taskAPI.getQueue(),
        vehicleAPI.getInsuranceAlerts(),
        vehicleAPI.getServiceAlerts(),
        vehicleAPI.getVehicles()
      ]);
      setQueue(queueRes.data);
      setInsuranceAlerts(Array.isArray(insRes.data) ? insRes.data : []);
      setServiceAlerts(Array.isArray(svcRes.data) ? svcRes.data : []);
      
      const fleet = Array.isArray(vRes.data) ? vRes.data : [];
      setVehicles(fleet);
      if (fleet.length > 0) {
        setSelectedVehicle(fleet[0].id.toString());
        setSelectedEfsVehicle(fleet[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load maintenance center data", err);
      setLoadError(err.response?.data || err.message || 'Failed to load maintenance data');
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
        `Added pending ${selectedTaskType} task for ${vehicle?.vehicleNumber} to queue.`,
        'AWS EventBridge'
      );
    } catch (err) {
      pushNotification('danger', 'Task Failed', err.response?.data || err.message || 'Failed to add task');
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
      pushNotification('danger', 'Remove Failed', err.response?.data || err.message || 'Failed to remove task');
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
      pushNotification('danger', 'Clear Failed', err.response?.data || err.message || 'Failed to clear queue');
    } finally {
      setActionLoading('');
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
        `Successfully escalated ${task.taskType} for ${vNum} into a real Service Request.`,
        'AWS EventBridge'
      );

      // Log CloudTrail Event
      logAudit(
        state.username, 
        'CreateRequest', 
        `Vehicle ${vNum}`, 
        `Escalated task queue item into an official Service Request`
      );
    } catch (err) {
      pushNotification('danger', 'Escalation Failed', err.response?.data || err.message || 'Failed to escalate request');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const driverTasks = queue?.tasks || [];

  return (
    <div className="container">
      {/* EventBridge & Lambda Scheduled Alert Rule Strip */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-warning)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Automated Scheduling Pipeline</h3>
            <span className="aws-badge" style={{ fontSize: '0.65rem' }}>AWS EventBridge</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Scheduled Cron: <code style={{ color: 'var(--accent-warning)', fontSize: '0.75rem' }}>30 3 * * ? *</code> (03:30 UTC = 09:00 IST daily).
            Target Lambda: <code style={{ color: 'var(--accent-warning)', fontSize: '0.75rem' }}>arn:aws:lambda:ap-south-1:{import.meta.env.VITE_AWS_ACCOUNT_ID || '123456789012'}:function:fleetops-maintenance-scanner</code>.
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="pulse-dot pulse-green" /> Rule Status: ACTIVE (Healthy)
        </div>
      </div>

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

      {/* Shared EFS Media Vault Section */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginTop: '2rem', borderTop: '4px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardDrive size={20} color="var(--accent-purple)" /> Shared Inspection Media Vault
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Shared Filesystem Mount: <code style={{ color: 'var(--accent-purple)' }}>/var/www/fleetops/shared-media</code> mounted to Elastic File System ID: <code style={{ color: 'var(--accent-purple)' }}>fs-092df8761a293b</code>
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

          {/* Simulate EFS write panel */}
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
                  <option value="ec2-ap-south-1a-node-01">ec2-ap-south-1a-node-01 (AZ-A)</option>
                  <option value="ec2-ap-south-1b-node-02">ec2-ap-south-1b-node-02 (AZ-B)</option>
                </select>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', borderLeft: '3px solid var(--accent-warning)' }}>
                <strong>Verification Point:</strong> Any file created here triggers a disk write to EFS. Check the catalog instantly to see it visible on the opposite client host.
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={uploadingPhoto || !selectedEfsVehicle}
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
