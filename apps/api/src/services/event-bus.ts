import { EventEmitter } from 'events';

// ─── Event Types ────────────────────────────────────────────────────────────
// Central event bus for internal pub/sub. Webhooks, Socket.IO broadcasts,
// and any future consumers all subscribe here rather than being coupled to
// individual emission points.

export type BusEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.assigned'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'comment.added'
  | 'sla.breached'
  | 'change.submitted'
  | 'change.approved'
  | 'change.completed'
  | 'problem.identified'
  | 'problem.resolved'
  | 'major_incident.declared'
  | 'major_incident.resolved'
  | 'change.created'
  | 'change.updated'
  | 'change.rejected'
  | 'change.started'
  | 'change.rolled_back'
  | 'problem.updated'
  | 'ticket.deleted'
  ;

export interface BusPayload {
  event: BusEvent;
  entityType: string;  // 'ticket' | 'change' | 'problem' | 'major_incident' | etc.
  entityId: string;
  actorId?: string;
  timestamp: string;
  data: Record<string, any>;
  previousData?: Record<string, any>;
}

class EventBusService extends EventEmitter {
  private static instance: EventBusService;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService();
    }
    return EventBusService.instance;
  }

  /** Publish an event to all subscribers (webhooks, sockets, etc.) */
  publish(event: BusEvent, payload: Omit<BusPayload, 'event' | 'timestamp'>): void {
    const fullPayload: BusPayload = {
      event,
      ...payload,
      timestamp: new Date().toISOString(),
    };
    this.emit(event, fullPayload);
    // Also emit on a wildcard channel for catch-all subscribers
    this.emit('*', fullPayload);
  }
}

export const eventBus = EventBusService.getInstance();
