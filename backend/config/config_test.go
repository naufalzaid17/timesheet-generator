package config

import (
	"reflect"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string
	}{
		{"single", "https://a.com", []string{"https://a.com"}},
		{"commaSeparated", "https://a.com,https://b.org", []string{"https://a.com", "https://b.org"}},
		{"whitespaceAndTrailingSlash", " https://a.com/ ,\thttps://b.org/ ", []string{"https://a.com", "https://b.org"}},
		{"dedup", "https://a.com,https://a.com", []string{"https://a.com"}},
		{"empty", "", []string{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseOrigins(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("parseOrigins(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
