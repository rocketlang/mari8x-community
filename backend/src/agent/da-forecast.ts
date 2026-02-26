/**
 * Mari8X Disbursement Account (DA) Cost Forecaster
 *
 * Estimates port call costs (DA) for a given port and vessel particulars.
 * Uses a static tariff matrix based on UNLOCODE region + vessel size.
 *
 * Cost components:
 *   port_dues     — per GRT (or per TEU for container terminals)
 *   pilotage      — fixed entry + per metre of LOA
 *   towage        — per tug × per hour (typically 2 h)
 *   wharfage      — per TEU or per metric tonne
 *   agency_fees   — fixed port-agent fee
 *   misc          — customs, health, security (flat)
 *
 * All figures in USD. Accuracy: ±25% (indicative only).
 */

// ── Tariff matrix ─────────────────────────────────────────────────────────────

interface TariffBand {
  portDuesPerGrt:   number;
  pilotageFixed:    number;
  pilotagePerMetre: number;
  tugHourlyRate:    number;
  tugsRequired:     number;
  wharfagePerTeu:   number;
  wharfagePerTonne: number;
  agencyFee:        number;
  miscFlat:         number;
}

type RegionCode = 'APAC' | 'MENA' | 'EU' | 'AMED' | 'SASC' | 'DEFAULT';

const TARIFFS: Record<RegionCode, TariffBand> = {
  // Asia-Pacific (Singapore, Hong Kong, Shanghai, etc.)
  APAC: {
    portDuesPerGrt:   0.045, pilotageFixed:  800, pilotagePerMetre: 18,
    tugHourlyRate: 1200, tugsRequired: 2,
    wharfagePerTeu: 90, wharfagePerTonne: 4.5,
    agencyFee: 1800, miscFlat: 600,
  },
  // Middle East & North Africa (Jebel Ali, Salalah, etc.)
  MENA: {
    portDuesPerGrt:   0.038, pilotageFixed:  600, pilotagePerMetre: 14,
    tugHourlyRate: 1000, tugsRequired: 2,
    wharfagePerTeu: 75, wharfagePerTonne: 3.8,
    agencyFee: 1500, miscFlat: 500,
  },
  // North Europe (Rotterdam, Hamburg, Antwerp, Felixstowe)
  EU: {
    portDuesPerGrt:   0.055, pilotageFixed: 1200, pilotagePerMetre: 22,
    tugHourlyRate: 1600, tugsRequired: 2,
    wharfagePerTeu: 120, wharfagePerTonne: 6.0,
    agencyFee: 2200, miscFlat: 900,
  },
  // Americas/Mediterranean
  AMED: {
    portDuesPerGrt:   0.050, pilotageFixed: 1000, pilotagePerMetre: 20,
    tugHourlyRate: 1400, tugsRequired: 2,
    wharfagePerTeu: 100, wharfagePerTonne: 5.0,
    agencyFee: 2000, miscFlat: 700,
  },
  // South Asia (INNSA, INMUN, LKCMB)
  SASC: {
    portDuesPerGrt:   0.032, pilotageFixed:  500, pilotagePerMetre: 12,
    tugHourlyRate:  800, tugsRequired: 2,
    wharfagePerTeu: 65,  wharfagePerTonne: 3.2,
    agencyFee: 1200, miscFlat: 400,
  },
  DEFAULT: {
    portDuesPerGrt:   0.040, pilotageFixed:  700, pilotagePerMetre: 16,
    tugHourlyRate: 1100, tugsRequired: 2,
    wharfagePerTeu: 80,  wharfagePerTonne: 4.0,
    agencyFee: 1600, miscFlat: 550,
  },
};

