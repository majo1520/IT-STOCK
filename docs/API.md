# ReactStock API Documentation

This document provides detailed information about the ReactStock REST API endpoints, request/response formats, and authentication requirements.

## Base URL

The base URL for all API endpoints is:

```
http://localhost:5000/api
```

For production deployments, replace with your domain.

## Authentication

Most API endpoints require authentication using JSON Web Tokens (JWT).

### Authentication Headers

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

To obtain a JWT token, use the login endpoint:

```
POST /api/auth/login
```

### POST /api/auth/login
Login with username and password

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "JWT_TOKEN_HERE",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### POST /api/auth/register
Register a new user (admin only)

## API Endpoints

### Authentication

#### Register User

Creates a new user account.

```
POST /api/auth/register
```

**Request Body:**

```json
{
  "username": "newuser",
  "password": "password123",
  "email": "newuser@example.com",
  "role": "user"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "user"
  }
}
```

**Status Codes:**
- `201 Created`: User created successfully
- `400 Bad Request`: Invalid input or user already exists

#### Get Current User

Returns information about the currently authenticated user.

```
GET /api/auth/me
```

**Response:**

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-01-01T12:00:00Z"
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated

### Items

#### Get All Items

Returns a list of inventory items with optional filtering and pagination.

```
GET /api/items
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for item name or description
- `category` (optional): Filter by category ID
- `sort` (optional): Sort field (name, quantity, created_at)
- `order` (optional): Sort order (asc, desc)

**Response:**

```json
{
  "items": [
    {
      "id": 1,
      "name": "EPSON 112 BLACK",
      "description": "Black toner cartridge for Epson printers",
      "quantity": 10,
      "type": "Toner",
      "ean_code": "EPL-IT-STOCK-15-56NO",
      "location": "Shelf A1",
      "serial_number": null,
      "category_id": 3,
      "created_at": "2023-01-15T09:30:00Z",
      "updated_at": "2023-01-15T09:30:00Z"
    },
    // More items...
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated

#### Get Item by ID

Returns details for a specific inventory item.

```
GET /api/items/:id
```

**Response:**

```json
{
  "id": 1,
  "name": "EPSON 112 BLACK",
  "description": "Black toner cartridge for Epson printers",
  "quantity": 10,
  "type": "Toner",
  "ean_code": "EPL-IT-STOCK-15-56NO",
  "location": "Shelf A1",
  "serial_number": null,
  "category_id": 3,
  "category": {
    "id": 3,
    "name": "Printer Supplies"
  },
  "images": [
    {
      "id": 1,
      "image_url": "/uploads/items/epson-112-black.jpg",
      "is_primary": true
    }
  ],
  "created_at": "2023-01-15T09:30:00Z",
  "updated_at": "2023-01-15T09:30:00Z"
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Item not found
- `401 Unauthorized`: Not authenticated

#### Create Item

Creates a new inventory item.

```
POST /api/items
```

**Request Body:**

```json
{
  "name": "EPSON 112 CYAN",
  "description": "Cyan toner cartridge for Epson printers",
  "quantity": 5,
  "type": "Toner",
  "ean_code": "EPL-IT-STOCK-12-LYQL",
  "location": "Shelf A1",
  "serial_number": null,
  "category_id": 3
}
```

**Response:**

```json
{
  "id": 2,
  "name": "EPSON 112 CYAN",
  "description": "Cyan toner cartridge for Epson printers",
  "quantity": 5,
  "type": "Toner",
  "ean_code": "EPL-IT-STOCK-12-LYQL",
  "location": "Shelf A1",
  "serial_number": null,
  "category_id": 3,
  "created_at": "2023-06-15T14:22:00Z",
  "updated_at": "2023-06-15T14:22:00Z"
}
```

**Status Codes:**
- `201 Created`: Item created successfully
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions

#### Update Item

Updates an existing inventory item.

```
PUT /api/items/:id
```

**Request Body:**

```json
{
  "name": "EPSON 112 CYAN",
  "description": "Cyan toner cartridge for Epson printers",
  "quantity": 8,
  "location": "Shelf A2"
}
```

**Response:**

```json
{
  "id": 2,
  "name": "EPSON 112 CYAN",
  "description": "Cyan toner cartridge for Epson printers",
  "quantity": 8,
  "type": "Toner",
  "ean_code": "EPL-IT-STOCK-12-LYQL",
  "location": "Shelf A2",
  "serial_number": null,
  "category_id": 3,
  "created_at": "2023-06-15T14:22:00Z",
  "updated_at": "2023-06-15T15:30:00Z"
}
```

**Status Codes:**
- `200 OK`: Item updated successfully
- `400 Bad Request`: Invalid input
- `404 Not Found`: Item not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions

#### Delete Item

Deletes an inventory item.

```
DELETE /api/items/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

**Status Codes:**
- `200 OK`: Item deleted successfully
- `404 Not Found`: Item not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions

### Categories

#### Get All Categories

Returns a list of all categories.

```
GET /api/categories
```

**Response:**

```json
[
  {
    "id": 1,
    "name": "Hardware",
    "description": "Computer hardware and components",
    "parent_id": null,
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z"
  },
  {
    "id": 2,
    "name": "Peripherals",
    "description": "Computer peripherals",
    "parent_id": 1,
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z"
  },
  // More categories...
]
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated

#### Get Category by ID

Returns details for a specific category.

```
GET /api/categories/:id
```

**Response:**

```json
{
  "id": 3,
  "name": "Printer Supplies",
  "description": "Toners, ink cartridges, and other printer supplies",
  "parent_id": 2,
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-01-01T12:00:00Z",
  "items": [
    {
      "id": 1,
      "name": "EPSON 112 BLACK",
      "quantity": 10
    },
    {
      "id": 2,
      "name": "EPSON 112 CYAN",
      "quantity": 8
    }
    // More items...
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Category not found
- `401 Unauthorized`: Not authenticated

### Transactions

#### Get Item Transactions

Returns transaction history for a specific item.

```
GET /api/items/:id/transactions
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**

```json
{
  "transactions": [
    {
      "id": 1,
      "item_id": 2,
      "user_id": 1,
      "user": {
        "username": "admin"
      },
      "quantity": 5,
      "type": "in",
      "notes": "Initial stock",
      "created_at": "2023-06-15T14:22:00Z"
    },
    {
      "id": 2,
      "item_id": 2,
      "user_id": 1,
      "user": {
        "username": "admin"
      },
      "quantity": 3,
      "type": "in",
      "notes": "Restocking",
      "created_at": "2023-06-15T15:30:00Z"
    }
    // More transactions...
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Item not found
- `401 Unauthorized`: Not authenticated

#### Create Transaction

Records a new transaction for an item.

```
POST /api/items/:id/transactions
```

**Request Body:**

```json
{
  "quantity": 3,
  "type": "out",
  "notes": "Used for printer maintenance"
}
```

**Response:**

```json
{
  "id": 3,
  "item_id": 2,
  "user_id": 1,
  "quantity": 3,
  "type": "out",
  "notes": "Used for printer maintenance",
  "created_at": "2023-06-16T10:15:00Z"
}
```

**Status Codes:**
- `201 Created`: Transaction created successfully
- `400 Bad Request`: Invalid input
- `404 Not Found`: Item not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- 100 requests per minute per IP address
- 1000 requests per hour per user

When rate limits are exceeded, the API returns a `429 Too Many Requests` status code.

## Versioning

The current API version is v1. The version is included in the URL path:

```
/api/v1/items
```

For backward compatibility, requests to `/api/items` are automatically routed to the latest stable API version.

## Webhooks

ReactStock supports webhooks for real-time notifications about inventory changes:

```
POST /api/webhooks
```

**Request Body:**

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["item.created", "item.updated", "item.deleted"],
  "secret": "your_webhook_secret"
}
```

Webhook payloads include the event type and relevant data:

```json
{
  "event": "item.updated",
  "timestamp": "2023-06-16T10:15:00Z",
  "data": {
    "id": 2,
    "name": "EPSON 112 CYAN",
    "quantity": 5,
    // Other item fields...
  }
}
```

## Boxes

### GET /api/boxes
Get all boxes

### GET /api/boxes/:id
Get a single box

### POST /api/boxes
Create a new box

### PUT /api/boxes/:id
Update an existing box

### DELETE /api/boxes/:id
Delete a box

## Transactions

### GET /api/transactions
Get all transactions

### POST /api/transactions
Create a new transaction

## Admin

### GET /api/admin/system-info
Get system health information

**Response:**
```json
{
  "hostname": "reactstock-server",
  "uptime": "23 days, 4 hours, 12 minutes",
  "cpu": {
    "model": "Intel(R) Xeon(R) CPU @ 2.20GHz",
    "cores": 4,
    "usage": 32.5
  },
  "memory": {
    "total": 16384,
    "used": 8192,
    "free": 8192,
    "usage": 50
  },
  "disk": {
    "total": 512000,
    "used": 256000,
    "free": 256000,
    "usage": 50
  },
  "network": {
    "interfaces": ["eth0", "lo"],
    "ip": "192.168.1.10",
    "received": "12.5 GB",
    "transmitted": "5.8 GB"
  },
  "database": {
    "status": "healthy",
    "size": "345 MB",
    "connections": 12,
    "uptime": "23 days, 2 hours"
  },
  "services": [
    { "name": "nginx", "status": "running", "pid": 1234 },
    { "name": "postgresql", "status": "running", "pid": 2345 },
    { "name": "node", "status": "running", "pid": 3456 }
  ]
}
```

## Users

### GET /api/users
Get all users (admin only)

### GET /api/users/:id
Get a single user

### POST /api/users
Create a new user (admin only)

### PUT /api/users/:id
Update a user

### DELETE /api/users/:id
Delete a user (admin only) 