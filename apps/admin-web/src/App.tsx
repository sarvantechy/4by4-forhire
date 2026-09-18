import { APIClient, type ReportSummary, type UserResponse } from '@4by4/api-client'
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardList,
  FileSearch,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import './App.css'

const apiClient = new APIClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1',
})

const navigation = [
  { label: 'Overview', icon: Gauge, active: true },
  { label: 'Moderation', icon: FileSearch },
  { label: 'Reports', icon: AlertTriangle },
  { label: 'Disputes', icon: ClipboardList },
  { label: 'Verification', icon: BadgeCheck },
  { label: 'Users', icon: Users },
]

function App() {
  const [operator, setOperator] = useState<UserResponse | null>(null)
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([apiClient.getCurrentUser(), apiClient.listAdminReports()])
      .then(([profile, items]) => {
        setOperator(profile)
        setReports(items)
      })
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await apiClient.loginEmail({
        client_type: 'customer_web',
        device_label: 'Admin operations browser',
        email,
        password,
      })
      const [profile, items] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.listAdminReports(),
      ])
      setCsrfToken(session.csrf_token ?? '')
      setOperator(profile)
      setReports(items)
      setPassword('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start a staff session.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await apiClient.logout(csrfToken || undefined)
    } finally {
      setOperator(null)
      setReports([])
      setCsrfToken('')
      setBusy(false)
    }
  }

  async function moderate(report: ReportSummary, action: 'approve' | 'remove') {
    if (report.target_type !== 'listing') return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiClient.moderateListing(
        report.target_id,
        { action, reason: `Reviewed from report ${report.id}: ${report.reason}` },
        csrfToken || undefined,
      )
      setNotice(`Listing ${action === 'approve' ? 'approved' : 'removed'}; audit event recorded.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moderation action failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!operator) {
    return (
      <main className="staff-login">
        <section className="staff-login-intro">
          <span className="brand-mark">4x4</span>
          <p className="eyebrow">Restricted operations</p>
          <h1>Staff review console</h1>
          <p>Customer accounts cannot access queues. Every moderation decision is checked server-side and recorded.</p>
        </section>
        <form className="staff-login-form" onSubmit={signIn}>
          <LockKeyhole aria-hidden="true" size={30} />
          <div><p className="eyebrow">Authorized staff</p><h2>Sign in</h2></div>
          <label><span>Email</span><input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label><span>Password</span><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={19} /> : <LockKeyhole size={18} />} Enter operations</button>
        </form>
      </main>
    )
  }

  const openReports = reports.filter((report) => report.status === 'open')
  const queues = [
    { label: 'Reported listings', value: openReports.filter((report) => report.target_type === 'listing').length, tone: 'yellow' },
    { label: 'Open safety reports', value: openReports.length, tone: 'red' },
    { label: 'Active disputes', value: 0, tone: 'teal' },
    { label: 'Verification reviews', value: 0, tone: 'ink' },
  ]

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span className="brand-mark">4x4</span>
          <div>
            <strong>For Hire</strong>
            <small>Operations</small>
          </div>
        </div>
        <nav aria-label="Administration sections">
          {navigation.map(({ active, icon: Icon, label }) => (
            <button className={active ? 'nav-item active' : 'nav-item'} key={label} type="button">
              <Icon aria-hidden="true" size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="trust-note">
          <ShieldCheck aria-hidden="true" size={20} />
          <p>Private evidence requires an assigned case and creates an audit event.</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Kanyakumari pilot</p>
            <h1>Operations overview</h1>
          </div>
          <div className="operator">
              <span className="operator-role">{operator.display_name}</span>
              <button aria-label="Sign out" className="icon-button" disabled={busy} onClick={signOut} type="button"><LogOut aria-hidden="true" size={19} /></button>
          </div>
        </header>

        <section className="status-strip" aria-label="Environment status">
          <span className="status-dot" /><strong>Live local data</strong><span>Staff authorization enforced by the API.</span>
        </section>

        <section aria-labelledby="queue-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Assigned work</p>
              <h2 id="queue-heading">Review queues</h2>
            </div>
            <button className="search-button" disabled type="button">
              <Search aria-hidden="true" size={18} /> Search cases
            </button>
          </div>
          <div className="queue-grid">
            {queues.map((queue) => (
              <article className={`queue-card ${queue.tone}`} key={queue.label}>
                <span>{queue.label}</span><strong>{queue.value}</strong><small>{queue.value === 0 ? 'Queue clear' : 'Needs review'}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="work-queue" aria-labelledby="work-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Case triage</p>
              <h2 id="work-heading">Current assignments</h2>
            </div>
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}
          {notice && <p className="admin-notice" role="status">{notice}</p>}
          {openReports.length === 0 ? (
            <div className="empty-table"><ClipboardList aria-hidden="true" size={28} /><div><strong>No open reports</strong><p>New customer reports will appear here.</p></div></div>
          ) : (
            <div className="case-list">
              {openReports.map((report) => (
                <article className="case-row" key={report.id}>
                  <AlertTriangle aria-hidden="true" size={20} />
                  <div className="case-copy"><strong>{report.reason}</strong><p>{report.description || 'No additional description.'}</p><small>{report.target_type} · {new Date(report.created_at).toLocaleString('en-IN')}</small></div>
                  {report.target_type === 'listing' && <div className="case-actions">
                    <button disabled={busy} onClick={() => moderate(report, 'approve')} type="button">Approve</button>
                    <button className="remove" disabled={busy} onClick={() => moderate(report, 'remove')} type="button">Remove</button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
