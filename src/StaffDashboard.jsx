import { useMemo } from 'react'
import {
  DAYS,
  loadBaseAssignment, loadStartDate, loadShift,
  generateWeekSchedule, getSunday, getWeekDates, formatDateShort,
  todayISO as getTodayISO,
} from './lib/rotationStore'

const COLORS = [
  { c: '#d53f3f', b: 'rgba(213,63,63,.10)' },
  { c: '#e08917', b: 'rgba(224,137,23,.10)' },
  { c: '#c9a017', b: 'rgba(201,160,23,.10)' },
  { c: '#149865', b: 'rgba(20,152,101,.10)' },
  { c: '#2f6fe4', b: 'rgba(47,111,228,.10)' },
  { c: '#7c5cdb', b: 'rgba(124,92,219,.10)' },
  { c: '#d45b90', b: 'rgba(212,91,144,.10)' },
  { c: '#1eb8a0', b: 'rgba(30,184,160,.10)' },
]

function fmtPct(value, digits = 1) {
  return value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(digits)}%`
}

function getColorStyle(pct) {
  if (pct >= 90) return { color: 'var(--green)', bg: 'rgba(20,152,101,.08)', border: 'rgba(20,152,101,.3)' }
  if (pct >= 70) return { color: 'var(--amber)', bg: 'rgba(201,160,23,.08)', border: 'rgba(201,160,23,.3)' }
  return { color: 'var(--red)', bg: 'rgba(213,63,63,.08)', border: 'rgba(213,63,63,.3)' }
}

export default function StaffDashboard({ employees, stations, latestReport }) {
  const baseAssignment = loadBaseAssignment()
  const startDate = loadStartDate()
  const shiftAmount = loadShift()

  const todayISO = getTodayISO()
  const currentSunday = getSunday(todayISO)
  const weekDates = useMemo(() => getWeekDates(currentSunday), [currentSunday])

  const todayJS = new Date().getDay()
  const todayIdx = todayJS >= 0 && todayJS <= 4 ? todayJS : -1
  const todayName = todayIdx >= 0 ? DAYS[todayIdx] : 'عطلة'

  const weekSchedule = useMemo(() => {
    if (!startDate) return DAYS.map(() => stations.map(() => []))
    return generateWeekSchedule(stations, baseAssignment, shiftAmount, startDate, currentSunday)
  }, [stations, baseAssignment, shiftAmount, startDate, currentSunday])

  // Production metrics
  const overallFPY = latestReport?.overallFPY
  const totalBoards = latestReport?.totalBoards || 0
  const targetBoards = latestReport?.targetBoards || 0
  const multiTestOK = useMemo(() => {
    const st = (latestReport?.stations || []).find((s) => {
      const n = (s.stationName || '').toLowerCase()
      return n.includes('multi-test') || n.includes('multi test')
    })
    return st ? (Number(st.nbBoardsOK) || 0) : 0
  }, [latestReport])
  const targetPct = targetBoards > 0 ? (multiTestOK / targetBoards) * 100 : 0
  const targetStyle = getColorStyle(targetPct)

  const isConfigured = startDate && Object.keys(baseAssignment).some((k) => (baseAssignment[k]?.length || 0) > 0)

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>داشبورد الموظفين</h2>
          <p className="kpi-sub" style={{ marginTop: 2 }}>جدول التوزيع وأداء الإنتاج</p>
        </div>
        <div className="tag" style={{ fontSize: 14, padding: '6px 16px', fontWeight: 700 }}>
          📅 {todayName} — {formatDateShort(todayISO)}
        </div>
      </div>

      {/* Production KPIs */}
      {latestReport && (
        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <div className="kpi-card">
            <div className="kpi-label">الهدف اليومي (Target)</div>
            <div className="kpi-value">{targetBoards || '—'}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">إنتاج Multi-TEST</div>
            <div className="kpi-value">{multiTestOK}</div>
            <div style={{ marginTop: 6 }}>
              <span className="tag" style={{
                background: targetStyle.bg, borderColor: targetStyle.border, color: targetStyle.color,
                fontWeight: 700, fontSize: 13,
              }}>{targetPct.toFixed(1)}% من الهدف</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">إجمالي الإنتاج (Perso)</div>
            <div className="kpi-value">{totalBoards}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">OVERALL FPY</div>
            <div className="kpi-value" style={{ color: overallFPY >= 90 ? 'var(--green)' : overallFPY >= 70 ? 'var(--amber)' : 'var(--red)' }}>
              {fmtPct(overallFPY)}
            </div>
          </div>
        </div>
      )}

      {!latestReport && (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text2)' }}>
          لم يتم رفع تقرير إنتاج بعد.
        </div>
      )}

      {/* Today's Production Pipeline */}
      {isConfigured ? (
        <div className="card" style={{ background: 'var(--bg)', border: 'none', boxShadow: 'none', padding: 0 }}>
          <div className="card-title" style={{ fontSize: 18, marginBottom: 5 }}>🏭 محطات خط الإنتاج ({todayName})</div>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
            توزيع الموظفين على محطات الإنتاج بناءً على نظام التدوير الآلي لليوم الحالي.
          </p>

          <div className="pipeline-container">
            {stations.map((st, si) => {
              const col = COLORS[si % COLORS.length]
              const empIds = weekSchedule[todayIdx >= 0 ? todayIdx : 0]?.[si] || []

              return (
                <div key={`station-${si}`} className="station-card">
                  <div className="station-card-header" style={{ borderBottomColor: `${col.c}40` }}>
                    <div className="dot" style={{ background: col.c }}></div>
                    {st.name}
                  </div>
                  
                  <div className="station-card-body">
                    {empIds.length === 0 ? (
                      <div className="empty-station">لا يوجد موظفين في هذه المحطة اليوم.</div>
                    ) : (
                      empIds.map((empId) => {
                        const emp = employees.find((e) => e.empId === empId)
                        if (!emp) return null
                        const nameParts = emp.name.trim().split(/\s+/)
                        const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1]}` : nameParts[0]
                        const initial = nameParts[0].charAt(0).toUpperCase()
                        
                        return (
                          <div key={empId} className="emp-badge-large">
                            <div className="avatar" style={{ background: col.c }}>{initial}</div>
                            {shortName}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>
          لم يتم إعداد جدول التدوير بعد. اذهب إلى "نظام التدوير" لإعداده.
        </div>
      )}
    </section>
  )
}
