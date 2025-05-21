# PostgreSQL Materialized View Solution for Item Data Consistency

## Problem

After analyzing the ReactStock application, we identified a critical issue: when item details are updated, the changes are not consistently reflected in the items list. This is caused by:

1. **Data duplication**: Item properties are stored in both the `items` table and a separate `item_properties` table.
2. **Inconsistent updates**: When updating item details, sometimes only one table gets updated.
3. **Race conditions**: The `COALESCE` function in the query tries to merge data from both tables, but can still lead to inconsistent results.
4. **Cache issues**: Despite cache-busting attempts in the API, the frontend may still display stale data.

## Solution

We implemented a PostgreSQL-based solution using materialized views with automatic refresh triggers. This approach provides:

1. **Data consistency**: A single source of truth for item data across the application
2. **Performance**: Materialized views are pre-computed and indexed for fast retrieval
3. **Real-time updates**: Database triggers automatically refresh the view when data changes
4. **Simplified queries**: Frontend uses a clean, consolidated data view

## Implementation Details

### 1. Materialized View

We created a materialized view (`items_complete_view`) that joins data from:
- `items` table (base properties)
- `item_properties` table (extended properties)
- Related tables (`boxes`, `locations`, `shelves`, etc.)

The view uses `COALESCE` to properly merge properties from both tables and presents a unified view of each item.

### 2. Automatic Refresh Triggers

We set up database triggers on:
- `items` table
- `item_properties` table
- `boxes` table
- `locations` table

These triggers call a function to refresh the materialized view whenever data in the underlying tables changes. The view is refreshed concurrently to prevent blocking.

### 3. Data Migration

We created a data migration script to fix existing inconsistencies between the `items` and `item_properties` tables before implementing the view.

### 4. API Updates

We modified the API controller functions:
- `getItems` now queries the materialized view directly
- `updateItem`, `createItem`, and `updateItemProperties` consistently update both tables and return data from the materialized view

## Files Modified

1. **New Files:**
   - `item_view_setup.sql` - SQL for creating the materialized view and triggers
   - `migrations/004_add_item_materialized_view.js` - Database migration script
   - `fix_item_properties_inconsistencies.sql` - Script to fix existing data inconsistencies

2. **Modified Files:**
   - `controllers/items.js` - Updated API controllers to use the materialized view

## Benefits of This Approach

1. **Long-term stability**: Using PostgreSQL's built-in features for a robust, production-grade solution
2. **No application-level caching needed**: The materialized view handles caching transparently
3. **Simplified API code**: Controllers no longer need complex join queries
4. **Improved performance**: Precomputed view with indexes for faster data retrieval
5. **Data integrity**: Ensures consistent data across the application

## How to Apply

1. Run the data consistency fix script:
   ```
   psql -U postgres -d your_database -f fix_item_properties_inconsistencies.sql
   ```

2. Run the migration to create the materialized view:
   ```
   npm run migrate
   ```

3. The application will now automatically use the materialized view for all item operations. 