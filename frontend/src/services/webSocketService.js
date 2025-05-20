import React from 'react';

// Determine the WebSocket URL based on the current environment
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // Use the /ws path which will be properly proxied by Vite
  return `${protocol}//${host}/ws`;
};

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second delay
    this.autoReconnect = true;
    this.pendingMessages = [];
    this.connectionSubscribers = new Set();
    this.lastPingTime = null;
    this.pingInterval = null;
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  // Initialize and connect to the WebSocket server
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.log('WebSocket already connected or connecting');
      return;
    }

    try {
      this.log('Connecting to WebSocket server...');
      const wsUrl = getWebSocketUrl();
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  // Handle successful connection
  handleOpen() {
    this.log('WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000; // Reset delay on successful connection

    // Notify subscribers about the connection
    this.notifyConnectionSubscribers({ connected: true });

    // Send pending messages
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this.sendImmediate(message);
    }

    // Setup ping interval to keep connection alive
    this.setupPingInterval();
  }

  // Handle incoming messages
  handleMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
      this.log('Received WebSocket message:', data);

      // Handle system messages
      if (data.type === 'ping') {
        this.handlePing();
        return;
      }

      // Notify subscribers based on message type
      const subscribers = this.subscribers.get(data.type) || [];
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in WebSocket subscriber callback:', err);
        }
      });

      // Also notify 'all' subscribers for any message
      const allSubscribers = this.subscribers.get('all') || [];
      allSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in WebSocket "all" subscriber callback:', err);
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  // Handle ping messages
  handlePing() {
    this.lastPingTime = Date.now();
    this.sendImmediate({ type: 'pong', timestamp: this.lastPingTime });
  }

  // Setup ping interval
  setupPingInterval() {
    // Clear existing interval if any
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Setup new interval
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendImmediate({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // 30 seconds
  }

  // Handle connection close
  handleClose(event) {
    this.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    this.isConnected = false;
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Notify subscribers about the disconnection
    this.notifyConnectionSubscribers({ connected: false });

    if (this.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  // Handle connection errors
  handleError(error) {
    console.error('WebSocket error:', error);
    
    // Only schedule reconnect if we're not already connected or reconnecting
    if (!this.isConnected) {
      this.scheduleReconnect();
    }
  }

  // Schedule reconnection with exponential backoff
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Maximum reconnect attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)); // Exponential backoff capped at 30 seconds
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  // Disconnect from the WebSocket server
  disconnect() {
    this.autoReconnect = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
    }
    
    this.isConnected = false;
    this.notifyConnectionSubscribers({ connected: false });
  }

  // Send a message to the WebSocket server
  send(message) {
    if (!message) {
      console.error('Cannot send empty message');
      return;
    }
    
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };

    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.sendImmediate(messageWithTimestamp);
    } else {
      // Queue message to be sent when connection is established
      this.log('Connection not open, queueing message:', messageWithTimestamp);
      this.pendingMessages.push(messageWithTimestamp);
      
      // Try to connect if not already connecting
      if (!this.socket || this.socket.readyState !== WebSocket.CONNECTING) {
        this.connect();
      }
    }
  }

  // Send a message immediately without queueing
  sendImmediate(message) {
    try {
      const messageString = JSON.stringify(message);
      this.socket.send(messageString);
      this.log('Sent WebSocket message:', message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  // Subscribe to a specific message type
  subscribe(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }
    
    const callbacks = this.subscribers.get(type);
    callbacks.push(callback);
    
    // If this is a connection subscriber, notify immediately about current status
    if (type === 'connection') {
      this.connectionSubscribers.add(callback);
      // Immediately notify about current connection status
      setTimeout(() => callback({ connected: this.isConnected }), 0);
    }
    
    // Try to connect if we're subscribing and not connected
    if (!this.isConnected && !this.socket) {
      this.connect();
    }
    
    // Return unsubscribe function
    return () => {
      const updatedCallbacks = this.subscribers.get(type).filter(cb => cb !== callback);
      
      if (updatedCallbacks.length === 0) {
        this.subscribers.delete(type);
      } else {
        this.subscribers.set(type, updatedCallbacks);
      }
      
      if (type === 'connection') {
        this.connectionSubscribers.delete(callback);
      }
    };
  }

  // Notify all connection subscribers about connection status changes
  notifyConnectionSubscribers(status) {
    this.connectionSubscribers.forEach(callback => {
      try {
        callback(status);
      } catch (err) {
        console.error('Error in connection subscriber callback:', err);
      }
    });
  }

  // Check if we're currently connected
  isWebSocketConnected() {
    return this.isConnected;
  }
  
  // Debug logging function
  log(...args) {
    if (this.debugMode) {
      console.log('[WebSocketService]', ...args);
    }
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

export default webSocketService; 