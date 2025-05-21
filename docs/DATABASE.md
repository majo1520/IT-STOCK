# ReactStock Database Schema

This document provides a comprehensive overview of the database schema used in the ReactStock inventory management system.

## Database Configuration

ReactStock supports multiple database backends:

- **SQLite** (default): Lightweight file-based database, ideal for development and small deployments
- **MySQL**: For medium to large deployments with higher performance requirements
- **PostgreSQL**: For enterprise-level deployments requiring advanced features

Database configuration is managed through environment variables in the `.env` file:

```
DB_TYPE=sqlite     # Options: sqlite, mysql, postgres
DB_PATH=./data.db  # Path for SQLite database file
DB_HOST=localhost  # Database host (MySQL/PostgreSQL)
DB_PORT=3306       # Database port (MySQL/PostgreSQL)
DB_NAME=reactstock # Database name (MySQL/PostgreSQL)
DB_USER=user       # Database username (MySQL/PostgreSQL)
DB_PASS=password   # Database password (MySQL/PostgreSQL)
```

## Entity Relationship Diagram

```
+---------------+       +---------------+       +---------------+
|     Users     |       |     Items     |       |  Categories   |
+---------------+       +---------------+       +---------------+
| id            |       | id            |       | id            |
| username      |       | name          |       | name          |
| password_hash |       | description   |       | description   |
| email         |       | quantity      |       | parent_id     |
| role          |       | type          |       | created_at    |
| created_at    |       | ean_code      |       | updated_at    |
| updated_at    |       | location      |       +---------------+
+---------------+       | serial_number |             |
       |                | category_id   |-------------+
       |                | created_at    |
       |                | updated_at    |
       |                +---------------+
       |                        |
       |                        |
+---------------+       +---------------+
| Transactions  |       |  Item_Images  |
+---------------+       +---------------+
| id            |       | id            |
| item_id       |-------| item_id       |
| user_id       |-------| image_url     |
| quantity      |       | is_primary    |
| type          |       | created_at    |
| notes         |       +---------------+
| created_at    |
+---------------+
```

## Tables Schema

### Users

Stores user authentication and authorization information.

| Column        | Type         | Constraints       | Description                       |
|---------------|--------------|-------------------|-----------------------------------|
| id            | INTEGER      | PK, AUTO_INCREMENT| Unique identifier                 |
| username      | VARCHAR(50)  | UNIQUE, NOT NULL  | User login name                   |
| password_hash | VARCHAR(255) | NOT NULL          | Bcrypt hashed password            |
| email         | VARCHAR(100) | UNIQUE, NOT NULL  | User email address                |
| role          | VARCHAR(20)  | NOT NULL          | User role (admin, user, etc.)     |
| created_at    | TIMESTAMP    | NOT NULL          | Account creation timestamp        |
| updated_at    | TIMESTAMP    | NOT NULL          | Last account update timestamp     |

Indexes:
- PRIMARY KEY on `id`
- UNIQUE INDEX on `username`
- UNIQUE INDEX on `email`

### Items

Stores inventory item information.

| Column        | Type         | Constraints       | Description                       |
|---------------|--------------|-------------------|-----------------------------------|
| id            | INTEGER      | PK, AUTO_INCREMENT| Unique identifier                 |
| name          | VARCHAR(100) | NOT NULL          | Item name                         |
| description   | TEXT         |                   | Item description                  |
| quantity      | INTEGER      | NOT NULL, DEFAULT 0| Current stock quantity           |
| type          | VARCHAR(50)  |                   | Item type                         |
| ean_code      | VARCHAR(100) | UNIQUE            | EAN/QR code for the item          |
| location      | VARCHAR(100) |                   | Storage location                  |
| serial_number | VARCHAR(100) |                   | Serial number if applicable       |
| category_id   | INTEGER      | FK                | Foreign key to categories table   |
| created_at    | TIMESTAMP    | NOT NULL          | Item creation timestamp           |
| updated_at    | TIMESTAMP    | NOT NULL          | Last item update timestamp        |

