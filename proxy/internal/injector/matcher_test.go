package injector

import "testing"

func TestMatchDomain(t *testing.T) {
	tests := []struct {
		pattern string
		host    string
		want    bool
	}{
		// Exact matches
		{"example.com", "example.com", true},
		{"example.com", "Example.COM", true}, // Case insensitive
		{"example.com", "other.com", false},
		{"example.com", "subexample.com", false},

		// Wildcard all
		{"*", "example.com", true},
		{"*", "anything.goes.here", true},

		// Prefix wildcard (*.example.com)
		{"*.example.com", "api.example.com", true},
		{"*.example.com", "www.example.com", true},
		{"*.example.com", "deep.sub.example.com", true},
		{"*.example.com", "example.com", false}, // Doesn't match bare domain
		{"*.example.com", "other.com", false},
		{"*.example.com", "notexample.com", false},

		// Suffix wildcard (api.*)
		{"api.*", "api.example.com", true},
		{"api.*", "api.io", true},
		{"api.*", "api.co.uk", true},
		{"api.*", "notapi.com", false},
		{"api.*", "myapi.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.pattern+"_"+tt.host, func(t *testing.T) {
			got := MatchDomain(tt.pattern, tt.host)
			if got != tt.want {
				t.Errorf("MatchDomain(%q, %q) = %v, want %v", tt.pattern, tt.host, got, tt.want)
			}
		})
	}
}
