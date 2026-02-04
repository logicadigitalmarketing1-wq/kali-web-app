import { Injectable } from '@nestjs/common';
import { Subject, Observable, filter } from 'rxjs';

export interface SmartScanEvent {
  sessionId: string;
  type: 'step_update' | 'progress_update' | 'finding_added' | 'scan_completed' | 'scan_failed' | 'log';
  data: {
    stepNumber?: number;
    status?: string;
    progress?: number;
    currentPhase?: string;
    message?: string;
    finding?: {
      title: string;
      severity: string;
      category: string;
    };
    timestamp: string;
  };
}

@Injectable()
export class SmartScanEventsService {
  private events$ = new Subject<SmartScanEvent>();

  emit(event: SmartScanEvent): void {
    this.events$.next(event);
  }

  getEvents(sessionId: string): Observable<SmartScanEvent> {
    return this.events$.pipe(
      filter((event) => event.sessionId === sessionId),
    );
  }

  emitStepUpdate(
    sessionId: string,
    stepNumber: number,
    status: string,
    message?: string,
  ): void {
    this.emit({
      sessionId,
      type: 'step_update',
      data: {
        stepNumber,
        status,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitProgressUpdate(
    sessionId: string,
    progress: number,
    currentPhase: string,
  ): void {
    this.emit({
      sessionId,
      type: 'progress_update',
      data: {
        progress,
        currentPhase,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitFindingAdded(
    sessionId: string,
    finding: { title: string; severity: string; category: string },
  ): void {
    this.emit({
      sessionId,
      type: 'finding_added',
      data: {
        finding,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitLog(sessionId: string, message: string): void {
    this.emit({
      sessionId,
      type: 'log',
      data: {
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitScanCompleted(sessionId: string): void {
    this.emit({
      sessionId,
      type: 'scan_completed',
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  emitScanFailed(sessionId: string, error: string): void {
    this.emit({
      sessionId,
      type: 'scan_failed',
      data: {
        message: error,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
