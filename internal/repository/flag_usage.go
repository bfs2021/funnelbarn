package repository

import (
	"context"
	"time"
)

// FlagUsageRow is the number of recorded evaluations of one flag that resolved
// to one variant on one UTC day.
type FlagUsageRow struct {
	FlagID  string
	Day     string // YYYY-MM-DD, UTC
	Variant string
	Count   int64
}

// flagUsageTimeLayout matches how SQLite stores created_at (CURRENT_TIMESTAMP).
const flagUsageTimeLayout = "2006-01-02 15:04:05"

// flagUsageDailyQuery is bounded on both ends by created_at, so it is a range
// scan of idx_flag_evals_project_time (project_id, created_at) and never reads
// the rest of the table. TestFlagUsageDailyUsesTheProjectTimeIndex pins the plan.
const flagUsageDailyQuery = `
	SELECT flag_id, date(created_at), variant, COUNT(*)
	FROM flag_evaluations
	WHERE project_id = ? AND created_at >= ? AND created_at < ?
	GROUP BY flag_id, date(created_at), variant`

// FlagUsageDaily counts the flag_evaluations rows of a project per flag, UTC
// day and variant in [from, to). The rows are one per recorded evaluation: an
// evaluation of a config flag, a dry run (preview) or a disabled flag writes no
// row and is not counted.
func (r *ReadStore) FlagUsageDaily(ctx context.Context, projectID string, from, to time.Time) ([]FlagUsageRow, error) {
	rows, err := r.rdb.QueryContext(ctx, flagUsageDailyQuery,
		projectID, from.UTC().Format(flagUsageTimeLayout), to.UTC().Format(flagUsageTimeLayout))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FlagUsageRow
	for rows.Next() {
		var row FlagUsageRow
		if err := rows.Scan(&row.FlagID, &row.Day, &row.Variant, &row.Count); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
