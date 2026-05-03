/**
 * Rotation Store — one-time base assignment + perpetual calendar rotation
 */

const EMP_KEY = 'prs_emp'
const ST_KEY  = 'prs_st'
const BASE_KEY = 'prs_base'      // Master assignment (one-time)
const START_KEY = 'prs_start'    // Start date of rotation
const SHIFT_KEY = 'prs_shift'    // Shift amount (1 or 2)

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

/* ── Date helpers (LOCAL timezone safe) ── */
function toLocalISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  return toLocalISO(new Date())
}

/* ── Employees ── */
export function loadEmployees() {
  try { return JSON.parse(localStorage.getItem(EMP_KEY) || '[]') }
  catch { return [] }
}
export function saveEmployees(list) {
  localStorage.setItem(EMP_KEY, JSON.stringify(list))
}

/* ── Stations ── */
export function loadStations() {
  try { return JSON.parse(localStorage.getItem(ST_KEY) || '[]') }
  catch { return [] }
}
export function saveStations(list) {
  localStorage.setItem(ST_KEY, JSON.stringify(list))
}

/* ── Base (master) assignment — one-time ──
   Structure: { "stIdx": [empId, empId, ...] }
*/
export function loadBaseAssignment() {
  try { return JSON.parse(localStorage.getItem(BASE_KEY) || '{}') }
  catch { return {} }
}
export function saveBaseAssignment(data) {
  localStorage.setItem(BASE_KEY, JSON.stringify(data))
}

/* ── Rotation start date ── */
export function loadStartDate() {
  return localStorage.getItem(START_KEY) || ''
}
export function saveStartDate(dateISO) {
  localStorage.setItem(START_KEY, dateISO)
}

/* ── Shift amount ── */
export function loadShift() {
  return Number(localStorage.getItem(SHIFT_KEY)) || 1
}
export function saveShift(n) {
  localStorage.setItem(SHIFT_KEY, String(n))
}

/**
 * Get the Sunday date for a given date (finds the most recent Sunday).
 */
export function getSunday(dateISO) {
  const d = parseLocalDate(dateISO)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - day)
  return toLocalISO(d)
}

/**
 * Count working days (Sun-Thu) between two dates.
 */
function countWorkingDays(fromISO, toISO) {
  const from = parseLocalDate(fromISO)
  const to = parseLocalDate(toISO)
  let count = 0
  const cur = new Date(from)
  while (cur < to) {
    const day = cur.getDay() // 0=Sun, 5=Fri, 6=Sat
    if (day >= 0 && day <= 4) count++ // Sun(0) to Thu(4)
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Circular rotation with FIXED station sizes:
 *
 *   All employees form a single circular queue (ordered by station).
 *   Each station has a FIXED number of slots (from base assignment).
 *   Each day, the employee queue rotates by `shiftAmount` PERSONS.
 *   The rotated queue is redistributed to stations keeping the same slot counts.
 *
 *   Example (shift=1):
 *     Stations: A(2 slots), B(1 slot), C(2 slots)
 *     Employees queue: [e1, e2, e3, e4, e5]
 *
 *     Day 0 (Sun): queue=[e1,e2,e3,e4,e5] → A=[e1,e2], B=[e3], C=[e4,e5]
 *     Day 1 (Mon): queue=[e5,e1,e2,e3,e4] → A=[e5,e1], B=[e2], C=[e3,e4]
 *     Day 2 (Tue): queue=[e4,e5,e1,e2,e3] → A=[e4,e5], B=[e1], C=[e2,e3]
 *
 *   Station sizes: A=2, B=1, C=2 — ALWAYS the same!
 *   Employees rotate through all stations over time.
 */
export function generateWeekSchedule(stations, baseAssignment, shiftAmount, startDate, weekSunday) {
  const numStations = stations.length
  if (numStations === 0) return DAYS.map(() => [])

  // Build flat employee queue and fixed slot counts from base assignment
  const slotCounts = []
  const flatQueue = []

  for (let si = 0; si < numStations; si++) {
    const emps = baseAssignment[String(si)] || []
    slotCounts.push(emps.length)
    flatQueue.push(...emps)
  }

  const N = flatQueue.length
  if (N === 0) return DAYS.map(() => stations.map(() => []))

  // How many working days from start to this week's Sunday
  const daysSinceStart = startDate ? countWorkingDays(startDate, weekSunday) : 0

  // Generate 5 days (Sun-Thu)
  const schedule = []
  for (let di = 0; di < 5; di++) {
    const totalOffset = daysSinceStart + di
    const shift = ((totalOffset * shiftAmount) % N + N) % N

    // Rotate the queue: take last `shift` items and put them at the front
    const rotated = shift === 0
      ? [...flatQueue]
      : [...flatQueue.slice(N - shift), ...flatQueue.slice(0, N - shift)]

    // Redistribute to stations using FIXED slot counts
    const dayAssign = []
    let cursor = 0
    for (let si = 0; si < numStations; si++) {
      const count = slotCounts[si]
      dayAssign.push(rotated.slice(cursor, cursor + count))
      cursor += count
    }

    schedule.push(dayAssign)
  }

  return schedule
}

/**
 * Get the dates for each day of a given week (Sun-Thu).
 */
export function getWeekDates(sundayISO) {
  const d = parseLocalDate(sundayISO)
  return DAYS.map((_, i) => {
    const date = new Date(d)
    date.setDate(d.getDate() + i)
    return toLocalISO(date)
  })
}

/**
 * Format a date nicely (e.g., "3 مايو")
 */
export function formatDateShort(iso) {
  const d = parseLocalDate(iso)
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export { DAYS }
