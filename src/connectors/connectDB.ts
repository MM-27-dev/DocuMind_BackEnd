import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const databaseName = process.env.DB_NAME;

    if (!mongoUri || !databaseName) {
      throw new Error(
        "MONGODB_URI or DB_NAME is missing in environment variables."
      );
    }
    
    // Connect to MongoDB
    const connection = await mongoose.connect(`${mongoUri}/${databaseName}`);

    console.log(
      `MongoDB connected successfully to database "${databaseName}" at host: ${connection.connection.host}`
    );
  } catch (error: any) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1); // Exit the process on failure
  }
};

export default connectDB;
