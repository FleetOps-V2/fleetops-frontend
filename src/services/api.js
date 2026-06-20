import axios from 'axios';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/').trim();
const normalizedBaseUrl = rawBaseUrl.endsWith('/') && rawBaseUrl !== '/'
  ? rawBaseUrl.slice(0, -1)
  : rawBaseUrl;

const api = axios.create({
  baseURL: normalizedBaseUrl || '/',
  timeout: 10000,
  withCredentials: true,  // send httpOnly JWT cookie on every request
});

// ----------------------------------------------------
// Request Interceptor: Guard against double /api prefix
// ----------------------------------------------------
api.interceptors.request.use(
  (config) => {
    // Guard against accidental double-prefix /api + /api/vehicles => /api/api/vehicles
    if (typeof config.url === 'string') {
      const base = (config.baseURL || '').replace(/\/+$/, '');
      if (base.endsWith('/api') && config.url.startsWith('/api/')) {
        config.url = config.url.replace(/^\/api/, '');
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ----------------------------------------------------
// Response Interceptor: Auto-logout on 401
// ----------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      window.dispatchEvent(new Event('auth-expired'));
    }
    return Promise.reject(error);
  }
);

// ----------------------------------------------------
// Auth API
// ----------------------------------------------------
export const authAPI = {
  login:    (credentials) => api.post('/api/auth/login', credentials),
  logout:   ()            => api.post('/api/auth/logout'),
  register: (data)        => api.post('/api/auth/register', data),
  getMe:    ()            => api.get('/api/auth/me'),
};

// ----------------------------------------------------
// Vehicle API
// ----------------------------------------------------
export const vehicleAPI = {
  getVehicles:        (params)        => api.get('/api/vehicles', { params }),
  getVehicle:         (id)            => api.get(`/api/vehicles/${id}`),
  createVehicle:      (data)          => api.post('/api/vehicles', data),
  updateVehicle:      (id, data)      => api.put(`/api/vehicles/${id}`, data),
  deleteVehicle:      (id)            => api.delete(`/api/vehicles/${id}`),
  updateStatus:       (id, status)    => api.patch(`/api/vehicles/${id}/status`, { status }),
  updateMileage:      (id, mileage)   => api.patch(`/api/vehicles/${id}/mileage`, { mileage }),
  getDashboard:       ()              => api.get('/api/vehicles/dashboard'),
  getInsuranceAlerts: ()              => api.get('/api/vehicles/alerts/insurance'),
  getServiceAlerts:   ()              => api.get('/api/vehicles/alerts/service'),
};

// ----------------------------------------------------
// Maintenance Task API
// ----------------------------------------------------
export const taskAPI = {
  getQueue:        ()       => api.get('/api/tasks'),
  addTask:         (data)   => api.post('/api/tasks/add', data),
  removeTask:      (taskId) => api.delete(`/api/tasks/remove/${taskId}`),
  clearQueue:      ()       => api.delete('/api/tasks/clear'),
  broadcastAlarms: ()       => api.post('/api/tasks/alarms/broadcast'),
};

// ----------------------------------------------------
// Service Request API
// ----------------------------------------------------
export const requestAPI = {
  createRequest:      (data)          => api.post('/api/requests', data),
  getRequests:        ()              => api.get('/api/requests'),
  getRequest:         (id)            => api.get(`/api/requests/${id}`),
  getRequestsByVehicle: (vehicleId)   => api.get(`/api/requests/vehicle/${vehicleId}`),
  updateStatus:       (id, status)    => api.patch(`/api/requests/${id}/status`, { status }),
  assignTechnician:   (id, technician)=> api.patch(`/api/requests/${id}/assign`, { technician }),
  completeRequest:    (id, data)      => api.patch(`/api/requests/${id}/complete`, data),
};

// ----------------------------------------------------
// Tracking API  (intermediate stage: PostgreSQL backend)
// GPS simulator on the frontend posts real pings here.
// In Phase 5 this backend endpoint will be replaced by
// SQS → Lambda → DynamoDB without changing this contract.
// ----------------------------------------------------
export const trackingAPI = {
  ping: (payload) => api.post('/api/tracking/ping', payload),
  getLive: ()     => api.get('/api/tracking/live'),
  getVehicle: (id)=> api.get(`/api/tracking/vehicle/${id}`),
};

// ----------------------------------------------------
// EFS Media API
// ----------------------------------------------------
export const mediaAPI = {
  getCatalog: () => api.get('/api/media/catalog'),
  uploadFile: (vehicleNumber, ec2Node, file) => {
    const form = new FormData();
    form.append('vehicleNumber', vehicleNumber);
    form.append('ec2Node', ec2Node);
    form.append('file', file);
    return api.post('/api/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ----------------------------------------------------
// AI Fleet Analysis API
// ----------------------------------------------------
export const aiAPI = {
  getFleetAnalysis: () => api.get('/api/vehicles/ai/fleet-analysis'),
};

export default api;
