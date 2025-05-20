import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/');
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuth();

  // Extract redirect path from URL query parameters on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const redirect = queryParams.get('redirect');
    if (redirect) {
      setRedirectPath(redirect);
    }
    
    // Check if we have remembered username
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberMeEnabled = localStorage.getItem('rememberMe') === 'true';
    
    if (rememberedUsername && rememberMeEnabled) {
      setFormData(prev => ({
        ...prev,
        username: rememberedUsername,
        rememberMe: true
      }));
      
      // Focus on password field if we have a remembered username
      setTimeout(() => {
        const passwordField = document.getElementById('password');
        if (passwordField) {
          passwordField.focus();
        }
      }, 100);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      const response = await login(formData);
      
      // Store the token and user data
      localStorage.setItem('token', response.data.token);
      
      // If rememberMe is checked, store username and flag in localStorage
      if (formData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('rememberedUsername', formData.username);
        localStorage.removeItem('needsReauth'); // Clear any reauth flag
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberedUsername');
      }
      
      setCurrentUser(response.data.user);
      
      // Redirect to the specified path or home page
      navigate(redirectPath);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4">
          <h2 className="card-title text-center mb-4">Login</h2>
          
          {redirectPath !== '/' && (
            <div className="alert alert-info" role="alert">
              <small>
                <i className="bi bi-info-circle me-1"></i>
                Login to access additional features
              </small>
            </div>
          )}
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                autoFocus={!formData.username} // Only autofocus if no username is remembered
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoFocus={!!formData.username} // Autofocus if username is remembered
              />
            </div>
            
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="rememberMe">
                Remember Me
              </label>
            </div>
            
            <div className="d-grid gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Logging in...
                  </>
                ) : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login; 