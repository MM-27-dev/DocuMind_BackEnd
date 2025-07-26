import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const dbUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME;

    if (!dbUri || !dbName) {
      throw new Error("MONGODB_URI or DB_NAME is missing in environment variables.");
    }

    const connectionInstance = await mongoose.connect(`${dbUri}/${dbName}`);

    console.log(
      `\n MongoDB connected to DB "${dbName}" at host: ${connectionInstance.connection.host}`
    );
  } catch (error: any) {
    console.error("MongoDB Connection error:", error?.message);
    process.exit(1);
  }
};

export default connectDB;
