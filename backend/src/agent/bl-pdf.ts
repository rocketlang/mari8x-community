/**
 * Mari8X Bill of Lading — PDF Renderer
 *
 * Generates a professionally formatted PDF for a Bill of Lading.
 * Uses PDFKit (pure-JS, no external binary dependency).
 *
 * Output: Buffer  (suitable for HTTP response as application/pdf)
 *
 * © 2026 ANKR Labs — Proprietary
 */

import PDFDocument from 'pdfkit';
import type { BillOfLading } from './bl.js';

// ── Palette ───────────────────────────────────────────────────────────────────

const C_NAVY   = '#0D2B45';
const C_TEAL   = '#1A7A8A';
const C_LIGHT  = '#F0F6FA';
const C_GRAY   = '#6B7A8A';
const C_BLACK  = '#111111';
const C_WHITE  = '#FFFFFF';
const C_BORDER = '#C8D6E0';

// ── Layout constants ──────────────────────────────────────────────────────────

const PW = 595.28;   // A4 width  (pt)
const PH = 841.89;   // A4 height (pt)
const M  = 36;       // page margin

// ── Helper: draw a key-value pair inside a box ─────────────────────────────────

function kvRow(
  doc:   PDFKit.PDFDocument,
  x:     number,
  y:     number,
  w:     number,
  label: string,
  value: string,
  opts?: { bold?: boolean; labelW?: number }
): void {
  const labelW = opts?.labelW ?? 120;
  const valW   = w - labelW - 8;

  doc.fontSize(7.5).fillColor(C_GRAY).font('Helvetica').text(label, x + 4, y + 4, { width: labelW });
  doc.fontSize(8.5)
     .fillColor(C_BLACK)
     .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
     .text(value || '—', x + labelW + 4, y + 4, { width: valW, lineBreak: false });
}

