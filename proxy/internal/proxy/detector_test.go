package proxy

import (
	"bytes"
	"io"
	"net"
	"testing"
	"time"
)

// mockConn implements net.Conn for testing
type mockConn struct {
	reader   io.Reader
	readErr  error
	closed   bool
	deadline time.Time
}

func (c *mockConn) Read(b []byte) (int, error) {
	if c.readErr != nil {
		return 0, c.readErr
	}
	return c.reader.Read(b)
}

func (c *mockConn) Write(b []byte) (int, error)        { return len(b), nil }
func (c *mockConn) Close() error                       { c.closed = true; return nil }
func (c *mockConn) LocalAddr() net.Addr                { return nil }
func (c *mockConn) RemoteAddr() net.Addr               { return nil }
func (c *mockConn) SetDeadline(t time.Time) error      { c.deadline = t; return nil }
func (c *mockConn) SetReadDeadline(t time.Time) error  { c.deadline = t; return nil }
func (c *mockConn) SetWriteDeadline(t time.Time) error { return nil }

func TestDetect_HTTP(t *testing.T) {
	tests := []struct {
		name string
		data []byte
	}{
		{"GET", []byte("GET / HTTP/1.1\r\n")},
		{"POST", []byte("POST /api HTTP/1.1\r\n")},
		{"PUT", []byte("PUT /resource HTTP/1.1\r\n")},
		{"DELETE", []byte("DELETE /item HTTP/1.1\r\n")},
		{"HEAD", []byte("HEAD / HTTP/1.1\r\n")},
		{"OPTIONS", []byte("OPTIONS * HTTP/1.1\r\n")},
		{"PATCH", []byte("PATCH /update HTTP/1.1\r\n")},
		{"CONNECT", []byte("CONNECT example.com:443 HTTP/1.1\r\n")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := &mockConn{reader: bytes.NewReader(tt.data)}
			proto, peeked, err := Detect(conn)

			if err != nil {
				t.Fatalf("Detect() error = %v", err)
			}
			if proto != ProtocolHTTP {
				t.Errorf("Detect() = %v, want %v", proto, ProtocolHTTP)
			}

			// Verify we can read the full data through peeked connection
			buf := make([]byte, len(tt.data))
			n, err := io.ReadFull(peeked, buf)
			if err != nil {
				t.Fatalf("Read from peeked conn error = %v", err)
			}
			if n != len(tt.data) {
				t.Errorf("Read %d bytes, want %d", n, len(tt.data))
			}
			if !bytes.Equal(buf, tt.data) {
				t.Errorf("Read data = %q, want %q", buf, tt.data)
			}
		})
	}
}

func TestDetect_SOCKS5(t *testing.T) {
	// SOCKS5 greeting: version (0x05) + number of methods + methods
	data := []byte{0x05, 0x01, 0x00}
	conn := &mockConn{reader: bytes.NewReader(data)}

	proto, peeked, err := Detect(conn)
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if proto != ProtocolSOCKS5 {
		t.Errorf("Detect() = %v, want %v", proto, ProtocolSOCKS5)
	}

	// Verify we can read the full data through peeked connection
	buf := make([]byte, len(data))
	_, err = io.ReadFull(peeked, buf)
	if err != nil {
		t.Fatalf("Read from peeked conn error = %v", err)
	}
	if !bytes.Equal(buf, data) {
		t.Errorf("Read data = %v, want %v", buf, data)
	}
}

func TestDetect_SOCKS4(t *testing.T) {
	// SOCKS4 connect: version (0x04) + command + port + IP + userid + null
	data := []byte{0x04, 0x01, 0x00, 0x50, 0x7f, 0x00, 0x00, 0x01, 0x00}
	conn := &mockConn{reader: bytes.NewReader(data)}

	proto, _, err := Detect(conn)
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if proto != ProtocolSOCKS4 {
		t.Errorf("Detect() = %v, want %v", proto, ProtocolSOCKS4)
	}
}

func TestDetect_Unknown(t *testing.T) {
	// Binary data that doesn't match any known protocol
	data := []byte{0x00, 0x01, 0x02, 0x03}
	conn := &mockConn{reader: bytes.NewReader(data)}

	proto, _, err := Detect(conn)
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}
	if proto != ProtocolUnknown {
		t.Errorf("Detect() = %v, want %v", proto, ProtocolUnknown)
	}
}

func TestDetect_ReadError(t *testing.T) {
	conn := &mockConn{readErr: io.EOF}

	_, _, err := Detect(conn)
	if err == nil {
		t.Error("Detect() expected error, got nil")
	}
}

func TestPeekedConn_Read(t *testing.T) {
	originalData := []byte("HELLO WORLD")
	peekedByte := originalData[:1]
	restOfData := originalData[1:]

	// Create a base reader for the rest of the data
	baseReader := bytes.NewReader(restOfData)
	baseConn := &mockConn{reader: baseReader}

	// Create peeked connection
	peeked := NewPeekedConn(baseConn, peekedByte)

	// Read all data through peeked connection
	result := make([]byte, len(originalData))
	n, err := io.ReadFull(peeked, result)

	if err != nil {
		t.Fatalf("Read error = %v", err)
	}
	if n != len(originalData) {
		t.Errorf("Read %d bytes, want %d", n, len(originalData))
	}
	if !bytes.Equal(result, originalData) {
		t.Errorf("Read data = %q, want %q", result, originalData)
	}
}

func TestProtocol_String(t *testing.T) {
	tests := []struct {
		proto Protocol
		want  string
	}{
		{ProtocolHTTP, "HTTP"},
		{ProtocolSOCKS5, "SOCKS5"},
		{ProtocolSOCKS4, "SOCKS4"},
		{ProtocolUnknown, "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.proto.String(); got != tt.want {
				t.Errorf("Protocol.String() = %q, want %q", got, tt.want)
			}
		})
	}
}
