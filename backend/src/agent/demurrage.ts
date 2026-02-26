/**
 * Mari8X Demurrage & Detention (D&D) Tracker
 *
 * Tracks container free time per B/L and calculates daily D&D liability.
 *
 * Concepts:
 *   demurrage   — charge for containers staying in the port/terminal past
 *                 the carrier's free time (at-port detention)
 *   detention   — charge for containers staying with the shipper/consignee
 *                 beyond the agreed free days (at-customer detention)
 *
 * Free time rules (carrier-configurable per trade lane):
 *   freeDaysDemurrage  — days at port before demurrage starts
 *   freeDaysDetention  — days with shipper before detention starts
 *   dailyRateDemurrage — USD/day/container after free days
 *   dailyRateDetention — USD/day/container after free days
 *
 * Storage:
 *   /root/.ankr/state/mari8x-dd/<blNumber>.json  — per-B/L D&D record
 *   /root/.ankr/state/mari8x-dd/index.json       — blNumber → summary lookup
 *
 * Status codes:
 *   FREE        — within free days for both demurrage and detention
 *   DEMURRAGE   — demurrage accruing; within free days for detention
 *   DETENTION   — detention accruing; within free days for demurrage
 *   BOTH        — both demurrage and detention accruing
 *   CLEARED     — containers returned / discharged, no further liability
 *
 * © 2026 ANKR Labs — Proprietary
 */

import * as fs   from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const DD_DIR   = '/root/.ankr/state/mari8x-dd'
const IDX_FILE = path.join(DD_DIR, 'index.json')

fs.mkdirSync(DD_DIR, { recursive: true })

// ── Types ─────────────────────────────────────────────────────────────────────

export type DDStatus = 'FREE' | 'DEMURRAGE' | 'DETENTION' | 'BOTH' | 'CLEARED'

export interface DDRules {
  freeDaysDemurrage:  number     // default 5
  freeDaysDetention:  number     // default 7
  dailyRateDemurrage: number     // USD per container per day
  dailyRateDetention: number     // USD per container per day
  currency:           string     // default 'USD'
}

export interface DDContainer {
  containerNumber:   string
  isoType:           string
  dischargeDate:     string | null   // ISO date — when landed at terminal
  returnDate:        string | null   // ISO date — when returned by shipper
  deliveryDate:      string | null   // ISO date — when picked up by consignee
  notes:             string | null
}

export interface DDRecord {
  blNumber:          string
  voyageId:          string | null
  vesselName:        string | null
  portCode:          string          // UNLOCODE
  portName:          string | null
  consignee:         string | null
  shipper:           string | null
  containers:        DDContainer[]
  rules:             DDRules
  status:            DDStatus
  demurrageDays:     number          // days accrued across all containers
  detentionDays:     number
  demurrageUsd:      number          // total liability
  detentionUsd:      number
  totalLiabilityUsd: number
  alertThresholdUsd: number | null   // fire alert when total exceeds this
  alertFired:        boolean
  createdAt:         string
  updatedAt:         string
}

export interface DDIndexEntry {
  portCode:          string
  vesselName:        string | null
  status:            DDStatus
  totalLiabilityUsd: number
  containers:        number
}

// ── Broadcast callback ────────────────────────────────────────────────────────

export type DDBroadcast = (event: string, record: DDRecord) => void
let _onDDUpdate: DDBroadcast | null = null
export function setDDBroadcast(fn: DDBroadcast): void { _onDDUpdate = fn }

// ── Default rules ─────────────────────────────────────────────────────────────

