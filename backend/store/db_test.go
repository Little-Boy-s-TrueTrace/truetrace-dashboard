package store

import "testing"

func TestConfiguredOperatorsUsesRuntimeConfiguration(t *testing.T) {
	t.Setenv("TRUETRACE_DASHBOARD_OPERATORS", "20001:alice,20002:bob")

	operators, err := configuredOperators()
	if err != nil {
		t.Fatalf("configuredOperators returned error: %v", err)
	}
	if len(operators) != 2 || operators["20001"] != "alice" || operators["20002"] != "bob" {
		t.Fatalf("unexpected operators: %#v", operators)
	}
}

func TestConfiguredOperatorsRejectsMalformedEntries(t *testing.T) {
	t.Setenv("TRUETRACE_DASHBOARD_OPERATORS", "missing-separator")

	if _, err := configuredOperators(); err == nil {
		t.Fatal("expected malformed operator configuration to fail")
	}
}
