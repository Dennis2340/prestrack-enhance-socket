
import mongoose from 'mongoose';
import { config } from 'dotenv';

config()

const connectDb = async () => {
  // If already connected, no need to connect again.
  if (mongoose.connection.readyState >= 1) return;

  try {
    await mongoose.connect(process.env.MONGO_DB_URI)
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit process with failure
  }
};

export default connectDb;
