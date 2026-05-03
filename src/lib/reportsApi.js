import { isSupabaseConfigured, supabase } from './supabase'

const TABLE = 'reports'

let lastSupabaseError = ''

function formatSupabaseError(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  const message = error.message || error.error_description || error.hint || 'Unknown Supabase error'
  const code = error.code ? ` (${error.code})` : ''
  const details = error.details ? ` - ${error.details}` : ''
  return `${message}${code}${details}`
}

export function getLastSupabaseError() {
  return lastSupabaseError
}

export function getStorageMode() {
  return 'supabase'
}

export async function fetchReports() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('report_date', { ascending: false })

  if (!error) {
    lastSupabaseError = ''
    return data ?? []
  }

  lastSupabaseError = formatSupabaseError(error)
  throw new Error(`Failed to fetch reports: ${lastSupabaseError}`)
}

export async function upsertReport(reportDate, parsedData, targetBoards) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const payload = {
    report_date: reportDate,
    product: parsedData.product,
    overall_fpy: parsedData.overallFPY,
    total_boards: parsedData.totalBoards,
    achieved: parsedData.achieved,
    data: { ...parsedData, targetBoards: targetBoards ?? null },
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'report_date' })
    .select('*')
    .single()

  if (!error) {
    lastSupabaseError = ''
    return { row: data, mode: 'supabase' }
  }

  lastSupabaseError = formatSupabaseError(error)
  throw new Error(`Supabase save failed: ${lastSupabaseError}`)
}

export async function deleteReport(id) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (!error) {
    lastSupabaseError = ''
    return
  }

  lastSupabaseError = formatSupabaseError(error)
  throw new Error(`Failed to delete report: ${lastSupabaseError}`)
}

export async function clearReports() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase.from(TABLE).delete().neq('id', 0)
  if (!error) {
    lastSupabaseError = ''
    return
  }

  lastSupabaseError = formatSupabaseError(error)
  throw new Error(`Failed to clear reports: ${lastSupabaseError}`)
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, mode: 'not_configured', error: 'Missing Supabase env vars.' }
  }

  const { error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).limit(1)
  if (!error) {
    lastSupabaseError = ''
    return { ok: true, mode: 'supabase', error: '' }
  }

  lastSupabaseError = formatSupabaseError(error)
  return { ok: false, mode: 'error', error: lastSupabaseError }
}
