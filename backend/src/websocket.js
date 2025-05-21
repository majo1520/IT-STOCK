const WebSocket = require('ws');
const logger = require('../utils/logger');
const url = require('url');

// Create WebSocket server
const createWebSocketServer = (server) => {
  // Configure WebSocket server to handle connections on the /ws path
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws' 
  });
  
  // Connected clients
  const clients = new Set();
  
  // Handle connection
  wss.on('connection', (ws, req) => {
    // Log connection details
    const ip = req.socket.remoteAddress;
    const clientUrl = req.url;
    logger.info(`WebSocket client connected from ${ip}. Path: ${clientUrl}`);
    
    // Add client to set
    clients.add(ws);
    logger.info(`Total WebSocket clients: ${clients.size}`);
    
    // Send initial connection message
    ws.send(JSON.stringify({ 
      type: 'connection', 
      message: 'Connected to ReactStock WebSocket server',
      timestamp: new Date().toISOString()
    }));
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug('Received WebSocket message:', data);
        
        // Handle specific message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } else if (data.type === 'pong') {
          // Client responded to our ping
          logger.debug('Received pong from client');
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`WebSocket client disconnected. Remaining clients: ${clients.size}`);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast to all connected clients
  const broadcast = (data) => {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    
    let activeClients = 0;
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        activeClients++;
      }
    });
    
    logger.debug(`Broadcast message sent to ${activeClients} of ${clients.size} clients`);
  };
  
  // Broadcast item updates to all clients
  const notifyItemChange = (action, items) => {
    broadcast({
      type: 'item_update',
      action: action, // 'create', 'update', 'delete', 'restore', etc.
      items: Array.isArray(items) ? items : [items],
      timestamp: new Date().toISOString()
    });
  };
  
  // Notify clients to refresh their data
  const notifyRefreshNeeded = (tableType = 'items') => {
    broadcast({
      type: 'refresh_needed',
      tableType: tableType,
      timestamp: new Date().toISOString()
    });
  };
  
  // Setup ping interval to keep connections alive
  setInterval(() => {
    if (clients.size > 0) {
      broadcast({
        type: 'ping',
        timestamp: new Date().toISOString()
      });
      logger.debug(`Sent ping to ${clients.size} clients`);
    }
  }, 30000); // Send ping every 30 seconds
  
  // Return interface
  return {
    notifyItemChange,
    notifyRefreshNeeded,
    getClientCount: () => clients.size
  };
};

module.exports = { createWebSocketServer }; 