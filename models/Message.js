import mongoose from 'mongoose';

const { Schema } = mongoose;

const messageSchema = new Schema({
  // Each message is associated with a room.
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  // Indicates whether the message is from the AI, an agent, a guest, or a system notification.
  senderType: { type: String, enum: ['ai', 'agent', 'guest', 'system'], required: true },
  // For agent and guest messages, this is a reference to the user document.
  // For AI messages, this can be null.
  sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // The actual message content.
  content: { type: String, required: true },
  // Optional: If an agent has tagged another agent, their user IDs are stored here.
  taggedAgents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // Timestamp for when the message was created.
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);
