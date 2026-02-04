import { Injectable, Logger } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';

export interface RunStreamEvent {
  runId: string;
  type: 'init' | 'output' | 'tool_start' | 'tool_complete' | 'progress' | 'completed' | 'failed';
  data: {
    chunk?: string;
    toolName?: string;
    toolIndex?: number;
    totalTools?: number;
    progress?: number;
    phase?: string;
    error?: string;
    duration?: number;
    timestamp: string;
  };
}

@Injectable()
export class RunsEventsService {
  private readonly logger = new Logger(RunsEventsService.name);
  // Map de ReplaySubject par runId - garde les 100 derniers événements pour les late subscribers
  private runEvents = new Map<string, ReplaySubject<RunStreamEvent>>();

  private getOrCreateSubject(runId: string): ReplaySubject<RunStreamEvent> {
    if (!this.runEvents.has(runId)) {
      this.logger.debug(`Creating new ReplaySubject for run ${runId}`);
      // ReplaySubject(100) buffers last 100 events for late subscribers
      this.runEvents.set(runId, new ReplaySubject<RunStreamEvent>(100));
    }
    return this.runEvents.get(runId)!;
  }

  emit(event: RunStreamEvent): void {
    const subject = this.getOrCreateSubject(event.runId);
    this.logger.log(`[SSE] Emitting ${event.type} event for run ${event.runId}`);
    subject.next(event);

    // Schedule cleanup after terminal events
    if (event.type === 'completed' || event.type === 'failed') {
      this.logger.log(`Run ${event.runId} finished, scheduling cleanup in 60s`);
      setTimeout(() => this.cleanup(event.runId), 60000);
    }
  }

  getEvents(runId: string): Observable<RunStreamEvent> {
    this.logger.log(`[SSE] Subscriber connected for run ${runId}, buffered events: ${this.runEvents.get(runId)?.observed || 0}`);
    return this.getOrCreateSubject(runId).asObservable();
  }

  private cleanup(runId: string): void {
    const subject = this.runEvents.get(runId);
    if (subject) {
      this.logger.debug(`Cleaning up ReplaySubject for run ${runId}`);
      subject.complete();
      this.runEvents.delete(runId);
    }
  }

  emitInit(runId: string): void {
    this.emit({
      runId,
      type: 'init',
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitOutput(runId: string, chunk: string): void {
    this.emit({
      runId,
      type: 'output',
      data: {
        chunk,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitToolStart(
    runId: string,
    toolName: string,
    toolIndex?: number,
    totalTools?: number,
  ): void {
    this.emit({
      runId,
      type: 'tool_start',
      data: {
        toolName,
        toolIndex,
        totalTools,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitToolComplete(
    runId: string,
    toolName: string,
    duration?: number,
  ): void {
    this.emit({
      runId,
      type: 'tool_complete',
      data: {
        toolName,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitProgress(runId: string, progress: number, phase: string): void {
    this.emit({
      runId,
      type: 'progress',
      data: {
        progress,
        phase,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitCompleted(runId: string, duration?: number): void {
    this.emit({
      runId,
      type: 'completed',
      data: {
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitFailed(runId: string, error: string): void {
    this.emit({
      runId,
      type: 'failed',
      data: {
        error,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
