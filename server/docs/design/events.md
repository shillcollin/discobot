# Events Module

This module provides the event system for real-time updates via Server-Sent Events (SSE).

## Files

| File | Description |
|------|-------------|
| `internal/events/events.go` | Event broker and subscriber |
| `internal/events/poller.go` | Event polling worker |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Event System                              │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Services   │───▶│    Broker    │───▶│   Subscribers    │  │
│  │  (publish)   │    │              │    │   (clients)      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                             │
│                    │   Database   │                             │
│                    │   (events)   │                             │
│                    └──────────────┘                             │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                             │
│                    │    Poller    │                             │
│                    │  (periodic)  │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Event Types

```go
type Event struct {
    ID        uint              `json:"id"`
    Type      string            `json:"type"`
    ProjectID string            `json:"projectId"`
    Payload   map[string]string `json:"payload"`
    CreatedAt time.Time         `json:"createdAt"`
}

const (
    EventSessionUpdated   = "session_updated"
    EventWorkspaceUpdated = "workspace_updated"
)
```

## Event Broker

### Structure

```go
type Broker struct {
    store       *store.Store
    subscribers map[string][]*Subscriber
    mu          sync.RWMutex
}

type Subscriber struct {
    ID        string
    ProjectID string
    Events    chan Event
    Done      chan struct{}
}

func NewBroker(store *store.Store) *Broker {
    return &Broker{
        store:       store,
        subscribers: make(map[string][]*Subscriber),
    }
}
```

### Subscribe

```go
func (b *Broker) Subscribe(projectID string) *Subscriber {
    b.mu.Lock()
    defer b.mu.Unlock()

    sub := &Subscriber{
        ID:        uuid.New().String(),
        ProjectID: projectID,
        Events:    make(chan Event, 100),
        Done:      make(chan struct{}),
    }

    b.subscribers[projectID] = append(b.subscribers[projectID], sub)
    return sub
}
```

### Unsubscribe

```go
func (b *Broker) Unsubscribe(sub *Subscriber) {
    b.mu.Lock()
    defer b.mu.Unlock()

    close(sub.Done)

    subs := b.subscribers[sub.ProjectID]
    for i, s := range subs {
        if s.ID == sub.ID {
            b.subscribers[sub.ProjectID] = append(subs[:i], subs[i+1:]...)
            break
        }
    }
}
```

### Publish

```go
func (b *Broker) Publish(event Event) error {
    // Store event in database
    dbEvent := &model.ProjectEvent{
        ProjectID: event.ProjectID,
        Type:      event.Type,
        Payload:   event.Payload,
    }
    if err := b.store.CreateEvent(context.Background(), dbEvent); err != nil {
        return err
    }

    // Broadcast to subscribers
    b.mu.RLock()
    defer b.mu.RUnlock()

    event.ID = dbEvent.ID
    event.CreatedAt = dbEvent.CreatedAt

    for _, sub := range b.subscribers[event.ProjectID] {
        select {
        case sub.Events <- event:
        default:
            // Channel full, skip
        }
    }

    return nil
}
```

### Broadcast (from Poller)

```go
func (b *Broker) Broadcast(projectID string, events []Event) {
    b.mu.RLock()
    defer b.mu.RUnlock()

    for _, sub := range b.subscribers[projectID] {
        for _, event := range events {
            select {
            case sub.Events <- event:
            case <-sub.Done:
                return
            default:
                // Channel full, skip
            }
        }
    }
}
```

## Event Poller

### Structure

```go
type PollerConfig struct {
    PollInterval time.Duration  // How often to poll when subscribers are active
    BatchSize    int            // Max events to fetch per poll
}

type Poller struct {
    store  *store.Store
    config PollerConfig

    lastSeq   int64        // Last seen sequence number (global)
    lastSeqMu sync.Mutex

    subscribers   map[string]*Subscriber  // Active subscribers
    subscribersMu sync.RWMutex

    notifyCh chan struct{}  // Notification channel for immediate polling

    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
}

func NewPoller(s *store.Store, config PollerConfig) *Poller {
    return &Poller{
        store:       s,
        config:      config,
        subscribers: make(map[string]*Subscriber),
        notifyCh:    make(chan struct{}, 100),
    }
}

func DefaultPollerConfig() PollerConfig {
    return PollerConfig{
        PollInterval: 2 * time.Second,
        BatchSize:    100,
    }
}
```

### Polling Strategy

The poller implements a "dirty flag" pattern:

1. **Periodic polling**: Polls every 2 seconds (configurable) when subscribers are active
2. **Immediate notification**: When events are published, `NotifyNewEvent()` triggers immediate poll
3. **Coalescing**: Multiple rapid notifications are coalesced into a single poll via `drainNotifications()`
4. **Subscriber-aware**: Only polls when there are active subscribers

### Start

