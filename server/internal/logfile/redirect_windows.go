//go:build windows

package logfile

import "fmt"

// RedirectStdoutStderr is not supported on Windows.
func RedirectStdoutStderr(_ string) error {
	return fmt.Errorf("log file redirect not supported on Windows")
}
