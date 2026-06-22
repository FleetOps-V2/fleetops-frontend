import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { logAudit } from '../utils/AuditLogger';
import { pushNotification } from './NotificationCenter';
import { documentAPI } from '../services/api';
import { FolderOpen, Upload, RefreshCw } from 'lucide-react';

const inferDocType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'Photo';
  if (ext === 'pdf') return 'PDF Document';
  return 'Document';
};

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const serverDocToDoc = (item) => ({
  name: item.filename,
  size: formatBytes(item.size),
  type: item.docType || inferDocType(item.filename),
  storageClass: 'S3 Standard',
  uploadDate: item.lastModified ? item.lastModified.substring(0, 10) : '—',
  securePath: `s3://vehicle-docs/${item.key}`,
});

const VehicleCard = ({ vehicle, onRequestService }) => {
  const { state } = useContext(AppContext);
  const isDriver = state.role === 'DRIVER' || state.role === 'ROLE_DRIVER';
  const isAdmin  = state.role === 'ADMIN'  || state.role === 'ROLE_ADMIN';

  const [showDocs, setShowDocs]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docType, setDocType]         = useState('RC Book');
  const [docs, setDocs]               = useState([]);

  useEffect(() => {
    if (!showDocs) return;
    let cancelled = false;
    setLoadingDocs(true);
    documentAPI.listDocuments(vehicle.vehicleNumber)
      .then(res => {
        if (cancelled) return;
        setDocs((res.data || []).map(serverDocToDoc));
      })
      .catch(() => {
        if (!cancelled) pushNotification('danger', 'Load Failed', 'Could not load documents from S3.', 'Documents API');
      })
      .finally(() => { if (!cancelled) setLoadingDocs(false); });
    return () => { cancelled = true; };
  }, [showDocs, vehicle.vehicleNumber]);

  const statusColors = {
    ACTIVE:     'var(--accent-success)',
    IN_SERVICE: 'var(--accent-warning)',
    BREAKDOWN:  'var(--accent-danger)',
    RETIRED:    'var(--text-muted)'
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data } = await documentAPI.getPresignedUrl(vehicle.vehicleNumber, docType, file.name);
      await documentAPI.uploadToS3(data.uploadUrl, file);

      const newDoc = {
        name: file.name,
        size: formatBytes(file.size),
        type: docType,
        storageClass: 'S3 Standard',
        uploadDate: new Date().toISOString().split('T')[0],
        securePath: `s3://vehicle-docs/${data.key}`,
      };
      setDocs(prev => [...prev, newDoc]);

      logAudit(
        state.username,
        'PutObject',
        `s3://vehicle-docs/${data.key}`,
        `Uploaded ${docType} to S3 vehicle-docs bucket`
      );
      pushNotification('success', 'Document Uploaded', `${file.name} stored in S3.`, 'Documents API');
    } catch {
      pushNotification('danger', 'Upload Failed', 'Could not upload document to S3.', 'Documents API');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
              <FolderOpen size={13} strokeWidth={2} /> Document Vault ({docs.length})
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

      {showDocs && (
        <div className="doc-panel" style={{ background: 'rgba(0,0,0,0.2)', padding: '1.2rem', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Document Vault
            </span>
            <span className="aws-badge" style={{ fontSize: '0.65rem', background: 'rgba(255,153,0,0.15)', color: '#ff9900', border: '1px solid rgba(255,153,0,0.3)' }}>S3 + KMS</span>
          </div>

          {loadingDocs ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <RefreshCw size={13} className="spin-icon" /> Loading from S3...
            </div>
          ) : docs.length === 0 ? (
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
                  {isAdmin && (
                    <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--accent-primary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Path: {doc.securePath}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {state.isAuthenticated && (
            <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  aria-label={`Document type for ${vehicle.vehicleNumber}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem', width: '100%', height: 'auto', background: 'var(--bg-elevated)' }}
                >
                  <option value="RC Book">RC Book</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Fitness Certificate">Fitness Certificate</option>
                  <option value="Permits">Permits</option>
                </select>
              </div>
              <label htmlFor={`upload-doc-${vehicle.id}`} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, fontSize: '0.75rem', padding: '0.4rem' }}>
                {uploading ? (
                  <>
                    <RefreshCw size={13} strokeWidth={2} className="spin-icon" /> Uploading to S3...
                  </>
                ) : (
                  <>
                    <Upload size={13} strokeWidth={2} /> Upload Document
                  </>
                )}
                <input
                  id={`upload-doc-${vehicle.id}`}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleUpload}
                  disabled={uploading}
                  aria-label={`Upload ${docType} for ${vehicle.vehicleNumber}`}
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
