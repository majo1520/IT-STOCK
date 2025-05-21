const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function createAdminUser() {
    const client = await pool.connect();
    
    try {
        // Admin user data
        const userData = {
            username: 'Milan',
            password: '1609003bbB',
            email: 'm.barat@europlac.com',
            full_name: 'Milan Barat',
            role: 'admin'
        };
        
        // Check if username already exists
        const userCheck = await client.query(
            'SELECT * FROM users WHERE username = $1',
            [userData.username]
        );
        
        if (userCheck.rows.length > 0) {
            console.log(`User '${userData.username}' already exists!`);
            return;
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        // Insert admin user
        const result = await client.query(
            'INSERT INTO users (username, password, email, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role, created_at',
            [userData.username, hashedPassword, userData.email, userData.full_name, userData.role]
        );
        
        console.log('Admin user created successfully:');
        console.log(result.rows[0]);
    } catch (err) {
        console.error('Error creating admin user:', err);
    } finally {
        client.release();
        pool.end(); // Close the pool
    }
}

createAdminUser(); 