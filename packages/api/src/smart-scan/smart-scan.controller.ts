import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable, map, interval, takeWhile, startWith, switchMap, from, catchError, of } from 'rxjs';
import { SmartScanService } from './smart-scan.service';
import { SmartScanEventsService } from './smart-scan-events.service';
import { CreateSmartScanDto } from './dto/create-smart-scan.dto';
import { SessionGuard } from '../common/guards/session.guard';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('smart-scan')
@UseGuards(SessionGuard)
export class SmartScanController {
  constructor(
    private readonly smartScanService: SmartScanService,
    private readonly eventsService: SmartScanEventsService,
  ) {}

  @Post()
  async createScan(@Request() req: RequestWithUser, @Body() createScanDto: CreateSmartScanDto) {
    const scan = await this.smartScanService.createScan(req.user.id, createScanDto);
    // Démarrer automatiquement le scan après création
    await this.smartScanService.startScan(scan.id, req.user.id);
    // Retourner le scan complet avec les steps (TransformInterceptor wraps with success/data)
    return this.smartScanService.getScanStatus(scan.id, req.user.id);
  }

  @Get(':id')
  async getScan(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.getScan(id, req.user.id);
  }

  @Post(':id/start')
  async startScan(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.startScan(id, req.user.id);
  }

  @Get(':id/status')
  async getScanStatus(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.getScanStatus(id, req.user.id);
  }

  @Sse(':id/stream')
  streamScan(@Request() req: RequestWithUser, @Param('id') id: string): Observable<MessageEvent> {
    // Get real-time events from the events service
    const events$ = this.eventsService.getEvents(id);

    // Also poll status every 2 seconds for completeness
    const poll$ = interval(2000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.smartScanService.getScanStatus(id, req.user.id)).pipe(
          catchError(() => of(null)),
        ),
      ),
      takeWhile((status) => {
        if (!status) return true;
        return status.status !== 'COMPLETED' && status.status !== 'FAILED' && status.status !== 'CANCELLED';
      }, true),
      map((status): MessageEvent => ({
        data: { type: 'status', ...status },
      })),
    );

    // Merge real-time events with poll updates
    const realtime$ = events$.pipe(
      map((event): MessageEvent => ({
        data: event,
      })),
    );

    // Use merge to combine both streams
    return new Observable<MessageEvent>((subscriber) => {
      const pollSub = poll$.subscribe(subscriber);
      const eventSub = realtime$.subscribe(subscriber);

      return () => {
        pollSub.unsubscribe();
        eventSub.unsubscribe();
      };
    });
  }

  @Delete(':id/cancel')
  async cancelScan(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.cancelScan(id, req.user.id);
  }

  @Delete(':id')
  async deleteScan(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.deleteScan(id, req.user.id);
  }

  @Get()
  async getUserScans(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.smartScanService.getUserScans(req.user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status,
    });
  }

  @Get('counts')
  async getStatusCounts(@Request() req: RequestWithUser) {
    return this.smartScanService.getStatusCounts(req.user.id);
  }

  @Get(':id/recommendations')
  async getRecommendations(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.smartScanService.generateRecommendations(id, req.user.id);
  }

  @Delete(':id/findings/:findingId')
  async deleteFinding(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
  ) {
    return this.smartScanService.deleteFinding(id, findingId, req.user.id);
  }

  @Delete(':id/tools/:tool')
  async deleteToolResults(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Param('tool') tool: string,
  ) {
    return this.smartScanService.deleteToolResults(id, tool, req.user.id);
  }
}