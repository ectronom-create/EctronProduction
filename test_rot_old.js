const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

function applyShift(stationArrays, shiftAmount) {
  const n = stationArrays.length
  if (n === 0) return stationArrays

  const movers = stationArrays.map((arr) => {
    const take = Math.min(shiftAmount, arr.length)
    return arr.slice(arr.length - take)
  })

  const remaining = stationArrays.map((arr) => {
    const take = Math.min(shiftAmount, arr.length)
    return arr.slice(0, arr.length - take)
  })

  return remaining.map((kept, i) => {
    const prevIdx = (i - 1 + n) % n
    return [...kept, ...movers[prevIdx]]
  })
}

export function generateWeekSchedule(stations, baseAssignment, shiftAmount) {
  let current = stations.map((_, si) => [...(baseAssignment[String(si)] || [])])

  const schedule = []
  for (let di = 0; di < 5; di++) {
    schedule.push(current.map((arr) => [...arr]))
    if (di < 4) {
      current = applyShift(current, shiftAmount)
    }
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

const res = generateWeekSchedule(stations, base, 2)
res.forEach((day, di) => {
  console.log(`Day ${di}:`)
  day.forEach((st, si) => {
    console.log(`  St ${si}: [${st.join(', ')}]`)
  })
})
