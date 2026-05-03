import * as XLSX from 'xlsx'

function parsePercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace('%', '').replace(',', '.').trim();
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

function parseIntSafe(value) {
  if (value === null || value === undefined || value === '') return 0
  const cleaned = String(value).replace(/,/g, '').trim()
  const num = Number.parseInt(cleaned, 10)
  return Number.isNaN(num) ? 0 : num
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

export function parseFPYExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const activeTabIndex = wb.Workbook?.Views?.[0]?.activeTab ?? 0
  const sheetName = wb.SheetNames[activeTabIndex]

  if (!sheetName) {
    throw new Error('No worksheet found in this file.')
  }

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i += 1) {
    const match = rows[i].some((cell) => normalizeText(cell).toLowerCase().includes('nb boards'))
    if (match) {
      headerIdx = i
      break
    }
  }

  if (headerIdx < 0) {
    throw new Error('Could not detect the expected FPY header row (Nb boards).')
  }

  let productInfo = ''
  for (let i = 0; i < headerIdx; i += 1) {
    const row = rows[i]
    const cell = row.find((c) => normalizeText(c).includes('Produit'))
    if (cell) {
      productInfo = normalizeText(cell)
      break
    }
  }

  const productMatch = productInfo.match(/Produit\s*:\s*([^>]+)/)
  const product = productMatch ? productMatch[1].trim() : 'Unknown Product'

  const stations = []

  let colIdx = {
    name: 1,
    in: 2,
    ok: 6,
    fpy: 10
  }

  // dynamically find columns from header row
  const headerRow = rows[headerIdx] || []
  for (let c = 0; c < headerRow.length; c++) {
    const text = normalizeText(headerRow[c]).toLowerCase()
    if (text.includes('test bench') || text.includes('product name')) colIdx.name = c
    else if (text.includes('nb boards') && !text.includes('ok')) colIdx.in = c
    else if (text.includes('nb boards ok')) colIdx.ok = c
    else if (text === 'fpy' || text.includes('fpy')) colIdx.fpy = c
  }

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const nameCell = normalizeText(row?.[colIdx.name])

    if (!nameCell) continue
    if (nameCell.toUpperCase().includes('TOTAL')) continue

    const [benchRaw, stationRaw] = nameCell.split('|')
    const stationName = normalizeText(stationRaw || benchRaw)

    stations.push({
      stationName,
      nbBoards: parseIntSafe(row?.[colIdx.in]),
      nbBoardsOK: parseIntSafe(row?.[colIdx.ok]),
      fpy: parsePercent(row?.[colIdx.fpy]),
    })
  }

  const assemblyRow = stations.find((s) => {
    const name = s.stationName.toLowerCase()
    return name.includes('assembly') || name.includes('assemblage')
  })

  const persoRow = stations.find((s) => {
    const name = s.stationName.toLowerCase()
    return name.includes('perso')
  })

  const totalBoards = persoRow ? persoRow.nbBoardsOK : stations.reduce((max, item) => Math.max(max, item.nbBoards), 0)
  const achieved = assemblyRow ? assemblyRow.nbBoardsOK : 0

  let overallFPY = null
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const marker = normalizeText(row?.[colIdx.name]).toUpperCase()
    if (!marker.includes('TOTAL')) continue
    overallFPY = parsePercent(row?.[colIdx.fpy])
    break
  }

  return {
    product,
    stations,
    achieved,
    totalBoards,
    overallFPY,
    sheetName,
  }
}
