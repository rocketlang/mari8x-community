import { useState, useCallback } from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';

// ── Styles ─────────────────────────────────────────────────────────────────────
const css = `
  :root {
    --bg: #0A0C10; --canvas: #10121A; --card: #14172
    0; --border: #1E2130;
    --orange: #FF6B00; --orange-lt: #FF8C38;
    --green: #22C55E; --yellow: #F59E0B; --red: #EF4444; --blue: #3B82F6;
    --text: #E2E4F0; --muted: #7A7D9A;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text);
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         font-size: 14px; min-height: 100vh; }
  button { cursor: pointer; border: none; background: none; color: inherit; font: inherit; }
  input, select { font: inherit; }

  .app { display: flex; flex-direction: column; min-height: 100vh; }

  /* Header */
  .header { background: var(--canvas); border-bottom: 1px solid var(--border);
             padding: 0 24px; height: 56px; display: flex; align-items: center;
             gap: 16px; position: sticky; top: 0; z-index: 50; }
  .logo { font-size: 18px; font-weight: 900; color: var(--orange); white-space: nowrap; }
  .logo span { color: var(--text); }
  .port-select { background: var(--card); border: 1px solid var(--border); color: var(--text);
                  padding: 6px 12px; border-radius: 6px; font-size: 13px; }
  .window-select { background: var(--card); border: 1px solid var(--border); color: var(--text);
                    padding: 6px 12px; border-radius: 6px; font-size: 13px; width: 100px; }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .badge-live { background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3);
                 color: var(--green); padding: 3px 10px; border-radius: 99px; font-size: 11px;
                 font-weight: 700; display: flex; align-items: center; gap: 5px; }
  .dot-pulse { width: 6px; height: 6px; background: var(--green); border-radius: 50%;
                animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* Tabs */
  .tabs { background: var(--canvas); border-bottom: 1px solid var(--border);
           padding: 0 24px; display: flex; gap: 2px; }
  .tab { padding: 12px 20px; font-size: 13px; font-weight: 600; color: var(--muted);
          cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--orange); border-color: var(--orange); }

  /* Main content */
  .content { flex: 1; padding: 24px; max-width: 1200px; margin: 0 auto; width: 100%; }

  /* Cards */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border);
                  display: flex; align-items: center; justify-content: space-between; }
  .card-title { font-size: 14px; font-weight: 700; }
  .card-body { padding: 16px 20px; }

  /* Stat row */
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
                padding: 16px 18px; }
  .stat-num { font-size: 28px; font-weight: 900; color: var(--orange); }
  .stat-lbl { font-size: 11px; color: var(--muted); margin-top: 3px; }

  /* Vessel list */
  .vessel-list { display: flex; flex-direction: column; gap: 8px; }
  .vessel-row { background: var(--card); border: 1px solid var(--border); border-radius: 8px;
                 padding: 14px 16px; display: flex; align-items: center; gap: 14px; }
  .vessel-row:hover { border-color: rgba(255,107,0,.3); }
  .vessel-icon { font-size: 20px; width: 32px; text-align: center; }
  .vessel-main { flex: 1; min-width: 0; }
  .vessel-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vessel-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .vessel-right { text-align: right; flex-shrink: 0; }
  .vessel-eta { font-size: 13px; font-weight: 700; }
  .vessel-dist { font-size: 11px; color: var(--muted); }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  .badge-green { background: rgba(34,197,94,.15); color: var(--green); border: 1px solid rgba(34,197,94,.25); }
  .badge-yellow { background: rgba(245,158,11,.15); color: var(--yellow); border: 1px solid rgba(245,158,11,.25); }
  .badge-red { background: rgba(239,68,68,.15); color: var(--red); border: 1px solid rgba(239,68,68,.25); }
  .badge-blue { background: rgba(59,130,246,.15); color: var(--blue); border: 1px solid rgba(59,130,246,.25); }
  .badge-orange { background: rgba(255,107,0,.15); color: var(--orange); border: 1px solid rgba(255,107,0,.25); }
  .badge-muted { background: rgba(122,125,154,.15); color: var(--muted); border: 1px solid var(--border); }

  /* Document table */
  .doc-table { width: 100%; border-collapse: collapse; }
  .doc-table th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700;
                   color: var(--muted); text-transform: uppercase; letter-spacing: .5px;
                   border-bottom: 1px solid var(--border); }
  .doc-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--border); }
  .doc-table tr:last-child td { border-bottom: none; }
  .doc-table tr:hover td { background: rgba(255,255,255,.02); }

  /* DA Forecast */
  .da-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .form-group label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 5px;
                       font-weight: 600; letter-spacing: .3px; }
  .form-group input, .form-group select {
    width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
    padding: 8px 12px; border-radius: 6px; font-size: 13px; }
  .form-group input:focus, .form-group select:focus {
    outline: none; border-color: var(--orange); }
  .btn-run { background: var(--orange); color: white; padding: 10px 24px; border-radius: 7px;
              font-size: 14px; font-weight: 700; transition: background .15s; }
  .btn-run:hover { background: var(--orange-lt); }
  .btn-run:disabled { opacity: .5; cursor: not-allowed; }
  .cost-table { width: 100%; border-collapse: collapse; }
  .cost-table td { padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .cost-table tr:last-child td { border-bottom: none; font-weight: 700; font-size: 15px; }
  .cost-table td:last-child { text-align: right; font-weight: 600; }

  /* Alerts */
  .alert-row { background: var(--card); border: 1px solid var(--border); border-radius: 8px;
                padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .alert-row.acked { opacity: .45; }
  .alert-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .alert-body { flex: 1; min-width: 0; }
  .alert-msg { font-size: 13px; font-weight: 600; }
  .alert-meta { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .btn-ack { background: rgba(34,197,94,.1); color: var(--green); border: 1px solid rgba(34,197,94,.3);
              padding: 4px 12px; border-radius: 5px; font-size: 12px; font-weight: 600;
              transition: background .15s; flex-shrink: 0; }
  .btn-ack:hover { background: rgba(34,197,94,.2); }

  /* Empty state */
  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 36px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: var(--text); }

  /* Spinner */
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border);
              border-top-color: var(--orange); border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading { display: flex; justify-content: center; align-items: center; gap: 10px;
              padding: 60px; color: var(--muted); }

  /* Congestion level indicator */
  .cong-bar { display: flex; align-items: center; gap: 8px; }
  .cong-pip { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  @media(max-width: 768px) {
    .stat-row { grid-template-columns: repeat(2, 1fr); }
    .da-form { grid-template-columns: 1fr 1fr; }
    .header { padding: 0 12px; }
    .content { padding: 12px; }
  }
`;

