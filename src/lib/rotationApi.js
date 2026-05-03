/**
 * Rotation API — Supabase sync for employees, stations, assignments & config.
 * Falls back gracefully if Supabase is not configured (localStorage still works).
 */
import { isSupabaseConfigured, supabase } from './supabase'

/* ═══════════════════════════════════════════
   EMPLOYEES
═══════════════════════════════════════════ */

export async function fetchEmployees() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('fetchEmployees:', error); return null }
  return (data || []).map((r) => ({
    name: r.name,
    empId: r.emp_id,
    phone: r.phone || '',
    email: r.email || '',
  }))
}

export async function syncEmployees(employees) {
  if (!isSupabaseConfigured || !supabase) return
  // Delete all then re-insert (simple full sync)
  await supabase.from('employees').delete().neq('id', 0)
  if (employees.length === 0) return
  const rows = employees.map((e) => ({
    emp_id: e.empId,
    name: e.name,
    phone: e.phone || '',
    email: e.email || '',
  }))
  const { error } = await supabase.from('employees').insert(rows)
  if (error) console.error('syncEmployees:', error)
}

/* ═══════════════════════════════════════════
   ROTATION STATIONS
═══════════════════════════════════════════ */

export async function fetchRotationStations() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase
    .from('rotation_stations')
    .select('*')
    .order('station_order', { ascending: true })
  if (error) { console.error('fetchRotationStations:', error); return null }
  return (data || []).map((r) => ({
    _dbId: r.id,
    name: r.name,
  }))
}

export async function syncRotationStations(stations) {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.from('rotation_stations').delete().neq('id', 0)
  if (stations.length === 0) return
  const rows = stations.map((s, i) => ({
    station_order: i,
    name: s.name,
  }))
  const { error } = await supabase.from('rotation_stations').insert(rows)
  if (error) console.error('syncRotationStations:', error)
}

/* ═══════════════════════════════════════════
   ROTATION ASSIGNMENTS
═══════════════════════════════════════════ */

export async function fetchRotationAssignments() {
  if (!isSupabaseConfigured || !supabase) return null

  // Get station IDs in order
  const { data: stData } = await supabase
    .from('rotation_stations')
    .select('id, station_order')
    .order('station_order', { ascending: true })
  if (!stData) return null

  const { data: assignData, error } = await supabase
    .from('rotation_assignments')
    .select('*')
    .order('assignment_order', { ascending: true })
  if (error) { console.error('fetchRotationAssignments:', error); return null }

  // Build { "stIdx": [empId, ...] }
  const result = {}
  stData.forEach((st, idx) => {
    const empIds = (assignData || [])
      .filter((a) => a.station_id === st.id)
      .map((a) => a.emp_id)
    if (empIds.length > 0) result[String(idx)] = empIds
  })
  return result
}

export async function syncRotationAssignments(baseAssignment) {
  if (!isSupabaseConfigured || !supabase) return

  // Get current station DB IDs in order
  const { data: stData } = await supabase
    .from('rotation_stations')
    .select('id, station_order')
    .order('station_order', { ascending: true })
  if (!stData) return

  // Clear all assignments
  await supabase.from('rotation_assignments').delete().neq('id', 0)

  // Insert new
  const rows = []
  Object.entries(baseAssignment).forEach(([stIdx, empIds]) => {
    const stRow = stData[Number(stIdx)]
    if (!stRow || !empIds?.length) return
    empIds.forEach((empId, order) => {
      rows.push({
        station_id: stRow.id,
        emp_id: empId,
        assignment_order: order,
      })
    })
  })
  if (rows.length > 0) {
    const { error } = await supabase.from('rotation_assignments').insert(rows)
    if (error) console.error('syncRotationAssignments:', error)
  }
}

/* ═══════════════════════════════════════════
   ROTATION CONFIG
═══════════════════════════════════════════ */

export async function fetchRotationConfig() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase
    .from('rotation_config')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) { console.error('fetchRotationConfig:', error); return null }
  return {
    startDate: data.start_date || '',
    shiftAmount: data.shift_amount || 1,
  }
}

export async function syncRotationConfig(startDate, shiftAmount) {
  if (!isSupabaseConfigured || !supabase) return
  const { error } = await supabase
    .from('rotation_config')
    .upsert({
      id: 1,
      start_date: startDate || null,
      shift_amount: shiftAmount,
    })
  if (error) console.error('syncRotationConfig:', error)
}
