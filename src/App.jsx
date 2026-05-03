import { useEffect, useMemo, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  BarElement,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { parseFPYExcel } from './lib/parser'
import { fetchReports, upsertReport, deleteReport, clearReports, getStorageMode, getLastSupabaseError, testSupabaseConnection } from './lib/reportsApi'
import { fpyClass, normalizeReport } from './lib/fpy'
import { isSupabaseConfigured } from './lib/supabase'
import { loadEmployees, saveEmployees, loadStations, saveStations } from './lib/rotationStore'
import { syncEmployees, fetchEmployees, syncRotationStations, fetchRotationStations } from './lib/rotationApi'
import EmployeesPage from './EmployeesPage'
import RotationPage from './RotationPage'
import StaffDashboard from './StaffDashboard'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const MAX_FILE_SIZE_MB = 20
const DAILY_TARGET_DEFAULT = 320

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'upload', label: 'Upload' },
  { id: 'history', label: 'History' },
  { id: 'trend', label: 'Trends' },
  { id: 'employees', label: 'Employees' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'staff', label: 'Staff View' },
]

function fmtPct(value, digits = 2) {
  return value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(digits)}%`
}

function clampNonNegative(n) {
  const x = Number(n) || 0
  return x < 0 ? 0 : x
}

function calcRateFromInput(inCount, okCount) {
  const input = Number(inCount) || 0
  const passed = Number(okCount) || 0
  if (input <= 0) return null
  const pct = (passed / input) * 100
  return Math.max(0, Math.min(100, pct))
}

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function addDays(dateISO, deltaDays) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return toISODate(d)
}

function startOfMonthISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(1)
  return toISODate(d)
}

function endOfMonthISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setMonth(d.getMonth() + 1, 0)
  return toISODate(d)
}

function diffDaysInclusive(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`)
  const b = new Date(`${toISO}T00:00:00`)
  const ms = b - a
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24))) + 1
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [reports, setReports] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [dailyTarget, setDailyTarget] = useState(DAILY_TARGET_DEFAULT)
  const [uploadTarget, setUploadTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [storageMode, setStorageMode] = useState(getStorageMode())
  const [supabaseDiag, setSupabaseDiag] = useState('')
  const [testingConn, setTestingConn] = useState(false)
  const [smartPeriod, setSmartPeriod] = useState('month') // day | week | month | custom
  const [rangeFrom, setRangeFrom] = useState(startOfMonthISO(toISODate(new Date())))
  const [rangeTo, setRangeTo] = useState(toISODate(new Date()))
  const [monthPick, setMonthPick] = useState(toISODate(new Date()).slice(0, 7)) // YYYY-MM

  // Rotation system state
  const [rotEmployees, setRotEmployees] = useState(() => loadEmployees())
  const [rotStations, setRotStations] = useState(() => loadStations())

  // Load rotation data from Supabase on startup
  useEffect(() => {
    async function loadRotationFromSupabase() {
      try {
        const dbEmps = await fetchEmployees()
        if (dbEmps && dbEmps.length > 0) {
          setRotEmployees(dbEmps)
          saveEmployees(dbEmps)
        }
        const dbStations = await fetchRotationStations()
        if (dbStations && dbStations.length > 0) {
          const clean = dbStations.map((s) => ({ name: s.name }))
          setRotStations(clean)
          saveStations(clean)
        }
      } catch (err) {
        console.warn('Failed to load rotation from Supabase:', err)
      }
    }
    loadRotationFromSupabase()
  }, [])

  function handleSaveEmployees(list) {
    setRotEmployees(list)
    saveEmployees(list)
    syncEmployees(list).catch((err) => console.warn('Supabase sync employees:', err))
  }

  function handleSaveStations(list) {
    setRotStations(list)
    saveStations(list)
    syncRotationStations(list).catch((err) => console.warn('Supabase sync stations:', err))
  }

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchReports()
      const normalized = data.map(normalizeReport)
      setReports(normalized)
      setStorageMode(getStorageMode())
      setSupabaseDiag(getLastSupabaseError())
      if (normalized.length === 0) {
        setSelectedId('')
      } else if (!normalized.some((r) => String(r.id) === String(selectedId))) {
        setSelectedId(String(normalized[0].id))
      }
    } catch (err) {
      setError(err.message || 'Failed to load reports from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  async function onTestConnection() {
    setTestingConn(true)
    setError('')
    setMessage('')
    try {
      const res = await testSupabaseConnection()
      setStorageMode(getStorageMode())
      setSupabaseDiag(res.error || '')
      if (res.ok) {
        setMessage('تم الاتصال بـ Supabase بنجاح.')
        await loadReports()
      } else if (res.mode === 'not_configured') {
        setError('Supabase غير مضبوط في ملف .env')
      } else {
        setError('فشل الاتصال بـ Supabase. راجع تفاصيل الخطأ أدناه.')
      }
    } catch (err) {
      setError(err.message || 'فشل اختبار الاتصال')
    } finally {
      setTestingConn(false)
    }
  }

  const selectedReport = useMemo(() => {
    if (reports.length === 0) return null
    if (!selectedId) return reports[0]
    return reports.find((r) => String(r.id) === String(selectedId)) ?? reports[0]
  }, [reports, selectedId])

  useEffect(() => {
    if (!selectedReport) return
    const nextTarget = Number(selectedReport.targetBoards)
    if (Number.isFinite(nextTarget) && nextTarget > 0) {
      setDailyTarget(nextTarget)
    }
  }, [selectedReport])

  useEffect(() => {
    const today = toISODate(new Date())
    if (smartPeriod === 'day') {
      setRangeFrom(today)
      setRangeTo(today)
      return
    }
    if (smartPeriod === 'week') {
      setRangeFrom(addDays(today, -6))
      setRangeTo(today)
      return
    }
    if (smartPeriod === 'month') {
      setRangeFrom(startOfMonthISO(today))
      setRangeTo(endOfMonthISO(today))
      return
    }
    if (smartPeriod === 'customMonth') {
      const monthISO = `${monthPick}-01`
      setRangeFrom(startOfMonthISO(monthISO))
      setRangeTo(endOfMonthISO(monthISO))
    }
  }, [smartPeriod, monthPick])

  const progressPct = useMemo(() => {
    const achieved = selectedReport?.achieved ?? 0
    const target = Number(selectedReport?.targetBoards ?? dailyTarget) || 1
    return ((achieved / target) * 100).toFixed(1)
  }, [dailyTarget, selectedReport])

  const smartFiltered = useMemo(() => {
    const from = String(rangeFrom || '')
    const to = String(rangeTo || '')
    if (!from || !to) return []
    return [...reports].filter((r) => String(r.date) >= from && String(r.date) <= to).sort((a, b) => a.date.localeCompare(b.date))
  }, [reports, rangeFrom, rangeTo])

  const smartPrevFiltered = useMemo(() => {
    const from = String(rangeFrom || '')
    const to = String(rangeTo || '')
    if (!from || !to) return []
    const days = diffDaysInclusive(from, to)
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(days - 1))
    return [...reports].filter((r) => String(r.date) >= prevFrom && String(r.date) <= prevTo).sort((a, b) => a.date.localeCompare(b.date))
  }, [reports, rangeFrom, rangeTo])

  const smartStats = useMemo(() => {
    function agg(list) {
      const count = list.length
      const sumBoards = list.reduce((acc, r) => acc + (Number(r.totalBoards) || 0), 0)
      const sumAchieved = list.reduce((acc, r) => acc + (Number(r.achieved) || 0), 0)
      const fpyVals = list.map((r) => (r.overallFPY === null || r.overallFPY === undefined ? null : Number(r.overallFPY))).filter((v) => Number.isFinite(v))
      const avgFPY = fpyVals.length ? fpyVals.reduce((a, b) => a + b, 0) / fpyVals.length : null
      const best = list
        .filter((r) => Number.isFinite(Number(r.overallFPY)))
        .sort((a, b) => Number(b.overallFPY) - Number(a.overallFPY))[0]
      const worst = list
        .filter((r) => Number.isFinite(Number(r.overallFPY)))
        .sort((a, b) => Number(a.overallFPY) - Number(b.overallFPY))[0]
      return {
        count,
        sumBoards,
        sumAchieved,
        avgFPY,
        best: best ? { date: best.date, value: Number(best.overallFPY) } : null,
        worst: worst ? { date: worst.date, value: Number(worst.overallFPY) } : null,
      }
    }

    const cur = agg(smartFiltered)
    const prev = agg(smartPrevFiltered)

    const fpyDelta = cur.avgFPY !== null && prev.avgFPY !== null ? cur.avgFPY - prev.avgFPY : null
    const boardsDelta = cur.sumBoards - prev.sumBoards

    return { cur, prev, fpyDelta, boardsDelta }
  }, [smartFiltered, smartPrevFiltered])

  async function onFilePicked(file) {
    if (!file) return
    setError('')
    setMessage('')
    setParsedData(null)

    const targetValue = Number(uploadTarget)
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError('حدد Target صحيح (رقم أكبر من 0) قبل رفع التقرير.')
      return
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      setError('الملف يجب أن يكون Excel بصيغة .xls أو .xlsx')
      return
    }

    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_FILE_SIZE_MB) {
      setError(`حجم الملف ${sizeMb.toFixed(1)}MB أكبر من الحد ${MAX_FILE_SIZE_MB}MB`)
      return
    }

    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseFPYExcel(buffer)
      setParsedData(parsed)
      setMessage('تم تحليل الملف بنجاح. يمكنك المراجعة ثم الحفظ إلى Supabase.')
    } catch (err) {
      setError(err.message || 'فشل تحليل الملف')
      setParsedData(null)
    } finally {
      setLoading(false)
    }
  }

  async function onSaveReport() {
    if (!parsedData) return
    if (!reportDate) {
      setError('اختر تاريخ التقرير قبل الحفظ.')
      return
    }
    const targetValue = Number(uploadTarget)
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError('اكتب Target صحيح (رقم أكبر من 0) لهذا التقرير قبل الحفظ.')
      return
    }

    const existingForDate = reports.find((r) => String(r.date) === String(reportDate))
    if (existingForDate) {
      const replace = window.confirm(
        `يوجد تقرير محفوظ بتاريخ ${reportDate}. هل تريد تحديثه بالملف الجديد؟`,
      )
      if (!replace) {
        setError('تم إلغاء الحفظ. اختر تاريخًا مختلفًا إذا أردت إنشاء تقرير جديد.')
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saveRes = await upsertReport(reportDate, parsedData, targetValue)
      setParsedData(null)
      setStorageMode(getStorageMode())
      setMessage(existingForDate ? 'تم تحديث التقرير في Supabase بنجاح.' : 'تم حفظ التقرير الجديد في Supabase بنجاح.')
      await loadReports()
      setActiveTab('dashboard')
    } catch (err) {
      setStorageMode(getStorageMode())
      setError(err.message || 'فشل حفظ التقرير في Supabase')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteReport(id) {
    const ok = window.confirm('هل تريد حذف هذا التقرير؟')
    if (!ok) return

    setError('')
    setMessage('')
    try {
      await deleteReport(id)
      setStorageMode(getStorageMode())
      setMessage('تم حذف التقرير.')
      await loadReports()
    } catch (err) {
      setError(err.message || 'فشل حذف التقرير')
    }
  }

  async function onClearAll() {
    const ok = window.confirm('سيتم حذف كل التقارير نهائيا. هل أنت متأكد؟')
    if (!ok) return

    setError('')
    setMessage('')
    try {
      await clearReports()
      setStorageMode(getStorageMode())
      setSelectedId('')
      setMessage('تم حذف كل التقارير.')
      await loadReports()
    } catch (err) {
      setError(err.message || 'فشل حذف الكل')
    }
  }

  const steps = selectedReport?.stations || []

  const stepsFlow = useMemo(() => {
    return steps.map((s) => {
      const inCount = Number(s.nbBoards) || 0
      const okCount = Number(s.nbBoardsOK) || 0
      const errorCount = clampNonNegative(inCount - okCount)
      const ratePct = (s.fpy !== undefined && s.fpy !== null) ? Number(s.fpy) : null
      return { ...s, inCount, okCount, errorCount, ratePct }
    })
  }, [steps])

  const bottleneck = useMemo(() => {
    return [...stepsFlow]
      .filter((s) => s.ratePct !== null)
      .sort((a, b) => a.ratePct - b.ratePct)[0] || null
  }, [stepsFlow])

  const targetComparison = useMemo(() => {
    const multiTestFlow = stepsFlow.find((s) => s.stationName.toLowerCase().includes('multi-test') || s.stationName.toLowerCase().includes('multi test'))
    const assemblyFlow = stepsFlow.find((s) => s.stationName.toLowerCase().includes('assembly') || s.stationName.toLowerCase().includes('assemblage'))

    const multiTestOK = multiTestFlow ? multiTestFlow.okCount : 0
    const assemblyOK = assemblyFlow ? assemblyFlow.okCount : 0

    const target = Number(selectedReport?.targetBoards ?? dailyTarget) || 1

    const multiTestPct = (multiTestOK / target) * 100
    const assemblyPct = (assemblyOK / target) * 100

    return {
      multiTestOK,
      assemblyOK,
      multiTestPct,
      assemblyPct,
      target
    }
  }, [stepsFlow, selectedReport, dailyTarget])

  const getComparisonColor = (pct) => {
    if (pct >= 90) return 'tag-green'
    if (pct >= 70) return 'tag-amber'
    return 'tag-red'
  }

  const flowChartData = useMemo(() => {
    const labels = stepsFlow.map((s) => (s.stationName.length > 16 ? `${s.stationName.slice(0, 16)}...` : s.stationName))
    return {
      labels,
      datasets: [
        {
          label: 'معدّي (OK)',
          data: stepsFlow.map((s) => s.okCount),
          backgroundColor: 'rgba(20, 152, 101, 0.75)',
          borderRadius: 5,
          stack: 'flow',
        },
        {
          label: 'أخطاء (NOK)',
          data: stepsFlow.map((s) => s.errorCount),
          backgroundColor: 'rgba(213, 63, 63, 0.65)',
          borderRadius: 5,
          stack: 'flow',
        },
      ],
    }
  }, [stepsFlow])

  const trendData = {
    labels: [...reports].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.date),
    datasets: [
      {
        label: 'FPY %',
        data: [...reports].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.overallFPY),
        borderColor: '#22c98a',
        backgroundColor: 'rgba(34, 201, 138, 0.08)',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
    ],
  }

  const boardsTrendData = {
    labels: [...reports].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.date),
    datasets: [
      {
        label: 'الإنتاج المنجز',
        data: [...reports].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.totalBoards),
        backgroundColor: 'rgba(75, 142, 240, 0.75)',
        borderRadius: 5,
      },
    ],
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-title">FPY Dashboard (React)</div>
          <div className="logo-sub">Supabase Connected</div>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <div className="sidebar-bottom">{reports.length} Reports — {rotEmployees.length} Employees</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>FPY Production Dashboard</h1>
          <div className="topbar-meta">
            React + Supabase + Excel Parser
          </div>
        </header>

        {(error || message) && (
          <div className="alerts">
            {error && <div className="alert error">{error}</div>}
            {message && <div className="alert success">{message}</div>}
          </div>
        )}


        {activeTab === 'upload' && (
          <section className="section">
            <h2>Upload Excel Report</h2>
            <div className="upload-row">
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              <input
                type="number"
                min={1}
                value={uploadTarget}
                onChange={(e) => setUploadTarget(e.target.value)}
                placeholder="Target (Boards)"
                title="Target لهذا التقرير"
              />
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) => onFilePicked(e.target.files?.[0])}
                disabled={loading || saving || !(Number(uploadTarget) > 0)}
              />
            </div>
            <p className="kpi-sub">You must enter a Target first, then select a report file.</p>

            {loading && <p>Reading file...</p>}

            {parsedData && (
              <div className="card">
                <div className="card-title">Preview: {parsedData.product} (Sheet: {parsedData.sheetName})</div>
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-label">OVERALL FPY</div>
                    <div className="kpi-value">{fmtPct(parsedData.overallFPY)}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Total Produced (Perso)</div>
                    <div className="kpi-value">{parsedData.totalBoards}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Assembly OK</div>
                    <div className="kpi-value">{parsedData.achieved}</div>
                  </div>
                </div>

                <button type="button" className="btn primary" onClick={onSaveReport} disabled={saving}>
                  {saving ? 'Saving...' : 'Save to Supabase'}
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'dashboard' && (
          <section className="section">
            <div className="toolbar">
              <h2>Dashboard</h2>
            </div>

            {loading && <p>Loading...</p>}
            {!loading && !selectedReport && <p>No reports yet. Go to Upload.</p>}

            {selectedReport && (
              <>


                <div className="card">
                  <div className="card-title">Period Analytics</div>
                  <div className="smart-row">
                    <select value={smartPeriod} onChange={(e) => setSmartPeriod(e.target.value)}>
                      <option value="day">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">This Month</option>
                      <option value="customMonth">Specific Month</option>
                      <option value="custom">Custom Range</option>
                    </select>

                    {smartPeriod === 'customMonth' && (
                      <input type="month" value={monthPick} onChange={(e) => setMonthPick(e.target.value)} />
                    )}

                    {smartPeriod === 'custom' && (
                      <>
                        <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                        <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
                      </>
                    )}

                    <span className="tag">
                      Period: {rangeFrom} → {rangeTo}
                    </span>
                  </div>

                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-label">Report Count</div>
                      <div className="kpi-value">{smartStats.cur.count}</div>
                      <div className="kpi-sub">vs previous: {smartStats.prev.count}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Average FPY</div>
                      <div className="kpi-value">{fmtPct(smartStats.cur.avgFPY, 2)}</div>
                      <div className="kpi-sub">
                        {smartStats.fpyDelta === null ? 'No comparison' : `Diff from previous: ${smartStats.fpyDelta >= 0 ? '+' : ''}${smartStats.fpyDelta.toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Total Produced (Perso)</div>
                      <div className="kpi-value">{smartStats.cur.sumBoards}</div>
                      <div className="kpi-sub">
                        Diff from previous: {smartStats.boardsDelta >= 0 ? '+' : ''}
                        {smartStats.boardsDelta}
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Best / Worst Day (FPY)</div>
                      <div className="kpi-sub">
                        Best: {smartStats.cur.best ? `${smartStats.cur.best.date} (${smartStats.cur.best.value.toFixed(1)}%)` : '—'}
                      </div>
                      <div className="kpi-sub">
                        Worst: {smartStats.cur.worst ? `${smartStats.cur.worst.date} (${smartStats.cur.worst.value.toFixed(1)}%)` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ fontWeight: 'bold', margin: 0, minWidth: '120px' }}>Select Report:</label>
                  <select 
                    value={selectedId} 
                    onChange={(e) => setSelectedId(e.target.value)} 
                    disabled={reports.length === 0}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
                  >
                    {reports.length === 0 && <option value="">No reports</option>}
                    {reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.date} - {r.product}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="target-bar">
                  <label htmlFor="targetInput">Target for this report (Boards)</label>
                  <input
                    id="targetInput"
                    type="number"
                    min={1}
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(e.target.value)}
                  />
                  <span className={`tag ${getComparisonColor(targetComparison.multiTestPct)}`}>
                    Progress (Multi-TEST as final): {targetComparison.multiTestPct.toFixed(1)}%
                  </span>
                </div>

                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-label">Target</div>
                    <div className="kpi-value">{targetComparison.target}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Multi-TEST Production (Final)</div>
                    <div className="kpi-value">{targetComparison.multiTestOK}</div>
                    <div className={`kpi-sub tag ${getComparisonColor(targetComparison.multiTestPct)}`} style={{marginTop: '8px', display: 'inline-block'}}>Achieved: {targetComparison.multiTestPct.toFixed(1)}%</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Assembly Production</div>
                    <div className="kpi-value">{targetComparison.assemblyOK}</div>
                    <div className="kpi-sub" style={{marginTop: '8px'}}>Achieved: {targetComparison.assemblyPct.toFixed(1)}%</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">OVERALL FPY</div>
                    <div className="kpi-value">{fmtPct(selectedReport.overallFPY)}</div>
                  </div>
                </div>

                <div className="charts-grid">
                  <div className="card">
                    <div className="card-title">Production Stages Analysis (In, Out, Errors, FPY%)</div>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Stage (Product Name)</th>
                            <th>In (Nb boards)</th>
                            <th>Passed (Nb Boards OK)</th>
                            <th>Errors (In - Out)</th>
                            <th>Success Rate (FPY)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepsFlow.map((s) => (
                            <tr key={`${selectedReport.id}-flow-${s.stationName}`}>
                              <td>{s.stationName}</td>
                              <td>{s.inCount}</td>
                              <td>{s.okCount}</td>
                              <td>
                                <span className={`tag ${s.errorCount > 0 ? 'tag-red' : 'tag-green'}`}>{s.errorCount}</span>
                              </td>
                              <td>
                                <span className={`tag ${fpyClass(s.ratePct)}`}>{fmtPct(s.ratePct)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Input vs Errors vs Passed (Per Step)</div>
                    <div className="chart-wrap">
                      <Bar
                        data={flowChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'bottom' } },
                          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                        }}
                      />
                    </div>
                  </div>
                </div>


              </>
            )}
          </section>
        )}

        {activeTab === 'history' && (
          <section className="section">
            <div className="toolbar">
              <h2>Report History</h2>
              <button type="button" className="btn danger" onClick={onClearAll} disabled={reports.length === 0}>
                Clear All
              </button>
            </div>

            {reports.length === 0 && <p>No history yet.</p>}
            {reports.map((r) => {
              const rowBottleneck = [...(r.stations || [])].filter((s) => s.fpy !== null).sort((a, b) => a.fpy - b.fpy)[0]
              return (
                <div key={r.id} className="history-item">
                  <div>
                    <div className="history-title">{r.date}</div>
                    <div className="history-sub">{r.product}</div>
                  </div>
                  <div className="history-stats">
                    <span>FPY: {fmtPct(r.overallFPY, 1)}</span>
                    <span>Produced: {r.totalBoards}</span>
                    <span>OK: {r.achieved}</span>
                    <span>Bottleneck: {rowBottleneck ? fmtPct(rowBottleneck.fpy, 1) : 'N/A'}</span>
                  </div>
                  <div className="history-actions">
                    <button type="button" className="btn" onClick={() => { setSelectedId(String(r.id)); setActiveTab('dashboard') }}>
                      View
                    </button>
                    <button type="button" className="btn danger" onClick={() => onDeleteReport(r.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {activeTab === 'trend' && (
          <section className="section">
            <h2>Trends</h2>
            {reports.length < 2 && <p>Add two or more reports to see trends.</p>}

            <div className="card">
              <div className="card-title">FPY Over Time</div>
              <div className="chart-wrap large">
                <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </div>

            <div className="card">
              <div className="card-title">Total Production Over Time</div>
              <div className="chart-wrap medium">
                <Bar data={boardsTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </div>
          </section>
        )}
        {activeTab === 'employees' && (
          <EmployeesPage
            employees={rotEmployees}
            onSave={handleSaveEmployees}
            stationCount={rotStations.length}
          />
        )}

        {activeTab === 'rotation' && (
          <RotationPage
            employees={rotEmployees}
            stations={rotStations}
            onSaveStations={handleSaveStations}
          />
        )}

        {activeTab === 'staff' && (
          <StaffDashboard
            employees={rotEmployees}
            stations={rotStations}
            latestReport={reports.length > 0 ? [...reports].sort((a, b) => b.date.localeCompare(a.date))[0] : null}
          />
        )}
      </main>
    </div>
  )
}

export default App
