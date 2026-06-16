import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { logAudit } from '../utils/AuditLogger';
import { FolderOpen, Upload, RefreshCw } from 'lucide-react';

const VehicleCard = ({ vehicle, onRequestService }) => {
  const { state } = useContext(AppContext);
  const isDriver = state.role === 'DRIVER' || state.role === 'ROLE_DRIVER';

  const isAdmin = state.role === 'ADMIN' || state.role === 'ROLE_ADMIN';

  const [showDocs, setShowDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('RC Book');
  const [docs, setDocs] = useState([
    { name: 'RC_Book.pdf', size: '2.4 MB', type: 'RC Book', storageClass: 'S3 Standard', uploadDate: '2026-05-15', securePath: `s3://fleetops-documents-prod/vehicles/${vehicle.id}/RC_Book.pdf` },
    { name: 'Insurance_Policy.pdf', size: '1.8 MB', type: 'Insurance', storageClass: 'S3 Standard', uploadDate: '2026-05-20', securePath: `s3://fleetops-documents-prod/vehicles/${vehicle.id}/Insurance_Policy.pdf` }
  ]);

  const statusColors = {
    ACTIVE: 'var(--accent-success)',
    IN_SERVICE: 'var(--accent-warning)',
    BREAKDOWN: 'var(--accent-danger)',
    RETIRED: 'var(--text-muted)'
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setTimeout(() => {
      const newDoc = {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type: docType,
        storageClass: 'S3 Standard',
        uploadDate: new Date().toISOString().split('T')[0],
        securePath: `s3://fleetops-documents-prod/vehicles/${vehicle.id}/${file.name}`
      };
      setDocs(prev => [...prev, newDoc]);
      setUploading(false);

      // Log CloudTrail Audit Event
      logAudit(
        state.username,
        'PutObject',
        `s3://fleetops-documents-prod/vehicles/${vehicle.id}/${file.name}`,
        `Uploaded ${docType} file to S3 bucket fleetops-documents-prod`
      );
    }, 1500);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', transition: 'transform 0.2s' }}>
      <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{vehicle.brand} {vehicle.model}</h3>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              {vehicle.vehicleNumber}
            </span>
          </div>
          <span style={{ 
            fontSize: '0.8rem', 
            fontWeight: 'bold', 
            color: statusColors[vehicle.status] || 'white',
            background: `${statusColors[vehicle.status]}22`,
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${statusColors[vehicle.status]}55`
          }}>
            {vehicle.status}
          </span>
        </div>
        
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Type:</span>
            <span style={{ color: 'var(--text-primary)' }}>{vehicle.type}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mileage:</span>
            <span style={{ color: 'var(--text-primary)' }}>{vehicle.currentMileage} km</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Assigned To:</span>
            <span style={{ color: 'var(--text-primary)' }}>{vehicle.assignedDriverId || 'Unassigned'}</span>
          </div>
        </div>
        
        <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button 
              className="btn-secondary btn-sm"
              onClick={() => setShowDocs(!showDocs)}
              style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <FolderOpen size={13} strokeWidth={2} /> Document Center ({docs.length})
            </button>
            
            {isDriver && vehicle.status === 'ACTIVE' && vehicle.assignedDriverId === state.username && (
              <button 
                className="btn-primary btn-sm" 
                onClick={onRequestService}
                style={{ flexGrow: 1.5, padding: '0.5rem', fontSize: '0.8rem' }}
              >
                Request Service
              </button>
            )}
          </div>
          
          {isDriver && vehicle.status !== 'ACTIVE' && vehicle.assignedDriverId === state.username && (
            <div style={{ textAlign: 'center', color: 'var(--accent-warning)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
              Currently {vehicle.status.replace('_', ' ')}
            </div>
          )}
        </div>
      </div>

      {/* Clean Document Storage Drawer Panel */}
      {showDocs && (
        <div className="doc-panel" style={{ background: 'rgba(0,0,0,0.2)', padding: '1.2rem', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              S3 Object Registry
            </span>
            <span className="aws-badge" style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>S3 + KMS + CloudFront</span>
          </div>

          {docs.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No documents stored.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {docs.map((doc, idx) => (
                <div key={idx} style={{ padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>📄 {doc.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{doc.size}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Type: {doc.type}</span>
                    {isAdmin && <span>Tier: <strong style={{ color: 'var(--accent-success)' }}>{doc.storageClass}</strong></span>}
                  </div>
                  
                  {/* Backup / lifecycle timeline info */}
                  {isAdmin && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        <span>Active</span>
                        <span>Infrequent Access (30d)</span>
                        <span>Archive (90d)</span>
                      </div>
                      <div className="lifecycle-track">
                        <div className="lifecycle-standard" style={{ width: '33.3%' }}></div>
                        <div className="lifecycle-ia" style={{ width: '33.3%' }}></div>
                        <div className="lifecycle-glacier" style={{ width: '33.3%' }}></div>
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--accent-primary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Path: {doc.securePath}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Document Upload Interface */}
          {state.isAuthenticated && (
            <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '0.3rem', width: '100%', height: 'auto', background: 'var(--bg-elevated)' }}
                >
                  <option value="RC Book">RC Book</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Fitness Certificate">Fitness Certificate</option>
                  <option value="Permits">Permits</option>
                </select>
              </div>
              <label className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer', opacity: uploading ? 0.6 : 1, fontSize: '0.75rem', padding: '0.4rem' }}>
                {uploading ? (
                  <>
                    <RefreshCw size={13} strokeWidth={2} className="spin-icon" /> Uploading Document...
                  </>
                ) : (
                  <>
                    <Upload size={13} strokeWidth={2} /> Upload Document
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleCard;
