import type { Processor } from "bullmq";
import type { PingJobPayload } from "@workspace/queues";
import { logger } from "../logger.js";

export const pingProcessor: Processor<PingJobPayload> = async (job) => {
  const age = Date.now() - job.data.timestamp;
  logger.info({ jobId: job.id, ageMs: age }, "[Worker:Ping] Ping job processed");
  return { ok: true, ageMs: age };
};
