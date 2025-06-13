import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  // Only agents and admins will have these fields set; guests may be created without email/password.
  email: { type: String, unique: true, sparse: true },
  agentId: { type: String, unique: true, sparse: true },
  // Role determines the user's permissions: 'guest', 'agent', or 'admin'
  role: { type: String, enum: ['guest', 'agent', 'admin'], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
