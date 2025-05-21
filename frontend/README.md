# IT Stock Europlac - Frontend

This is the frontend application for the IT Stock Europlac inventory management system.

## Technology Stack

- React
- React Router
- Axios for API communication
- Bootstrap for styling

## Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The frontend will be accessible at http://localhost:3000.

## Building for Production

To create a production build:
```bash
npm run build
```

This will create optimized files in the `dist` directory.

## Components

- **BoxList**: Displays a list of all boxes with basic information
- **BoxDetail**: Shows detailed information about a box and its transaction history
- **BoxForm**: Form for creating and editing boxes

## API Connection

The application connects to the backend API using Axios. The base URL is configured to use:
- `http://localhost:5000/api` in development
- `/api` in production (for when the frontend is served by the same server as the backend)

All API calls are centralized in the `src/services/api.js` file. 