# Octobot Proxy

A multi-protocol proxy server with HTTP interception, header injection, and dynamic configuration.

## Overview

The proxy provides:
- HTTP/HTTPS proxy with MITM for traffic inspection and header injection
- SOCKS5 proxy for non-HTTP TCP tunneling
- Protocol auto-detection on a single port
- Domain-based header injection rules
- Dynamic configuration via file watching and REST API
- Request logging for all proxied traffic

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Proxy Server                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Protocol Detector                             │ │
│  │              (first-byte sniffing on :8080)                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                    │                          │                      │
│           HTTP (GET/POST/...)           SOCKS5 (0x05)               │
│                    │                          │                      │
│                    ▼                          ▼                      │
│  ┌─────────────────────────┐    ┌─────────────────────────────────┐ │
│  │     HTTP Proxy          │    │        SOCKS5 Proxy             │ │
│  │     (goproxy)           │    │     (things-go/go-socks5)       │ │
│  │                         │    │                                 │ │
│  │  ┌───────────────────┐  │    │  ┌───────────────────────────┐  │ │
│  │  │   MITM Handler    │  │    │  │   Rule-based Filtering    │  │ │
│  │  │  (TLS intercept)  │  │    │  │   (DNS/IP allowlist)      │  │ │
│  │  └───────────────────┘  │    │  └───────────────────────────┘  │ │
│  │           │             │    │               │                 │ │
│  │           ▼             │    │               ▼                 │ │
│  │  ┌───────────────────┐  │    │  ┌───────────────────────────┐  │ │
│  │  │  Header Injector  │  │    │  │   Connection Tunneling    │  │ │
│  │  │  (per-domain)     │  │    │  │   (TCP passthrough)       │  │ │
│  │  └───────────────────┘  │    │  └───────────────────────────┘  │ │
│  └─────────────────────────┘    └─────────────────────────────────┘ │
│                    │                          │                      │
│                    └──────────┬───────────────┘                      │
│                               ▼                                      │
│                    ┌───────────────────┐                            │
│                    │   Request Logger  │                            │
│                    └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Config Watcher │  │   REST API      │  │  Certificate    │
│  (YAML file)    │  │   (POST only)   │  │  Manager        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - System design and data flow
- [Config Module](./docs/design/config.md) - Configuration and file watching
- [Proxy Module](./docs/design/proxy.md) - HTTP and SOCKS5 proxy implementation
- [Injector Module](./docs/design/injector.md) - Header injection logic
- [API Module](./docs/design/api.md) - REST API for configuration

## Getting Started

### Prerequisites

- Go 1.23+

### Development

```bash
# Run with auto-reload
cd proxy
air

# Or run directly
go run cmd/proxy/main.go

# Run tests
go test ./...

# Run linter
golangci-lint run
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `8080` | Main proxy port (HTTP + SOCKS5) |
| `API_PORT` | `8081` | REST API port |
| `CONFIG_FILE` | `config.yaml` | Path to configuration file |
| `CERT_DIR` | `./certs` | Directory for CA certificate |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `LOG_FORMAT` | `text` | Log format (text, json) |

### Building

```bash
go build -o octobot-proxy ./cmd/proxy
```

### Configuration File

```yaml
# config.yaml
proxy:
  port: 8080
  api_port: 8081

# DNS/IP allowlist (empty = allow all)
allowlist:
  domains:
    - "*.github.com"
    - "api.anthropic.com"
    - "*.openai.com"
  ips:
    - "192.168.1.0/24"

# Header injection rules (domain -> header rules)
# Each rule has "set" (replace) and/or "append" sections
headers:
  "api.anthropic.com":
    set:
      "X-Custom-Header": "value1"
  "*.openai.com":
    set:
      "X-Request-Source": "octobot-proxy"
    append:
      "X-Forwarded-For": "proxy.internal"

