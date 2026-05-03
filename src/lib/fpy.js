export function fpyClass(fpy) {
  if (fpy === null || fpy === undefined) return ''
  if (fpy >= 90) return 'tag-green'
  if (fpy >= 75) return 'tag-amber'
  return 'tag-red'
}

export function normalizeReport(row) {
  const targetBoards = row.target_boards ?? row.data?.targetBoards ?? null
  return {
    id: row.id,
    date: row.report_date,
    product: row.product,
    overallFPY: row.overall_fpy,
    totalBoards: row.total_boards,
    achieved: row.achieved,
    targetBoards,
    ...(row.data || {}),
  }
}