// ── GQL Queries ───────────────────────────────────────────────────────────────

const Q_DASHBOARD = gql`
  query Dashboard($portCode: String!, $window: Int, $grt: Float, $loa: Float, $teu: Int) {
    portDashboard(portCode: $portCode, window: $window, grt: $grt, loa: $loa, teu: $teu) {
      port
      generatedAt
      congestion
      preArrival
      documents
      daForecast
    }
  }
`;

const Q_ALERTS = gql`
  query Alerts($portCode: String!, $includeAcknowledged: Boolean) {
    portAlerts(portCode: $portCode, includeAcknowledged: $includeAcknowledged) {
      id ts portCode type severity imo vesselName message acknowledged
    }
  }
`;

const M_EVAL_ALERTS = gql`
  mutation EvalAlerts($portCode: String!) {
    evaluatePortAlerts(portCode: $portCode) {
      id type severity imo vesselName message acknowledged
    }
  }
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTS = [
  { code: 'SGSIN', name: 'Singapore' },
  { code: 'NLRTM', name: 'Rotterdam' },
  { code: 'CNSHA', name: 'Shanghai' },
  { code: 'AEJEA', name: 'Jebel Ali' },
  { code: 'INMUN', name: 'Mundra' },
  { code: 'INPAV', name: 'Pipavav' },
  { code: 'INPNQ', name: 'Pune/JNPT' },
  { code: 'GBFXT', name: 'Felixstowe' },
  { code: 'USNYC', name: 'New York' },
  { code: 'DEHAM', name: 'Hamburg' },
];

const VESSEL_ICONS: Record<string, string> = {
  CONTAINER: '🚢',
  TANKER: '🛢️',
  BULK_CARRIER: '⚓',
  CRUISE: '🛳️',
  RO_RO: '🚗',
  GAS_CARRIER: '💨',
  GENERAL_CARGO: '📦',
};

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'badge-red',
  HIGH: 'badge-orange',
  MEDIUM: 'badge-yellow',
  LOW: 'badge-blue',
};

const CONG_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  moderate: '#3B82F6',
  low: '#22C55E',
  normal: '#7A7D9A',
};

function confidenceBadge(c: string) {
  if (c === 'high') return <span className="badge badge-green">High</span>;
  if (c === 'medium') return <span className="badge badge-yellow">Med</span>;
  return <span className="badge badge-muted">Low</span>;
}

function etaLabel(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// ── Tab: Arrivals ─────────────────────────────────────────────────────────────

function ArrivalsTab({ portCode, windowHours }: { portCode: string; windowHours: number }) {
  const { data, loading, error } = useQuery(Q_DASHBOARD, {
    variables: { portCode, window: windowHours, grt: 50000, loa: 250, teu: 4000 },
    fetchPolicy: 'cache-and-network',
  });

  if (loading) return <div className="loading"><div className="spinner" /> Loading arrivals…</div>;
  if (error) return <div className="empty"><div className="empty-icon">⚠️</div><div className="empty-title">Could not load data</div><p>{error.message}</p></div>;

  const dash = data?.portDashboard;
  if (!dash) return <div className="empty"><div className="empty-icon">🔌</div><div className="empty-title">No data for {portCode}</div></div>;

  const port = dash.port as any;
  const cong = dash.congestion as any;
  const pre  = dash.preArrival as any;
  const vessels: any[] = pre?.vessels ?? [];
  const docs = dash.documents as any;
  const da   = dash.daForecast as any;

  return (
    <>
      {/* Stats */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-num">{vessels.length}</div>
          <div className="stat-lbl">Inbound vessels ({windowHours}h window)</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: CONG_COLORS[cong?.level ?? 'normal'] ?? 'var(--muted)' }}>
            {cong?.level?.toUpperCase() ?? '—'}
          </div>
          <div className="stat-lbl">Congestion · {cong?.score?.toFixed(0) ?? '—'}/100</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{docs?.openVoyages ?? '—'}</div>
          <div className="stat-lbl">Open doc checklists</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">${da?.totalUSD?.toLocaleString() ?? '—'}</div>
          <div className="stat-lbl">Est. DA (50K GRT, 250m)</div>
        </div>
      </div>

      {/* Vessel list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pre-Arrival Vessels — {port?.name ?? portCode}</span>
          <span className="badge badge-muted">Updated {new Date(pre?.generatedAt ?? dash.generatedAt).toLocaleTimeString()}</span>
        </div>
        <div className="card-body">
          {vessels.length === 0
            ? <div className="empty"><div className="empty-icon">🔭</div><div className="empty-title">No vessels in window</div><p>No AIS targets within {windowHours}h window for {portCode}</p></div>
            : <div className="vessel-list">
                {vessels.map((v: any) => (
                  <div className="vessel-row" key={v.imo}>
                    <div className="vessel-icon">{VESSEL_ICONS[v.type] ?? '🚢'}</div>
                    <div className="vessel-main">
                      <div className="vessel-name">{v.name}</div>
                      <div className="vessel-meta">IMO {v.imo} · {v.type?.replace('_', ' ')} · {v.flag ?? 'Unknown flag'} · {v.speed?.toFixed(1)} kts / {v.heading}°</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {confidenceBadge(v.confidence)}
                    </div>
                    <div className="vessel-right">
                      <div className="vessel-eta">{etaLabel(v.etaHours)}</div>
                      <div className="vessel-dist">{v.distanceNM?.toFixed(0)} nm</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </>
  );
}

// ── Tab: Documents ────────────────────────────────────────────────────────────

function DocumentsTab({ portCode }: { portCode: string }) {
  const API = import.meta.env.VITE_API_BASE || 'http://localhost:4001';
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/api/agent/documents`)
      .then(r => r.json())
      .then(d => { setChecklists(d.checklists ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [API]);

  if (!loaded) {
    load();
    return <div className="loading"><div className="spinner" /> Loading checklists…</div>;
  }

  const portChecklists = checklists.filter((c: any) => !portCode || c.portCode === portCode || true);

  if (portChecklists.length === 0) {
    return <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No open checklists</div><p>Document checklists are created when a vessel pre-arrival is registered</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {portChecklists.map((cl: any) => {
        const docs: any[] = cl.documents ?? [];
        const overdue = docs.filter((d: any) => d.overdue).length;
        const ready   = docs.filter((d: any) => d.status === 'submitted' || d.status === 'verified').length;
        return (
          <div className="card" key={cl.voyageId}>
            <div className="card-header">
              <div>
                <span className="card-title">{cl.vesselName}</span>
                <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                  Voyage {cl.voyageId} · Port {cl.portCode}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {overdue > 0 && <span className="badge badge-red">{overdue} OVERDUE</span>}
                <span className="badge badge-muted">{ready}/{docs.length} ready</span>
                <span className="badge badge-muted">{cl.readinessPct?.toFixed(0)}%</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Due (h before ETA)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc: any) => (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 600 }}>{doc.name}</td>
                      <td><span className="badge badge-muted">{doc.category}</span></td>
                      <td style={{ color: 'var(--muted)' }}>{doc.dueHoursBefore}h</td>
                      <td>
                        {doc.overdue
                          ? <span className="badge badge-red">OVERDUE</span>
                          : doc.status === 'verified'
                            ? <span className="badge badge-green">VERIFIED</span>
                            : doc.status === 'submitted'
                              ? <span className="badge badge-blue">SUBMITTED</span>
                              : doc.status === 'rejected'
                                ? <span className="badge badge-red">REJECTED</span>
                                : <span className="badge badge-muted">PENDING</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: DA Forecast ──────────────────────────────────────────────────────────

function DAForecastTab() {
  const API = import.meta.env.VITE_API_BASE || 'http://localhost:4001';
  const [form, setForm] = useState({ port: 'SGSIN', grt: '50000', loa: '250', teu: '4000', cargoTonnes: '' });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${API}/api/agent/da-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          port: form.port,
          vessel: {
            grt: Number(form.grt),
            loaMetres: Number(form.loa),
            teuCapacity: form.teu ? Number(form.teu) : undefined,
            cargoTonnes: form.cargoTonnes ? Number(form.cargoTonnes) : undefined,
          }
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d);
    } catch (e: any) {
      setErr(e.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const COST_LABELS: Record<string, string> = {
    portDues: 'Port Dues (GRT/TEU based)',
    pilotage: 'Pilotage',
    towage: 'Towage',
    wharfage: 'Wharfage',
    agencyFees: 'Agency Fees',
    miscellaneous: 'Misc. (Customs, Security, Health)',
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Disbursement Account Estimator</span></div>
        <div className="card-body">
          <div className="da-form">
            <div className="form-group">
              <label>Port (UNLOCODE)</label>
              <select className="port-select" style={{ width: '100%' }}
                value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))}>
                {PORTS.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Gross Registered Tonnage (GRT)</label>
              <input type="number" value={form.grt} onChange={e => setForm(f => ({ ...f, grt: e.target.value }))} placeholder="50000" />
            </div>
            <div className="form-group">
              <label>Length Overall (metres)</label>
              <input type="number" value={form.loa} onChange={e => setForm(f => ({ ...f, loa: e.target.value }))} placeholder="250" />
            </div>
            <div className="form-group">
              <label>TEU Capacity (optional)</label>
              <input type="number" value={form.teu} onChange={e => setForm(f => ({ ...f, teu: e.target.value }))} placeholder="4000" />
            </div>
            <div className="form-group">
              <label>Cargo Tonnes (optional)</label>
              <input type="number" value={form.cargoTonnes} onChange={e => setForm(f => ({ ...f, cargoTonnes: e.target.value }))} placeholder="—" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn-run" onClick={run} disabled={loading}>
                {loading ? 'Calculating…' : 'Calculate DA →'}
              </button>
            </div>
          </div>
          {err && <p style={{ color: 'var(--red)', fontSize: 13 }}>{err}</p>}
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">DA Estimate — {result.port} ({result.region})</span>
            <span className="badge badge-muted">±25% accuracy</span>
          </div>
          <div className="card-body">
            <table className="cost-table">
              <tbody>
                {Object.entries(result.breakdown ?? {}).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: 'var(--muted)' }}>{COST_LABELS[k] ?? k}</td>
                    <td>${(v as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
                <tr>
                  <td>TOTAL ESTIMATED DA</td>
                  <td style={{ color: 'var(--orange)', fontSize: 20 }}>
                    ${result.totalUSD?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
            {result.notes && (
              <div style={{ marginTop: 14, padding: 12, background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {result.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab: Alerts ───────────────────────────────────────────────────────────────

function AlertsTab({ portCode }: { portCode: string }) {
  const [showAcked, setShowAcked] = useState(false);
  const { data, loading, error, refetch } = useQuery(Q_ALERTS, {
    variables: { portCode, includeAcknowledged: showAcked },
    fetchPolicy: 'cache-and-network',
  });
  const [evalAlerts, { loading: evalLoading }] = useMutation(M_EVAL_ALERTS, {
    onCompleted: () => refetch(),
  });

  const API = import.meta.env.VITE_API_BASE || 'http://localhost:4001';

  const ack = async (alertId: string) => {
    await fetch(`${API}/api/agent/alerts/${portCode}/${alertId}/ack`, { method: 'POST' });
    refetch();
  };

  const ALERT_ICONS: Record<string, string> = {
    ETA_IMMINENT: '⏱️',
    DG_INBOUND: '⚠️',
    DOC_OVERDUE: '📋',
    HIGH_CONGESTION: '🔴',
  };

  if (loading) return <div className="loading"><div className="spinner" /> Loading alerts…</div>;
  if (error) return <div className="empty"><div className="empty-icon">⚠️</div><div className="empty-title">Error loading alerts</div><p>{error.message}</p></div>;

  const alerts: any[] = data?.portAlerts ?? [];
  const active = alerts.filter((a: any) => !a.acknowledged);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{active.length} active alert{active.length !== 1 ? 's' : ''}</span>
        <button className="btn-run" style={{ marginLeft: 'auto' }}
          onClick={() => evalAlerts({ variables: { portCode } })} disabled={evalLoading}>
          {evalLoading ? 'Evaluating…' : '↻ Evaluate Alerts'}
        </button>
        <button className="badge badge-muted" style={{ cursor: 'pointer' }}
          onClick={() => setShowAcked(s => !s)}>
          {showAcked ? 'Hide acknowledged' : 'Show all'}
        </button>
      </div>

      {alerts.length === 0
        ? <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">No active alerts</div><p>All clear for {portCode}. Click "Evaluate Alerts" to re-check.</p></div>
        : alerts.map((a: any) => (
            <div className={`alert-row${a.acknowledged ? ' acked' : ''}`} key={a.id}>
              <div className="alert-icon">{ALERT_ICONS[a.type] ?? '🔔'}</div>
              <div className="alert-body">
                <div className="alert-msg">{a.message}</div>
                <div className="alert-meta">
                  {a.vesselName} (IMO {a.imo}) ·
                  <span className={`badge ${SEV_COLORS[a.severity] ?? 'badge-muted'}`} style={{ margin: '0 6px' }}>{a.severity}</span>
                  · {a.type} · {new Date(a.ts).toLocaleTimeString()}
                </div>
              </div>
              {!a.acknowledged && (
                <button className="btn-ack" onClick={() => ack(a.id)}>Acknowledge</button>
              )}
            </div>
          ))
      }
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'arrivals',  label: '🚢 Arrivals'   },
  { id: 'documents', label: '📋 Documents'  },
  { id: 'da',        label: '💰 DA Forecast' },
  { id: 'alerts',    label: '🔔 Alerts'     },
];

export default function App() {
  const [portCode, setPortCode] = useState('SGSIN');
  const [windowHours, setWindowHours] = useState(48);
  const [tab, setTab] = useState('arrivals');

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <span className="logo">Mari8X <span>Agent Wedge</span></span>
          <select className="port-select" value={portCode} onChange={e => setPortCode(e.target.value)}>
            {PORTS.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
          </select>
          <select className="window-select" value={windowHours} onChange={e => setWindowHours(Number(e.target.value))}>
            <option value={12}>12h window</option>
            <option value={24}>24h window</option>
            <option value={48}>48h window</option>
            <option value={72}>72h window</option>
          </select>
          <div className="header-right">
            <span className="badge-live"><span className="dot-pulse" />Live</span>
          </div>
        </header>

        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <main className="content">
          {tab === 'arrivals'  && <ArrivalsTab portCode={portCode} windowHours={windowHours} />}
          {tab === 'documents' && <DocumentsTab portCode={portCode} />}
          {tab === 'da'        && <DAForecastTab />}
          {tab === 'alerts'    && <AlertsTab portCode={portCode} />}
        </main>
      </div>
    </>
  );
}