logging:
  level: info
  format: text
  file: ""  # Empty = stdout
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/config` | Overwrite entire running config |
| PATCH | `/api/config` | Merge partial config into running config |
| GET | `/health` | Health check |

### POST /api/config - Overwrite

Completely replaces the running configuration:

```bash
curl -X POST http://localhost:8081/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "allowlist": {
      "enabled": true,
      "domains": ["*.github.com", "api.anthropic.com"],
      "ips": ["10.0.0.0/8"]
    },
    "headers": {
      "api.anthropic.com": {
        "set": {"Authorization": "Bearer sk-ant-xxx"}
      },
      "*.github.com": {
        "set": {"Authorization": "token ghp_xxx"},
        "append": {"X-Forwarded-For": "proxy.internal"}
      }
    }
  }'
```

### PATCH /api/config - Merge

Merges into existing config. Set a domain to `null` to delete:

```bash
# Add headers for a new domain (existing domains unchanged)
curl -X PATCH http://localhost:8081/api/config \
  -d '{"headers": {"api.openai.com": {"set": {"Authorization": "Bearer sk-xxx"}}}}'

# Add append-style headers
curl -X PATCH http://localhost:8081/api/config \
  -d '{"headers": {"*": {"append": {"Via": "1.1 octobot-proxy"}}}}'

# Delete a domain's headers
curl -X PATCH http://localhost:8081/api/config \
  -d '{"headers": {"api.openai.com": null}}'
```

Response:
```json
{"status": "ok"}
```

## Project Structure

```
proxy/
├── cmd/proxy/
│   └── main.go              # Application entry point
├── internal/
│   ├── config/              # Configuration management
│   │   ├── config.go        # Config types and loading
│   │   └── watcher.go       # File watcher for hot reload
│   ├── proxy/               # Proxy implementations
│   │   ├── server.go        # Main server with protocol detection
│   │   ├── http.go          # HTTP/HTTPS proxy (goproxy)
│   │   ├── socks.go         # SOCKS5 proxy (go-socks5)
│   │   └── detector.go      # Protocol detection
│   ├── injector/            # Header injection
│   │   ├── injector.go      # Header injection logic
│   │   └── matcher.go       # Domain pattern matching
│   ├── cert/                # Certificate management
│   │   └── manager.go       # CA cert generation and storage
│   ├── api/                 # REST API
│   │   ├── server.go        # API server
│   │   └── handlers.go      # API handlers
│   ├── logger/              # Request logging
│   │   └── logger.go        # Structured logging
│   └── filter/              # Connection filtering
│       └── filter.go        # DNS/IP allowlist
├── docs/
│   ├── ARCHITECTURE.md
│   └── design/
│       ├── config.md
│       ├── proxy.md
│       ├── injector.md
│       └── api.md
├── go.mod
├── go.sum
└── config.yaml              # Example configuration
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `github.com/elazarl/goproxy` | HTTP/HTTPS proxy with MITM |
| `github.com/things-go/go-socks5` | SOCKS5 server |
| `github.com/fsnotify/fsnotify` | File watching for config |
| `github.com/go-chi/chi/v5` | HTTP routing for API |
| `gopkg.in/yaml.v3` | YAML configuration parsing |
| `go.uber.org/zap` | Structured logging |

## Certificate Installation

For HTTPS interception, the proxy generates a CA certificate on first run. Install it in your system/browser trust store:

```bash
# Certificate is saved to:
# ./certs/ca.crt (public cert - install this)
# ./certs/ca.key (private key - keep secure)

# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./certs/ca.crt

# Linux (Ubuntu/Debian)
sudo cp ./certs/ca.crt /usr/local/share/ca-certificates/octobot-proxy.crt
sudo update-ca-certificates

# Windows (PowerShell as Admin)
Import-Certificate -FilePath .\certs\ca.crt -CertStoreLocation Cert:\LocalMachine\Root
```

## Usage

### As HTTP Proxy

```bash
# Set environment variables
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080

# Or per-command
curl --proxy http://localhost:8080 https://api.anthropic.com/v1/messages
```

### As SOCKS5 Proxy

```bash
# Set environment variable
export ALL_PROXY=socks5://localhost:8080

# Or per-command
curl --socks5 localhost:8080 https://example.com
```

## Testing

```bash
# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run specific package
go test ./internal/injector/...

# Run with race detection
go test -race ./...
```

## License

MIT
