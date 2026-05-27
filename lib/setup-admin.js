/**
 * Admin User Setup
 * Creates or updates the admin user with hashed password
 */

const bcrypt = require('bcryptjs');

async function setupAdminUser(email, password) {
  const User = require('../models/User');

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const username = email.split('@')[0];

    // Use upsert to create or update
    const [user, created] = await User.upsert({
      email,
      passwordHash: hashedPassword,
      role: 'admin',
      name: username,
    }, {
      conflictFields: ['email'],
    });

    if (created) {
      console.log(`  ✓ Admin user created: ${email}`);
    } else {
      console.log(`  ✓ Admin user updated: ${email}`);
    }

    return user;
  } catch (error) {
    console.warn(`  ⚠ Could not setup admin user: ${error.message}`);
    // Don't fail initialization if we can't create admin (DB might not be ready yet)
    return null;
  }
}

module.exports = setupAdminUser;