```go
func (p *Poller) Start(parentCtx context.Context) error {
    p.ctx, p.cancel = context.WithCancel(parentCtx)

    // Initialize last seen sequence from database
    maxSeq, err := p.store.GetMaxEventSeq(p.ctx)
    if err != nil {
        return err
    }
    p.lastSeq = maxSeq

    log.Printf("Event poller starting (last seq: %d)", p.lastSeq)

    p.wg.Add(1)
    go p.pollLoop()

    return nil
}
```

### Poll Loop

```go
func (p *Poller) pollLoop() {
    defer p.wg.Done()

    ticker := time.NewTicker(p.config.PollInterval)
    defer ticker.Stop()

    for {
        select {
        case <-p.ctx.Done():
            return
        case <-ticker.C:
            // Only poll if there are subscribers
            p.subscribersMu.RLock()
            hasSubscribers := len(p.subscribers) > 0
            p.subscribersMu.RUnlock()

            if hasSubscribers {
                p.pollAndBroadcast()
            }
        case <-p.notifyCh:
            // Drain any additional notifications (coalesce rapid writes)
            p.drainNotifications()

            // Only poll if there are subscribers
            p.subscribersMu.RLock()
            hasSubscribers := len(p.subscribers) > 0
            p.subscribersMu.RUnlock()

            if hasSubscribers {
                p.pollAndBroadcast()
            }
        }
    }
}

func (p *Poller) drainNotifications() {
    for {
        select {
        case <-p.notifyCh:
            // Keep draining
        default:
            // Channel is empty
            return
        }
    }
}
```

### Notification

```go
func (p *Poller) NotifyNewEvent() {
    select {
    case p.notifyCh <- struct{}{}:
    default:
        // Channel full, next poll will pick it up
    }
}
```

## SSE Handler

```go
func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "projectId")

    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("X-Accel-Buffering", "no")

    // Subscribe to events
    sub := h.broker.Subscribe(projectID)
    defer h.broker.Unsubscribe(sub)

    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "SSE not supported", http.StatusInternalServerError)
        return
    }

    // Send initial connection event
    fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
    flusher.Flush()

    // Stream events
    for {
        select {
        case event := <-sub.Events:
            data, _ := json.Marshal(event)
            fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
            flusher.Flush()

        case <-r.Context().Done():
            return

        case <-sub.Done:
            return
        }
    }
}
```

## Publishing Events

### From Services

```go
// SessionService
func (s *SessionService) UpdateStatus(ctx context.Context, id, status string) error {
    if err := s.store.UpdateSession(ctx, id, map[string]any{"status": status}); err != nil {
        return err
    }

    // Publish event
    session, _ := s.store.GetSession(ctx, id)
    s.broker.Publish(Event{
        Type:      EventSessionUpdated,
        ProjectID: session.ProjectID,
        Payload: map[string]string{
            "sessionId": id,
            "status":    status,
        },
    })

    return nil
}

// WorkspaceService
func (s *WorkspaceService) UpdateStatus(ctx context.Context, id, status string) error {
    if err := s.store.UpdateWorkspace(ctx, id, map[string]any{"status": status}); err != nil {
        return err
    }

    workspace, _ := s.store.GetWorkspace(ctx, id)
    s.broker.Publish(Event{
        Type:      EventWorkspaceUpdated,
        ProjectID: workspace.ProjectID,
        Payload: map[string]string{
            "workspaceId": id,
            "status":      status,
        },
    })

    return nil
}
```

## Frontend Integration

The frontend subscribes to events using `useProjectEvents`:

```typescript
// lib/hooks/use-project-events.ts
function useProjectEvents(options: UseProjectEventsOptions) {
  useEffect(() => {
    const eventSource = new EventSource(`/api/projects/${projectId}/events`)

    eventSource.addEventListener('session_updated', (e) => {
      const event = JSON.parse(e.data)
      options.onSessionUpdated?.(event.payload.sessionId)
    })

    eventSource.addEventListener('workspace_updated', (e) => {
      const event = JSON.parse(e.data)
      options.onWorkspaceUpdated?.(event.payload.workspaceId)
    })

    return () => eventSource.close()
  }, [projectId])
}
```

## Event Cleanup

Old events can be cleaned up periodically:

```go
func (s *Store) CleanupOldEvents(ctx context.Context, olderThan time.Duration) error {
    cutoff := time.Now().Add(-olderThan)
    return s.db.WithContext(ctx).
        Where("created_at < ?", cutoff).
        Delete(&ProjectEvent{}).Error
}
```

## Testing

```go
func TestBroker_PublishSubscribe(t *testing.T) {
    store := store.NewMock()
    broker := NewBroker(store)

    // Subscribe
    sub := broker.Subscribe("project-1")
    defer broker.Unsubscribe(sub)

    // Publish
    broker.Publish(Event{
        Type:      EventSessionUpdated,
        ProjectID: "project-1",
        Payload:   map[string]string{"sessionId": "session-1"},
    })

    // Receive
    select {
    case event := <-sub.Events:
        assert.Equal(t, EventSessionUpdated, event.Type)
        assert.Equal(t, "session-1", event.Payload["sessionId"])
    case <-time.After(time.Second):
        t.Fatal("Timeout waiting for event")
    }
}
```
