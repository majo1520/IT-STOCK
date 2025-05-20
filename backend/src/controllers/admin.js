const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

const execPromise = promisify(exec);

/**
 * Get system information for the admin dashboard
 */
const getSystemInfo = async (req, res) => {
  try {
    // Basic system information
    const hostname = os.hostname();
    const platform = os.platform();
    const uptime = formatUptime(os.uptime());
    const cpuInfo = os.cpus()[0];
    const cpuUsage = await getCpuUsage();
    
    // Memory information
    const totalMemory = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemory = Math.round(os.freemem() / (1024 * 1024));
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
    
    // Disk information
    const diskInfo = await getDiskInfo();
    
    // Network information
    const networkInterfaces = Object.keys(os.networkInterfaces());
    const networkInfo = await getNetworkInfo();
    
    // Database information
    const dbInfo = await getDatabaseInfo();
    
    // Services information
    const services = await getServicesInfo();
    
    // Combine all information
    const systemInfo = {
      hostname,
      platform,
      uptime,
      cpu: {
        model: cpuInfo ? cpuInfo.model : 'Unknown',
        cores: os.cpus().length,
        usage: cpuUsage
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: memoryUsage
      },
      disk: diskInfo,
      network: {
        interfaces: networkInterfaces,
        ...networkInfo
      },
      database: dbInfo,
      services
    };
    
    res.json(systemInfo);
  } catch (error) {
    logger.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
};

/**
 * Format uptime in days, hours, minutes
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  let uptime = '';
  if (days > 0) uptime += `${days} days, `;
  if (hours > 0 || days > 0) uptime += `${hours} hours, `;
  uptime += `${minutes} minutes`;
  
  return uptime;
};

/**
 * Get CPU usage
 */
const getCpuUsage = async () => {
  try {
    // Different commands based on platform
    let cmd;
    if (os.platform() === 'linux') {
      cmd = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
    } else if (os.platform() === 'darwin') {
      cmd = "top -l 1 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'";
    } else {
      // For Windows or unsupported platforms, use Node.js process CPU usage as fallback
      const startUsage = process.cpuUsage();
      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);
      // Calculate percent
      return Math.round(((endUsage.user + endUsage.system) / (100 * 1000)) * 100);
    }
    
    const { stdout } = await execPromise(cmd);
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    logger.error('Error getting CPU usage:', error);
    return 0;
  }
};

/**
 * Get disk information
 */
const getDiskInfo = async () => {
  try {
    let cmd;
    if (os.platform() === 'linux' || os.platform() === 'darwin') {
      cmd = "df -k / | awk 'NR==2 {print $2,$3,$4,$5}'";
    } else {
      // Return estimated values for non-UNIX systems
      return {
        total: 100000,
        used: 50000,
        free: 50000,
        usage: 50
      };
    }
    
    const { stdout } = await execPromise(cmd);
    const [total, used, free, usage] = stdout.trim().split(/\s+/);
    
    return {
      total: parseInt(total, 10),
      used: parseInt(used, 10),
      free: parseInt(free, 10),
      usage: parseInt(usage, 10) || 0
    };
  } catch (error) {
    logger.error('Error getting disk info:', error);
    return {
      total: 100000,
      used: 50000,
      free: 50000,
      usage: 50
    };
  }
};

/**
 * Get network information
 */
const getNetworkInfo = async () => {
  try {
    let ip = '';
    // Get primary IP address
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          ip = iface.address;
          break;
        }
      }
      if (ip) break;
    }
    
    // For actual network throughput we would need historical data
    // For now, we'll return mock data
    return {
      ip,
      received: '10.2 GB',
      transmitted: '4.5 GB'
    };
  } catch (error) {
    logger.error('Error getting network info:', error);
    return {
      ip: '127.0.0.1',
      received: '0 B',
      transmitted: '0 B'
    };
  }
};

/**
 * Get database information
 */
const getDatabaseInfo = async () => {
  let client;
  try {
    client = await pool.connect();
    
    // Database size
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    
    // Database connections
    const connectionsResult = await client.query(`
      SELECT count(*) as connections FROM pg_stat_activity;
    `);
    
    // Database uptime
    const uptimeResult = await client.query(`
      SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime;
    `);
    
    const size = sizeResult.rows[0]?.size || '0 MB';
    const connections = parseInt(connectionsResult.rows[0]?.connections, 10) || 0;
    
    // Handle the uptime data carefully
    let dbUptime;
    try {
      dbUptime = uptimeResult.rows[0]?.uptime || '0';
      // If dbUptime is not a string, convert it
      if (typeof dbUptime !== 'string') {
        // For PostgreSQL, it might return an interval object
        if (dbUptime.hours !== undefined || dbUptime.minutes !== undefined) {
          const hours = dbUptime.hours || 0;
          const minutes = dbUptime.minutes || 0;
          dbUptime = `${hours}:${minutes}:00`;
        } else {
          // Default case - stringify the object
          dbUptime = JSON.stringify(dbUptime);
        }
      }
    } catch (uptimeError) {
      logger.error('Error processing database uptime:', uptimeError);
      dbUptime = '0';
    }
    
    if (client) client.release();
    
    return {
      status: 'healthy',
      size,
      connections,
      uptime: formatDatabaseUptime(dbUptime)
    };
  } catch (error) {
    logger.error('Error getting database info:', error);
    if (client) client.release();
    
    return {
      status: 'error',
      size: '0 MB',
      connections: 0,
      uptime: '0'
    };
  }
};

/**
 * Format database uptime
 */
const formatDatabaseUptime = (uptime) => {
  if (!uptime) return '0';
  
  // Convert PostgreSQL interval to something readable
  // Sample input: '5 days 02:03:04'
  try {
    // Ensure uptime is a string
    const uptimeStr = String(uptime);
    
    // Check if uptime contains 'days'
    if (uptimeStr.includes('days') || uptimeStr.includes('day')) {
      let parts = uptimeStr.split(' days ');
      if (parts.length === 1) {
        parts = uptimeStr.split(' day '); // Handle singular case
      }
      const days = parseInt(parts[0], 10);
      const timeStr = parts[1] || '00:00:00';
      const [hours, minutes] = timeStr.split(':');
      
      return `${days} days, ${parseInt(hours, 10)} hours, ${parseInt(minutes, 10)} minutes`;
    } else {
      // Just hours:minutes:seconds
      const [hours, minutes] = uptimeStr.split(':');
      return `${parseInt(hours, 10) || 0} hours, ${parseInt(minutes, 10) || 0} minutes`;
    }
  } catch (error) {
    logger.error('Error formatting database uptime:', error);
    // Return a safe default string
    return typeof uptime === 'object' ? JSON.stringify(uptime) : String(uptime);
  }
};

/**
 * Get services information (mock data for now)
 */
const getServicesInfo = async () => {
  try {
    // For a real implementation, check actual services status
    // For example: systemctl status nginx, postgresql, etc.
    // Or use pm2 list for node services
    
    // Mock data for demonstration
    return [
      { name: 'nginx', status: 'running', pid: 1234 },
      { name: 'postgresql', status: 'running', pid: 2345 },
      { name: 'node', status: 'running', pid: 3456 }
    ];
  } catch (error) {
    logger.error('Error getting services info:', error);
    return [];
  }
};

module.exports = {
  getSystemInfo
}; 