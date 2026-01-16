# Config Module

Configuration management with file watching for hot reload.

## Files

| File | Purpose |
|------|---------|
| `internal/config/config.go` | Config types, loading, validation |
| `internal/config/watcher.go` | fsnotify file watcher |

## Types

```go
// Config is the root configuration structure
type Config struct {
    Proxy     ProxyConfig     `yaml:"proxy"`
    TLS       TLSConfig       `yaml:"tls"`
    Allowlist AllowlistConfig `yaml:"allowlist"`
    Headers   HeadersConfig   `yaml:"headers"`
    Logging   LoggingConfig   `yaml:"logging"`
}

type ProxyConfig struct {
    Port         int           `yaml:"port"`
    APIPort      int           `yaml:"api_port"`
    ReadTimeout  time.Duration `yaml:"read_timeout"`
    WriteTimeout time.Duration `yaml:"write_timeout"`
}

type TLSConfig struct {
    CertDir string `yaml:"cert_dir"`
}

type AllowlistConfig struct {
    Enabled bool     `yaml:"enabled"`
    Domains []string `yaml:"domains"`
    IPs     []string `yaml:"ips"`
}

// HeadersConfig maps domain patterns to header key-value pairs
type HeadersConfig map[string]map[string]string

type LoggingConfig struct {
    Level       string `yaml:"level"`
    Format      string `yaml:"format"`
    File        string `yaml:"file"`
    IncludeBody bool   `yaml:"include_body"`
}
```

## Loading

```go
func Load(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("read config: %w", err)
    }

    var cfg Config
    if err := yaml.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }

    if err := cfg.Validate(); err != nil {
        return nil, fmt.Errorf("validate config: %w", err)
    }

    return &cfg, nil
}
```

## Validation

```go
func (c *Config) Validate() error {
    if c.Proxy.Port < 1 || c.Proxy.Port > 65535 {
        return errors.New("invalid proxy port")
    }
    if c.Proxy.APIPort < 1 || c.Proxy.APIPort > 65535 {
        return errors.New("invalid API port")
    }
    if c.Proxy.Port == c.Proxy.APIPort {
        return errors.New("proxy and API ports must be different")
    }

    // Validate domain patterns
    for pattern := range c.Headers {
        if !isValidDomainPattern(pattern) {
            return fmt.Errorf("invalid domain pattern: %s", pattern)
        }
    }

    // Validate CIDR ranges
    for _, cidr := range c.Allowlist.IPs {
        if _, _, err := net.ParseCIDR(cidr); err != nil {
            // Try as single IP
            if net.ParseIP(cidr) == nil {
                return fmt.Errorf("invalid IP/CIDR: %s", cidr)
            }
        }
    }

    return nil
}
```

## File Watching

```go
type Watcher struct {
    configPath string
    watcher    *fsnotify.Watcher
    stop       chan struct{}
    onChange   func(*Config)
}

func NewWatcher(configPath string, onChange func(*Config)) *Watcher {
    return &Watcher{
        configPath: configPath,
        stop:       make(chan struct{}),
        onChange:   onChange,
    }
}

func (w *Watcher) Start() error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    w.watcher = watcher

    // Watch the directory to handle editors that rename files
    dir := filepath.Dir(w.configPath)
    if err := watcher.Add(dir); err != nil {
        return err
    }

    go w.loop()
    return nil
}

func (w *Watcher) loop() {
    var debounce <-chan time.Time

    for {
        select {
        case event := <-w.watcher.Events:
            // Check if it's our config file
            if filepath.Base(event.Name) != filepath.Base(w.configPath) {
                continue
            }
            // Debounce rapid changes (editors often write multiple times)
            debounce = time.After(100 * time.Millisecond)

        case <-debounce:
            cfg, err := Load(w.configPath)
            if err != nil {
                log.Printf("config reload error: %v", err)
                continue
            }
            w.onChange(cfg)

        case err := <-w.watcher.Errors:
            log.Printf("watcher error: %v", err)

        case <-w.stop:
            w.watcher.Close()
            return
        }
    }
}

func (w *Watcher) Stop() {
    close(w.stop)
}
```

## Default Values

```go
func DefaultConfig() *Config {
    return &Config{
        Proxy: ProxyConfig{
            Port:         8080,
            APIPort:      8081,
            ReadTimeout:  30 * time.Second,
            WriteTimeout: 30 * time.Second,
        },
        TLS: TLSConfig{
            CertDir: "./certs",
        },
        Allowlist: AllowlistConfig{
            Enabled: false,  // Allow all by default
            Domains: []string{},
            IPs:     []string{},
        },
        Headers: HeadersConfig{},
        Logging: LoggingConfig{
            Level:  "info",
            Format: "text",
        },
    }
}
```
