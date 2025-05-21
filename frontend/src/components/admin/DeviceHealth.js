import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Table, Badge, Button, Spinner, ProgressBar, Dropdown } from 'react-bootstrap';
import { getSystemInfo } from '../../services/api';

const DeviceHealth = () => {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60000); // Default: 1 minute
  const intervalRef = useRef(null);

  const fetchSystemInfo = async () => {
    try {
      setRefreshing(true);
      // Use the API service instead of axios directly
      const response = await getSystemInfo();
      setSystemInfo(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching system info:', err);
      
      // Check for authentication or permission errors
      if (err.response) {
        if (err.response.status === 401) {
          setError('Authentication required. Please log in again.');
        } else if (err.response.status === 403) {
          setError('You do not have permission to access system information. Admin privileges required.');
        } else {
          setError(`Failed to load system information: ${err.response.data?.error || 'Unknown error'}`);
        }
      } else {
        setError('Failed to load system information. Network error or server unavailable.');
      }
      
      // For development/demo purposes - mock data when API isn't available
      setSystemInfo({
        hostname: 'reactstock-server',
        uptime: '23 days, 4 hours, 12 minutes',
        cpu: {
          model: 'Intel(R) Xeon(R) CPU @ 2.20GHz',
          cores: 4,
          usage: 32.5
        },
        memory: {
          total: 16384,
          used: 8192,
          free: 8192,
          usage: 50
        },
        disk: {
          total: 512000,
          used: 256000,
          free: 256000,
          usage: 50
        },
        network: {
          interfaces: ['eth0', 'lo'],
          ip: '192.168.1.10',
          received: '12.5 GB',
          transmitted: '5.8 GB'
        },
        database: {
          status: 'healthy',
          size: '345 MB',
          connections: 12,
          uptime: '23 days, 2 hours'
        },
        services: [
          { name: 'nginx', status: 'running', pid: 1234 },
          { name: 'postgresql', status: 'running', pid: 2345 },
          { name: 'node', status: 'running', pid: 3456 }
        ]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh interval change
  const handleIntervalChange = (interval) => {
    setRefreshInterval(interval);
    
    // Clear the existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set up new interval
    intervalRef.current = setInterval(fetchSystemInfo, interval);
  };

  useEffect(() => {
    fetchSystemInfo();
    
    // Set up interval for automatic refresh
    intervalRef.current = setInterval(fetchSystemInfo, refreshInterval);
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return <Badge bg="success">Running</Badge>;
      case 'stopped':
        return <Badge bg="danger">Stopped</Badge>;
      case 'warning':
        return <Badge bg="warning">Warning</Badge>;
      case 'healthy':
        return <Badge bg="success">Healthy</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const getUsageVariant = (usage) => {
    if (usage < 60) return 'success';
    if (usage < 80) return 'warning';
    return 'danger';
  };

  const getIntervalLabel = (ms) => {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  };

  if (loading && !systemInfo) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading system information...</p>
      </div>
    );
  }

  if (error && !systemInfo) {
    return (
      <div className="alert alert-danger">
        <h5><i className="bi bi-exclamation-triangle-fill me-2"></i>Error Loading System Information</h5>
        <p>{error}</p>
        {error.includes('permission') && (
          <div className="mt-2 mb-2 p-2 bg-light border rounded">
            <small>
              <strong>Note:</strong> To access this section, you need administrator privileges. 
              Please contact your system administrator if you believe you should have access.
            </small>
          </div>
        )}
        <Button variant="outline-primary" onClick={fetchSystemInfo}>
          <i className="bi bi-arrow-clockwise me-1"></i> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="device-health-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>System Health Dashboard</h3>
        <div className="d-flex">
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="outline-secondary" id="refresh-dropdown">
              <i className="bi bi-clock me-1"></i>
              Auto Refresh: {getIntervalLabel(refreshInterval)}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item 
                active={refreshInterval === 10000} 
                onClick={() => handleIntervalChange(10000)}
              >
                10 seconds
              </Dropdown.Item>
              <Dropdown.Item 
                active={refreshInterval === 30000} 
                onClick={() => handleIntervalChange(30000)}
              >
                30 seconds
              </Dropdown.Item>
              <Dropdown.Item 
                active={refreshInterval === 60000} 
                onClick={() => handleIntervalChange(60000)}
              >
                1 minute
              </Dropdown.Item>
              <Dropdown.Item 
                active={refreshInterval === 300000} 
                onClick={() => handleIntervalChange(300000)}
              >
                5 minutes
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button 
            variant="outline-primary" 
            onClick={fetchSystemInfo} 
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Spinner 
                  as="span" 
                  animation="border" 
                  size="sm" 
                  role="status" 
                  aria-hidden="true" 
                />
                <span className="ms-2">Refreshing...</span>
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <Card className="mb-4">
        <Card.Header className="bg-primary text-white">
          <i className="bi bi-pc-display me-2"></i>
          System Overview
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">Hostname:</dt>
                <dd className="col-sm-8">{systemInfo.hostname}</dd>
                
                <dt className="col-sm-4">IP Address:</dt>
                <dd className="col-sm-8">{systemInfo.network.ip}</dd>
                
                <dt className="col-sm-4">Uptime:</dt>
                <dd className="col-sm-8">{systemInfo.uptime}</dd>
              </dl>
            </Col>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">CPU Model:</dt>
                <dd className="col-sm-8">{systemInfo.cpu.model}</dd>
                
                <dt className="col-sm-4">CPU Cores:</dt>
                <dd className="col-sm-8">{systemInfo.cpu.cores}</dd>
                
                <dt className="col-sm-4">Database:</dt>
                <dd className="col-sm-8">
                  {getStatusBadge(systemInfo.database.status)} {systemInfo.database.size}
                </dd>
              </dl>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Resource Usage */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="h-100">
            <Card.Header className="bg-info text-white">
              <i className="bi bi-cpu me-2"></i>
              CPU Usage
            </Card.Header>
            <Card.Body>
              <h3 className="display-5 text-center mb-3">{systemInfo.cpu.usage}%</h3>
              <ProgressBar 
                variant={getUsageVariant(systemInfo.cpu.usage)} 
                now={systemInfo.cpu.usage} 
                className="mb-3"
              />
              <p className="small text-muted text-center mb-0">
                {systemInfo.cpu.model}
              </p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="h-100">
            <Card.Header className="bg-primary text-white">
              <i className="bi bi-memory me-2"></i>
              Memory Usage
            </Card.Header>
            <Card.Body>
              <h3 className="display-5 text-center mb-3">{systemInfo.memory.usage}%</h3>
              <ProgressBar 
                variant={getUsageVariant(systemInfo.memory.usage)} 
                now={systemInfo.memory.usage} 
                className="mb-3"
              />
              <p className="small text-muted text-center mb-0">
                {Math.round(systemInfo.memory.used / 1024)} GB / {Math.round(systemInfo.memory.total / 1024)} GB
              </p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="h-100">
            <Card.Header className="bg-success text-white">
              <i className="bi bi-hdd me-2"></i>
              Disk Usage
            </Card.Header>
            <Card.Body>
              <h3 className="display-5 text-center mb-3">{systemInfo.disk.usage}%</h3>
              <ProgressBar 
                variant={getUsageVariant(systemInfo.disk.usage)} 
                now={systemInfo.disk.usage} 
                className="mb-3"
              />
              <p className="small text-muted text-center mb-0">
                {Math.round(systemInfo.disk.used / 1024)} GB / {Math.round(systemInfo.disk.total / 1024)} GB
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Services Status */}
      <Card className="mb-4">
        <Card.Header className="bg-secondary text-white">
          <i className="bi bi-gear me-2"></i>
          Service Status
        </Card.Header>
        <Card.Body>
          <Table striped hover responsive size="sm">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>PID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {systemInfo.services.map((service, index) => (
                <tr key={index}>
                  <td><i className="bi bi-gear-fill me-2"></i>{service.name}</td>
                  <td>{getStatusBadge(service.status)}</td>
                  <td>{service.pid}</td>
                  <td>
                    <Button variant="outline-primary" size="sm" className="me-2" title="Restart service">
                      <i className="bi bi-arrow-clockwise"></i>
                    </Button>
                    {service.status === 'running' ? (
                      <Button variant="outline-danger" size="sm" title="Stop service">
                        <i className="bi bi-stop-circle"></i>
                      </Button>
                    ) : (
                      <Button variant="outline-success" size="sm" title="Start service">
                        <i className="bi bi-play-circle"></i>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Database Information */}
      <Card className="mb-4">
        <Card.Header className="bg-info text-white">
          <i className="bi bi-database me-2"></i>
          Database Information
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">Status:</dt>
                <dd className="col-sm-8">{getStatusBadge(systemInfo.database.status)}</dd>
                
                <dt className="col-sm-4">Size:</dt>
                <dd className="col-sm-8">{systemInfo.database.size}</dd>
              </dl>
            </Col>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">Connections:</dt>
                <dd className="col-sm-8">{systemInfo.database.connections}</dd>
                
                <dt className="col-sm-4">Uptime:</dt>
                <dd className="col-sm-8">{systemInfo.database.uptime}</dd>
              </dl>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Network Information */}
      <Card>
        <Card.Header className="bg-warning text-dark">
          <i className="bi bi-hdd-network me-2"></i>
          Network Information
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">IP Address:</dt>
                <dd className="col-sm-8">{systemInfo.network.ip}</dd>
                
                <dt className="col-sm-4">Interfaces:</dt>
                <dd className="col-sm-8">{systemInfo.network.interfaces.join(', ')}</dd>
              </dl>
            </Col>
            <Col md={6}>
              <dl className="row">
                <dt className="col-sm-4">Received:</dt>
                <dd className="col-sm-8">{systemInfo.network.received}</dd>
                
                <dt className="col-sm-4">Transmitted:</dt>
                <dd className="col-sm-8">{systemInfo.network.transmitted}</dd>
              </dl>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default DeviceHealth; 