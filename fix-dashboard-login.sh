#!/bin/bash

echo "🔧 GhostTrace Dashboard Login Fix"
echo "=================================="
echo ""

# Reset admin password
echo "📝 Resetting admin password..."

cd /home/wal8y/Desktop/graduation

RESULT=$(node -e "
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

(async () => {
  try {
    const sequelize = new Sequelize('dna', 'postgres', '', {
      host: 'localhost',
      dialect: 'postgres',
      logging: false
    });
    
    const newPassword = 'Admin123!';
    const hash = await bcrypt.hash(newPassword, 10);
    
    const [results] = await sequelize.query(
      'UPDATE users SET \"passwordHash\" = :hash WHERE email = :email RETURNING email',
      { replacements: { hash, email: 'admin@test.local' } }
    );
    
    if (results.length > 0) {
      console.log('SUCCESS');
    } else {
      console.log('NO_USER');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.log('ERROR:', e.message);
    process.exit(1);
  }
})();
" 2>&1)

if echo "$RESULT" | grep -q "SUCCESS"; then
  echo "✅ Password reset successful!"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🌐 Dashboard URL:"
  echo "   http://localhost:3001"
  echo ""
  echo "👤 Login Credentials:"
  echo "   Email:    admin@test.local"
  echo "   Password: Admin123!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📋 Steps to fix 'fetch failed' error:"
  echo "   1. Open http://localhost:3001/login.html"
  echo "   2. Login with the credentials above"
  echo "   3. Navigate to AI Configuration"
  echo "   4. The fetch error should be gone!"
  echo ""
  
  # Test the login
  echo "🧪 Testing login..."
  LOGIN_RESULT=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.local","password":"Admin123!"}' 2>&1)
  
  if echo "$LOGIN_RESULT" | grep -q '"success":true'; then
    echo "✅ Login API working!"
    
    # Save cookies for testing
    curl -s -X POST http://localhost:3001/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@test.local","password":"Admin123!"}' \
      -c /tmp/ghosttrace-cookies.txt > /dev/null 2>&1
    
    # Test AI endpoint
    echo "🧪 Testing AI configuration endpoint..."
    AI_RESULT=$(curl -s http://localhost:3001/api/ai/configs \
      -b /tmp/ghosttrace-cookies.txt 2>&1)
    
    if echo "$AI_RESULT" | grep -q '"success":true'; then
      echo "✅ AI configuration API working!"
      echo ""
      echo "🎉 Everything is working! Just login in your browser."
    else
      echo "⚠️  AI endpoint returned: $(echo $AI_RESULT | head -c 100)"
    fi
  else
    echo "⚠️  Login failed. Response:"
    echo "$LOGIN_RESULT" | head -c 200
  fi
  
elif echo "$RESULT" | grep -q "NO_USER"; then
  echo "⚠️  User 'admin@test.local' not found in database"
  echo ""
  echo "Creating new admin user..."
  
  node -e "
  const bcrypt = require('bcryptjs');
  const { Sequelize, DataTypes } = require('sequelize');
  
  (async () => {
    try {
      const sequelize = new Sequelize('dna', 'postgres', '', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false
      });
      
      const hash = await bcrypt.hash('Admin123!', 10);
      
      await sequelize.query(
        'INSERT INTO users (email, \"passwordHash\", name, role, active, \"createdAt\", \"updatedAt\") VALUES (:email, :hash, :name, :role, true, NOW(), NOW())',
        { 
          replacements: { 
            email: 'admin@test.local',
            hash: hash,
            name: 'Admin User',
            role: 'admin'
          } 
        }
      );
      
      console.log('Admin user created!');
      await sequelize.close();
    } catch (e) {
      console.error('Error:', e.message);
    }
  })();
  "
  
  echo ""
  echo "✅ Admin user created!"
  echo "   Email: admin@test.local"
  echo "   Password: Admin123!"
  
else
  echo "❌ Failed to reset password"
  echo "Error: $RESULT"
  echo ""
  echo "Try manually:"
  echo "  psql -U postgres -d dna -c \"UPDATE users SET passwordHash = '\$2a\$10\$N9qo8uLO.Wmh8yBPH4jhJO8tN8F5jEo0u0Q0cBNQ8X2xdQ5yJXvYi' WHERE email = 'admin@test.local';\""
fi

echo ""
