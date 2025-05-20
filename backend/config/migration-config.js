const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  migrationDirectory: 'migrations',
  driver: 'pg',
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  // SSL options for production environments
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Schema management
  schema: 'public',
  // Migration table - where migration state is stored
  migrationsTable: 'pgmigrations',
  // Migration pattern - how to find migration files
  migrationsPattern: 'migrations/*.js',
  // Transaction behavior
  singleTransaction: true,
}; 