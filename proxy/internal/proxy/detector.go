// Package proxy provides HTTP and SOCKS5 proxy implementations.
package proxy

import (
	"bytes"
	"io"
	"net"
	"time"
)

// Protocol represents a detected protocol.
type Protocol int

const (
	// ProtocolUnknown is an unknown protocol.
	ProtocolUnknown Protocol = iota
	// ProtocolHTTP is HTTP protocol.
	ProtocolHTTP
	// ProtocolSOCKS5 is SOCKS5 protocol.
	ProtocolSOCKS5
	// ProtocolSOCKS4 is SOCKS4 protocol (not supported).
	ProtocolSOCKS4
)

func (p Protocol) String() string {
	switch p {
	case ProtocolHTTP:
		return "HTTP"
	case ProtocolSOCKS5:
		return "SOCKS5"
	case ProtocolSOCKS4:
		return "SOCKS4"
	default:
		return "Unknown"
	}
}

// DetectionTimeout is the timeout for protocol detection.
const DetectionTimeout = 5 * time.Second

// Detect reads the first byte(s) to determine the protocol.
// Returns the detected protocol and a wrapped connection that replays the peeked bytes.
func Detect(conn net.Conn) (Protocol, *PeekedConn, error) {
	// Set a short timeout for detection
	if err := conn.SetReadDeadline(time.Now().Add(DetectionTimeout)); err != nil {
		return ProtocolUnknown, nil, err
	}

	buf := make([]byte, 1)
	_, err := io.ReadFull(conn, buf)

	// Clear the deadline
	if clearErr := conn.SetReadDeadline(time.Time{}); clearErr != nil && err == nil {
		err = clearErr
	}

	if err != nil {
		return ProtocolUnknown, nil, err
	}

	// Extract first byte for protocol detection
	firstByte := buf[0]

	var proto Protocol
	switch firstByte {
	case 0x05:
		proto = ProtocolSOCKS5
	case 0x04:
		proto = ProtocolSOCKS4
	default:
		// Check if ASCII printable (HTTP methods start with uppercase letters)
		if firstByte >= 'A' && firstByte <= 'Z' {
			proto = ProtocolHTTP
		} else {
			proto = ProtocolUnknown
		}
	}

	// Wrap connection to replay peeked byte
	peeked := NewPeekedConn(conn, buf)
	return proto, peeked, nil
}

// PeekedConn wraps a connection with pre-read bytes.
type PeekedConn struct {
	net.Conn
	reader io.Reader
}

// NewPeekedConn creates a connection that replays peeked bytes.
func NewPeekedConn(conn net.Conn, peeked []byte) *PeekedConn {
	return &PeekedConn{
		Conn:   conn,
		reader: io.MultiReader(bytes.NewReader(peeked), conn),
	}
}

// Read reads from the connection, first returning any peeked bytes.
func (c *PeekedConn) Read(b []byte) (int, error) {
	return c.reader.Read(b)
}
