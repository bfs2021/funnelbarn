package spool_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/wiebe-xyz/funnelbarn/internal/spool"
)

// A failed rotation must not leave the spool with a closed handle: before, the
// rename error escaped with the active file closed, every later Append failed
// with "file already closed", and only a process restart recovered.
func TestRotate_RenameFailureKeepsSpoolWritable(t *testing.T) {
	dir := newTestDir(t)
	sp, err := spool.New(dir)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer sp.Close()

	if err := sp.Append(makeRecord("before-rotate", `{"name":"x"}`)); err != nil {
		t.Fatalf("Append before rotate: %v", err)
	}

	// Occupy every archive name Rotate could pick so the rename fails.
	now := time.Now().UTC()
	for i := -2; i <= 30; i++ {
		name := now.Add(time.Duration(i) * time.Second).Format("20060102T150405Z")
		if err := os.Mkdir(filepath.Join(dir, "ingest-"+name+".ndjson"), 0o755); err != nil {
			t.Fatalf("Mkdir archive blocker: %v", err)
		}
	}

	if err := sp.Rotate(); err == nil {
		t.Fatal("Rotate with occupied archive path = nil, want an error")
	}

	// The spool must stay writable: the failed rotation leaves the segment
	// unrenamed and the handle open.
	if err := sp.Append(makeRecord("after-rotate", `{"name":"y"}`)); err != nil {
		t.Fatalf("Append after failed Rotate: %v", err)
	}
	if err := sp.AppendBatch([]spool.Record{makeRecord("batch-after-rotate", `{"name":"z"}`)}); err != nil {
		t.Fatalf("AppendBatch after failed Rotate: %v", err)
	}

	records, err := spool.ReadRecords(spool.Path(dir))
	if err != nil {
		t.Fatalf("ReadRecords: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("active segment holds %d records, want 3", len(records))
	}
	if records[0].IngestID != "before-rotate" || records[2].IngestID != "batch-after-rotate" {
		t.Fatalf("unexpected records after failed rotation: %+v", records)
	}
}

// Writes after Close report ErrClosed so a caller never logs a record as
// written to a spool that is shut down.
func TestAppend_AfterCloseReturnsErrClosed(t *testing.T) {
	dir := newTestDir(t)
	sp, err := spool.New(dir)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := sp.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	if err := sp.Append(makeRecord("late", `{}`)); !errors.Is(err, spool.ErrClosed) {
		t.Fatalf("Append after Close = %v, want ErrClosed", err)
	}
	if err := sp.AppendBatch([]spool.Record{makeRecord("late-batch", `{}`)}); !errors.Is(err, spool.ErrClosed) {
		t.Fatalf("AppendBatch after Close = %v, want ErrClosed", err)
	}
}
