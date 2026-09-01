import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSummary } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'wallet.json'), 'utf8'))

// Mốc tham chiếu cố định: 2026-02-11 (thứ 4), tuần ISO 2026-W07 (t2 09/02 - cn 15/02).
const NOW = new Date('2026-02-11T10:00:00Z')
const summary = buildSummary(fixture, NOW)

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

test('timezone + generatedAt theo fixture va moc NOW', () => {
  assert.equal(summary.timezone, 'UTC')
  assert.equal(summary.generatedAt, '2026-02-11T10:00:00.000Z')
})

test('today (2026-02-11): tong dung tren 2 model, cost bo qua null', () => {
  assert.deepEqual(summary.today.totals, {
    input: 300,
    output: 130,
    cacheRead: 30,
    cacheWrite: 5,
    reasoning: 30,
    total: 495,
  })
  assert.ok(near(summary.today.cost, 0.5))
})

test('thisWeek = ISO week hien tai (2026-W07), cong 09-11/02', () => {
  assert.deepEqual(summary.thisWeek.totals, {
    input: 710,
    output: 330,
    cacheRead: 40,
    cacheWrite: 30,
    reasoning: 65,
    total: 1175,
  })
  assert.ok(near(summary.thisWeek.cost, 0.85))
})

test('thisMonth (2026-02): gom ca tuan truoc trong thang', () => {
  assert.deepEqual(summary.thisMonth.totals, {
    input: 840,
    output: 395,
    cacheRead: 45,
    cacheWrite: 35,
    reasoning: 70,
    total: 1385,
  })
  assert.ok(near(summary.thisMonth.cost, 1.6))
})

test('daily: du 30 bucket ke ca ngay 0, key lien tuc, bucket dung', () => {
  assert.equal(summary.series.daily.length, 30)
  assert.equal(summary.series.daily[0].key, '2026-01-13')
  assert.equal(summary.series.daily[29].key, '2026-02-11')
  for (const b of summary.series.daily) assert.match(b.key, /^\d{4}-\d{2}-\d{2}$/)
  const d10 = summary.series.daily.find((b) => b.key === '2026-02-10')
  assert.deepEqual(d10.totals, {
    input: 230,
    output: 100,
    cacheRead: 5,
    cacheWrite: 10,
    reasoning: 10,
    total: 355,
  })
  assert.ok(near(d10.cost, 0.25))
  assert.equal(d10.byModel['deepseek-chat'].total, 220)
  assert.equal(d10.byModel['deepseek-reasoner'].total, 135)
  const zero = summary.series.daily.find((b) => b.key === '2026-02-08')
  assert.equal(zero.totals.total, 0)
  assert.equal(zero.cost, 0)
})

test('weekly: 12 bucket ISO (thu 2 lam dau tuan), key YYYY-Www', () => {
  assert.equal(summary.series.weekly.length, 12)
  for (const b of summary.series.weekly) assert.match(b.key, /^\d{4}-W\d{2}$/)
  assert.equal(summary.series.weekly[11].key, '2026-W07')
  assert.equal(summary.series.weekly[11].totals.total, 1175)
  assert.equal(summary.series.weekly[10].key, '2026-W06')
  assert.equal(summary.series.weekly[10].totals.total, 210)
  assert.equal(summary.series.weekly[0].key, '2025-W48')
  assert.ok(near(summary.series.weekly[11].byModel['deepseek-chat'].cost, 0.75))
})

test('monthly: 12 bucket, key YYYY-MM', () => {
  assert.equal(summary.series.monthly.length, 12)
  for (const b of summary.series.monthly) assert.match(b.key, /^\d{4}-\d{2}$/)
  assert.equal(summary.series.monthly[11].key, '2026-02')
  assert.equal(summary.series.monthly[10].key, '2026-01')
  assert.equal(summary.series.monthly[10].totals.total, 300)
  assert.ok(near(summary.series.monthly[10].cost, 0.2))
})

test('allTime: cong tu sessions (official.models + third.models) + official.cost', () => {
  assert.deepEqual(summary.allTime.totals, {
    input: 1020,
    output: 485,
    cacheRead: 55,
    cacheWrite: 40,
    reasoning: 85,
    total: 1685,
  })
  assert.ok(near(summary.allTime.cost, 1.6))
  assert.equal(summary.allTime.byModel['deepseek-chat'].total, 735)
  assert.equal(summary.allTime.byModel['deepseek-reasoner'].total, 950)
})

test('defensive: du lieu rong van tra du series 30/12/12 va totals 0', () => {
  const empty = buildSummary({}, NOW)
  assert.equal(empty.series.daily.length, 30)
  assert.equal(empty.series.weekly.length, 12)
  assert.equal(empty.series.monthly.length, 12)
  assert.equal(empty.allTime.totals.total, 0)
  assert.equal(empty.today.totals.total, 0)
  assert.equal(empty.thisWeek.totals.total, 0)
  assert.equal(empty.thisMonth.totals.total, 0)
})
