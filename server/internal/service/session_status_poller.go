package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/obot-platform/discobot/server/internal/events"
	"github.com/obot-platform/discobot/server/internal/model"
	"github.com/obot-platform/discobot/server/internal/store"
)

const (
	pollInterval = 5 * time.Second // Check running sessions every 5 seconds
	pollTimeout  = 3 * time.Second // Timeout for individual status checks
)

// errSessionNotRunning is returned by checkSession when it successfully determines
// that a session is not actually running and updates its status.
var errSessionNotRunning = errors.New("session not running")

// SessionStatusPoller monitors running sessions and verifies they're actually running
// by checking the agent-api completion status. Polls continuously on a fixed interval.
type SessionStatusPoller struct {
	store        *store.Store
	sandboxSvc   *SandboxService
	eventBroker  *events.Broker
	logger       *slog.Logger
	mu           sync.Mutex
	running      bool
	stopChan     chan struct{}
	wg           sync.WaitGroup
	shutdownOnce sync.Once
}

// NewSessionStatusPoller creates a new session status poller
func NewSessionStatusPoller(
	store *store.Store,
	sandboxSvc *SandboxService,
	eventBroker *events.Broker,
	logger *slog.Logger,
) *SessionStatusPoller {
	return &SessionStatusPoller{
		store:       store,
		sandboxSvc:  sandboxSvc,
		eventBroker: eventBroker,
		logger:      logger.With("component", "session_status_poller"),
		stopChan:    make(chan struct{}),
	}
}

// Start begins the polling loop. This is called on application startup.
func (p *SessionStatusPoller) Start(ctx context.Context) {
	p.mu.Lock()
	if p.running {
		p.mu.Unlock()
		return
	}
	p.running = true
	p.mu.Unlock()

	p.wg.Add(1)
	go p.pollLoop(ctx)

	p.logger.Info("session status poller started")
}

// Shutdown gracefully stops the poller
func (p *SessionStatusPoller) Shutdown(ctx context.Context) error {
	var err error
	p.shutdownOnce.Do(func() {
		p.logger.Info("shutting down session status poller")
		close(p.stopChan)

		// Wait for goroutine to finish with timeout
		done := make(chan struct{})
		go func() {
			p.wg.Wait()
			close(done)
		}()

		select {
		case <-done:
			p.logger.Info("session status poller shutdown complete")
		case <-ctx.Done():
			err = fmt.Errorf("shutdown timeout exceeded")
			p.logger.Error("session status poller shutdown timeout")
		}
	})
	return err
}

// pollLoop is the main polling loop that runs in a goroutine.
// Continuously polls for running sessions on a fixed interval.
func (p *SessionStatusPoller) pollLoop(ctx context.Context) {
	defer p.wg.Done()

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	p.logger.Info("poll loop started, checking every 5 seconds")

	for {
		select {
		case <-ctx.Done():
			p.logger.Info("poll loop stopped: context cancelled")
			return
		case <-p.stopChan:
			p.logger.Info("poll loop stopped: shutdown signal")
			return
		case <-ticker.C:
			hasRunning, err := p.checkRunningSessions(ctx)
			if err != nil {
				p.logger.Error("error checking running sessions", "error", err)
				continue
			}
			if hasRunning {
				p.logger.Debug("found running sessions, will check again in 5 seconds")
			}
		}
	}
}

// checkRunningSessions checks all running sessions and returns true if any are still running
func (p *SessionStatusPoller) checkRunningSessions(ctx context.Context) (bool, error) {
	// Get all sessions with status "running"
	sessions, err := p.store.GetSessionsByStatus(ctx, model.SessionStatusRunning)
	if err != nil {
		return false, fmt.Errorf("failed to get running sessions: %w", err)
	}

	if len(sessions) == 0 {
		return false, nil
	}

	p.logger.Debug("checking running sessions", "count", len(sessions))

	stillRunning := 0
	for _, session := range sessions {
		err := p.checkSession(ctx, &session)
		if err == nil {
			// Session is still running
			stillRunning++
		} else if !errors.Is(err, errSessionNotRunning) {
			// Actual error checking the session (not the expected "not running" case)
			p.logger.Error("error checking session",
				"session_id", session.ID,
				"project_id", session.ProjectID,
				"error", err)
			// Continue checking other sessions
		}
		// If err is errSessionNotRunning, the session was successfully marked
		// as not running - don't count it or log an error
	}

	return stillRunning > 0, nil
}

// checkSession verifies if a session marked as "running" actually has an active completion
func (p *SessionStatusPoller) checkSession(ctx context.Context, session *model.Session) error {
	logger := p.logger.With("session_id", session.ID, "project_id", session.ProjectID)

	// Create a timeout context for this check
	checkCtx, cancel := context.WithTimeout(ctx, pollTimeout)
	defer cancel()

	// Get the sandbox client
	client, err := p.sandboxSvc.GetClient(checkCtx, session.ID)
	if err != nil {
		// If we can't get a client (sandbox might be stopped), mark session as stopped
		logger.Warn("failed to get sandbox client, marking session as stopped", "error", err)
		if updateErr := p.updateSessionStatus(ctx, session, model.SessionStatusStopped, err.Error()); updateErr != nil {
			return updateErr
		}
		return errSessionNotRunning
	}

	// Check the chat status
	status, err := client.GetChatStatus(checkCtx)
	if err != nil {
		logger.Warn("failed to get chat status", "error", err)
		// Don't mark as error immediately, might be a transient issue
		return err
	}

	// If completion is not running, update session to ready
	if !status.IsRunning {
		logger.Info("session marked running but completion not active, updating to ready",
			"completion_id", status.CompletionID)
		if err := p.updateSessionStatus(ctx, session, model.SessionStatusReady, ""); err != nil {
			return err
		}
		return errSessionNotRunning
	}

	logger.Debug("session completion still running", "completion_id", status.CompletionID)
	return nil
}

// updateSessionStatus updates a session's status and publishes an event
func (p *SessionStatusPoller) updateSessionStatus(ctx context.Context, session *model.Session, newStatus, errorMsg string) error {
	logger := p.logger.With("session_id", session.ID, "project_id", session.ProjectID)

	// Prepare error message pointer
	var errorMsgPtr *string
	if errorMsg != "" {
		errorMsgPtr = &errorMsg
	}

	// Update in database
	if err := p.store.UpdateSessionStatus(ctx, session.ID, newStatus, errorMsgPtr); err != nil {
		logger.Error("failed to update session status", "error", err)
		return err
	}

	// Publish event
	if p.eventBroker != nil {
		if err := p.eventBroker.PublishSessionUpdated(ctx, session.ProjectID, session.ID, newStatus, errorMsg); err != nil {
			logger.Error("failed to publish session updated event", "error", err)
		}
	}

	logger.Info("updated session status", "old_status", session.Status, "new_status", newStatus)
	return nil
}
