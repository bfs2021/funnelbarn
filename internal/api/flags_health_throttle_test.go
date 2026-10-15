package api

import (
	"testing"
	"time"
)

func TestMarkThrottleAllowsOneMarkPerProjectPerInterval(t *testing.T) {
	var th markThrottle
	now := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)

	if !th.due("p1", now) {
		t.Fatal("first mark for a project must be due")
	}
	if th.due("p1", now.Add(flagsHealthInterval-time.Second)) {
		t.Error("second mark inside the interval must be skipped")
	}
	if !th.due("p2", now) {
		t.Error("another project has its own interval")
	}
	if !th.due("p1", now.Add(flagsHealthInterval)) {
		t.Error("a mark after the interval must be due again")
	}
}
