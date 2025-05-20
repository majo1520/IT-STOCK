/**
 * Network Status Service
 * 
 * Provides utilities for monitoring network status and connectivity
 */

class NetworkStatusService {
  constructor() {
    this.online = navigator.onLine;
    this.listeners = [];
    
    // Set up event listeners for online/offline events
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));
    
    // Set up periodic connectivity check
    this.checkInterval = setInterval(() => this.checkConnectivity(), 30000);
  }
  
  // Update network status and notify listeners
  updateStatus(isOnline) {
    if (this.online !== isOnline) {
      this.online = isOnline;
      this.notifyListeners();
    }
  }
  
  // Check connectivity by making a small request
  async checkConnectivity() {
    try {
      // Try to fetch a small resource to verify actual connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health-check', { 
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.updateStatus(true);
        return true;
      } else {
        this.updateStatus(false);
        return false;
      }
    } catch (error) {
      this.updateStatus(false);
      return false;
    }
  }
  
  // Get current network status
  isOnline() {
    return this.online;
  }
  
  // Add a listener for network status changes
  addListener(callback) {
    if (typeof callback === 'function' && !this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
    return () => this.removeListener(callback); // Return unsubscribe function
  }
  
  // Remove a listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
  
  // Notify all listeners of status change
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.online);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }
  
  // Clean up resources
  destroy() {
    clearInterval(this.checkInterval);
    window.removeEventListener('online', () => this.updateStatus(true));
    window.removeEventListener('offline', () => this.updateStatus(false));
    this.listeners = [];
  }
}

// Create singleton instance
const networkStatus = new NetworkStatusService();

export default networkStatus; 