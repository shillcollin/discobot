// Package injector provides header injection with domain pattern matching.
package injector

import "strings"

// MatchDomain checks if host matches the pattern.
// Supported patterns:
//   - "example.com"     - exact match
//   - "*.example.com"   - matches any subdomain (api.example.com, www.example.com)
//   - "api.*"           - matches api.com, api.io, etc.
//   - "*"               - matches everything
func MatchDomain(pattern, host string) bool {
	// Normalize to lowercase
	pattern = strings.ToLower(pattern)
	host = strings.ToLower(host)

	// Exact match
	if pattern == host {
		return true
	}

	// Wildcard match all
	if pattern == "*" {
		return true
	}

	// Prefix wildcard: *.example.com
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:] // .example.com
		return strings.HasSuffix(host, suffix)
	}

	// Suffix wildcard: api.*
	if strings.HasSuffix(pattern, ".*") {
		prefix := pattern[:len(pattern)-2] // api
		return strings.HasPrefix(host, prefix+".")
	}

	return false
}
