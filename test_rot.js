const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

function countWorkingDays(fromISO, toISO) {
  return 0 // For testing, just assume offset 0 for Sunday
}

export function generateWeekSchedule(stations, baseAssignment, shiftAmount, startDate, weekSunday) {
  const numStations = stations.length
  if (numStations === 0) return DAYS.map(() => [])

  const slotCounts = []
  const flatQueue = []

  for (let si = 0; si < numStations; si++) {
    const emps = baseAssignment[String(si)] || []
    slotCounts.push(emps.length)
    flatQueue.push(...emps)
  }

  const N = flatQueue.length
  if (N === 0) return DAYS.map(() => stations.map(() => []))

  const daysSinceStart = 0

  const schedule = []
  for (let di = 0; di < 5; di++) {
    const totalOffset = daysSinceStart + di
    const shift = ((totalOffset * shiftAmount) % N + N) % N

    const rotated = shift === 0
      ? [...flatQueue]
      : [...flatQueue.slice(N - shift), ...flatQueue.slice(0, N - shift)]

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

const stations = [ { name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' } ]
const base = {
  '0': ['Ammar', 'Ali', 'Zainab', 'Nafja'],
  '1': ['Abdul', 'Basma', 'Asila'],
  '2': ['Khalid', 'Abrar', 'Maryam'],
  '3': ['Samar', 'Anfal', 'Fatema']
}

const res = generateWeekSchedule(stations, base, 2, null, null)
res.forEach((day, di) => {
  console.log(`Day ${di}:`)
  day.forEach((st, si) => {
    console.log(`  St ${si}: [${st.join(', ')}]`)
  })
})
