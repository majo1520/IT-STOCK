/**
 * Add notes column to items table
 */
const { pool } = require('../config/database');

module.exports = {
    up: async () => {
        console.log('Running migration: Add notes column to items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if notes column already exists
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name = 'notes'
            `);
            
            const hasNotesColumn = columnCheckResult.rows.length > 0;
            
            if (hasNotesColumn) {
                console.log('Notes column already exists in items table. Skipping.');
                await client.query('COMMIT');
                return;
            }
            
            // Add the notes column
            await client.query(`
                ALTER TABLE items 
                ADD COLUMN notes TEXT
            `);
            
            await client.query('COMMIT');
            console.log('Successfully added notes column to items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error adding notes column:', error);
            throw error;
        } finally {
            client.release();
        }
    },
    
    down: async () => {
        console.log('Running down migration: Remove notes column from items table');
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if notes column exists before trying to drop it
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name = 'notes'
            `);
            
            const hasNotesColumn = columnCheckResult.rows.length > 0;
            
            if (!hasNotesColumn) {
                console.log('Notes column does not exist in items table. Skipping.');
                await client.query('COMMIT');
                return;
            }
            
            // Drop the notes column
            await client.query(`
                ALTER TABLE items 
                DROP COLUMN notes
            `);
            
            await client.query('COMMIT');
            console.log('Successfully dropped notes column from items table');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error dropping notes column:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}; 