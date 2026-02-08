import { createClient, type RedisClientType } from 'redis';

import env from './env.config.js';


export const redisClient: RedisClientType = createClient({
    username: 'default',
    password: env.REDIS.REDIS_PASSWORD,
    socket: {
        host: env.REDIS.REDIS_HOST,
        port: Number(env.REDIS.REDIS_PORT)
    }
});

redisClient.on('error', (err: any) => console.log('Redis Client Error', err));



export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect()
            console.log("®️ - Redis server connected ");
        }
    } catch (error) {
        console.error("Redis failed, continuing without Redis");
    }

}

