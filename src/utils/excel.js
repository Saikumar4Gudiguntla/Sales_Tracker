import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

// ---------- generic sheet reader ----------
export function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        resolve(wb)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function clean(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v.trim() || null
  return v
}

function toDateStr(v) {
  if (!v) return null
  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD')
  const d = dayjs(v)
  return d.isValid() ? d.format('YYYY-MM-DD') : null
}

// Reads any sheet as an array of row objects keyed by the header row,
// auto-detecting the first row that looks like a real header
// (skips stray metadata rows like a lone date or blank row).
function sheetToRows(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  let headerIdx = 0
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const nonEmpty = raw[i].filter((c) => c !== null && String(c).trim() !== '')
    if (nonEmpty.length >= 3) { headerIdx = i; break }
  }
  const headers = raw[headerIdx].map((h) => (h ? String(h).trim() : ''))
  const rows = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    const obj = {}
    let hasData = false
    headers.forEach((h, idx) => {
      if (!h) return
      const v = clean(row[idx])
      if (v !== null) hasData = true
      obj[h] = v
    })
    if (hasData) rows.push(obj)
  }
  return rows
}

// ---------- lead sheet mapping ----------
const LEAD_FIELD_MAP = {
  'Lead Name': 'lead_name',
  'Name': 'contact_name',
  'Topic/ SKU': 'topic_sku',
  'Sales': 'salesperson',
  '# of People': 'num_people',
  'Rev #': 'rev_number',
  'Date Received': 'date_received',
  'Status': 'status',
  'Next Action': 'next_action',
  'Demos Status': 'demo_date',
  'G/S': 'segment',
  'Source': 'source',
}

export function parseLeadsWorkbook(wb) {
  const results = []
  wb.SheetNames.forEach((name) => {
    const rows = sheetToRows(wb.Sheets[name])
    rows.forEach((r) => {
      const lead = {}
      Object.entries(LEAD_FIELD_MAP).forEach(([src, dest]) => {
        // headers in source files sometimes carry trailing spaces
        const key = Object.keys(r).find((k) => k.trim() === src)
        if (key) lead[dest] = r[key]
      })
      if (!lead.lead_name) return
      if (lead.date_received) lead.date_received = toDateStr(lead.date_received)
      lead.status = lead.status || 'New'
      results.push(lead)
    })
  })
  return results
}

// ---------- license sheet mapping ----------
const LICENSE_FIELD_MAP = {
  'Customer Name': 'customer_name',
  'Agreement - client signature': 'agreement_client_signed',
  'Agreement Counter Signed': 'agreement_countersigned',
  'Invoice Shared': 'invoice_shared',
  'Payment done': 'payment_done',
  'Payment Confirmed': 'payment_confirmed',
  'License Loaded': 'license_loaded',
  'SKU': 'sku',
  '# of License': 'license_qty',
  'Subscription': 'subscription_type',
  'Amount': 'amount',
  'Roles': 'roles_notes',
}

function toBool(v) {
  if (v === null || v === undefined) return false
  const s = String(v).trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === 'y'
}

export function parseLicensesWorkbook(wb) {
  const results = []
  wb.SheetNames.forEach((name) => {
    const rows = sheetToRows(wb.Sheets[name])
    rows.forEach((r) => {
      const keys = Object.keys(r)
      const lic = {}
      Object.entries(LICENSE_FIELD_MAP).forEach(([src, dest]) => {
        const key = keys.find((k) => k.trim() === src)
        if (key) lic[dest] = r[key]
      })
      if (!lic.customer_name) return
      // skip legend / instruction rows (e.g. "Role, client, cfo...")
      if (/^role$/i.test(String(lic.customer_name).trim())) return
      if (/^total$/i.test(String(lic.customer_name).trim())) return
      ;['agreement_client_signed', 'agreement_countersigned', 'invoice_shared', 'payment_done', 'payment_confirmed', 'license_loaded']
        .forEach((f) => { lic[f] = toBool(lic[f]) })
      if (lic.license_qty) lic.license_qty = parseInt(String(lic.license_qty).replace(/[^0-9]/g, ''), 10) || 0
      if (lic.amount) lic.amount = parseFloat(String(lic.amount).replace(/[^0-9.]/g, '')) || 0
      if (lic.subscription_type) {
        const s = String(lic.subscription_type).trim().toUpperCase()
        lic.subscription_type = s === 'M' ? 'M' : 'A'
      }
      lic.status = lic.license_loaded ? 'Active' : (lic.payment_confirmed ? 'Pending' : 'Pending')
      results.push(lic)
    })
  })
  return results
}

// ---------- export ----------
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
