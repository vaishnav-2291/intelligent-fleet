import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';

let isConnecting = false;

// Pre-seeded system accounts matching existing auth definitions
export const SEEDED_SYSTEM_USERS = [
  {
    id: 'usr-admin-1',
    name: 'Fleet Admin',
    phone: '9876543210',
    email: 'admin@intelligentfleet.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'ADMIN',
    status: 'active'
  },
  {
    id: 'usr-mgr-1',
    name: 'Fleet Operations Manager',
    phone: '9876543211',
    email: 'manager@intelligentfleet.com',
    passwordHash: bcrypt.hashSync('manager123', 10),
    role: 'FLEET_MANAGER',
    status: 'active'
  },
  {
    id: 'usr-disp-1',
    name: 'Tamil Nadu Dispatcher',
    phone: '9876543212',
    email: 'dispatcher@intelligentfleet.com',
    passwordHash: bcrypt.hashSync('dispatch123', 10),
    role: 'DISPATCHER',
    status: 'active'
  },
  {
    id: 'usr-drv-1',
    name: 'Arun Kumar',
    phone: '9123456789',
    email: 'arun.kumar@intelligentfleet.com',
    passwordHash: bcrypt.hashSync('driver123', 10),
    role: 'DRIVER',
    driverId: 'DR001',
    status: 'active'
  },
  {
    id: 'usr-view-1',
    name: 'Auditor Viewer',
    phone: '9876543214',
    email: 'viewer@intelligentfleet.com',
    passwordHash: bcrypt.hashSync('viewer123', 10),
    role: 'VIEWER',
    status: 'active'
  }
];

export function normalizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return null;
  let uri = rawUri.trim();
  if (uri.endsWith('?retryWrites')) {
    uri += '=true&w=majority';
  }
  return uri;
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function initUserDatabase() {
  if (!isDbConnected()) return;
  try {
    for (const seed of SEEDED_SYSTEM_USERS) {
      await User.updateOne(
        { phone: seed.phone },
        {
          $setOnInsert: {
            id: seed.id,
            name: seed.name,
            phone: seed.phone,
            email: seed.email,
            passwordHash: seed.passwordHash,
            role: seed.role,
            status: seed.status,
            driverId: seed.driverId || null
          }
        },
        { upsert: true }
      );
    }
    console.log('[Auth DB]: Built-in system accounts verified/seeded in MongoDB Atlas.');
  } catch (err) {
    console.warn('[Auth DB]: Warning during initial seed verification:', err.message);
  }
}

export async function connectDb() {
  if (isDbConnected()) {
    return true;
  }
  if (isConnecting) {
    let waited = 0;
    while (isConnecting && waited < 50) {
      await new Promise(r => setTimeout(r, 100));
      waited++;
    }
    return isDbConnected();
  }

  const rawUri = process.env.MONGODB_URI;
  const uri = normalizeMongoUri(rawUri);

  if (!uri) {
    console.warn('[Auth DB]: MONGODB_URI not configured. Operating in fallback in-memory auth mode.');
    return false;
  }

  isConnecting = true;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('[Auth DB]: Successfully connected to MongoDB Atlas (fleet_management).');
    await initUserDatabase();
    return true;
  } catch (err) {
    console.warn('[Auth DB]: Failed to connect to MongoDB Atlas:', err.message);
    return false;
  } finally {
    isConnecting = false;
  }
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
