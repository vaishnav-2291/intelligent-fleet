import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'DRIVER', 'VIEWER'],
      default: 'DRIVER'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    driverId: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Sparse unique index on email only (phone unique index is already declared above)
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
