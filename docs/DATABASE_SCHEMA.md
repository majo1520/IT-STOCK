# ReactStock Database Schema

## Overview

The ReactStock database schema is designed to efficiently manage inventory items, boxes, locations, users, and transaction history. The schema follows a relational model with optimized indexing and views for performant querying.

## Entity Relationship Diagram

```
+----------------+     +----------------+     +----------------+
|     USERS      |     |     BOXES      |     |   LOCATIONS    |
+----------------+     +----------------+     +----------------+
| id (PK)        |     | id (PK)        |     | id (PK)        |
| username       |     | box_number     |     | name           |
| password       |     | description    |     | description    |
| email          |     | serial_number  |     | color          |
| full_name      |     | status         |     +----------------+
| role           |     | shelf_id (FK)  |            ↑
| created_at     |     | location_id (FK)|------------+
| updated_at     |     | qr_code        |            |
+----------------+     | ean_code       |     +----------------+
      ↑                | created_at     |     |    SHELVES     |
      |                | updated_at     |     +----------------+
      |                | deleted_at     |     | id (PK)        |
      |                +----------------+     | name           |
      |                       ↑               | description    |
      |                       |               +----------------+
      |                       |                      ↑
      |                       |                      |
+-----+---------+     +------+--------+     +----------------+
| TRANSACTIONS  |     |     ITEMS     |     | ITEM_PROPERTIES|
+---------------+     +---------------+     +----------------+
| id (PK)       |     | id (PK)       |---->| id (PK)        |
| box_id (FK)   |-----| name          |     | item_id (FK)   |
| item_id (FK)  |     | description   |     | type           |
| user_id (FK)  |-----| quantity      |     | ean_code       |
| type          |     | box_id (FK)   |-----| serial_number  |
| notes         |     | parent_item_id|     | qr_code        |
| created_by    |     | supplier      |     | supplier       |
| created_at    |     | type          |     | purchase_date  |
+---------------+     | serial_number |     | expiry_date    |
                      | ean_code      |     | warranty_expiry|
+---------------+     | qr_code       |     | cost           |
|ITEM_TRANSACTIONS|   | status        |     | additional_data|
+---------------+     | notes         |     +----------------+
| id (PK)       |     | last_trans_at |
| item_id (FK)  |-----| last_trans_type|    +----------------+
| type          |     | created_at    |     | ITEM_TAGS      |
| quantity      |     | updated_at    |     +----------------+
| box_id (FK)   |-----| deleted_at    |     | id (PK)        |
| previous_box_id|    +---------------+     | name           |
| new_box_id    |            ↑              | color          |
| user_id (FK)  |-----+       |              +----------------+
| customer_id   |     |       |                     ↑
| notes         |     |       |                     |
| supplier      |     |       |              +----------------+
| reference_code|     |       |              |ITEM_TAG_RELATIONS|
| created_at    |     |       |              +----------------+
+---------------+     |       |              | item_id (FK)   |----+
                      |       |              | tag_id (FK)    |----+
+---------------+     |       |              +----------------+
|ITEM_AUDIT_LOG |     |       |
+---------------+     |       |              +----------------+
| id (PK)       |     |       |              | ITEM_IMAGES    |
| item_id (FK)  |-----+       |              +----------------+
| user_id (FK)  |-----+       |              | id (PK)        |
| action        |     |       |              | item_id (FK)   |----+
| changed_fields|     |       |              | image_url      |
| old_values    |     |       |              | is_primary     |
| new_values    |     |       +------------->+----------------+
| ip_address    |     |
| user_agent    |     |                      +----------------+
| created_at    |     |                      | CUSTOMERS      |
+---------------+     |                      +----------------+
                      |                      | id (PK)        |
                      |                      | name           |
                      |                      | contact_person |
                      +--------------------->| email          |
                                             | phone          |
                                             | address        |
                                             +----------------+
```

## Key Tables

### Core Tables

- **users**: Application users with roles and authentication info
- **boxes**: Physical boxes/containers where items are stored
- **items**: The core inventory items with essential fields
- **shelves**: Physical shelves where boxes are stored
- **locations**: Physical locations where shelves are located

### Properties and Tags

- **item_properties**: Extended properties for items (separate table to keep the items table lean)
- **item_tags**: Tags for categorizing items
- **item_tag_relations**: Connects items to tags (many-to-many)
- **item_images**: Stores images associated with items

### Transaction Tracking

- **transactions**: General transactions for both boxes and items
- **item_transactions**: Detailed transactions specific to items
- **transaction_metadata**: Additional transaction details
- **item_audit_log**: Complete audit trail of all item changes

## Materialized Views

- **items_complete_view**: Optimized materialized view combining core item data with properties, location, and summary information

## Database Features

- **Soft Delete**: Items are soft-deleted with a timestamp in deleted_at
- **Audit Trail**: All changes to items are logged with before/after values
- **Automatic Timestamps**: created_at and updated_at are maintained automatically
- **Performance Optimization**: Indexed fields and materialized views
- **Referential Integrity**: Foreign key constraints protect data integrity 