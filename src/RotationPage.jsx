import { useMemo, useState, useRef, useEffect } from 'react'
import {
  DAYS,
  loadBaseAssignment, saveBaseAssignment,
  loadStartDate, saveStartDate,
  generateWeekSchedule,
  loadShift, saveShift,
  getSunday, getWeekDates, formatDateShort,
  todayISO as getTodayISO,
} from './lib/rotationStore'
import {
  syncRotationAssignments, fetchRotationAssignments,
  syncRotationConfig, fetchRotationConfig,
} from './lib/rotationApi'

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

/* ── Dropdown for picking employees ── */
function EmpPicker({ employees, assigned, allUsedIds = [], onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const available = employees.filter((e) => !assigned.includes(e.empId) && !allUsedIds.includes(e.empId))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 28 }}>
        {assigned.map((empId) => {
          const emp = employees.find((e) => e.empId === empId)
          if (!emp) return null
          return (
            <span key={empId} className="tag" style={{
              fontSize: 11, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(47,111,228,.08)', borderColor: 'rgba(47,111,228,.3)', color: '#2f6fe4',
            }}>
              {emp.name.split(/\s+/)[0]}
              <button type="button" onClick={() => onRemove(empId)} style={{
                background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1,
              }} title="إزالة">×</button>
            </span>
          )
        })}
        <button type="button" onClick={() => setOpen(!open)} style={{
          background: 'none', border: '1px dashed var(--border)', borderRadius: 6,
          color: 'var(--blue)', cursor: 'pointer', fontSize: 14, padding: '1px 8px', lineHeight: 1.4,
        }} title="إضافة موظف">+</button>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, minWidth: 180, maxHeight: 200, overflowY: 'auto',
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,29,53,.15)', zIndex: 100, padding: 4, marginTop: 4,
        }}>
          {available.length === 0 && (
            <div style={{ padding: 8, color: 'var(--text2)', fontSize: 12, textAlign: 'center' }}>لا يوجد موظفون متاحون</div>
          )}
          {available.map((emp) => (
            <div key={emp.empId} onClick={() => { onAdd(emp.empId); setOpen(false) }} style={{
              padding: '6px 10px', cursor: 'pointer', borderRadius: 6, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background .15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="emp-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                {emp.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <span>{emp.name}</span>
              <span style={{ marginRight: 'auto', color: 'var(--text2)', fontSize: 11 }}>{emp.empId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Read-only cell ── */
function ReadOnlyCell({ employees, empIds, stColor }) {
  if (empIds.length === 0) return <span style={{ color: 'var(--text2)', fontSize: 12 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {empIds.map((empId) => {
        const emp = employees.find((e) => e.empId === empId)
        if (!emp) return null
        return (
          <span key={empId} className="tag" style={{
            fontSize: 11, padding: '2px 6px',
            background: stColor?.b || 'rgba(20,152,101,.08)',
            borderColor: `${stColor?.c || '#149865'}33`, color: stColor?.c || '#149865',
          }}>{emp.name.split(/\s+/)[0]}</span>
        )
      })}
    </div>
  )
}

export default function RotationPage({ employees, stations, onSaveStations }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [formErr, setFormErr] = useState('')
  const [baseAssignment, setBaseAssignment] = useState(() => loadBaseAssignment())
  const [startDate, setStartDate] = useState(() => loadStartDate())
  const [shiftAmount, setShiftAmount] = useState(() => loadShift())
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week

  const isConfigured = startDate && Object.keys(baseAssignment).some((k) => (baseAssignment[k]?.length || 0) > 0)

  // Load rotation config + assignments from Supabase on mount
  useEffect(() => {
    async function loadFromDB() {
      try {
        const dbConfig = await fetchRotationConfig()
        if (dbConfig) {
          if (dbConfig.startDate) { setStartDate(dbConfig.startDate); saveStartDate(dbConfig.startDate) }
          if (dbConfig.shiftAmount) { setShiftAmount(dbConfig.shiftAmount); saveShift(dbConfig.shiftAmount) }
        }
        const dbAssign = await fetchRotationAssignments()
        if (dbAssign && Object.keys(dbAssign).length > 0) {
          setBaseAssignment(dbAssign)
          saveBaseAssignment(dbAssign)
        }
      } catch (err) {
        console.warn('Failed to load rotation config from Supabase:', err)
      }
    }
    loadFromDB()
  }, [])

  // Current viewed week's Sunday
  const todayISO = getTodayISO()
  const currentSunday = useMemo(() => {
    const base = getSunday(todayISO)
    const [y, m, d] = base.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + weekOffset * 7)
    const ry = dt.getFullYear()
    const rm = String(dt.getMonth() + 1).padStart(2, '0')
    const rd = String(dt.getDate()).padStart(2, '0')
    return `${ry}-${rm}-${rd}`
  }, [todayISO, weekOffset])

  const weekDates = useMemo(() => getWeekDates(currentSunday), [currentSunday])

  function persistBase(data) {
    setBaseAssignment(data)
    saveBaseAssignment(data)
    syncRotationAssignments(data).catch((err) => console.warn('Supabase sync assignments:', err))
  }

  function handleShiftChange(val) {
    setShiftAmount(val)
    saveShift(val)
    syncRotationConfig(startDate, val).catch((err) => console.warn('Supabase sync config:', err))
  }

  function activateRotation() {
    const today = getTodayISO()
    const sunday = getSunday(today)
    setStartDate(sunday)
    saveStartDate(sunday)
    syncRotationConfig(sunday, shiftAmount).catch((err) => console.warn('Supabase sync config:', err))
    syncRotationAssignments(baseAssignment).catch((err) => console.warn('Supabase sync assignments:', err))
  }

  /* ── Station CRUD ── */
  function openAddStation() { setNewName(''); setFormErr(''); setModalOpen(true) }
  function handleSaveStation() {
    if (!newName.trim()) { setFormErr('⚠ أدخل اسم المحطة'); return }
    onSaveStations([...stations, { name: newName.trim() }])
    setModalOpen(false)
  }
  function deleteStation(i) {
    if (!window.confirm(`هل تريد حذف محطة "${stations[i].name}"؟`)) return
    onSaveStations(stations.filter((_, idx) => idx !== i))
  }

  /* ── Base assignment ── */
  function addToStation(stIdx, empId) {
    const current = baseAssignment[String(stIdx)] || []
    if (current.includes(empId)) return
    persistBase({ ...baseAssignment, [String(stIdx)]: [...current, empId] })
  }
  function removeFromStation(stIdx, empId) {
    const current = baseAssignment[String(stIdx)] || []
    persistBase({ ...baseAssignment, [String(stIdx)]: current.filter((id) => id !== empId) })
  }

  /* ── Generate schedule for viewed week ── */
  const weekSchedule = useMemo(() => {
    if (!startDate) return DAYS.map(() => stations.map(() => []))
    return generateWeekSchedule(stations, baseAssignment, shiftAmount, startDate, currentSunday)
  }, [stations, baseAssignment, shiftAmount, startDate, currentSunday])

  const totalAssigned = Object.values(baseAssignment).reduce((acc, arr) => acc + (arr?.length || 0), 0)

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>Staff Distribution & Rotation System</h2>
          <p className="kpi-sub" style={{ marginTop: 2 }}>Assign employees once — the schedule continues automatically by date</p>
        </div>
        <button className="btn primary" type="button" onClick={openAddStation}>+ Add Station</button>
      </div>

      {/* Station chips */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Stations ({stations.length})</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text2)' }}>
            Employees: <strong style={{ color: 'var(--green)' }}>{employees.length}</strong>
          </span>
        </div>
        {stations.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text2)', padding: 20 }}>No stations defined yet. Click "Add Station".</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {stations.map((st, i) => {
            const col = COLORS[i % COLORS.length]
            return (
              <div key={`st-${i}`} className="tag" style={{
                background: col.b, color: col.c, borderColor: `${col.c}44`,
                fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.c, flexShrink: 0 }}></span>
                {st.name}
                <button type="button" onClick={() => deleteStation(i)} style={{
                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, marginRight: 4,
                }} title="Delete">×</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Base Assignment — one-time setup */}
      {stations.length > 0 && employees.length > 0 && !isConfigured && (
        <div className="card" style={{ borderColor: 'rgba(201,160,23,.4)', background: 'rgba(201,160,23,.04)' }}>
          <div className="card-title" style={{ color: 'var(--amber)' }}>⚙ Base Assignment Setup (One-time)</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Assign each employee to their station, then click "Activate Rotation". The system will rotate automatically from this date.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Station</th><th>Assigned Employees</th></tr></thead>
              <tbody>
                {stations.map((st, si) => {
                  const col = COLORS[si % COLORS.length]
                  const assigned = baseAssignment[String(si)] || []
                  const otherUsedIds = stations.flatMap((_, otherSi) => {
                    if (otherSi === si) return []
                    return baseAssignment[String(otherSi)] || []
                  })
                  return (
                    <tr key={`setup-${si}`}>
                      <td><span className="tag" style={{ background: col.b, color: col.c, borderColor: `${col.c}44`, fontWeight: 600, fontSize: 12 }}>{st.name}</span></td>
                      <td style={{ padding: '8px 6px' }}>
                        <EmpPicker employees={employees} assigned={assigned} allUsedIds={otherUsedIds}
                          onAdd={(empId) => addToStation(si, empId)} onRemove={(empId) => removeFromStation(si, empId)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Daily Shift:</span>
              <select value={shiftAmount} onChange={(e) => handleShiftChange(Number(e.target.value))} style={{ padding: '3px 8px', borderRadius: 8 }}>
                <option value={1}>1 Person</option>
                <option value={2}>2 Persons</option>
                <option value={3}>3 Persons</option>
              </select>
            </div>
            <button className="btn" type="button" onClick={activateRotation}
              disabled={totalAssigned === 0}
              style={{ background: totalAssigned > 0 ? 'var(--green)' : undefined, color: totalAssigned > 0 ? '#fff' : undefined, borderColor: totalAssigned > 0 ? 'var(--green)' : undefined }}>
              ✓ Activate Rotation
            </button>
            <span className="tag" style={{ fontSize: 11 }}>Assigned: <strong>{totalAssigned}</strong> / {employees.length}</span>
          </div>
        </div>
      )}

      {/* Edit base assignment (after activation) */}
      {isConfigured && (
        <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Rotation Active</span>
            <span style={{ color: 'var(--text2)', marginRight: 8 }}> since {formatDateShort(startDate)}</span>
            <span style={{ color: 'var(--text2)' }}> — Shift: {shiftAmount === 1 ? '1 Person' : shiftAmount === 2 ? '2 Persons' : `${shiftAmount} Persons`} / Day</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" type="button" onClick={() => { setStartDate(''); saveStartDate('') }} style={{ fontSize: 12, padding: '4px 10px' }}>
              ✏ Edit Assignment
            </button>
            <select value={shiftAmount} onChange={(e) => handleShiftChange(Number(e.target.value))} style={{ padding: '3px 8px', borderRadius: 8, fontSize: 12 }}>
              <option value={1}>Shift: 1</option>
              <option value={2}>Shift: 2</option>
              <option value={3}>Shift: 3</option>
            </select>
          </div>
        </div>
      )}

      {/* Weekly view — calendar-based */}
      {isConfigured && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>Weekly Schedule</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn" type="button" onClick={() => setWeekOffset(weekOffset - 1)} style={{ padding: '3px 10px' }}>Previous</button>
              <button className="btn" type="button" onClick={() => setWeekOffset(0)}
                style={{ padding: '3px 10px', fontWeight: weekOffset === 0 ? 700 : 400, color: weekOffset === 0 ? 'var(--blue)' : undefined }}>
                Current
              </button>
              <button className="btn" type="button" onClick={() => setWeekOffset(weekOffset + 1)} style={{ padding: '3px 10px' }}>Next</button>
              <button className="btn" type="button" onClick={() => window.print()} style={{ fontSize: 12, padding: '3px 10px' }}>🖨</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 100 }}>Station</th>
                  {DAYS.map((d, di) => {
                    const isToday = weekDates[di] === todayISO
                    return (
                      <th key={d} style={{
                        minWidth: 130, textAlign: 'center',
                        background: isToday ? 'rgba(47,111,228,.08)' : undefined,
                      }}>
                        <div>{d}</div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: isToday ? 'var(--blue)' : 'var(--text2)', marginTop: 2 }}>
                          {formatDateShort(weekDates[di])} {isToday && '📍'}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {stations.map((st, si) => {
                  const col = COLORS[si % COLORS.length]
                  return (
                    <tr key={`row-${si}`}>
                      <td>
                        <span className="tag" style={{
                          background: col.b, color: col.c, borderColor: `${col.c}44`,
                          fontWeight: 600, fontSize: 12,
                        }}>{st.name}</span>
                      </td>
                      {DAYS.map((_, di) => {
                        const isToday = weekDates[di] === todayISO
                        return (
                          <td key={`cell-${si}-${di}`} style={{
                            verticalAlign: 'top', padding: '8px 6px', textAlign: 'center',
                            background: isToday ? 'rgba(47,111,228,.04)' : undefined,
                          }}>
                            <ReadOnlyCell employees={employees} empIds={weekSchedule[di]?.[si] || []} stColor={col} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stations.length > 0 && employees.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>
          Add employees first from the "Employees" page.
        </div>
      )}

      {/* Add Station Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Production Station</div>
            <div className="form-group">
              <label className="form-label">Station Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Assembly" onKeyDown={(e) => e.key === 'Enter' && handleSaveStation()} />
            </div>
            {formErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn primary" type="button" onClick={handleSaveStation}>Add</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
