import IORedis from "ioredis";

let redisClient: IORedis | null = null;

// Connect to Redis
export const connectToRedis = async (): Promise<IORedis> => {
  if (!redisClient) {
    redisClient = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
      tls:
        process.env.REDIS_USE_TLS === "true"
          ? {
              rejectUnauthorized: false, // Use this only in development
            }
          : undefined,
      retryStrategy: (times: number) => {
        // Wait a bit before trying again if connection fails
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: null, // Needed for BullMQ
    });

    // When Redis is connected
    redisClient.on("connect", () => {
      console.info("Connected to Redis.");
    });

    // When there's a connection error
    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    // When Redis is trying to reconnect
    redisClient.on("reconnecting", () => {
      console.info("Trying to reconnect to Redis...");
    });
  }

  // Check if Redis is working
  try {
    await redisClient.ping();
  } catch (err: any) {
    redisClient.disconnect();
    throw new Error(`Could not connect to Redis: ${err.message}`);
  }

  return redisClient;
};

// Get the Redis client, or connect if not already connected
export const getRedisClient = async (): Promise<IORedis> => {
  if (!redisClient) {
    redisClient = await connectToRedis();
  }
  return redisClient;
};

// Close the Redis connection
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.info("Redis connection closed.");
  }
};
