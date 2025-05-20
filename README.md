# ReactStock - Inventory Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=white)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-14.x-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14.x-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

ReactStock is a comprehensive inventory management system built with React for the frontend and Node.js for the backend. It provides tools for tracking inventory items, generating QR code labels, and managing stock efficiently.

![ReactStock Screenshot](docs/images/dashboard.png)

## Features

- **Item Management**: Add, edit, delete, and track inventory items
- **QR Code Generation**: Generate unique QR codes for each inventory item
- **Label Printing**: Print custom-sized labels (17x54mm) with QR codes for inventory tracking
- **User Authentication**: Secure login and user management
- **Responsive Design**: Works on desktop and mobile devices
- **Search & Filter**: Quickly find items in your inventory
- **Data Export**: Export inventory data to CSV or PDF
- **Activity Logs**: Track changes to inventory items
- **Barcode Scanning**: Scan box and item barcodes for quick stock management
- **Quick Stock Actions**: Perform stock in/out operations directly from scan results
- **Box-Item Filtering**: View only items in a specific box after scanning
- **System Health Monitoring**: Monitor system health including CPU, memory, and disk usage
- **Database Backup/Restore**: Built-in tools for database maintenance

## System Requirements

- Node.js 14.x or higher
- NPM 6.x or higher
- PostgreSQL 12.x or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/reactstock.git
cd reactstock
```

### 2. Set up the database

First, make sure PostgreSQL is installed and running. Then:

```bash
# Make the setup script executable
chmod +x setup_database.sh

# Run the setup script (adjust PostgreSQL user if needed)
./setup_database.sh
```

This script will:
- Create a new PostgreSQL database named "reactstock"
- Initialize the database schema with all tables, views, and functions
- Create a default admin user (username: admin, password: adminpass)

### 3. Configure the backend

```bash
cd backend

# Create a .env file
cp env.example .env

# Edit the .env file with your database credentials and other settings
nano .env
```

### 4. Install dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 5. Start the application

```bash
# Start backend server
cd backend
npm run dev

# In a new terminal, start frontend server
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Database Schema

ReactStock uses a PostgreSQL database with a comprehensive schema designed for efficient inventory management. Major components include:

### Core Tables
- **Users**: Application users and authentication
- **Items**: Inventory items with essential information
- **Boxes**: Physical storage containers
- **Locations**: Physical storage locations
- **Shelves**: Shelf locations within storage areas

### Transaction & History
- **Transactions**: Records all item movements
- **Item Audit Log**: Complete history of all changes

### Optimization Features
- **Materialized Views**: For fast querying of complex data
- **Indexes**: Optimized for common query patterns
- **Soft Delete**: Non-destructive item deletion

For a complete database schema diagram and details, see [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)

## Database Backup and Restore

ReactStock includes scripts to simplify database backup and recovery processes.

### Testing Database Export/Import

You can test the database export/import functionality with:

```bash
# Make the script executable
chmod +x test_db_export_import.sh

# Run the test
./test_db_export_import.sh
```

This script will:
1. Export your ReactStock database to a SQL file
2. Create a test database
3. Import the SQL file into the test database
4. Verify data integrity by comparing row counts
5. Optionally clean up the test artifacts

### Automated Backups

For regular database backups:

```bash
# Make the script executable
chmod +x db_backup.sh

# Run a backup
./db_backup.sh
```

This script:
- Creates timestamped backups in the "backups" directory
- Manages backup retention (keeps the 7 most recent backups by default)
- Logs backup operations
- Supports multiple PostgreSQL backup formats

To automate backups with cron, add a line like:
```
0 2 * * * /path/to/reactstock/db_backup.sh
```

### Database Restoration

To restore from a backup:

```bash
# Make the script executable
chmod +x db_restore.sh

# Run the restore script
./db_restore.sh
```

The restore script:
- Lists available backups
- Allows selection of backup file
- Handles dropping and recreating the database if needed
- Verifies the restoration by checking key tables

## System Health Monitoring

ReactStock includes a comprehensive system health monitoring dashboard in the admin panel. This dashboard provides real-time information about:

- CPU usage and details
- Memory usage and allocation
- Disk space and usage
- Network information
- Database status, connections, and size
- Running services and their status

Administrators can use this dashboard to ensure the system is running optimally and to troubleshoot any performance issues.

## Deployment for Production

For production deployment, follow these steps:

### 1. Build the frontend
```bash
cd frontend
npm run build
```

### 2. Set up environment for production
```bash
cd ../backend
# Edit .env for production settings
nano .env
```

Set the following in your .env file:
```
NODE_ENV=production
PORT=5000
# Add your production database credentials and other settings
```

### 3. Start the production server
```bash
npm start
```

For a more robust production setup, consider using:
- PM2 for process management
- Nginx as a reverse proxy
- SSL certificates for HTTPS

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.