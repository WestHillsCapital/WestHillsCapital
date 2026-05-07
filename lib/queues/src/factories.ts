import { Queue, Worker, type Processor, type WorkerOptions, type QueueOptions } from "bullmq";
import { getRedisConnection } from "./connection.js";

/**
 * Creates a BullMQ Queue for the given name.
 * Returns null when REDIS_URL is not configured.
 */
export function createQueue<TData = unknown, TResult = unknown>(
  name: string,
  options?: Partial<QueueOptions>,
): Queue<TData, TResult> | null {
  const connection = getRedisConnection();
  if (!connection) return null;
  return new Queue<TData, TResult>(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    },
    ...options,
  });
}

/**
 * Creates a BullMQ Worker for the given queue name.
 * Returns null when REDIS_URL is not configured.
 */
export function createQueueWorker<TData = unknown, TResult = unknown>(
  name: string,
  processor: Processor<TData, TResult>,
  options?: Partial<WorkerOptions>,
): Worker<TData, TResult> | null {
  const connection = getRedisConnection();
  if (!connection) return null;
  return new Worker<TData, TResult>(name, processor, {
    connection,
    concurrency: 5,
    ...options,
  });
}
