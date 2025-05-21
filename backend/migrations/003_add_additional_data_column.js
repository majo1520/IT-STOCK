/**
 * Add additional_data column to items table
 */
const { pool } = require('../config/database');

module.exports = {
    up: async () => {
        console.log('Running migration: Add additional_data column to items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if additional_data column already exists
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name = 'additional_data'
            `);
            
            const hasColumn = columnCheckResult.rows.length > 0;
            
            if (hasColumn) {
                console.log('additional_data column already exists in items table. Skipping.');
                await client.query('COMMIT');
                return;
            }
            
            // Add the additional_data column
            await client.query(`
                ALTER TABLE items 
                ADD COLUMN additional_data JSONB DEFAULT '{}'::jsonb
            `);
            
            await client.query('COMMIT');
            console.log('Successfully added additional_data column to items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error adding additional_data column:', error);
            throw error;
        } finally {
            client.release();
        }
    },
    
    down: async () => {
        console.log('Running down migration: Remove additional_data column from items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if additional_data column exists before trying to drop it
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name = 'additional_data'
            `);
            
            const hasColumn = columnCheckResult.rows.length > 0;
            
            if (!hasColumn) {
                console.log('additional_data column does not exist in items table. Skipping.');
                await client.query('COMMIT');
                return;
            }
            
            // Drop the additional_data column
            await client.query(`
                ALTER TABLE items 
                DROP COLUMN additional_data
            `);
            
            await client.query('COMMIT');
            console.log('Successfully dropped additional_data column from items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error dropping additional_data column:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}; 