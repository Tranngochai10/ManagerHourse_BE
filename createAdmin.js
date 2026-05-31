/**
 * Script tạo tài khoản ADMIN
 * Chạy: node createAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, enum: ['OWNER', 'JOCKEY', 'SPECTATOR', 'ADMIN', 'REFEREE'], required: true },
  phone: { type: String, trim: true },
  refreshToken: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const ADMIN_EMAIL = 'admin@horseracing.com';
const ADMIN_PASSWORD = 'Admin@12345';
const ADMIN_NAME = 'Administrator';

async function createAdmin() {
  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công!');

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log('⚠️  Tài khoản admin đã tồn tại!');
      console.log('📧 Email:', ADMIN_EMAIL);
      console.log('🔑 Password:', ADMIN_PASSWORD);
      console.log('👤 Role:', existingAdmin.role);
      console.log('📊 Status:', existingAdmin.status);
      await mongoose.disconnect();
      return;
    }

    // Tạo hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    // Tạo tài khoản admin
    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      fullName: ADMIN_NAME,
      role: 'ADMIN',
      phone: '0123456789',
      status: 'ACTIVE',
      isDeleted: false,
    });

    console.log('\n🎉 Tạo tài khoản ADMIN thành công!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email   :', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Role    :', admin.role);
    console.log('📊 Status  :', admin.status);
    console.log('🆔 ID      :', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Bạn có thể đăng nhập với thông tin trên!');

    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB.');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

createAdmin();
