package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
	"time"

	"github.com/wiebe-xyz/funnelbarn/internal/snapshot"
)

// Key snapshot timing for the flag evaluate path. A key revoked in the
// dashboard leaves the snapshot on the next refresh. When refreshes fail, the
// snapshot is trusted until it is KeySnapshotMaxAge old and the live lookup
// takes over after that, so a revoked key keeps evaluating flags for at most
// KeySnapshotInterval + KeySnapshotMaxAge (about 65 s). Every other route
// checks keys live.
const (
	KeySnapshotInterval = 5 * time.Second
	KeySnapshotMaxAge   = 60 * time.Second
	keySnapshotTimeout  = 10 * time.Second
)

// KeyGrant is what a stored API key grants.
type KeyGrant struct {
	KeySHA256 string
	ProjectID string
	Scope     string
}

// KeySnapshot holds the API keys the evaluate path may answer from memory.
type KeySnapshot struct {
	snap   *snapshot.Snapshot[map[string]KeyGrant]
	maxAge time.Duration
}

// NewKeySnapshot returns a cold snapshot of the keys list returns for which
// include(scope) is true. Start it with Run.
func NewKeySnapshot(list func(context.Context) ([]KeyGrant, error), include func(scope string) bool, now func() time.Time) *KeySnapshot {
	return &KeySnapshot{
		maxAge: KeySnapshotMaxAge,
		snap: snapshot.New(snapshot.Config[map[string]KeyGrant]{
			Name:     "api_keys",
			Interval: KeySnapshotInterval,
			Timeout:  keySnapshotTimeout,
			Now:      now,
			Load: func(ctx context.Context) (map[string]KeyGrant, error) {
				keys, err := list(ctx)
				if err != nil {
					return nil, err
				}
				m := make(map[string]KeyGrant, len(keys))
				for _, k := range keys {
					if include(k.Scope) {
						m[k.KeySHA256] = k
					}
				}
				return m, nil
			},
		}),
	}
}

// Run reloads the snapshot in the background until ctx is done.
func (ks *KeySnapshot) Run(ctx context.Context) { ks.snap.Run(ctx) }

// Refresh reloads the snapshot once.
func (ks *KeySnapshot) Refresh(ctx context.Context) error { return ks.snap.Refresh(ctx) }

// Age is the time since the last good load.
func (ks *KeySnapshot) Age() time.Duration { return ks.snap.Age() }

// grant returns the held grant for a key hash. ok is false when the snapshot
// is cold, older than maxAge, or does not hold the key; the caller then does
// the live lookup. Only a full load fills the snapshot, so a failed or
// negative live lookup is never remembered.
func (ks *KeySnapshot) grant(keySHA256 string) (KeyGrant, bool) {
	m, age, ok := ks.snap.Get()
	if !ok || age > ks.maxAge {
		return KeyGrant{}, false
	}
	g, ok := m[keySHA256]
	return g, ok
}

// WithEvaluateKeys returns a copy of the Authorizer whose ValidForEvaluate
// answers from ks first.
func (a *Authorizer) WithEvaluateKeys(ks *KeySnapshot) *Authorizer {
	cp := Authorizer{}
	if a != nil {
		cp = *a
	}
	cp.evaluateKeys = ks
	return &cp
}

// ValidForEvaluate is ValidWithProject for the flag evaluate route only: a key
// held in the evaluate key snapshot is accepted without a database read.
func (a *Authorizer) ValidForEvaluate(ctx context.Context, provided string) (projectID string, scope string, ok bool) {
	if a == nil || !a.Enabled() || a.evaluateKeys == nil {
		return a.ValidWithProject(ctx, provided)
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(provided)))
	if len(a.apiKeyHash) == sha256.Size && subtle.ConstantTimeCompare(sum[:], a.apiKeyHash) == 1 {
		return "", "full", true
	}
	hexSum := hex.EncodeToString(sum[:])
	if g, ok := a.evaluateKeys.grant(hexSum); ok {
		if a.dbTouch != nil {
			_ = a.dbTouch(ctx, hexSum)
		}
		return g.ProjectID, g.Scope, true
	}
	return a.ValidWithProject(ctx, provided)
}
