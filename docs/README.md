# ReactStock Documentation

This directory contains documentation for the ReactStock inventory management system.

## Contents

- [Database Schema](DATABASE_SCHEMA.md) - Detailed information about the database design
- [Database Management](DATABASE_MANAGEMENT.md) - Guide for database backup, restore, and maintenance
- [Images](./images/) - Screenshots and diagrams
- [API Documentation](API.md) - API endpoint documentation (to be created)
- [User Guide](USER_GUIDE.md) - End-user documentation (to be created)

## Getting Started

For installation and setup instructions, please refer to the main [README.md](../README.md) in the project root.

## Development Workflow

1. Set up the development environment following the installation instructions
2. Make changes to the code
3. Test your changes
4. Submit a pull request

## Documentation Guidelines

When updating documentation:

1. Use Markdown for all documentation files
2. Keep screenshots up-to-date with the latest UI
3. Document API changes in API.md
4. Update the database schema documentation when changing the database structure

## Project Structure

```
reactstock/
├── backend/               # Node.js backend code
│   ├── config/            # Configuration files
│   ├── migrations/        # Database migrations
│   └── src/               # Source code
│       ├── controllers/   # API controllers
│       ├── middleware/    # Express middleware
│       ├── models/        # Data models
│       └── routes/        # API routes
├── frontend/              # React frontend code
│   ├── public/            # Static files
│   └── src/               # Source code
│       ├── assets/        # Images, fonts, etc.
│       ├── components/    # React components
│       ├── contexts/      # React context providers
│       ├── hooks/         # Custom React hooks
│       ├── pages/         # Page components
│       └── services/      # API services
├── docs/                  # Documentation
└── setup.sql              # Database setup script
``` 