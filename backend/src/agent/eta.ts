/**
 * Mari8X Voyage ETA Tracker
 *
 * Maintains a live ETA registry for vessel voyages.
 * Supports upsert, history tracking, and WebSocket broadcast on change.
 *
 * Storage: /root/.ankr/state/mari8x-eta/
 *   <voyageId>.json   — individual ETA record with history
 *   index.json        — voyageId → { portCode, currentETA, vesselName } lookup
 *
 * © 2026 ANKR Labs — Proprietary
 */

import * as fs   from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const ETA_DIR   = '/root/.ankr/state/mari8x-eta'
const IDX_FILE  = path.join(ETA_DIR, 'index.json')

fs.mkdirSync(ETA_DIR, { recursive: true })

// ── Types ─────────────────────────────────────────────────────────────────────

export type EtaStatus = 'ON_TIME' | 'DELAYED' | 'EARLY' | 'ARRIVED' | 'UNKNOWN'

export interface EtaHistoryEntry {
  eta:       string    // ISO 8601
  source:    string
  updatedAt: string
  delta?:    number    // minutes relative to original ETA (+late, -early)
}

export interface EtaRecord {
  voyageId:    string
  vesselName:  string
  vesselIMO?:  string
  portCode:    string    // UNLOCODE e.g. SGSIN
  portName?:   string
  originalETA: string    // First ETA ever recorded (ISO 8601)
  currentETA:  string    // Latest ETA (ISO 8601)
  status:      EtaStatus
  deltaMins:   number    // currentETA - originalETA in minutes
  source:      string    // 'manual' | 'ais' | 'port' | 'agent'
  remarks?:    string
  history:     EtaHistoryEntry[]
  createdAt:   string
  updatedAt:   string
}

export interface EtaIndexEntry {
  portCode:   string
  vesselName: string
  currentETA: string
  status:     EtaStatus
}

// ── Broadcast callback (wired from main.ts) ───────────────────────────────────

export type EtaBroadcast = (event: string, record: EtaRecord) => void
let _onEtaUpdate: EtaBroadcast | null = null
export const onEtaUpdate: { fn: EtaBroadcast | null } = { fn: null }
export function setEtaBroadcast(fn: EtaBroadcast): void { _onEtaUpdate = fn; onEtaUpdate.fn = fn }

// ── Persistence helpers ───────────────────────────────────────────────────────

