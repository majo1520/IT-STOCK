import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, login } from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem('token');
      const rememberedUser = localStorage.getItem('rememberMe');
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Set rememberMe state based on localStorage
      setRememberMe(!!rememberedUser);

      try {
        const response = await getCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error fetching current user:', error);
        // If token is invalid or expired, log out
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('token');
          
          // If rememberMe is true, don't clear the username from localStorage
          if (!rememberedUser) {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('rememberedUsername');
          } else {
            // Store the fact that we need to re-authenticate
            localStorage.setItem('needsReauth', 'true');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('rememberedUsername');
    localStorage.removeItem('needsReauth');
    setCurrentUser(null);
    setRememberMe(false);
    navigate('/login');
  };

  const value = {
    currentUser,
    setCurrentUser,
    loading,
    logout,
    rememberMe,
    setRememberMe
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext; 