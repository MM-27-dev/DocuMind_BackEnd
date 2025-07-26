import IORedis from "ioredis";
let redisClient: IORedis | null = null;

export const connectToRedis = async (): Promise<IORedis> => {
  if (!redisClient) {
    redisClient = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      tls:
        process.env.REDIS_USE_TLS === "true"
          ? {
              rejectUnauthorized: false, // Only use this in development
            }
          : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null, // BullMQ requirement
    });

    redisClient.on("connect", () => {
      console.info("Connected to redis");
    });

    redisClient.on("error", (err) => {
      console.error(`Error in connecting to redis ${err}`);
    });

    redisClient.on("reconnecting", () => {
      console.info("Reconnecting to redis...");
    });
  }

  // Check if redis is connected
  try {
    await redisClient.ping();
  } catch (err: any) {
    redisClient.disconnect();
    throw new Error(`Error in connecting to redis: ${err.message}`);
  }

  return redisClient;
};

export const getRedisClient = async (): Promise<IORedis> => {
  if (!redisClient) {
    redisClient = await connectToRedis();
  }
  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