function etaFile(voyageId: string): string {
  return path.join(ETA_DIR, `${voyageId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
}

function loadIndex(): Record<string, EtaIndexEntry> {
  try { return JSON.parse(fs.readFileSync(IDX_FILE, 'utf-8')) }
  catch { return {} }
}

function saveIndex(idx: Record<string, EtaIndexEntry>): void {
  fs.writeFileSync(IDX_FILE, JSON.stringify(idx, null, 2))
}

function computeStatus(originalETA: string, currentETA: string): { status: EtaStatus; deltaMins: number } {
  const orig = new Date(originalETA).getTime()
  const curr = new Date(currentETA).getTime()
  if (isNaN(orig) || isNaN(curr)) return { status: 'UNKNOWN', deltaMins: 0 }
  const deltaMins = Math.round((curr - orig) / 60_000)
  if (new Date(currentETA) < new Date()) return { status: 'ARRIVED', deltaMins }
  if (deltaMins >  30) return { status: 'DELAYED', deltaMins }
  if (deltaMins < -30) return { status: 'EARLY',   deltaMins }
  return { status: 'ON_TIME', deltaMins }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Upsert an ETA record.
 * If a record already exists for voyageId, the history is appended and
 * currentETA is updated.  originalETA is never changed after first write.
 */
export function upsertETA(input: {
  voyageId:   string
  vesselName: string
  vesselIMO?: string
  portCode:   string
  portName?:  string
  eta:        string    // ISO 8601 datetime
  source?:    string
  remarks?:   string
}): EtaRecord {
  const now    = new Date().toISOString()
  const source = input.source ?? 'manual'
  const file   = etaFile(input.voyageId)

  let record: EtaRecord
  let isNew = false

  if (fs.existsSync(file)) {
    record = JSON.parse(fs.readFileSync(file, 'utf-8')) as EtaRecord
    // Append history only if ETA actually changed
    if (record.currentETA !== input.eta) {
      const { deltaMins } = computeStatus(record.originalETA, input.eta)
      record.history.push({
        eta:       input.eta,
        source,
        updatedAt: now,
        delta:     deltaMins,
      })
    }
    record.currentETA = input.eta
    record.source     = source
    record.remarks    = input.remarks ?? record.remarks
    record.updatedAt  = now
  } else {
    isNew  = true
    record = {
      voyageId:    input.voyageId,
      vesselName:  input.vesselName,
      vesselIMO:   input.vesselIMO,
      portCode:    input.portCode.toUpperCase(),
      portName:    input.portName,
      originalETA: input.eta,
      currentETA:  input.eta,
      status:      'UNKNOWN',
      deltaMins:   0,
      source,
      remarks:     input.remarks,
      history:     [],
      createdAt:   now,
      updatedAt:   now,
    }
  }

  // Recompute status
  const { status, deltaMins } = computeStatus(record.originalETA, record.currentETA)
  record.status    = status
  record.deltaMins = deltaMins

  fs.writeFileSync(file, JSON.stringify(record, null, 2))

  // Update index
  const idx = loadIndex()
  idx[input.voyageId] = {
    portCode:   record.portCode,
    vesselName: record.vesselName,
    currentETA: record.currentETA,
    status:     record.status,
  }
  saveIndex(idx)

  // Broadcast via WebSocket
  const event = isNew ? 'ETA_NEW' : 'ETA_UPDATE'
  _onEtaUpdate?.(event, record)

  return record
}

export function getETA(voyageId: string): EtaRecord | null {
  const file = etaFile(voyageId)
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) as EtaRecord }
  catch { return null }
}

export function listETAsByPort(portCode: string): EtaRecord[] {
  const idx     = loadIndex()
  const matches = Object.entries(idx)
    .filter(([, e]) => e.portCode === portCode.toUpperCase())
    .map(([voyageId]) => getETA(voyageId))
    .filter(Boolean) as EtaRecord[]
  return matches.sort((a, b) => a.currentETA.localeCompare(b.currentETA))
}

export function listAllETAs(): EtaRecord[] {
  const idx = loadIndex()
  return Object.keys(idx)
    .map(v => getETA(v))
    .filter(Boolean) as EtaRecord[]
}

export function getETADashboard() {
  const records = listAllETAs()
  const now     = new Date()
  const today   = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)

  // Group by port
  const byPort: Record<string, {
    portCode:  string
    vessels:   EtaRecord[]
    today:     number
    tomorrow:  number
    overdue:   number
    delayed:   number
  }> = {}

  for (const r of records) {
    if (!byPort[r.portCode]) {
      byPort[r.portCode] = { portCode: r.portCode, vessels: [], today: 0, tomorrow: 0, overdue: 0, delayed: 0 }
    }
    const g = byPort[r.portCode]
    g.vessels.push(r)
    const etaDate = r.currentETA.slice(0, 10)
    if (etaDate === today)     g.today++
    if (etaDate === tomorrow)  g.tomorrow++
    if (r.status === 'DELAYED') g.delayed++
    if (r.currentETA < now.toISOString() && r.status !== 'ARRIVED') g.overdue++
  }

  return {
    totalVessels: records.length,
    totalPorts:   Object.keys(byPort).length,
    arrivingToday:    records.filter(r => r.currentETA.slice(0, 10) === today).length,
    arrivingTomorrow: records.filter(r => r.currentETA.slice(0, 10) === tomorrow).length,
    delayed:          records.filter(r => r.status === 'DELAYED').length,
    overdue:          records.filter(r => r.currentETA < now.toISOString() && r.status !== 'ARRIVED').length,
    ports: Object.values(byPort).sort((a, b) => b.vessels.length - a.vessels.length),
  }
}

/** Mark a voyage as arrived */
export function markArrived(voyageId: string, remarks?: string): EtaRecord | null {
  const record = getETA(voyageId)
  if (!record) return null
  record.status    = 'ARRIVED'
  record.remarks   = remarks ?? record.remarks
  record.updatedAt = new Date().toISOString()
  fs.writeFileSync(etaFile(voyageId), JSON.stringify(record, null, 2))
  const idx = loadIndex()
  if (idx[voyageId]) { idx[voyageId].status = 'ARRIVED'; saveIndex(idx) }
  _onEtaUpdate?.('ETA_ARRIVED', record)
  return record
}
