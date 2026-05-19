import { prisma } from "@/lib/db";
import { processSubmission } from "./gradingPipeline";

class QueueService {
  private queue: string[] = [];
  private isProcessing = false;

  constructor() {
    if (typeof window === "undefined") {
      this.initializeQueue();
    }
  }

  public async initializeQueue() {
    try {
      const unfinished = await prisma.assignment.findMany({
        where: {
          status: { in: ["pending", "processing"] },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
        },
      });

      console.log(`[QueueService] Initializing queue, found ${unfinished.length} unfinished assignments.`);
      
      for (const ass of unfinished) {
        await prisma.assignment.update({
          where: { id: ass.id },
          data: { status: "pending" },
        });
        
        this.enqueue(ass.id);
      }
    } catch (err) {
      console.error("[QueueService] Error during queue initialization:", err);
    }
  }

  public enqueue(assignmentId: string) {
    if (!this.queue.includes(assignmentId)) {
      this.queue.push(assignmentId);
      console.log(`[QueueService] Enqueued assignment ${assignmentId}. Queue size: ${this.queue.length}`);
    }
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const currentId = this.queue.shift()!;
    console.log(`[QueueService] Processing assignment ${currentId}... Remaining in queue: ${this.queue.length}`);

    try {
      await processSubmission(currentId);
    } catch (err) {
      console.error(`[QueueService] Error processing assignment ${currentId}:`, err);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 100);
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const queueService = new QueueService();
