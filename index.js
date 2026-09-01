/**
 * dsh-token-stats - host half (ESM).
 *
 * Read-only aggregation over the wallet usage ledger (~/.dsh/storages/wallet.json):
 *  - all-time totals come from sessions[*].official.models + sessions[*].third.models
 *    (authoritative per-session accumulators, but they carry no day information)
 *    plus sessions[*].official.cost;
 *  - today / this week / this month and the daily(30)/weekly(12)/monthly(12)
 *    series are aggregated from history.events - the only per-day source -
 *    bucketed by the 'day' field the host already normalized into
 *    history.timezone (weekly/monthly buckets are derived from 'day':
 *    Monday-based ISO weeks keyed 'YYYY-Www', months keyed 'YYYY-MM').
 *
 * The store is NEVER written. The file is re-read only when its mtime changes.
 * Missing fields count as 0; null costs are skipped; a broken store answers
 * HTTP 500 with { ok: false, error }.
 * Route: GET /api/token-stats/summary, registered exactly like the wallet
 * plugin registers its /api/wallet/* routes (ctx.webServer.register).
 */
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'token-stats'
export const inject = ['webServer']

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const STORE_PATH = join(DSH_HOME, 'storages', 'wallet.json')

/** The five usage counters; 'total' is their sum. */
const USAGE_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning']
const DAILY_BUCKETS = 30
const WEEKLY_BUCKETS = 12
const MONTHLY_BUCKETS = 12
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function emptyTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 }
}

function addUsage(totals, usage) {
  if (!usage || typeof usage !== 'object') return totals
  for (const k of USAGE_KEYS) totals[k] += num(usage[k])
  totals.total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite + totals.reasoning
  return totals
}

function addCost(acc, cost) {
  if (typeof cost === 'number' && Number.isFinite(cost)) acc.cost += cost
  return acc
}

function emptyBucket() {
  return { totals: emptyTotals(), byModel: Object.create(null), cost: 0 }
}

function modelEntry(bkt, model) {
  const key = typeof model === 'string' && model !== '' ? model : 'khong ro'
  let entry = bkt.byModel[key]
  if (!entry) {
    entry = emptyTotals()
    entry.cost = 0
    bkt.byModel[key] = entry
  }
  return entry
}

function addEventToBucket(bkt, event) {
  addUsage(bkt.totals, event.usage)
  addCost(bkt, event.cost)
  const entry = modelEntry(bkt, event.model)
  addUsage(entry, event.usage)
  addCost(entry, event.cost)
}

/* ---------------- calendar helpers (string keys, UTC-safe arithmetic) ---------------- */

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function localDayKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

/** 'YYYY-MM-DD' of date rendered in timezone tz (Intl); falls back to the
 *  system timezone, then to plain local getters. */
function dayKeyInTz(date, tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' }
  try {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: tz }).format(date)
  } catch (err) {
    console.warn('[dsh-token-stats] Intl timezone "' + tz + '" failed, falling back: ' + (err && err.message))
  }
  try {
    return new Intl.DateTimeFormat('en-CA', opts).format(date)
  } catch (err) {
    return localDayKey(date)
  }
}

function shiftDay(dayKey, delta) {
  const parts = dayKey.split('-').map(Number)
  const t = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  t.setUTCDate(t.getUTCDate() + delta)
  return t.toISOString().slice(0, 10)
}

function shiftMonth(yearMonth, delta) {
  const parts = yearMonth.split('-').map(Number)
  const t = new Date(Date.UTC(parts[0], parts[1] - 1 + delta, 1))
  return t.toISOString().slice(0, 7)
}

/** Monday-based ISO week key ('YYYY-Www') for a 'YYYY-MM-DD' day. */
function isoWeekKey(dayKey) {
  const parts = dayKey.split('-').map(Number)
  const t = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const dow = (t.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  t.setUTCDate(t.getUTCDate() - dow + 3) // the Thursday of this ISO week
  const isoYear = t.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Dow = (jan4.getUTCDay() + 6) % 7
  const week1Thu = new Date(Date.UTC(isoYear, 0, 4))
  week1Thu.setUTCDate(week1Thu.getUTCDate() - jan4Dow + 3) // the Thursday of ISO week 1
  const week = 1 + Math.round((t.getTime() - week1Thu.getTime()) / 604800000)
  return isoYear + '-W' + pad2(week)
}

/** The Thursday (00:00 UTC) inside the ISO week containing dayKey. */
function thursdayOf(dayKey) {
  const parts = dayKey.split('-').map(Number)
  const t = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const dow = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dow + 3)
  return t
}

/** Best-effort 'YYYY-MM-DD' for an event without a usable 'day' field. */
function deriveDay(event, tz) {
  const ms = event && typeof event.occurredAt === 'number' && Number.isFinite(event.occurredAt) ? event.occurredAt : null
  if (ms === null) return null
  const key = dayKeyInTz(new Date(ms), tz)
  return DAY_RE.test(key) ? key : null
}

/* ---------------- aggregation ---------------- */

