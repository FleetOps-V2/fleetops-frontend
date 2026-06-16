import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { taskAPI, vehicleAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { ListTodo } from 'lucide-react';

const TaskDrawer = ({ isOpen, onClose }) => {
  const { state, fetchCartCount } = useContext(AppContext);
  const navigate = useNavigate();
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && state.isAuthenticated) {
      loadQueue();
    }
  }, [isOpen, state.isAuthenticated]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await taskAPI.getQueue();
      const rawQueue = res.data;
      
      // Enrich with vehicle details
      if (rawQueue.tasks && rawQueue.tasks.length > 0) {
        const enriched = await Promise.all(
          rawQueue.tasks.map(async (task) => {
            try {
              const vRes = await vehicleAPI.getVehicle(task.vehicleId);
              return { ...task, vehicle: vRes.data };
            } catch {
              return { ...task, vehicle: { vehicleNumber: `ID: ${task.vehicleId}`, brand: 'Unknown' } };
            }
          })
        );
        setQueue({ ...rawQueue, tasks: enriched });
      } else {
        setQueue(rawQueue);
      }
    } catch (err) {
      console.error("Failed to load task queue", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTask = async (taskId) => {
    try {
      await taskAPI.removeTask(taskId);
      await loadQueue();
      fetchCartCount();
    } catch (err) {
      alert("Failed to remove task");
    }
  };

  const handleCreateRequest = () => {
    if (!queue?.tasks?.length) return;
    onClose();
    navigate('/requests', {
      state: {
        source: 'queue',
        items: queue.tasks.map((task) => ({
          vehicleId: task.vehicleId,
          vehicleNumber: task.vehicle?.vehicleNumber || null,
          requestType: task.taskType || 'ROUTINE_SERVICE',
          notes: task.description || ''
        }))
      }
    });
  };

  return (
    <>
      {isOpen && (
        <div 
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, transition: 'opacity 0.3s' }}
        />
      )}
      
      <div className="glass" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '400px',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out', zIndex: 1001,
        display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Pending Tasks</h2>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.5rem' }}>&times;</button>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <LoadingSpinner />
          ) : !queue || !queue.tasks || queue.tasks.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <ListTodo size={48} strokeWidth={1.5} color="var(--text-muted)" />
              </div>
              <h3>Queue is empty</h3>
              <p className="mt-1">No pending maintenance tasks.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {queue.tasks.map(task => (
                <div key={task.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: '0.25rem', fontSize: '0.95rem' }}>
                      {task.vehicle?.brand} ({task.vehicle?.vehicleNumber})
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-warning)', fontWeight: 'bold' }}>{task.taskType}</p>
                    {task.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{task.description}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={() => handleRemoveTask(task.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {queue && queue.tasks && queue.tasks.length > 0 && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--glass-border)', background: 'var(--bg-elevated)' }}>
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={handleCreateRequest}
              disabled={processing}
            >
              Formalize Service Request
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default TaskDrawer;
