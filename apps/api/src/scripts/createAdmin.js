/**
 * Script to create an admin user
 * 
 * Usage: node src/scripts/createAdmin.js [email] [password] [firstName] [lastName]
 * Example: node src/scripts/createAdmin.js admin@example.com admin123 Admin User
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../lib/mongodb');
const User = require('../models/User');

async function createAdmin() {
  try {
    // Get arguments
    const args = process.argv.slice(2);
    const email = args[0] || 'admin@shop.am';
    const password = args[1] || 'admin123';
    const firstName = args[2] || 'Admin';
    const lastName = args[3] || 'User';

    console.log('🔐 Creating admin user...');
    console.log('📧 Email:', email);
    console.log('👤 Name:', `${firstName} ${lastName}`);

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone: email }],
      deletedAt: null,
    });

    if (existingUser) {
      console.log('⚠️  User already exists, updating to admin...');
      
      // Update existing user to admin
      const hashedPassword = await bcrypt.hash(password, 10);
      existingUser.email = email;
      existingUser.passwordHash = hashedPassword;
      existingUser.firstName = firstName;
      existingUser.lastName = lastName;
      existingUser.roles = ['admin', 'customer'];
      existingUser.emailVerified = true;
      existingUser.locale = 'en';
      
      await existingUser.save();
      
      console.log('✅ User updated to admin successfully!');
      console.log('📧 Email:', existingUser.email);
      console.log('🔑 Password:', password);
      console.log('👤 Name:', `${existingUser.firstName} ${existingUser.lastName}`);
      console.log('🎭 Roles:', existingUser.roles.join(', '));
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const adminUser = await User.create({
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        emailVerified: true,
        locale: 'en',
        roles: ['admin', 'customer'],
      });

      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', adminUser.email);
      console.log('🔑 Password:', password);
      console.log('👤 Name:', `${adminUser.firstName} ${adminUser.lastName}`);
      console.log('🎭 Roles:', adminUser.roles.join(', '));
      console.log('🆔 User ID:', adminUser._id.toString());
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdmin();