function computeAllTime(data) {
  const totals = emptyTotals()
  const costAcc = { cost: 0 }
  const byModel = Object.create(null)
  const sessions =
    data && typeof data === 'object' && data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
  const mergeModels = (models) => {
    if (!models || typeof models !== 'object') return
    for (const modelKey of Object.keys(models)) {
      const usage = models[modelKey]
      if (!usage || typeof usage !== 'object') continue
      addUsage(totals, usage)
      const key = modelKey !== '' ? modelKey : 'khong ro'
      let entry = byModel[key]
      if (!entry) {
        entry = emptyTotals()
        entry.cost = 0
        byModel[key] = entry
      }
      addUsage(entry, usage)
      // Per-model cost when the store carries one on the model entry; the
      // headline cost stays sessions[*].official.cost (no double counting).
      if (typeof usage.cost === 'number' && Number.isFinite(usage.cost)) entry.cost += usage.cost
    }
  }
  for (const session of Object.values(sessions)) {
    if (!session || typeof session !== 'object') continue
    const official = session.official && typeof session.official === 'object' ? session.official : {}
    addCost(costAcc, official.cost)
    mergeModels(official.models)
    const third = session.third && typeof session.third === 'object' ? session.third : {}
    mergeModels(third.models)
  }
  const byModelSorted = {}
  for (const k of Object.keys(byModel).sort((a, b) => byModel[b].total - byModel[a].total)) {
    byModelSorted[k] = byModel[k]
  }
  return { totals, byModel: byModelSorted, cost: costAcc.cost }
}

function emitBucket(key, bkt) {
  return { key, totals: { ...bkt.totals }, byModel: bkt.byModel, cost: bkt.cost }
}

function buildSeries(events, tz, todayKey) {
  const dailyMap = new Map()
  const weeklyMap = new Map()
  const monthlyMap = new Map()
  const bucketOf = (map, key) => {
    let b = map.get(key)
    if (!b) {
      b = emptyBucket()
      map.set(key, b)
    }
    return b
  }
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const day = typeof event.day === 'string' && DAY_RE.test(event.day) ? event.day : deriveDay(event, tz)
    if (day === null) continue
    addEventToBucket(bucketOf(dailyMap, day), event)
    addEventToBucket(bucketOf(weeklyMap, isoWeekKey(day)), event)
    addEventToBucket(bucketOf(monthlyMap, day.slice(0, 7)), event)
  }
  const daily = []
  for (let i = DAILY_BUCKETS - 1; i >= 0; i--) {
    const key = shiftDay(todayKey, -i)
    daily.push(emitBucket(key, dailyMap.get(key) ?? emptyBucket()))
  }
  const weekly = []
  const thisThursday = thursdayOf(todayKey)
  for (let i = WEEKLY_BUCKETS - 1; i >= 0; i--) {
    const t = new Date(thisThursday.getTime())
    t.setUTCDate(t.getUTCDate() - 7 * i)
    const key = isoWeekKey(t.toISOString().slice(0, 10))
    weekly.push(emitBucket(key, weeklyMap.get(key) ?? emptyBucket()))
  }
  const monthly = []
  for (let i = MONTHLY_BUCKETS - 1; i >= 0; i--) {
    const key = shiftMonth(todayKey.slice(0, 7), -i)
    monthly.push(emitBucket(key, monthlyMap.get(key) ?? emptyBucket()))
  }
  return { daily, weekly, monthly }
}

/**
 * Pure aggregation entry point (exported for tests).
 * @param data - parsed wallet.json (missing/odd shapes tolerated)
 * @param now  - reference instant; 'today' is resolved in history.timezone
 */
export function buildSummary(data, now = new Date()) {
  const at = now instanceof Date ? now : new Date(now)
  const history = data && typeof data === 'object' && data.history && typeof data.history === 'object' ? data.history : {}
  let timezone
  if (typeof history.timezone === 'string' && history.timezone !== '') {
    timezone = history.timezone
  } else {
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
    } catch (err) {
      timezone = 'UTC'
    }
  }
  const todayKey = dayKeyInTz(at, timezone)
  const events = history.events && typeof history.events === 'object' ? Object.values(history.events) : []
  const series = buildSeries(events, timezone, todayKey)
  const current = (arr) => {
    const b = arr[arr.length - 1]
    return { totals: { ...b.totals }, cost: b.cost }
  }
  return {
    generatedAt: at.toISOString(),
    timezone,
    today: current(series.daily),
    thisWeek: current(series.weekly),
    thisMonth: current(series.monthly),
    allTime: computeAllTime(data),
    series,
  }
}

/* ---------------- store read (mtime cache, read-only) ---------------- */

let storeCache = null // { mtimeMs, data }

function loadStore() {
  let mtimeMs
  try {
    mtimeMs = statSync(STORE_PATH).mtimeMs
  } catch (err) {
    throw new Error('cannot stat ' + STORE_PATH + ': ' + ((err && err.message) || String(err)))
  }
  if (storeCache && storeCache.mtimeMs === mtimeMs) return storeCache.data
  const data = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
  storeCache = { mtimeMs, data }
  return data
}

function summaryHandler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
  try {
    return json(res, 200, buildSummary(loadStore(), new Date()))
  } catch (err) {
    console.warn('[dsh-token-stats] summary aggregation failed: ' + ((err && err.message) || String(err)))
    return json(res, 500, { ok: false, error: 'token-stats: ' + ((err && err.message) || String(err)) })
  }
}

export function apply(ctx) {
  const webServer = ctx && ctx.webServer
  if (!webServer || typeof webServer.register !== 'function') {
    console.warn('[dsh-token-stats] ctx.webServer unavailable - route not registered')
    return
  }
  const register = () => webServer.register({ kind: 'exact', path: '/api/token-stats/summary', handler: summaryHandler })
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      const dispose = register()
      return typeof dispose === 'function' ? dispose : undefined
    }, 'token-stats: routes')
  } else {
    register()
  }
}
