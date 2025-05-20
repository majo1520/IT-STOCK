# PostgreSQL Item System Rebuild

This document outlines the optimized PostgreSQL item system designed for production use. The new system offers improved stability, performance, and maintainability over the previous implementation.

## Key Improvements

1. **Proper Data Separation**: Clear separation between core item data and extended properties
2. **Type Safety**: Added custom ENUM types for better data validation and consistency
3. **Optimized Indexing**: Comprehensive indexing strategy for faster queries
4. **Full Text Search**: Added trigram-based indexes for efficient text search
5. **Robust Audit Trail**: Complete history of all item changes
6. **Materialized Views**: Pre-computed complex data for dashboard efficiency
7. **Transaction-Based Inventory**: All quantity changes are transaction-based
8. **Enhanced Metadata**: Support for tagging, categorization, and extended properties
9. **Soft Delete Support**: Items are never actually deleted, only marked as deleted
10. **Clean Migration Path**: Safe migration from the old schema

## Database Schema

### Core Tables

1. **items** - Main table with essential fields only
   - `id`, `name`, `description`, `quantity`, `box_id`, `parent_item_id`, `status`, `created_at`, `updated_at`, `deleted_at`

2. **item_properties** - Extended item properties
   - `item_id`, `type`, `ean_code`, `serial_number`, `qr_code`, `supplier`, `purchase_date`, `expiry_date`, `warranty_expiry`, etc.

3. **item_images** - Multiple images per item
   - `item_id`, `image_url`, `is_primary`

4. **item_tags** and **item_tag_relations** - Flexible tagging system
   - Tags are reusable across multiple items
   - Color-coded tags for visual organization

### Transaction Tracking

1. **item_transactions** - Comprehensive transaction history
   - Records all inventory movements (in, out, transfer, adjustment)
   - Links to boxes, users, and customers
   - Preserves history across item lifecycle

2. **transaction_metadata** - Additional transaction context
   - Extended fields for business processes (invoices, approvals)
   - JSONB field for flexible additional data

### Audit Trail

**item_audit_log** - Complete history of item changes
   - Tracks what changed, when, by whom, and both old/new values
   - IP address and user agent tracking for security

## Views and Materialized Views

1. **items_with_properties** - Regular view combining core data and properties
   - Real-time combined data for queries

2. **items_complete_data** - Materialized view for dashboards and reports
   - Pre-computed aggregates and calculations
   - Automatically refreshed when underlying data changes

## Triggers and Functions

1. **update_modified_column** - Automatic timestamp updates
2. **log_item_changes** - Comprehensive audit logging
3. **refresh_items_complete_data** - View refresh management
4. **soft_delete_item** - Handles soft deletes
5. **update_item_quantity_from_transaction** - Transaction-based quantity changes

## Migration Process

The migration to the new system can be performed using the provided `migration_to_new_item_system.js` script, which handles:

1. Database backup before any changes
2. Renaming existing tables
3. Creating new schema
4. Migrating data from old to new tables
5. Migrating transaction history
6. Refreshing materialized views
7. Verification of migrated data
8. Option to rollback or commit changes

## Executing the Migration

```bash
# Make sure your database configuration is correct in backend/config/database.js
node migration_to_new_item_system.js
```

The migration script includes multiple safety checks and will prompt for confirmation at critical points.

## Performance Considerations

1. **Indexes**: All common query patterns are covered by indexes
2. **Materialized Views**: Complex queries are pre-computed
3. **Concurrent Refresh**: Materialized views refresh without blocking reads
4. **Trigram Indexes**: Fast text search on item names and descriptions
5. **JSONB**: Flexible storage with index support for complex property data

## Best Practices for Using the New System

1. **Always use transactions** for modifying data
2. **Use the API endpoints** rather than direct database access
3. **Don't manually update quantity** - use item_transactions instead
4. **Leverage the tag system** for flexible categorization
5. **Use the audit log** for troubleshooting and compliance
6. **Consider periodic maintenance** of materialized views
7. **Back up regularly** including the transaction logs

## API Integration

The new schema is designed to work seamlessly with the existing API structure. Key integration points:

1. **GET /items** - Now leverages the materialized view for faster responses
2. **POST /items** - Creates both an item record and its properties
3. **PUT /items/:id** - Updates both tables with appropriate validation
4. **Transaction endpoints** - Now ensure data consistency via triggers

## Future Extensions

The new schema is designed to be extensible for future features:

1. **Item categories hierarchy**
2. **Custom attributes by category**
3. **Batch/lot tracking**
4. **Cost tracking and valuation**
5. **Serial number generation and validation**
6. **QR code integration**
7. **Expiry date notification system**

---

For any questions or issues with the new item system, please refer to the migration logs located in the `logs` directory or contact the database administrator. 