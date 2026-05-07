export const QUEUE_NAMES = {
  PING: "ping",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
