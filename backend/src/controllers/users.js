const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');

// GET all users - Admin only
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET user by ID - Admin only
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// CREATE user - Admin only
const createUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password, email, full_name, role } = req.body;
    
    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    const userCheck = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insert new user
    const result = await client.query(
      'INSERT INTO users (username, password, email, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role, created_at',
      [username, hashedPassword, email || null, full_name || null, role || 'user']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  } finally {
    client.release();
  }
};

// UPDATE user - Admin only
const updateUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.params.id;
    const { username, email, full_name, role } = req.body;
    
    // Check if user exists
    const userCheck = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user
    const result = await client.query(
      'UPDATE users SET username = $1, email = $2, full_name = $3, role = $4 WHERE id = $5 RETURNING id, username, email, full_name, role, created_at',
      [
        username || userCheck.rows[0].username,
        email !== undefined ? email : userCheck.rows[0].email,
        full_name !== undefined ? full_name : userCheck.rows[0].full_name,
        role || userCheck.rows[0].role,
        userId
      ]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
};

// DELETE user - Admin only
const deleteUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const userCheck = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting admin users
    if (userCheck.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }
    
    // Delete user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
};

// RESET user password - Admin only
const resetPassword = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.params.id;
    const { password } = req.body;
    
    // Validate required fields
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Check if user exists
    const userCheck = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update user password
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
    
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword
}; 