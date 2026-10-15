import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Shell from '../components/shell/Shell'
import { useProjects } from '../lib/projects'
import { reportError } from '../lib/bugbarn'
import { getFlagUsage } from '../lib/api.flagusage'
import type { FlagUsageReport } from '../lib/api.flagusage'
import { Skeleton } from '../components/ui/Skeleton'
import { C, FlagsTitle } from '../components/flags/shared'
import { FlagUsageTable } from '../components/flags/FlagUsageTable'

export default function FlagUsage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const { projects } = useProjects()
  const [report, setReport] = useState<FlagUsageReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setReport(null)
    setFailed(false)
    getFlagUsage(projectId)
      .then(setReport)
      .catch((e) => { console.error(e); setFailed(true); reportError(e, { source: 'FlagUsage' }) })
  }, [projectId])

  if (!projectId) {
    return (
      <Shell>
        <div style={{ color: C.muted, padding: '2rem', textAlign: 'center' }}>Select a project to see flag usage.</div>
      </Shell>
    )
  }

  const projectName = projects.find((p) => p.id === projectId)?.name

  return (
    <Shell projectId={projectId} projectName={projectName}>
      <div style={{ marginBottom: '1.5rem' }}>
        <FlagsTitle projectId={projectId} active="usage" />
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.5rem' }}>
        {failed ? (
          <div style={{ color: C.error }}>Could not load flag usage.</div>
        ) : !report ? (
          <Skeleton height={200} />
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 0.5rem' }}>{report.counts_note}</p>
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 1rem' }}>{report.stale_note}</p>
            <FlagUsageTable flags={report.flags} staleNote={report.stale_note} />
          </>
        )}
      </div>
    </Shell>
  )
}
