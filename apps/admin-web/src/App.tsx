import { APIClient, type AdminCaseUpdateRequest, type AdminDisputeResponse, type ReportSummary, type UserResponse } from '@4by4/api-client'
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
  const [disputes, setDisputes] = useState<AdminDisputeResponse[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([apiClient.getCurrentUser(), apiClient.listAdminReports(), apiClient.listAdminDisputes()])
      .then(([profile, items, disputeItems]) => {
        setOperator(profile)
        setReports(items)
        setDisputes(disputeItems)
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
      const disputeItems = await apiClient.listAdminDisputes()
      setCsrfToken(session.csrf_token ?? '')
      setOperator(profile)
      setReports(items)
      setDisputes(disputeItems)
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
      setDisputes([])
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

  async function updateReport(report: ReportSummary, payload: Partial<AdminCaseUpdateRequest>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await apiClient.updateReportCase(
        report.id,
        { assign_to_self: false, ...payload },
        csrfToken || undefined,
      )
      setReports((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNotice('Report case updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this report.')
    } finally {
      setBusy(false)
    }
  }

  async function updateDispute(dispute: AdminDisputeResponse, payload: Partial<AdminCaseUpdateRequest>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await apiClient.updateDisputeCase(
        dispute.id,
        { assign_to_self: false, ...payload },
        csrfToken || undefined,
      )
      setDisputes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNotice('Dispute case updated.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this dispute.')
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
  const openDisputes = disputes.filter((dispute) => dispute.status === 'open' || dispute.status === 'in_review')
  const queues = [
    { label: 'Reported listings', value: openReports.filter((report) => report.target_type === 'listing').length, tone: 'yellow' },
    { label: 'Open safety reports', value: openReports.length, tone: 'red' },
    { label: 'Active disputes', value: openDisputes.length, tone: 'teal' },
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
            <p className="eyebrow">Tamil Nadu pilot</p>
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
                  <div className="case-controls">
                    <select
                      disabled={busy}
                      onChange={(event) => updateReport(report, { priority: event.target.value as AdminCaseUpdateRequest['priority'] })}
                      value={report.priority ?? 'normal'}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <select
                      disabled={busy}
                      onChange={(event) => updateReport(report, { status: event.target.value as AdminCaseUpdateRequest['status'] })}
                      value={report.status}
                    >
                      <option value="open">Open</option>
                      <option value="in_review">In review</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                    <button disabled={busy} onClick={() => updateReport(report, { assign_to_self: true })} type="button">
                      {report.assigned_staff_user_id === operator.id ? 'Assigned to me' : 'Assign to me'}
                    </button>
                  </div>
                  {report.target_type === 'listing' && <div className="case-actions">
                    <button disabled={busy} onClick={() => moderate(report, 'approve')} type="button">Approve</button>
                    <button className="remove" disabled={busy} onClick={() => moderate(report, 'remove')} type="button">Remove</button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="work-queue" aria-labelledby="dispute-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Booking disagreements</p>
              <h2 id="dispute-heading">Disputes</h2>
            </div>
          </div>
          {disputes.length === 0 ? (
            <div className="empty-table"><ClipboardList aria-hidden="true" size={28} /><div><strong>No disputes filed</strong><p>Renter or owner disputes will appear here.</p></div></div>
          ) : (
            <div className="case-list">
              {disputes.map((dispute) => (
                <article className="case-row" key={dispute.id}>
                  <AlertTriangle aria-hidden="true" size={20} />
                  <div className="case-copy"><strong>{dispute.type}</strong><p>{dispute.description || 'No additional description.'}</p><small>booking {dispute.booking_id} · {new Date(dispute.created_at).toLocaleString('en-IN')}</small></div>
                  <div className="case-controls">
                    <select
                      disabled={busy}
                      onChange={(event) => updateDispute(dispute, { priority: event.target.value as AdminCaseUpdateRequest['priority'] })}
                      value={dispute.priority ?? 'normal'}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <select
                      disabled={busy}
                      onChange={(event) => updateDispute(dispute, { status: event.target.value as AdminCaseUpdateRequest['status'] })}
                      value={dispute.status}
                    >
                      <option value="open">Open</option>
                      <option value="in_review">In review</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                    <button disabled={busy} onClick={() => updateDispute(dispute, { assign_to_self: true })} type="button">
                      {dispute.assigned_staff_user_id === operator.id ? 'Assigned to me' : 'Assign to me'}
                    </button>
                  </div>
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
