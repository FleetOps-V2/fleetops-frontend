import React, { createContext, useReducer, useEffect } from 'react';
import { taskAPI } from '../services/api';

export const AppContext = createContext();

const initialState = {
  isAuthenticated: !!localStorage.getItem('username'),
  username: localStorage.getItem('username') || null,
  role: localStorage.getItem('role') || null,
  cartItemsCount: 0,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        username: action.payload.username,
        role: action.payload.role,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        username: null,
        role: null,
        cartItemsCount: 0,
      };
    case 'SET_CART_COUNT':
      return {
        ...state,
        cartItemsCount: action.payload,
      };
    default:
      return state;
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Sync cart count
  const fetchCartCount = async () => {
    if (!state.isAuthenticated) return;
    try {
      const res = await taskAPI.getQueue();
      const count = res.data.tasks?.length || 0;
      dispatch({ type: 'SET_CART_COUNT', payload: count });
    } catch (err) {
      console.error("Failed to fetch cart count", err);
    }
  };

  // Listen for auto-logout event from Axios interceptor
  useEffect(() => {
    const handleAuthExpired = () => {
      dispatch({ type: 'LOGOUT' });
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // Fetch cart on mount if authenticated
  useEffect(() => {
    fetchCartCount();
  }, [state.isAuthenticated]);

  return (
    <AppContext.Provider value={{ state, dispatch, fetchCartCount }}>
      {children}
    </AppContext.Provider>
  );
};
