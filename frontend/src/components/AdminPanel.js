import React, { useState } from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import RemovalReasonManagement from './RemovalReasonManagement';
import DatabaseTools from './admin/DatabaseTools';
import DeletedItemsManager from './DeletedItemsManager';
import UserManagement from './admin/UserManagement';
import DeviceHealth from './admin/DeviceHealth';

function AdminPanel() {
  const [key, setKey] = useState('users');
  
  return (
    <div className="container-fluid mt-4">
      <h2 className="mb-4">Admin Panel</h2>
      
      <Tabs
        id="admin-tabs"
        activeKey={key}
        onSelect={(k) => setKey(k)}
        className="mb-4"
      >
        <Tab eventKey="users" title="User Management">
          <UserManagement />
        </Tab>
        <Tab eventKey="removal-reasons" title="Removal Reasons">
          <RemovalReasonManagement />
        </Tab>
        <Tab eventKey="deleted-items" title="Deleted Items">
          <DeletedItemsManager />
        </Tab>
        <Tab eventKey="device-health" title="Device Health">
          <DeviceHealth />
        </Tab>
        <Tab eventKey="migration" title="Database Tools">
          <DatabaseTools />
        </Tab>
      </Tabs>
    </div>
  );
}

export default AdminPanel; 