Indexes:
- PRIMARY KEY on `id`
- INDEX on `category_id`
- UNIQUE INDEX on `ean_code`
- INDEX on `name`

### Categories

Stores item categories with hierarchical structure.

| Column        | Type         | Constraints       | Description                       |
|---------------|--------------|-------------------|-----------------------------------|
| id            | INTEGER      | PK, AUTO_INCREMENT| Unique identifier                 |
| name          | VARCHAR(50)  | NOT NULL          | Category name                     |
| description   | TEXT         |                   | Category description              |
| parent_id     | INTEGER      | FK                | Parent category ID (for hierarchy)|
| created_at    | TIMESTAMP    | NOT NULL          | Category creation timestamp       |
| updated_at    | TIMESTAMP    | NOT NULL          | Last category update timestamp    |

Indexes:
- PRIMARY KEY on `id`
- INDEX on `parent_id`

### Transactions

Records all inventory movements and changes.

| Column        | Type         | Constraints       | Description                       |
|---------------|--------------|-------------------|-----------------------------------|
| id            | INTEGER      | PK, AUTO_INCREMENT| Unique identifier                 |
| item_id       | INTEGER      | FK, NOT NULL      | Foreign key to items table        |
| user_id       | INTEGER      | FK, NOT NULL      | Foreign key to users table        |
| quantity      | INTEGER      | NOT NULL          | Quantity changed                  |
| type          | VARCHAR(20)  | NOT NULL          | Transaction type (in, out, adjust)|
| notes         | TEXT         |                   | Transaction notes                 |
| created_at    | TIMESTAMP    | NOT NULL          | Transaction timestamp             |

Indexes:
- PRIMARY KEY on `id`
- INDEX on `item_id`
- INDEX on `user_id`
- INDEX on `created_at`

### Item_Images

Stores images associated with inventory items.

| Column        | Type         | Constraints       | Description                       |
|---------------|--------------|-------------------|-----------------------------------|
| id            | INTEGER      | PK, AUTO_INCREMENT| Unique identifier                 |
| item_id       | INTEGER      | FK, NOT NULL      | Foreign key to items table        |
| image_url     | VARCHAR(255) | NOT NULL          | URL or path to image file         |
| is_primary    | BOOLEAN      | NOT NULL, DEFAULT 0| Whether this is the main image   |
| created_at    | TIMESTAMP    | NOT NULL          | Image creation timestamp          |

Indexes:
- PRIMARY KEY on `id`
- INDEX on `item_id`

## Foreign Key Constraints

- `items.category_id` references `categories.id` (ON DELETE SET NULL)
- `categories.parent_id` references `categories.id` (ON DELETE SET NULL)
- `transactions.item_id` references `items.id` (ON DELETE CASCADE)
- `transactions.user_id` references `users.id` (ON DELETE CASCADE)
- `item_images.item_id` references `items.id` (ON DELETE CASCADE)

## Database Migrations

The database schema is managed through migrations, which are located in the `backend/migrations` directory. Migrations are automatically applied when the application starts or can be manually applied using the following command:

```bash
npm run db:migrate
```

To create a new migration:

```bash
npm run db:create-migration -- "add_new_field_to_items"
```

## Initial Data Seeding

The application includes seed data for development and testing purposes. Seed data can be applied using:

```bash
npm run db:seed
```

Default seed data includes:
- Admin user (username: admin, password: admin123)
- Sample categories
- Sample inventory items

## Backup and Restore

For SQLite databases, backup can be performed by copying the database file. For MySQL and PostgreSQL, use the respective database backup tools:

```bash
# SQLite backup
cp ./data.db ./data.db.backup

# MySQL backup
mysqldump -u user -p reactstock > backup.sql

# PostgreSQL backup
pg_dump -U user -W -F p reactstock > backup.sql
```

Restore procedures:

```bash
# SQLite restore
cp ./data.db.backup ./data.db

# MySQL restore
mysql -u user -p reactstock < backup.sql

# PostgreSQL restore
psql -U user -W reactstock < backup.sql
``` 