// Map UNLOCODE country prefixes to region
const COUNTRY_REGION: Record<string, RegionCode> = {
  SG: 'APAC', HK: 'APAC', CN: 'APAC', JP: 'APAC', KR: 'APAC', AU: 'APAC', NZ: 'APAC',
  MY: 'APAC', TH: 'APAC', VN: 'APAC', ID: 'APAC', PH: 'APAC', TW: 'APAC',
  AE: 'MENA', SA: 'MENA', OM: 'MENA', EG: 'MENA', QA: 'MENA', BH: 'MENA', KW: 'MENA',
  MA: 'MENA', DZ: 'MENA', TN: 'MENA', LY: 'MENA', JO: 'MENA', IL: 'MENA',
  NL: 'EU', DE: 'EU', BE: 'EU', GB: 'EU', FR: 'EU', DK: 'EU', SE: 'EU',
  NO: 'EU', FI: 'EU', PL: 'EU', LV: 'EU', EE: 'EU', LT: 'EU',
  US: 'AMED', CA: 'AMED', MX: 'AMED', BR: 'AMED', AR: 'AMED', CL: 'AMED',
  ES: 'AMED', IT: 'AMED', GR: 'AMED', PT: 'AMED', TR: 'AMED', CY: 'AMED',
  IN: 'SASC', PK: 'SASC', LK: 'SASC', BD: 'SASC', MM: 'SASC',
};

function regionFor(unlocode: string): RegionCode {
  const cc = unlocode.slice(0, 2).toUpperCase();
  return COUNTRY_REGION[cc] ?? 'DEFAULT';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VesselSpec {
  grt:       number;   // Gross Register Tonnage
  loaMetres: number;   // Length Overall in metres
  teuCapacity?: number; // Container capacity (for wharfage calc)
  cargoTonnes?: number; // Metric tonnes of cargo (alt wharfage calc)
}

export interface DACostBreakdown {
  portDues:    number;
  pilotage:    number;
  towage:      number;
  wharfage:    number;
  agencyFees:  number;
  misc:        number;
  totalUsd:    number;
  currency:    'USD';
  accuracy:    '±25%';
}

export interface DAForecast {
  port: {
    unlocode: string;
    region:   RegionCode;
  };
  vessel:    VesselSpec;
  costs:     DACostBreakdown;
  notes:     string[];
  generatedAt: string;
}

// ── Core ──────────────────────────────────────────────────────────────────────

export function forecastDA(unlocode: string, vessel: VesselSpec): DAForecast {
  const region  = regionFor(unlocode);
  const t       = TARIFFS[region];
  const notes: string[] = [`Region: ${region}`, 'Figures are indicative ±25%'];

  // Port dues
  const portDues = Math.round(vessel.grt * t.portDuesPerGrt);

  // Pilotage
  const pilotage = Math.round(t.pilotageFixed + vessel.loaMetres * t.pilotagePerMetre);

  // Towage — 2 h call
  const towage = Math.round(t.tugsRequired * t.tugHourlyRate * 2);

  // Wharfage — prefer TEU-based if container vessel
  let wharfage = 0;
  if (vessel.teuCapacity && vessel.teuCapacity > 0) {
    wharfage = Math.round(vessel.teuCapacity * t.wharfagePerTeu);
    notes.push('Wharfage: TEU-based');
  } else if (vessel.cargoTonnes && vessel.cargoTonnes > 0) {
    wharfage = Math.round(vessel.cargoTonnes * t.wharfagePerTonne);
    notes.push('Wharfage: cargo-tonne based');
  } else {
    // Estimate from GRT
    wharfage = Math.round(vessel.grt * 0.015);
    notes.push('Wharfage: GRT estimate (no TEU/cargo data)');
  }

  const agencyFees = t.agencyFee;
  const misc       = t.miscFlat;
  const totalUsd   = portDues + pilotage + towage + wharfage + agencyFees + misc;

  return {
    port:        { unlocode: unlocode.toUpperCase(), region },
    vessel,
    costs: {
      portDues, pilotage, towage, wharfage,
      agencyFees, misc, totalUsd,
      currency: 'USD', accuracy: '±25%',
    },
    notes,
    generatedAt: new Date().toISOString(),
  };
}
