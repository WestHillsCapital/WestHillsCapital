export const QUEUE_NAMES = {
  PING: "ping",
  GENERATE_PDF: "generate-pdf",
  DELIVER_WEBHOOK: "deliver-webhook",
  SCHEDULER: "scheduler",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
