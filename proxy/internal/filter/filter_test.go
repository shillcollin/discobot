package filter

import "testing"

func TestFilter_DisabledAllowsAll(t *testing.T) {
	f := New()
	f.SetEnabled(false)

	tests := []string{
		"example.com",
		"any.domain.com",
		"192.168.1.1",
		"10.0.0.1",
	}

	for _, host := range tests {
		if !f.AllowHost(host) {
			t.Errorf("AllowHost(%q) = false, want true (filter disabled)", host)
		}
	}
}

func TestFilter_EnabledWithEmptyListBlocksAll(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist(nil, nil)

	tests := []string{
		"example.com",
		"any.domain.com",
		"192.168.1.1",
	}

	for _, host := range tests {
		if f.AllowHost(host) {
			t.Errorf("AllowHost(%q) = true, want false (empty allowlist)", host)
		}
	}
}

func TestFilter_DomainAllowlist(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist([]string{
		"example.com",
		"*.github.com",
		"api.*",
	}, nil)

	tests := []struct {
		host string
		want bool
	}{
		{"example.com", true},
		{"Example.COM", true}, // Case insensitive
		{"api.github.com", true},
		{"raw.github.com", true},
		{"api.example.com", true},
		{"api.io", true},
		{"other.com", false},
		{"github.com", false}, // *.github.com doesn't match bare domain
		{"notexample.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got := f.AllowHost(tt.host)
			if got != tt.want {
				t.Errorf("AllowHost(%q) = %v, want %v", tt.host, got, tt.want)
			}
		})
	}
}

func TestFilter_IPAllowlist(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist(nil, []string{
		"192.168.1.100",
		"10.0.0.0/8",
		"172.16.0.0/12",
	})

	tests := []struct {
		host string
		want bool
	}{
		{"192.168.1.100", true},
		{"192.168.1.101", false},
		{"10.0.0.1", true},
		{"10.255.255.255", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"172.32.0.1", false},
		{"8.8.8.8", false},
	}

	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got := f.AllowHost(tt.host)
			if got != tt.want {
				t.Errorf("AllowHost(%q) = %v, want %v", tt.host, got, tt.want)
			}
		})
	}
}

func TestFilter_MixedAllowlist(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist(
		[]string{"*.example.com"},
		[]string{"10.0.0.0/8"},
	)

	tests := []struct {
		host string
		want bool
	}{
		{"api.example.com", true},
		{"10.0.0.1", true},
		{"other.com", false},
		{"8.8.8.8", false},
	}

	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got := f.AllowHost(tt.host)
			if got != tt.want {
				t.Errorf("AllowHost(%q) = %v, want %v", tt.host, got, tt.want)
			}
		})
	}
}

func TestFilter_HostWithPort(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist([]string{"example.com"}, []string{"192.168.1.100"})

	tests := []struct {
		host string
		want bool
	}{
		{"example.com:80", true},
		{"example.com:443", true},
		{"192.168.1.100:3306", true},
		{"other.com:80", false},
	}

	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got := f.AllowHost(tt.host)
			if got != tt.want {
				t.Errorf("AllowHost(%q) = %v, want %v", tt.host, got, tt.want)
			}
		})
	}
}

func TestFilter_AddDomains(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist([]string{"example.com"}, nil)

	// Verify initial state
	if !f.AllowHost("example.com") {
		t.Error("example.com should be allowed initially")
	}
	if f.AllowHost("other.com") {
		t.Error("other.com should not be allowed initially")
	}

	// Add more domains
	f.AddDomains([]string{"other.com", "*.github.com"})

	if !f.AllowHost("other.com") {
		t.Error("other.com should be allowed after AddDomains")
	}
	if !f.AllowHost("api.github.com") {
		t.Error("api.github.com should be allowed after AddDomains")
	}
}

func TestFilter_AddIPs(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist(nil, []string{"192.168.1.100"})

	// Verify initial state
	if !f.AllowHost("192.168.1.100") {
		t.Error("192.168.1.100 should be allowed initially")
	}
	if f.AllowHost("10.0.0.1") {
		t.Error("10.0.0.1 should not be allowed initially")
	}

	// Add more IPs
	f.AddIPs([]string{"10.0.0.0/8"})

	if !f.AllowHost("10.0.0.1") {
		t.Error("10.0.0.1 should be allowed after AddIPs")
	}
}

func TestFilter_RemoveDomain(t *testing.T) {
	f := New()
	f.SetEnabled(true)
	f.SetAllowlist([]string{"example.com", "other.com"}, nil)

	// Verify initial state
	if !f.AllowHost("example.com") {
		t.Error("example.com should be allowed initially")
	}

	// Remove domain
	f.RemoveDomain("example.com")

	if f.AllowHost("example.com") {
		t.Error("example.com should not be allowed after RemoveDomain")
	}
	if !f.AllowHost("other.com") {
		t.Error("other.com should still be allowed")
	}
}

func TestFilter_SetEnabled(t *testing.T) {
	f := New()
	f.SetAllowlist([]string{"example.com"}, nil)

	// Initially disabled
	if f.IsEnabled() {
		t.Error("Filter should be disabled initially")
	}
	if !f.AllowHost("other.com") {
		t.Error("other.com should be allowed when filter is disabled")
	}

	// Enable
	f.SetEnabled(true)
	if !f.IsEnabled() {
		t.Error("Filter should be enabled after SetEnabled(true)")
	}
	if f.AllowHost("other.com") {
		t.Error("other.com should not be allowed when filter is enabled")
	}

	// Disable again
	f.SetEnabled(false)
	if f.IsEnabled() {
		t.Error("Filter should be disabled after SetEnabled(false)")
	}
	if !f.AllowHost("other.com") {
		t.Error("other.com should be allowed when filter is disabled")
	}
}