/** One bordered cell in a row. Returns new x (after the cell). */
function cell(
  doc:      PDFKit.PDFDocument,
  x:        number,
  y:        number,
  w:        number,
  h:        number,
  text:     string,
  opts?: { header?: boolean; center?: boolean; fs?: number }
): number {
  doc.rect(x, y, w, h).strokeColor(C_BORDER).lineWidth(0.4).stroke();

  if (opts?.header) {
    doc.rect(x, y, w, h).fillColor(C_NAVY).fill();
    doc.fillColor(C_WHITE).fontSize(opts?.fs ?? 7.5)
       .font('Helvetica-Bold')
       .text(text, x + 3, y + (h - (opts?.fs ?? 7.5)) / 2 + 1, {
         width:  w - 6,
         align:  opts?.center ? 'center' : 'left',
         lineBreak: false,
       });
  } else {
    doc.fillColor(C_BLACK).fontSize(opts?.fs ?? 8.5)
       .font('Helvetica')
       .text(text, x + 3, y + (h - 8.5) / 2 + 1, {
         width:     w - 6,
         align:     opts?.center ? 'center' : 'left',
         lineBreak: false,
       });
  }
  return x + w;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateBLPdf(bl: BillOfLading): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  ()         => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header bar ────────────────────────────────────────────────────────────

    doc.rect(0, 0, PW, 70).fillColor(C_NAVY).fill();

    // Branding
    doc.fillColor(C_WHITE).fontSize(18).font('Helvetica-Bold').text('MARI8X', M, 16);
    doc.fillColor(C_TEAL).fontSize(8).font('Helvetica').text('Community Edition · Bill of Lading', M, 37);

    // BL number badge
    const badgeW = 170;
    doc.rect(PW - M - badgeW, 12, badgeW, 22).fillColor(C_TEAL).fill();
    doc.fillColor(C_WHITE).fontSize(12).font('Helvetica-Bold')
       .text(bl.blNumber, PW - M - badgeW + 6, 17, { width: badgeW - 12, align: 'center' });

    // Status badge
    const statusColors: Record<string, string> = {
      DRAFT:       '#F0AD4E',
      ISSUED:      '#5CB85C',
      SURRENDERED: '#5BC0DE',
      RELEASED:    '#6C757D',
    };
    const sc = statusColors[bl.status] ?? C_TEAL;
    doc.rect(PW - M - badgeW, 38, badgeW, 18).fillColor(sc).fill();
    doc.fillColor(C_WHITE).fontSize(9).font('Helvetica-Bold')
       .text(`${bl.status}  ·  ${bl.releaseType}`, PW - M - badgeW + 4, 43, {
         width: badgeW - 8, align: 'center',
       });

    // ── Party boxes: Shipper / Consignee / Notify Party ───────────────────────

    let y = 80;
    const ROW_H = 60;
    const COL1  = M;
    const COL2  = M + 175;
    const COL3  = M + 350;
    const BOX_W = 165;

    for (const [label, value] of [
      ['SHIPPER',        bl.shipper],
      ['CONSIGNEE',      bl.consignee],
      ['NOTIFY PARTY',   bl.notifyParty ?? '—'],
    ] as const) {
      const xPos = label === 'SHIPPER' ? COL1 : label === 'CONSIGNEE' ? COL2 : COL3;
      doc.rect(xPos, y, BOX_W, ROW_H).fillColor(C_LIGHT).fill();
      doc.rect(xPos, y, BOX_W, ROW_H).strokeColor(C_BORDER).lineWidth(0.4).stroke();
      doc.rect(xPos, y, BOX_W, 13).fillColor(C_TEAL).fill();
      doc.fillColor(C_WHITE).fontSize(7).font('Helvetica-Bold')
         .text(label, xPos + 4, y + 3, { width: BOX_W - 8 });
      doc.fillColor(C_BLACK).fontSize(8).font('Helvetica')
         .text(value, xPos + 4, y + 17, { width: BOX_W - 8, height: ROW_H - 19, ellipsis: true });
    }

    y += ROW_H + 8;

    // ── Voyage section ────────────────────────────────────────────────────────

    doc.rect(M, y, PW - 2 * M, 14).fillColor(C_NAVY).fill();
    doc.fillColor(C_WHITE).fontSize(8).font('Helvetica-Bold').text('VOYAGE DETAILS', M + 4, y + 3);
    y += 14;

    const voyW  = (PW - 2 * M) / 4;
    for (const [label, value] of [
      ['VESSEL',              bl.vesselName],
      ['VOYAGE NO.',          bl.voyageNumber],
      ['PORT OF LOADING',     bl.portOfLoading],
      ['PORT OF DISCHARGE',   bl.portOfDischarge],
    ] as const) {
      // Nothing — will draw in table row below
      void label; void value;
    }

    let vx = M;
    for (const [label, value] of [
      ['VESSEL',            bl.vesselName],
      ['VOYAGE NO.',        bl.voyageNumber],
      ['PORT OF LOADING',   bl.portOfLoading],
      ['PORT OF DISCHARGE', bl.portOfDischarge],
    ] as const) {
      doc.rect(vx, y, voyW, 26).fillColor(C_LIGHT).fill();
      doc.rect(vx, y, voyW, 26).strokeColor(C_BORDER).lineWidth(0.4).stroke();
      doc.fillColor(C_GRAY).fontSize(7).font('Helvetica').text(label, vx + 3, y + 3);
      doc.fillColor(C_BLACK).fontSize(9).font('Helvetica-Bold').text(value, vx + 3, y + 13, { width: voyW - 6, lineBreak: false });
      vx += voyW;
    }
    y += 26;

    // Place of Receipt / Place of Delivery (optional)
    if (bl.placeOfReceipt || bl.placeOfDelivery) {
      const halfW = (PW - 2 * M) / 2;
      doc.rect(M,         y, halfW, 20).fillColor(C_LIGHT).fill();
      doc.rect(M,         y, halfW, 20).strokeColor(C_BORDER).lineWidth(0.4).stroke();
      doc.rect(M + halfW, y, halfW, 20).fillColor(C_LIGHT).fill();
      doc.rect(M + halfW, y, halfW, 20).strokeColor(C_BORDER).lineWidth(0.4).stroke();

      doc.fillColor(C_GRAY).fontSize(7).font('Helvetica').text('PLACE OF RECEIPT', M + 3, y + 3);
      doc.fillColor(C_BLACK).fontSize(8).font('Helvetica').text(bl.placeOfReceipt ?? '—', M + 3, y + 11);
      doc.fillColor(C_GRAY).fontSize(7).font('Helvetica').text('PLACE OF DELIVERY', M + halfW + 3, y + 3);
      doc.fillColor(C_BLACK).fontSize(8).font('Helvetica').text(bl.placeOfDelivery ?? '—', M + halfW + 3, y + 11);
      y += 20;
    }

    y += 6;

    // ── Cargo table ───────────────────────────────────────────────────────────

    doc.rect(M, y, PW - 2 * M, 13).fillColor(C_NAVY).fill();
    doc.fillColor(C_WHITE).fontSize(8).font('Helvetica-Bold').text('CARGO DESCRIPTION', M + 4, y + 3);
    y += 13;

    // Header row
    const TH = 16;
    const cols = [
      { label: 'CONTAINER NO.',   w: 110 },
      { label: 'ISO TYPE',        w: 60  },
      { label: 'SEAL NO.',        w: 70  },
      { label: 'GROSS WT (KG)',   w: 80  },
    ];
    let tx = M;
    for (const c of cols) {
      cell(doc, tx, y, c.w, TH, c.label, { header: true, center: true });
      tx += c.w;
    }

    // Cargo summary column (spans full height)
    const cargoCols = cols.reduce((a, c) => a + c.w, 0);
    const cargoX    = M + cargoCols;
    const cargoW    = PW - 2 * M - cargoCols;
    doc.rect(cargoX, y, cargoW, TH).fillColor(C_NAVY).fill();
    doc.rect(cargoX, y, cargoW, TH).strokeColor(C_BORDER).lineWidth(0.4).stroke();
    doc.fillColor(C_WHITE).fontSize(7.5).font('Helvetica-Bold')
       .text('COMMODITY / DESCRIPTION', cargoX + 3, y + 4, { width: cargoW - 6 });
    y += TH;

    // Container rows
    const containers = bl.containers.length > 0 ? bl.containers : [
      { containerNumber: '—', isoType: '—', sealNumber: undefined, grossWeightKg: undefined },
    ];
    const ROW = 16;
    for (let i = 0; i < containers.length; i++) {
      const con  = containers[i];
      const rowY = y + i * ROW;
      const bg   = i % 2 === 0 ? C_WHITE : C_LIGHT;
      tx = M;
      for (const [text, w] of [
        [con.containerNumber,              cols[0].w],
        [con.isoType,                      cols[1].w],
        [con.sealNumber ?? '—',            cols[2].w],
        [con.grossWeightKg != null ? String(con.grossWeightKg) : '—', cols[3].w],
      ] as [string, number][]) {
        doc.rect(tx, rowY, w, ROW).fillColor(bg).fill();
        doc.rect(tx, rowY, w, ROW).strokeColor(C_BORDER).lineWidth(0.4).stroke();
        doc.fillColor(C_BLACK).fontSize(8).font('Helvetica').text(text, tx + 3, rowY + 4, { width: w - 6, lineBreak: false });
        tx += w;
      }
      if (i === 0) {
        // Commodity spans all container rows
        const totalH = containers.length * ROW;
        doc.rect(cargoX, y, cargoW, totalH).fillColor(C_LIGHT).fill();
        doc.rect(cargoX, y, cargoW, totalH).strokeColor(C_BORDER).lineWidth(0.4).stroke();
        doc.fillColor(C_BLACK).fontSize(8.5).font('Helvetica')
           .text(
             `${bl.commodity}\n\n${bl.packages} ${bl.packageUnit}\nGross Wt: ${bl.grossWeightKg.toLocaleString()} KG` +
               (bl.measurementCbm ? `\nMeasurement: ${bl.measurementCbm} CBM` : '') +
               (bl.marksAndNumbers ? `\n\nMarks: ${bl.marksAndNumbers}` : ''),
             cargoX + 4, y + 4,
             { width: cargoW - 8, height: totalH - 8, ellipsis: true }
           );
      }
    }
    y += containers.length * ROW + 6;

    // ── Freight / Terms row ───────────────────────────────────────────────────

    doc.rect(M, y, PW - 2 * M, 13).fillColor(C_NAVY).fill();
    doc.fillColor(C_WHITE).fontSize(8).font('Helvetica-Bold').text('FREIGHT & TERMS', M + 4, y + 3);
    y += 13;

    const HW = (PW - 2 * M) / 3;
    for (const [label, value, x] of [
      ['FREIGHT PAYABLE', bl.freightPayable, M],
      ['AMOUNT',          bl.freightAmount != null ? `${bl.currency} ${bl.freightAmount.toLocaleString()}` : '—', M + HW],
      ['PLACE OF ISSUE',  bl.placeOfIssue ?? '—', M + HW * 2],
    ] as const) {
      doc.rect(x, y, HW, 22).fillColor(C_LIGHT).fill();
      doc.rect(x, y, HW, 22).strokeColor(C_BORDER).lineWidth(0.4).stroke();
      doc.fillColor(C_GRAY).fontSize(7).font('Helvetica').text(label, x + 3, y + 3);
      doc.fillColor(C_BLACK).fontSize(9).font('Helvetica-Bold').text(value, x + 3, y + 12, { width: HW - 6, lineBreak: false });
    }
    y += 22 + 6;

    // ── Amendments (if any) ────────────────────────────────────────────────────

    if (bl.amendments.length > 0) {
      doc.rect(M, y, PW - 2 * M, 13).fillColor('#4A4A4A').fill();
      doc.fillColor(C_WHITE).fontSize(8).font('Helvetica-Bold')
         .text(`AMENDMENTS (${bl.amendments.length})`, M + 4, y + 3);
      y += 13;

      for (let ai = 0; ai < bl.amendments.length; ai++) {
        const amend = bl.amendments[ai];
        const rowBg = ai % 2 === 0 ? C_WHITE : C_LIGHT;
        doc.rect(M, y, PW - 2 * M, 20).fillColor(rowBg).fill();
        doc.rect(M, y, PW - 2 * M, 20).strokeColor(C_BORDER).lineWidth(0.4).stroke();
        doc.fillColor(C_GRAY).fontSize(7).font('Helvetica')
           .text(`Amendment #${amend.amendmentNo} · ${amend.field} · by ${amend.amendedBy} · ${amend.amendedAt.slice(0, 10)}`,
             M + 4, y + 3, { width: PW - 2 * M - 8 });
        doc.fillColor(C_BLACK).fontSize(8).font('Helvetica')
           .text(`${amend.oldValue}  →  ${amend.newValue}  |  Reason: ${amend.reason}`,
             M + 4, y + 11, { width: PW - 2 * M - 8, lineBreak: false });
        y += 20;
      }
      y += 4;
    }

    // ── Signature / Stamp section ─────────────────────────────────────────────

    const sigY     = Math.max(y + 10, PH - 130);
    const sigBoxW  = (PW - 2 * M) / 3;
    const sigBoxH  = 60;

    for (const [idx, label] of [
      [0, 'ISSUED BY / CARRIER'],
      [1, 'SHIPPER SIGNATURE'],
      [2, 'AUTHORISED SIGNATORY'],
    ] as [number, string][]) {
      const sx = M + idx * sigBoxW;
      doc.rect(sx, sigY, sigBoxW, sigBoxH).fillColor(C_LIGHT).fill();
      doc.rect(sx, sigY, sigBoxW, sigBoxH).strokeColor(C_BORDER).lineWidth(0.4).stroke();
      doc.rect(sx, sigY, sigBoxW, 13).fillColor(C_TEAL).fill();
      doc.fillColor(C_WHITE).fontSize(7).font('Helvetica-Bold')
         .text(label, sx + 4, sigY + 3, { width: sigBoxW - 8 });
      // Place of issue + date
      if (idx === 0) {
        doc.fillColor(C_GRAY).fontSize(7.5).font('Helvetica')
           .text(`${bl.placeOfIssue ?? 'ANKR Labs'}\n${bl.issuedAt?.slice(0, 10) ?? ''}`, sx + 4, sigY + 18, { width: sigBoxW - 8 });
      }
    }

    // ── Footer bar ─────────────────────────────────────────────────────────────

    doc.rect(0, PH - 26, PW, 26).fillColor(C_NAVY).fill();
    doc.fillColor(C_GRAY).fontSize(7).font('Helvetica')
       .text(
         `Generated by ANKR Labs · Mari8X Community Edition · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
         M, PH - 18, { width: PW / 2 - M }
       );
    doc.fillColor(C_GRAY).fontSize(7).font('Helvetica')
       .text(`B/L No: ${bl.blNumber}  ·  This document is generated electronically`,
         PW / 2, PH - 18, { width: PW / 2 - M, align: 'right' });

    doc.end();
  });
}
