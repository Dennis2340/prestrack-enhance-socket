import mongoose from 'mongoose';

const { Schema } = mongoose;

const roomSchema = new Schema({
  // Each room is created for a guest session.
  guest: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // List of agent users who have joined the room.
  activeAgents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // When an agent takes over, this field holds that agent's user ID.
  currentOverride: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Track whether the conversation is ongoing or closed.
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Room', roomSchema);
