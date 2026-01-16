package config

import (
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher watches a configuration file for changes.
type Watcher struct {
	configPath string
	watcher    *fsnotify.Watcher
	onChange   func(*Config)
	stop       chan struct{}
	wg         sync.WaitGroup
}

// NewWatcher creates a new configuration file watcher.
func NewWatcher(configPath string, onChange func(*Config)) *Watcher {
	return &Watcher{
		configPath: configPath,
		onChange:   onChange,
		stop:       make(chan struct{}),
	}
}

// Start begins watching the configuration file.
func (w *Watcher) Start() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	w.watcher = watcher

	// Watch the directory to handle editors that rename files
	dir := filepath.Dir(w.configPath)
	if err := watcher.Add(dir); err != nil {
		_ = watcher.Close()
		return err
	}

	w.wg.Add(1)
	go w.loop()

	return nil
}

// Stop stops watching the configuration file.
func (w *Watcher) Stop() {
	close(w.stop)
	w.wg.Wait()
	if w.watcher != nil {
		_ = w.watcher.Close()
	}
}

func (w *Watcher) loop() {
	defer w.wg.Done()

	var debounceTimer *time.Timer
	var debounceCh <-chan time.Time

	configFileName := filepath.Base(w.configPath)

	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}

			// Check if it's our config file
			if filepath.Base(event.Name) != configFileName {
				continue
			}

			// Only trigger on write or create (editors may delete and recreate)
			if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
				continue
			}

			// Debounce rapid changes (editors often write multiple times)
			if debounceTimer != nil {
				debounceTimer.Stop()
			}
			debounceTimer = time.NewTimer(100 * time.Millisecond)
			debounceCh = debounceTimer.C

		case <-debounceCh:
			debounceCh = nil
			debounceTimer = nil

			cfg, err := Load(w.configPath)
			if err != nil {
				log.Printf("config reload error: %v", err)
				continue
			}
			w.onChange(cfg)

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("config watcher error: %v", err)

		case <-w.stop:
			if debounceTimer != nil {
				debounceTimer.Stop()
			}
			return
		}
	}
}
