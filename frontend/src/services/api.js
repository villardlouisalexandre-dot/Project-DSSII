import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3087';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data) => api.post('/api/auth/register', data);
export const login = (data) => api.post('/api/auth/login', data);

// Todos
export const getPublicTodos = (params) => api.get('/api/todos/public', { params });
export const getMyTodos = (params) => api.get('/api/todos', { params });
export const getTodo = (id) => api.get(`/api/todos/${id}`);
export const createTodo = (data) => api.post('/api/todos', data);
export const updateTodo = (id, data) => api.put(`/api/todos/${id}`, data);
export const setCompletion = (id, isCompleted) => api.patch(`/api/todos/${id}/completion`, { isCompleted });
export const deleteTodo = (id) => api.delete(`/api/todos/${id}`);

export default api;
