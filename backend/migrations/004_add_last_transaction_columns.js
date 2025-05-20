/**
 * Add last_transaction_at and last_transaction_type columns to items table
 */
const { pool } = require('../config/database');

module.exports = {
    up: async () => {
        console.log('Running migration: Add last_transaction columns to items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if columns already exist
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name IN ('last_transaction_at', 'last_transaction_type')
            `);
            
            const existingColumns = columnCheckResult.rows.map(row => row.column_name);
            
            // Add last_transaction_at column if it doesn't exist
            if (!existingColumns.includes('last_transaction_at')) {
                await client.query(`
                    ALTER TABLE items 
                    ADD COLUMN last_transaction_at TIMESTAMP WITH TIME ZONE
                `);
                console.log('Added last_transaction_at column');
            } else {
                console.log('last_transaction_at column already exists. Skipping.');
            }
            
            // Add last_transaction_type column if it doesn't exist
            if (!existingColumns.includes('last_transaction_type')) {
                await client.query(`
                    ALTER TABLE items 
                    ADD COLUMN last_transaction_type VARCHAR(50)
                `);
                console.log('Added last_transaction_type column');
            } else {
                console.log('last_transaction_type column already exists. Skipping.');
            }
            
            await client.query('COMMIT');
            console.log('Successfully added transaction columns to items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error adding transaction columns:', error);
            throw error;
        } finally {
            client.release();
        }
    },
    
    down: async () => {
        console.log('Running down migration: Remove transaction columns from items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if columns exist before trying to drop them
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name IN ('last_transaction_at', 'last_transaction_type')
            `);
            
            const existingColumns = columnCheckResult.rows.map(row => row.column_name);
            
            // Remove last_transaction_at column if it exists
            if (existingColumns.includes('last_transaction_at')) {
                await client.query(`
                    ALTER TABLE items 
                    DROP COLUMN last_transaction_at
                `);
                console.log('Dropped last_transaction_at column');
            } else {
                console.log('last_transaction_at column does not exist. Skipping.');
            }
            
            // Remove last_transaction_type column if it exists
            if (existingColumns.includes('last_transaction_type')) {
                await client.query(`
                    ALTER TABLE items 
                    DROP COLUMN last_transaction_type
                `);
                console.log('Dropped last_transaction_type column');
            } else {
                console.log('last_transaction_type column does not exist. Skipping.');
            }
            
            await client.query('COMMIT');
            console.log('Successfully removed transaction columns from items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error removing transaction columns:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}; 