const DEFAULT_RULES: DDRules = {
  freeDaysDemurrage:  5,
  freeDaysDetention:  7,
  dailyRateDemurrage: 75,
  dailyRateDetention: 50,
  currency:           'USD',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ddFile(blNumber: string): string {
  return path.join(DD_DIR, `${blNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
}

function loadIndex(): Record<string, DDIndexEntry> {
  try { return JSON.parse(fs.readFileSync(IDX_FILE, 'utf-8')) }
  catch { return {} }
}

function saveIndex(idx: Record<string, DDIndexEntry>): void {
  fs.writeFileSync(IDX_FILE, JSON.stringify(idx, null, 2))
}

function daysBetween(from: string, to?: string): number {
  const fromMs = new Date(from).getTime()
  const toMs   = to ? new Date(to).getTime() : Date.now()
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000))
}

/**
 * Compute D&D liability for the record based on current date.
 * Returns updated demurrageDays, detentionDays, USD totals, and status.
 */
function computeLiability(record: DDRecord): Pick<DDRecord, 'demurrageDays' | 'detentionDays' | 'demurrageUsd' | 'detentionUsd' | 'totalLiabilityUsd' | 'status'> {
  const r  = record.rules
  let totalDemurrageDays = 0
  let totalDetentionDays = 0

  for (const con of record.containers) {
    if (record.status === 'CLEARED') break

    // Demurrage: time at port from discharge to delivery/return
    if (con.dischargeDate) {
      const end = con.deliveryDate ?? con.returnDate ?? undefined
      const daysAtPort = daysBetween(con.dischargeDate, end)
      const demurrageDays = Math.max(0, daysAtPort - r.freeDaysDemurrage)
      totalDemurrageDays += demurrageDays
    }

    // Detention: time with shipper/consignee from delivery to return
    if (con.deliveryDate && !con.returnDate) {
      const daysWithShipper = daysBetween(con.deliveryDate)
      const detentionDays   = Math.max(0, daysWithShipper - r.freeDaysDetention)
      totalDetentionDays   += detentionDays
    }
  }

  const demurrageUsd = totalDemurrageDays * r.dailyRateDemurrage
  const detentionUsd = totalDetentionDays * r.dailyRateDetention
  const totalLiabilityUsd = demurrageUsd + detentionUsd

  const status: DDStatus =
    record.status === 'CLEARED' ? 'CLEARED' :
    totalDemurrageDays > 0 && totalDetentionDays > 0 ? 'BOTH' :
    totalDemurrageDays > 0 ? 'DEMURRAGE' :
    totalDetentionDays > 0 ? 'DETENTION' : 'FREE'

  return { demurrageDays: totalDemurrageDays, detentionDays: totalDetentionDays, demurrageUsd, detentionUsd, totalLiabilityUsd, status }
}

function updateIndex(record: DDRecord): void {
  const idx = loadIndex()
  idx[record.blNumber] = {
    portCode:          record.portCode,
    vesselName:        record.vesselName,
    status:            record.status,
    totalLiabilityUsd: record.totalLiabilityUsd,
    containers:        record.containers.length,
  }
  saveIndex(idx)
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create or update a D&D record for a B/L.
 * Pass containers to add/replace; pass rules to override defaults.
 */
export function upsertDD(input: {
  blNumber:       string
  voyageId?:      string
  vesselName?:    string
  portCode:       string
  portName?:      string
  consignee?:     string
  shipper?:       string
  containers:     DDContainer[]
  rules?:         Partial<DDRules>
  alertThresholdUsd?: number
}): DDRecord {
  const now  = new Date().toISOString()
  const file = ddFile(input.blNumber)

  let record: DDRecord

  if (fs.existsSync(file)) {
    record = JSON.parse(fs.readFileSync(file, 'utf-8')) as DDRecord
    // Merge containers: update existing by containerNumber, append new
    for (const newCon of input.containers) {
      const existing = record.containers.findIndex(c => c.containerNumber === newCon.containerNumber)
      if (existing >= 0) record.containers[existing] = { ...record.containers[existing], ...newCon }
      else               record.containers.push(newCon)
    }
    if (input.rules)             record.rules             = { ...record.rules, ...input.rules }
    if (input.consignee)         record.consignee         = input.consignee
    if (input.shipper)           record.shipper           = input.shipper
    if (input.alertThresholdUsd !== undefined) record.alertThresholdUsd = input.alertThresholdUsd
    record.updatedAt = now
  } else {
    record = {
      blNumber:          input.blNumber,
      voyageId:          input.voyageId ?? null,
      vesselName:        input.vesselName ?? null,
      portCode:          input.portCode.toUpperCase(),
      portName:          input.portName ?? null,
      consignee:         input.consignee ?? null,
      shipper:           input.shipper   ?? null,
      containers:        input.containers,
      rules:             { ...DEFAULT_RULES, ...(input.rules ?? {}) },
      status:            'FREE',
      demurrageDays:     0,
      detentionDays:     0,
      demurrageUsd:      0,
      detentionUsd:      0,
      totalLiabilityUsd: 0,
      alertThresholdUsd: input.alertThresholdUsd ?? null,
      alertFired:        false,
      createdAt:         now,
      updatedAt:         now,
    }
  }

  // Recompute liability
  const liability = computeLiability(record)
  Object.assign(record, liability)

  // Alert check
  if (
    record.alertThresholdUsd !== null &&
    record.totalLiabilityUsd >= record.alertThresholdUsd &&
    !record.alertFired
  ) {
    record.alertFired = true
    _onDDUpdate?.('DD_ALERT', record)
  }

  fs.writeFileSync(file, JSON.stringify(record, null, 2))
  updateIndex(record)
  _onDDUpdate?.('DD_UPDATE', record)

  return record
}

export function getDD(blNumber: string): DDRecord | null {
  const file = ddFile(blNumber)
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) as DDRecord }
  catch { return null }
}

/** Mark all containers as returned → status = CLEARED */
export function clearDD(blNumber: string, returnDate?: string): DDRecord | null {
  const record = getDD(blNumber)
  if (!record) return null
  const rd = returnDate ?? new Date().toISOString().slice(0, 10)
  for (const con of record.containers) {
    if (!con.returnDate) con.returnDate = rd
  }
  record.status    = 'CLEARED'
  record.updatedAt = new Date().toISOString()
  const liability  = computeLiability(record)
  Object.assign(record, liability)
  fs.writeFileSync(ddFile(blNumber), JSON.stringify(record, null, 2))
  updateIndex(record)
  _onDDUpdate?.('DD_CLEARED', record)
  return record
}

/** Refresh all open records' liability (call on schedule or webhook) */
export function refreshAllDD(): DDRecord[] {
  const idx     = loadIndex()
  const records: DDRecord[] = []
  for (const bl of Object.keys(idx)) {
    const record = getDD(bl)
    if (!record || record.status === 'CLEARED') continue
    const liability = computeLiability(record)
    Object.assign(record, liability)
    // Alert check
    if (
      record.alertThresholdUsd !== null &&
      record.totalLiabilityUsd >= record.alertThresholdUsd &&
      !record.alertFired
    ) {
      record.alertFired = true
      _onDDUpdate?.('DD_ALERT', record)
    }
    record.updatedAt = new Date().toISOString()
    fs.writeFileSync(ddFile(bl), JSON.stringify(record, null, 2))
    updateIndex(record)
    records.push(record)
  }
  return records
}

export function listAllDD(): DDRecord[] {
  const idx = loadIndex()
  return Object.keys(idx).map(bl => getDD(bl)).filter(Boolean) as DDRecord[]
}

export function listDDByPort(portCode: string): DDRecord[] {
  const idx = loadIndex()
  return Object.entries(idx)
    .filter(([, e]) => e.portCode === portCode.toUpperCase())
    .map(([bl]) => getDD(bl))
    .filter(Boolean) as DDRecord[]
}

export function getDDAlerts(): DDRecord[] {
  return listAllDD().filter(r => r.status !== 'FREE' && r.status !== 'CLEARED')
}

export function getDDDashboard() {
  const all         = listAllDD()
  const open        = all.filter(r => r.status !== 'CLEARED')
  const totalUsd    = open.reduce((a, r) => a + r.totalLiabilityUsd, 0)
  const demurrage   = open.filter(r => r.status === 'DEMURRAGE' || r.status === 'BOTH')
  const detention   = open.filter(r => r.status === 'DETENTION' || r.status === 'BOTH')
  const atRisk      = open.filter(r => r.alertThresholdUsd !== null && r.totalLiabilityUsd >= r.alertThresholdUsd * 0.8)

  return {
    totalBLs:         all.length,
    openBLs:          open.length,
    clearedBLs:       all.length - open.length,
    totalLiabilityUsd: Math.round(totalUsd * 100) / 100,
    demurrageCount:   demurrage.length,
    detentionCount:   detention.length,
    atRiskCount:      atRisk.length,
    topLiabilities:   open
      .sort((a, b) => b.totalLiabilityUsd - a.totalLiabilityUsd)
      .slice(0, 10)
      .map(r => ({
        blNumber:         r.blNumber,
        portCode:         r.portCode,
        status:           r.status,
        totalLiabilityUsd: r.totalLiabilityUsd,
        containers:       r.containers.length,
      })),
  }
}
