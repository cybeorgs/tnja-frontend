// ─── PDF / print export helpers ────────────────────────────────────────────
// DOM/window side effects (opens a print window), no React state.

import type { BracketMatch, BracketSlot, DrawCategory, RegisteredPlayer, Tournament } from "../types";
import { isDrawRoundRobin, roundName, getRoundLabel, mainBracketRoundCount, getEliminationFormatLabel } from "./bracketEngine";

// ─── Classic "official draw sheet" bracket renderer ───────────────────────────
// Renders a traditional box-and-connector-line bracket (IJF paper-sheet style):
// two stacked boxes per match joined by a right-angle line into the next round,
// blank boxes for BYE/TBD slots, and the recorded winner's name written on the
// connector line once a match is decided (mirrors the hand-written paper form).

const BX_ROW = 40;
const BX_BOX_W = 195;
const BX_BOX_H = 30;
const BX_COL_GAP = 80;
const BX_COL_W = BX_BOX_W + BX_COL_GAP;

function bxLine(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bx-line" />`;
}

function bxBox(slot: BracketSlot, x: number, y: number): string {
  const blank = slot.isBye || slot.playerName === "TBD";
  return `
    <div class="bx-box" style="left:${x}px; top:${y}px; width:${BX_BOX_W}px; height:${BX_BOX_H}px;">
      ${blank ? "" : `
        ${slot.seedNumber ? `<span class="bx-seed">${slot.seedNumber}</span>` : ""}
        <span class="bx-name-wrap">
          <span class="bx-name">${slot.playerName}</span>
          ${slot.club ? `<span class="bx-club">${slot.club}</span>` : ""}
        </span>
      `}
    </div>`;
}

// Main championship bracket: standard binary merge, round r's match i is fed by
// round r-1's matches 2i and 2i+1, laid out recursively so every round's boxes
// sit at the vertical midpoint of the two matches feeding them.
function renderMainBracketTree(mainRounds: BracketMatch[][]): { html: string; width: number; height: number; matchCount: number } {
  if (!mainRounds.length) return { html: "", width: 0, height: 0, matchCount: 0 };
  const POS_GUTTER = 30;
  const numRounds = mainRounds.length;

  const centers: number[][] = [];
  centers[0] = mainRounds[0].map((_, i) => i * 2 * BX_ROW + BX_ROW);
  for (let r = 1; r < numRounds; r++) {
    centers[r] = mainRounds[r].map((_, i) => (centers[r - 1][2 * i] + centers[r - 1][2 * i + 1]) / 2);
  }
  const slotY = (r: number, i: number, which: 0 | 1): number =>
    r === 0 ? (2 * i + which) * BX_ROW : centers[r - 1][2 * i + which];

  const totalHeight = mainRounds[0].length * 2 * BX_ROW + BX_BOX_H;
  const totalWidth = POS_GUTTER + numRounds * BX_COL_W + BX_BOX_W + 90;

  let lines = "";
  let boxes = "";
  let posCounter = 1;
  let matchCounter = 1;

  mainRounds.forEach((roundMatches, r) => {
    const colX = POS_GUTTER + r * BX_COL_W;
    const isFinal = r === numRounds - 1;

    roundMatches.forEach((m, i) => {
      const yA = slotY(r, i, 0);
      const yB = slotY(r, i, 1);
      boxes += bxBox(m.slotA, colX, yA);
      boxes += bxBox(m.slotB, colX, yB);

      if (r === 0) {
        const blankA = m.slotA.isBye || m.slotA.playerName === "TBD";
        const blankB = m.slotB.isBye || m.slotB.playerName === "TBD";
        boxes += `<div class="bx-pos" style="left:0px; top:${yA}px; width:${POS_GUTTER - 4}px; height:${BX_BOX_H}px;">${blankA ? "" : posCounter}</div>`;
        posCounter++;
        boxes += `<div class="bx-pos" style="left:0px; top:${yB}px; width:${POS_GUTTER - 4}px; height:${BX_BOX_H}px;">${blankB ? "" : posCounter}</div>`;
        posCounter++;
      }

      const midX = colX + BX_BOX_W + BX_COL_GAP / 2;
      lines += bxLine(colX + BX_BOX_W, yA + BX_BOX_H / 2, midX, yA + BX_BOX_H / 2);
      lines += bxLine(colX + BX_BOX_W, yB + BX_BOX_H / 2, midX, yB + BX_BOX_H / 2);
      lines += bxLine(midX, yA + BX_BOX_H / 2, midX, yB + BX_BOX_H / 2);

      const cy = centers[r][i] + BX_BOX_H / 2;
      if (!isFinal) {
        lines += bxLine(midX, cy, colX + BX_COL_W, cy);
        const decided = m.status === "COMPLETED" && !!m.winnerId;
        const winnerName = decided ? (m.winnerId === m.slotA.playerId ? m.slotA.playerName : m.slotB.playerName) : "";
        boxes += `<div class="bx-num" style="left:${colX + BX_BOX_W + 2}px; top:${cy - 18}px;">${matchCounter}</div>`;
        if (winnerName) {
          boxes += `<div class="bx-winline" style="left:${colX + BX_BOX_W + 2}px; top:${cy - 8}px; width:${BX_COL_GAP - 6}px;">${winnerName}</div>`;
        }
        matchCounter++;
      } else {
        boxes += `<div class="bx-final-tag" style="left:${colX + BX_BOX_W + 14}px; top:${cy - 34}px;">FINAL</div>`;
        boxes += `<div class="bx-place" style="left:${colX + BX_BOX_W + 14}px; top:${cy - 4}px;">1.</div>`;
        boxes += `<div class="bx-place" style="left:${colX + BX_BOX_W + 14}px; top:${cy + 18}px;">2.</div>`;
      }
    });
  });

  return {
    html: `<div class="bracket-canvas" style="width:${totalWidth}px; height:${totalHeight}px;"><svg width="${totalWidth}" height="${totalHeight}" class="bx-svg">${lines}</svg>${boxes}</div>`,
    width: totalWidth,
    height: totalHeight,
    matchCount: matchCounter - 1,
  };
}

// Repechage/bronze rounds don't halve like the main bracket — each round keeps
// the same match count, with round r+1's match i fed 1:1 by round r's match i
// (the other slot is either a fixed "Loser of ..." label or filled in later by
// the app's progression logic), so each column is laid out independently.
function renderRepechageBracket(repRounds: BracketMatch[][], numberStart: number): { html: string; width: number; height: number } {
  if (!repRounds.length) return { html: "", width: 0, height: 0 };

  const matchesPerCol = repRounds[0].length;
  const totalHeight = matchesPerCol * 2 * BX_ROW + BX_BOX_H;
  const totalWidth = repRounds.length * BX_COL_W + BX_BOX_W + 90;

  let lines = "";
  let boxes = "";
  let counter = numberStart;

  repRounds.forEach((roundMatches, r) => {
    const colX = r * BX_COL_W;
    const isLast = r === repRounds.length - 1;

    roundMatches.forEach((m, i) => {
      const yA = i * 2 * BX_ROW;
      const yB = i * 2 * BX_ROW + BX_ROW;
      boxes += bxBox(m.slotA, colX, yA);
      boxes += bxBox(m.slotB, colX, yB);

      const midX = colX + BX_BOX_W + BX_COL_GAP / 2;
      lines += bxLine(colX + BX_BOX_W, yA + BX_BOX_H / 2, midX, yA + BX_BOX_H / 2);
      lines += bxLine(colX + BX_BOX_W, yB + BX_BOX_H / 2, midX, yB + BX_BOX_H / 2);
      lines += bxLine(midX, yA + BX_BOX_H / 2, midX, yB + BX_BOX_H / 2);

      const cy = (yA + yB) / 2 + BX_BOX_H / 2;
      if (!isLast) {
        lines += bxLine(midX, cy, colX + BX_COL_W, cy);
        const decided = m.status === "COMPLETED" && !!m.winnerId;
        const winnerName = decided ? (m.winnerId === m.slotA.playerId ? m.slotA.playerName : m.slotB.playerName) : "";
        boxes += `<div class="bx-num" style="left:${colX + BX_BOX_W + 2}px; top:${cy - 18}px;">${counter}</div>`;
        if (winnerName) {
          boxes += `<div class="bx-winline" style="left:${colX + BX_BOX_W + 2}px; top:${cy - 8}px; width:${BX_COL_GAP - 6}px;">${winnerName}</div>`;
        }
        counter++;
      } else {
        boxes += `<div class="bx-final-tag" style="left:${colX + BX_BOX_W + 14}px; top:${cy - 18}px;">3RD PLACE</div>`;
      }
    });
  });

  return {
    html: `<div class="bracket-canvas" style="width:${totalWidth}px; height:${totalHeight}px;"><svg width="${totalWidth}" height="${totalHeight}" class="bx-svg">${lines}</svg>${boxes}</div>`,
    width: totalWidth,
    height: totalHeight,
  };
}

const BX_STYLES = `
  .bracket-canvas { position: relative; margin: 0 auto 20px auto; }
  .bx-svg { position: absolute; top: 0; left: 0; overflow: visible; }
  .bx-line { stroke: #0f172a; stroke-width: 1.5; }
  .bx-box {
    position: absolute;
    border: 1.5px solid #0f172a;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    font-size: 10px;
    overflow: hidden;
  }
  .bx-seed { flex-shrink: 0; background: #fef3c7; color: #b45309; font-weight: 900; font-size: 9px; padding: 1px 4px; border-radius: 3px; }
  .bx-name-wrap { display: flex; flex-direction: column; justify-content: center; overflow: hidden; min-width: 0; line-height: 1.15; }
  .bx-name { font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bx-club { color: #64748b; font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bx-pos { position: absolute; text-align: right; padding-right: 4px; font-size: 10px; font-weight: 900; color: #1d4ed8; display: flex; align-items: center; justify-content: flex-end; }
  .bx-num { position: absolute; font-size: 9px; font-weight: 900; color: #475569; background: #fff; padding: 0 2px; }
  .bx-winline { position: absolute; font-size: 10px; font-weight: 900; color: #15803d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bx-final-tag { position: absolute; font-size: 12px; font-weight: 900; color: #0f172a; text-decoration: underline; }
  .bx-place { position: absolute; font-size: 10px; font-weight: 800; color: #334155; }
`;

export function printRegistrationSlip(player: RegisteredPlayer, tournament: Tournament | null) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Slip - ${player.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #FF7400; padding-bottom: 16px; }
        .header h1 { font-size: 22px; color: #333; margin-bottom: 4px; }
        .header p { color: #666; font-size: 13px; }
        .tnja-id { text-align: center; font-size: 13px; color: #FF7400; font-weight: bold; letter-spacing: 1px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 24px; }
        .grid div { font-size: 13px; }
        .grid label { color: #FF7400; font-weight: bold; display: block; margin-bottom: 3px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .grid span { color: #333; font-weight: 600; font-size: 15px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${tournament?.title || "Tournament"} — Registration Slip</h1>
          <p>${tournament?.location || ""} ${tournament?.date ? "· " + new Date(tournament.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : ""}</p>
        </div>
        <div class="tnja-id">TNJA ID: ${player.tnjaId || "N/A"}</div>
        <div class="grid">
          <div><label>Player Name</label><span>${player.name}</span></div>
          <div><label>Gender</label><span>${player.gender === "FEMALE" ? "Female" : "Male"}</span></div>
          <div><label>District</label><span>${player.district || "—"}</span></div>
          <div><label>Club</label><span>${player.club || "—"}</span></div>
          <div><label>Category</label><span>${player.ageGroup || "—"}</span></div>
          <div><label>Belt</label><span>${player.belt || "—"}</span></div>
          <div><label>Weight</label><span>${player.rawWeight ? `${player.rawWeight} kg` : "—"}</span></div>
          <div><label>Height</label><span>${player.rawHeight ? `${player.rawHeight}` : "—"}</span></div>
          <div><label>Coach</label><span>${player.coachName || "—"}</span></div>
          <div><label>Payment Status</label><span class="status-badge" style="background:${player.isPaid ? "#f0fdf4;color:#22c55e" : "#fffbeb;color:#d97706"}">${player.isPaid ? "Paid" : "Unpaid"}</span></div>
        </div>
        <div class="footer">
          <p>Registered on ${player.registeredAt ? new Date(player.registeredAt).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
          <p>TNJA Tournament Management System — Generated on ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups for this site to print the registration slip.");
  }
}


export function exportMatchToPDF(
  match: BracketMatch,
  winner: BracketSlot,
  loser: BracketSlot,
  tournament: Tournament | null,
  roundIndex: number,
  nextMatchInfo: any
) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Match Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f5f5f5;
          padding: 20px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #FF7400;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          color: #333;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .tournament-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 8px;
        }
        .tournament-info div {
          font-size: 13px;
        }
        .tournament-info label {
          color: #FF7400;
          font-weight: bold;
          display: block;
          margin-bottom: 3px;
        }
        .tournament-info span {
          color: #333;
          font-weight: 500;
        }
        .match-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .player-card {
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #ddd;
        }
        .player-card.winner {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .player-card.loser {
          border-color: #ef4444;
          background: #fef2f2;
        }
        .player-card h3 {
          font-size: 14px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-weight: bold;
        }
        .player-card .name {
          font-size: 22px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }
        .player-card .club {
          font-size: 13px;
          color: #666;
          margin-bottom: 8px;
        }
        .player-card .seed {
          display: inline-block;
          background: #fef3c7;
          color: #b45309;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          margin-top: 8px;
        }
        .next-match {
          background: #eff6ff;
          border: 2px solid #3b82f6;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .next-match h3 {
          color: #1e40af;
          font-size: 14px;
          margin-bottom: 10px;
          font-weight: bold;
        }
        .next-match .details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          font-size: 13px;
        }
        .next-match .details div {
          color: #333;
        }
        .next-match .details label {
          color: #1e40af;
          font-weight: bold;
          display: block;
          margin-bottom: 2px;
        }
        .footer {
          text-align: center;
          color: #999;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .match-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 8px;
          font-size: 13px;
        }
        .match-meta label {
          color: #666;
          font-weight: bold;
        }
        .match-meta span {
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚔️ MATCH REPORT</h1>
          <p>Match Result & Progression Record</p>
        </div>

        <div class="tournament-info">
          <div>
            <label>Tournament</label>
            <span>${tournament?.title || "N/A"}</span>
          </div>
          <div>
            <label>Date</label>
            <span>${tournament?.date || "N/A"}</span>
          </div>
          <div>
            <label>Level</label>
            <span>${tournament?.level || "N/A"}</span>
          </div>
          <div>
            <label>Location</label>
            <span>${tournament?.location || "N/A"}</span>
          </div>
        </div>

        <div class="match-meta">
          <div>
            <label>Mat Number:</label>
            <span>${match.matNumber}</span>
          </div>
          <div>
            <label>Match Number:</label>
            <span>#${match.matchNumber}</span>
          </div>
        </div>

        <div class="match-details">
          <div class="player-card winner">
            <h3>🏆 Winner</h3>
            <div class="name">${winner.playerName}</div>
            <div class="club">${winner.club}</div>
            ${winner.seedNumber ? `<span class="seed">Seed #${winner.seedNumber}</span>` : ""}
          </div>
          <div class="player-card loser">
            <h3>Opponent</h3>
            <div class="name">${loser.playerName}</div>
            <div class="club">${loser.club}</div>
            ${loser.seedNumber ? `<span class="seed">Seed #${loser.seedNumber}</span>` : ""}
          </div>
        </div>

        ${nextMatchInfo ? `
          <div class="next-match">
            <h3>📍 NEXT MATCH</h3>
            <div class="details">
              <div>
                <label>Round:</label>
                <span>${roundName(nextMatchInfo.roundIndex, 5)}</span>
              </div>
              <div>
                <label>Match:</label>
                <span>#${nextMatchInfo.matchNumber}</span>
              </div>
              <div style="grid-column: 1 / -1;">
                <label>Opponent Status:</label>
                <span>${nextMatchInfo.opponent ? `vs ${nextMatchInfo.opponent}` : "⏳ Waiting for opponent to advance"}</span>
              </div>
            </div>
          </div>
        ` : ""}

        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
          <p>TNJA Tournament Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Give the new window a moment to parse the HTML before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups for this site to export the Match Report.");
  }
}

export function exportAllMatchesToPDF(tournament: Tournament | null, allDraws: Record<string, DrawCategory>) {
  let allMatches: { category: string; mat: number; round: number; matchNum: number; p1: string; p2: string; status: string; winner: string | null }[] = [];

  for (const [catKey, draw] of Object.entries(allDraws)) {
    if (!draw.rounds) continue;
    draw.rounds.forEach((roundMatches, ri) => {
      roundMatches.forEach(m => {
        if (!m.slotA.isBye && !m.slotB.isBye && m.slotA.playerName !== "TBD" && m.slotB.playerName !== "TBD") {
          allMatches.push({
            category: catKey.replace(/_/g, " "),
            mat: m.matNumber,
            round: ri + 1,
            matchNum: m.matchNumber,
            p1: m.slotA.playerName,
            p2: m.slotB.playerName,
            status: m.status,
            winner: m.winnerId === m.slotA.playerId ? m.slotA.playerName : m.winnerId === m.slotB.playerId ? m.slotB.playerName : null
          });
        }
      });
    });
  }

  // Sort by Mat Number, then Category, then Round, then Match
  allMatches.sort((a, b) => {
    if (a.mat !== b.mat) return a.mat - b.mat;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.round !== b.round) return a.round - b.round;
    return a.matchNum - b.matchNum;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Master Match List</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        h1 { text-align: center; color: #333; margin-bottom: 5px; font-size: 24px; }
        h3 { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .mat-row { background-color: #e2e8f0; font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      <h1>MASTER MATCH LIST</h1>
      <h3>${tournament?.title || "Tournament"} - All Categories</h3>
      <table>
        <thead>
          <tr>
            <th>Mat</th>
            <th>Category</th>
            <th>Match</th>
            <th>Player 1 (White)</th>
            <th>Player 2 (Blue)</th>
            <th>Status</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          ${allMatches.map(m => `
            <tr>
              <td style="text-align:center; font-weight:bold;">${m.mat}</td>
              <td>${m.category}</td>
              <td>R${m.round} - #${m.matchNum}</td>
              <td>${m.p1}</td>
              <td>${m.p2}</td>
              <td>${m.status}</td>
              <td>${m.winner || "-"}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #999;">
        Generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups to print.");
  }
}


export function exportOverallTournamentReport(
  tournament: Tournament | null,
  players: RegisteredPlayer[],
  allDraws: Record<string, DrawCategory>,
  placements: Record<string, "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION">
) {
  const activePlayers = players.filter(p => p.status === "APPROVED");
  const maleCount = activePlayers.filter(p => p.gender === "MALE").length;
  const femaleCount = activePlayers.filter(p => p.gender === "FEMALE").length;
  const otherCount = activePlayers.length - maleCount - femaleCount;
  const totalCategories = Object.keys(allDraws).length;

  let totalMatches = 0;
  let completedMatches = 0;
  let totalByes = 0;
  let totalIppons = 0;
  let totalWazaAris = 0;
  let totalYukos = 0;
  let totalMatchSeconds = 0;

  for (const draw of Object.values(allDraws)) {
    if (!draw.rounds) continue;
    draw.rounds.forEach(roundMatches => {
      roundMatches.forEach(m => {
        if (!m.slotA.isBye && !m.slotB.isBye && m.slotA.playerName !== "TBD" && m.slotB.playerName !== "TBD") {
          totalMatches++;
          if (m.status === "COMPLETED") {
            completedMatches++;
            totalMatchSeconds += (m.elapsedSeconds || 0);
            if (m.scoreA) {
              totalIppons += (m.scoreA.ippon || 0);
              totalWazaAris += (m.scoreA.wazaAri || 0);
              totalYukos += (m.scoreA.yuko || 0);
            }
            if (m.scoreB) {
              totalIppons += (m.scoreB.ippon || 0);
              totalWazaAris += (m.scoreB.wazaAri || 0);
              totalYukos += (m.scoreB.yuko || 0);
            }
          }
        } else if (m.slotA.isBye || m.slotB.isBye) {
          totalByes++;
        }
      });
    });
  }

  const avgMatchTimeSeconds = completedMatches > 0 ? Math.floor(totalMatchSeconds / completedMatches) : 0;
  const avgMins = Math.floor(avgMatchTimeSeconds / 60);
  const avgSecs = avgMatchTimeSeconds % 60;
  const totalMins = Math.floor(totalMatchSeconds / 60);
  const totalSecs = totalMatchSeconds % 60;

  const categoryRows = Object.entries(allDraws).map(([catKey, draw]) => {
    const ageGroup = draw.ageGroup;
    const gender = draw.gender;
    const weightDiv = draw.weightCategory === "ALL" ? "Open" : draw.weightCategory;

    const catPlayers = activePlayers.filter(p => 
      p.ageGroup === ageGroup && 
      (draw.exactAge === 0 || p.exactAge === draw.exactAge) &&
      p.gender === gender &&
      String(p.weight) === draw.weightCategory
    );
    const catMale = catPlayers.filter(p => p.gender === "MALE").length;
    const catFemale = catPlayers.filter(p => p.gender === "FEMALE").length;
    const catTotal = catPlayers.length;

    const goldPlayers = catPlayers.filter(p => placements[p.id] === "FIRST");
    const silverPlayers = catPlayers.filter(p => placements[p.id] === "SECOND");
    const bronzePlayers = catPlayers.filter(p => placements[p.id] === "THIRD");

    const formatWinners = (winners: typeof activePlayers) => {
      if (winners.length === 0) return "-";
      return winners.map(w => `<span class="winner-name">${w.name}</span><br/><span class="winner-club">(${w.club || w.district})</span>`).join('<br/><br/>');
    };

    return `
      <tr>
        <td style="font-weight: bold;">${ageGroup}</td>
        <td>${gender}</td>
        <td>${weightDiv}</td>
        <td>${catMale}</td>
        <td>${catFemale}</td>
        <td style="font-weight: bold;">${catTotal}</td>
        <td style="color: #b45309; font-weight: bold;">${formatWinners(goldPlayers)}</td>
        <td style="color: #334155; font-weight: bold;">${formatWinners(silverPlayers)}</td>
        <td style="color: #9a3412; font-weight: bold;">${formatWinners(bronzePlayers)}</td>
      </tr>
    `;
  }).join('');

  const drawShuffleRows = Object.entries(allDraws).map(([catKey, draw]) => {
    if (!draw.rounds || draw.rounds.length === 0) return '';
    const round1 = draw.rounds[0];
    const matchups = round1.map(m => {
      const p1 = m.slotA.playerName !== "TBD" ? m.slotA.playerName : (m.slotA.isBye ? "BYE" : "TBD");
      const p2 = m.slotB.playerName !== "TBD" ? m.slotB.playerName : (m.slotB.isBye ? "BYE" : "TBD");
      return `<div style="background:#f8fafc; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 5px;">
        <span style="color:#64748b; font-size:10px;">Match #${m.matchNumber}</span><br/>
        <strong>${p1}</strong> <span style="color:#94a3b8; font-size: 10px; margin: 0 5px;">vs</span> <strong>${p2}</strong>
      </div>`;
    }).join('');

    return `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h4 style="margin: 0 0 10px 0; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size:14px;">
          ${draw.ageGroup} ${draw.gender} ${draw.weightCategory === "ALL" ? "Open" : draw.weightCategory} - ${isDrawRoundRobin(draw) ? 'ROUND ROBIN' : 'ELIMINATION'}
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 11px;">
          ${matchups}
        </div>
      </div>
    `;
  }).join('');

  let allMatches: any[] = [];
  for (const [catKey, draw] of Object.entries(allDraws)) {
    if (!draw.rounds) continue;
    draw.rounds.forEach((roundMatches, ri) => {
      roundMatches.forEach(m => {
        if (!m.slotA.isBye && !m.slotB.isBye && m.slotA.playerName !== "TBD" && m.slotB.playerName !== "TBD") {
          allMatches.push({
            category: catKey.replace(/_/g, " "),
            mat: m.matNumber,
            round: ri + 1,
            matchNum: m.matchNumber,
            p1: m.slotA.playerName,
            p2: m.slotB.playerName,
            status: m.status,
            winner: m.winnerId === m.slotA.playerId ? m.slotA.playerName : m.winnerId === m.slotB.playerId ? m.slotB.playerName : "-"
          });
        }
      });
    });
  }

  allMatches.sort((a, b) => {
    if (a.mat !== b.mat) return a.mat - b.mat;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.round !== b.round) return a.round - b.round;
    return a.matchNum - b.matchNum;
  });

  const matchesRows = allMatches.map(m => `
    <tr>
      <td style="text-align:center; font-weight:bold;">${m.mat}</td>
      <td>${m.category}</td>
      <td>R${m.round} - #${m.matchNum}</td>
      <td>${m.p1}</td>
      <td>${m.p2}</td>
      <td>${m.status}</td>
      <td style="font-weight: bold;">${m.winner}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Official Tournament Completion Report</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.4; padding: 30px; margin: 0; }
        .header { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 5px; }
        .header-icon { font-size: 32px; }
        .header-title { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .subtitle { text-align: center; font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 20px 0; }
        .orange-line { height: 4px; background-color: #f97316; margin-bottom: 30px; }
        
        .info-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; margin-bottom: 40px; }
        .info-col { display: flex; flex-direction: column; gap: 5px; }
        .info-label { font-size: 11px; font-weight: 800; color: #f97316; text-transform: uppercase; }
        .info-value { font-size: 14px; font-weight: 500; color: #1e293b; }
        
        .section-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 30px 0 15px 0; display: flex; align-items: center; gap: 10px; }
        .section-title span { color: #f97316; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
        th { background-color: #f8fafc; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11px; }
        
        .winner-name { font-weight: bold; color: #b45309; }
        .winner-club { font-size: 10px; color: #64748b; }
        .td-center { text-align: center; }
        
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 50px; }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="header-icon">🏆</span>
        <h1 class="header-title">OFFICIAL TOURNAMENT COMPLETION REPORT</h1>
      </div>
      <p class="subtitle">${tournament?.title || "Tournament"}</p>
      <div class="orange-line"></div>
      
      <div class="info-box">
        <div class="info-col">
          <span class="info-label">Date</span>
          <span class="info-value">${tournament?.date ? new Date(tournament.date).toLocaleDateString('en-GB') : "N/A"}${tournament?.dateTo ? ' - ' + new Date(tournament.dateTo).toLocaleDateString('en-GB') : ""}</span>
        </div>
        <div class="info-col">
          <span class="info-label">Location</span>
          <span class="info-value">${tournament?.location || "N/A"}</span>
        </div>
        <div class="info-col">
          <span class="info-label">Level</span>
          <span class="info-value">${tournament?.level || "N/A"}</span>
        </div>
        <div class="info-col">
          <span class="info-label">Category</span>
          <span class="info-value">${tournament?.category || "N/A"}</span>
        </div>
      </div>
      
      <div class="section-title"><span>📊</span> PARTICIPATION METRICS SUMMARY</div>
      <table>
        <thead>
          <tr>
            <th>Total Players</th>
            <th>Male Players</th>
            <th>Female Players</th>
            <th>Other / Unspecified</th>
            <th>Total Categories</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold;">${activePlayers.length}</td>
            <td>${maleCount}</td>
            <td>${femaleCount}</td>
            <td>${otherCount}</td>
            <td>${totalCategories}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title"><span>📈</span> MATCH STATISTICS</div>
      <table>
        <thead>
          <tr>
            <th>Total Scheduled</th>
            <th>Completed Matches</th>
            <th>Auto-Advancements (Byes)</th>
            <th>Total Ippons (100)</th>
            <th>Total Waza-aris (10)</th>
            <th>Total Yukos (1)</th>
            <th>Total Time</th>
            <th>Avg. Match Time</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold;">${totalMatches}</td>
            <td style="color: #059669; font-weight: bold;">${completedMatches}</td>
            <td>${totalByes}</td>
            <td style="color: #b45309; font-weight: bold;">${totalIppons}</td>
            <td>${totalWazaAris}</td>
            <td>${totalYukos}</td>
            <td>${totalMins}m ${totalSecs}s</td>
            <td>${avgMins}m ${avgSecs}s</td>
          </tr>
        </tbody>
      </table>
      
      <div class="section-title" style="page-break-before: always;"><span>🥇</span> CATEGORY WINNERS & PARTICIPATION TABLE</div>
      <table>
        <thead>
          <tr>
            <th>Age Group</th>
            <th>Gender</th>
            <th>Weight Div</th>
            <th>Male</th>
            <th>Female</th>
            <th>Total</th>
            <th>🥇 Gold (1st)</th>
            <th>🥈 Silver (2nd)</th>
            <th>🥉 Bronze (3rd)</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows}
        </tbody>
      </table>

      <div class="section-title" style="page-break-before: always;"><span>🔀</span> CATEGORY INITIAL DRAWS (SHUFFLE)</div>
      <p style="font-size:12px; color: #64748b; margin-bottom: 20px;">The initial random seeding and first-round matchups generated for each category.</p>
      ${drawShuffleRows}
      
      <div class="section-title" style="page-break-before: always;"><span>⚔️</span> MASTER MATCHES & RESULTS LIST</div>
      <table>
        <thead>
          <tr>
            <th class="td-center">Mat</th>
            <th>Category</th>
            <th>Match</th>
            <th>Player 1 (White)</th>
            <th>Player 2 (Blue)</th>
            <th>Status</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          ${matchesRows}
        </tbody>
      </table>
      
      <div class="footer">
        Generated on ${new Date().toLocaleString()} &middot; Official Tournament Completion Record
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups to print the report.");
  }
}

export function exportRoundRobinPoolSheet(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;

  // Clean the category key for printing (e.g. "Senior_MALE_-60kg" -> "Senior MALE -60kg")
  const catLabel = categoryKey.replace(/_/g, " ");
  const parts = catLabel.split(" ");
  const ageGroup = parts[0] || "";
  const gender = parts[1] || "";
  const weight = parts[2] || "";

  const allMatches: any[] = [];
  draw.rounds.forEach(roundMatches => {
    roundMatches.forEach(m => {
      if (!m.slotA.isBye && !m.slotB.isBye) {
        allMatches.push(m);
      }
    });
  });

  // Approved active competitors
  const activePlayers = players.filter(p => p.status === "APPROVED");
  const pCount = activePlayers.length;

  // Standings computation to show Place and Wins/Pts
  const standingsMap: Record<string, {
    playerId: string;
    name: string;
    club: string;
    weight: string;
    wins: number;
    points: number;
    totalWinningTime: number;
  }> = {};

  activePlayers.forEach(p => {
    standingsMap[p.id] = {
      playerId: p.id,
      name: p.name,
      club: p.club || "",
      weight: p.weight ? String(p.weight) : "",
      wins: 0,
      points: 0,
      totalWinningTime: 0,
    };
  });

  allMatches.forEach(m => {
    if (m.status === "COMPLETED") {
      const ptsA = m.scoreA ? ( (m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0) * 1 ) : 0;
      const ptsB = m.scoreB ? ( (m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0) * 1 ) : 0;

      if (standingsMap[m.slotA.playerId]) standingsMap[m.slotA.playerId].points += Math.min(ptsA, 100);
      if (standingsMap[m.slotB.playerId]) standingsMap[m.slotB.playerId].points += Math.min(ptsB, 100);

      if (m.winnerId && standingsMap[m.winnerId]) {
        standingsMap[m.winnerId].wins += 1;
        standingsMap[m.winnerId].totalWinningTime += m.elapsedSeconds || 0;
      }
    }
  });

  const sortedPlayers = Object.values(standingsMap).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.points !== a.points) return b.points - a.points;

    const tiedGroup = Object.values(standingsMap).filter(p => p.wins === a.wins && p.points === a.points);
    if (tiedGroup.length === 2) {
      const headToHead = allMatches.find(m => 
        m.status === "COMPLETED" && 
        ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
         (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
      );
      if (headToHead && headToHead.winnerId) {
        return headToHead.winnerId === a.playerId ? -1 : 1;
      }
    }
    if (a.totalWinningTime !== b.totalWinningTime) {
      return a.totalWinningTime - b.totalWinningTime;
    }
    return 0;
  });

  // Map to find Rank
  const rankMap: Record<string, number> = {};
  sortedPlayers.forEach((p, idx) => {
    rankMap[p.playerId] = idx + 1;
  });

  // Competitor codes (01, 02, etc.) based on original activePlayers order
  const codeMap: Record<string, string> = {};
  activePlayers.forEach((p, idx) => {
    codeMap[p.id] = (idx + 1).toString().padStart(2, "0");
  });

  // Construct head-to-head outcomes matrix
  const grid: Record<string, Record<string, string>> = {};
  activePlayers.forEach(pA => {
    grid[pA.id] = {};
    activePlayers.forEach(pB => {
      grid[pA.id][pB.id] = "-"; // default
    });
  });

  allMatches.forEach(m => {
    if (m.status === "COMPLETED" && m.winnerId) {
      const ptsA = m.scoreA ? ( (m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0) * 1 ) : 0;
      const ptsB = m.scoreB ? ( (m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0) * 1 ) : 0;
      
      grid[m.slotA.playerId][m.slotB.playerId] = m.winnerId === m.slotA.playerId ? Math.min(ptsA, 100).toString() : "0";
      grid[m.slotB.playerId][m.slotA.playerId] = m.winnerId === m.slotB.playerId ? Math.min(ptsB, 100).toString() : "0";
    }
  });

  const formattedDate = tournament?.date ? new Date(tournament.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Round Robin Pool Sheet</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #000; }
        .official-header {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 5px;
        }
        .official-header td {
          border: 1px solid #000;
          padding: 8px;
          font-size: 11px;
          font-weight: bold;
          vertical-align: middle;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .sub-header {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: bold;
          margin: 10px 0;
          border-bottom: 2px solid #000;
          padding-bottom: 4px;
        }

        .pool-title {
          font-size: 20px;
          font-weight: 900;
          margin: 15px 0 5px 0;
        }

        .pool-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
          font-size: 12px;
        }
        .pool-table th, .pool-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        .pool-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .pool-table td.center, .pool-table th.center {
          text-align: center;
        }
        .shaded-cell {
          background-color: #e2e8f0;
        }

        .matches-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .matches-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .matches-table th, .matches-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        .matches-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .matches-table td.center {
          text-align: center;
        }
      </style>
    </head>
    <body>
      <table class="official-header">
        <tr>
          <td style="color: blue; font-size: 14px; width: 15%;" class="text-center">${gender.toUpperCase()} ${ageGroup.toUpperCase()}</td>
          <td style="color: blue; font-size: 14px; width: 12%;" class="text-center">${weight}</td>
          <td style="font-size: 11px; width: 35%;">${tournament?.title?.toUpperCase() || "TNJA CHAMPIONSHIP"}</td>
          <td style="font-size: 11px; width: 18%;">${tournament?.location || "CHENNAI"}</td>
          <td style="font-size: 11px; width: 10%;" class="text-center">${formattedDate}</td>
          <td style="font-size: 11px; width: 5%;" class="text-center">${pCount}</td>
          <td style="font-size: 11px; width: 5%;" class="text-center">Cmp</td>
        </tr>
      </table>

      <div class="sub-header">
        <span style="color: red;">Round Robin System for ${pCount} Competitors</span>
        <span>4 min</span>
        <span>Matte _</span>
      </div>

      <div class="pool-title">Poolk.</div>
      <table class="pool-table">
        <thead>
          <tr>
            <th style="width: 25%;">Nr. Name</th>
            <th style="width: 25%;">Club</th>
            ${activePlayers.map(p => `<th class="center" style="width: 8%;">${codeMap[p.id]}</th>`).join('')}
            <th class="center" style="width: 12%;">Wins / Pts</th>
            <th class="center" style="width: 10%;">Weight</th>
            <th class="center" style="width: 8%;">Place</th>
          </tr>
        </thead>
        <tbody>
          ${activePlayers.map(p => {
            const code = codeMap[p.id];
            const stats = standingsMap[p.id];
            const rank = rankMap[p.id];
            const placeEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`;
            return `
              <tr>
                <td><span style="color: blue;">${code}</span> ${p.name}</td>
                <td>:${p.club || ""}</td>
                ${activePlayers.map(opp => {
                  if (opp.id === p.id) {
                    return `<td class="shaded-cell"></td>`;
                  }
                  return `<td class="center">${grid[p.id][opp.id]}</td>`;
                }).join('')}
                <td class="center">${stats.wins} &nbsp;&nbsp;&nbsp;&nbsp; ${stats.points}</td>
                <td class="center">${stats.weight} kg</td>
                <td class="center" style="font-weight: bold; font-size: 14px;">${placeEmoji}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="matches-title">Matches:</div>
      <table class="matches-table">
        <thead>
          <tr>
            <th style="width: 12%;" class="center">Round/Compe</th>
            <th style="width: 28%;">Name ("white")</th>
            <th style="width: 28%;">Name ("blue")</th>
            <th style="width: 14%;">Winner</th>
            <th style="width: 8%;" class="center">Pts.</th>
            <th style="width: 10%;" class="center">Scores</th>
          </tr>
        </thead>
        <tbody>
          ${allMatches.map((m, idx) => {
            const codeA = codeMap[m.slotA.playerId] || "??";
            const codeB = codeMap[m.slotB.playerId] || "??";
            const winnerName = m.winnerId === m.slotA.playerId ? m.slotA.playerName : m.winnerId === m.slotB.playerId ? m.slotB.playerName : "";
            
            const ptsVal = m.status === "COMPLETED" ? (
              m.winnerId === m.slotA.playerId ? (
                m.scoreA ? Math.min((m.scoreA.ippon * 100) + (m.scoreA.wazaAri * 10) + (m.scoreA.yuko), 100) : 0
              ) : (
                m.scoreB ? Math.min((m.scoreB.ippon * 100) + (m.scoreB.wazaAri * 10) + (m.scoreB.yuko), 100) : 0
              )
            ) : "";

            const scoreA_str = m.scoreA ? `${m.scoreA.ippon}.${m.scoreA.wazaAri}.${m.scoreA.yuko}` : "0.0.0";
            const scoreB_str = m.scoreB ? `${m.scoreB.ippon}.${m.scoreB.wazaAri}.${m.scoreB.yuko}` : "0.0.0";
            const scoreDisplay = m.status === "COMPLETED" ? `${scoreA_str} / ${scoreB_str}` : "";

            return `
              <tr>
                <td class="center" style="font-size: 14px; font-weight: bold; color: blue;">
                  ${idx + 1} &nbsp;&nbsp;&nbsp;&nbsp; <span style="font-size:11px; font-weight:normal;">${codeA}-${codeB}</span>
                </td>
                <td>${m.slotA.playerName}</td>
                <td>${m.slotB.playerName}</td>
                <td style="font-weight: bold; color: green;">${winnerName}</td>
                <td class="center" style="font-weight: bold;">${ptsVal}</td>
                <td class="center">${scoreDisplay}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups to print.");
  }
}

export function exportEliminationBracketSheet(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;

  const catLabel = categoryKey.replace(/_/g, " ");
  const parts = catLabel.split(" ");
  const ageGroup = draw.ageGroup || parts[0] || "";
  const gender = draw.gender || parts[1] || "";
  const weight = draw.weightCategory === "ALL" ? "Open" : (draw.weightCategory || parts[2] || "");

  const activePlayers = players.filter(p => p.status === "APPROVED");
  const mainCount = mainBracketRoundCount(draw.rounds);
  const formatLabel = getEliminationFormatLabel(draw.rounds);

  const allMatches: {
    roundIndex: number;
    roundLabel: string;
    matchNumber: number;
    matNumber: number;
    slotA: BracketSlot;
    slotB: BracketSlot;
    status: string;
    winnerId: string | null;
    scoreA?: any;
    scoreB?: any;
    elapsedSeconds?: number;
    isFinal: boolean;
    isBronze: boolean;
  }[] = [];

  draw.rounds.forEach((roundMatches, ri) => {
    const roundLabel = getRoundLabel(draw.rounds, ri, false);
    const isFinal = (ri === mainCount - 1);
    const isBronze = (ri >= mainCount && ri === draw.rounds.length - 1);

    roundMatches.forEach(m => {
      allMatches.push({
        roundIndex: ri,
        roundLabel,
        matchNumber: m.matchNumber,
        matNumber: m.matNumber || draw.matNumber || 1,
        slotA: m.slotA,
        slotB: m.slotB,
        status: m.status,
        winnerId: m.winnerId,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        elapsedSeconds: m.elapsedSeconds,
        isFinal,
        isBronze,
      });
    });
  });

  allMatches.sort((a, b) => a.matchNumber - b.matchNumber);

  let goldWinnerName = "-";
  let goldWinnerClub = "";
  let silverWinnerName = "-";
  let silverWinnerClub = "";
  const bronzeWinners: { name: string; club: string }[] = [];

  const finalMatch = allMatches.find(m => m.isFinal && !m.slotA.isBye && !m.slotB.isBye);
  if (finalMatch && finalMatch.status === "COMPLETED" && finalMatch.winnerId) {
    if (finalMatch.winnerId === finalMatch.slotA.playerId) {
      goldWinnerName = finalMatch.slotA.playerName;
      goldWinnerClub = activePlayers.find(p => p.id === finalMatch.slotA.playerId)?.club || "";
      silverWinnerName = finalMatch.slotB.playerName;
      silverWinnerClub = activePlayers.find(p => p.id === finalMatch.slotB.playerId)?.club || "";
    } else if (finalMatch.winnerId === finalMatch.slotB.playerId) {
      goldWinnerName = finalMatch.slotB.playerName;
      goldWinnerClub = activePlayers.find(p => p.id === finalMatch.slotB.playerId)?.club || "";
      silverWinnerName = finalMatch.slotA.playerName;
      silverWinnerClub = activePlayers.find(p => p.id === finalMatch.slotA.playerId)?.club || "";
    }
  }

  const bronzeMatches = allMatches.filter(m => m.isBronze && m.status === "COMPLETED" && m.winnerId);
  bronzeMatches.forEach(bm => {
    if (bm.winnerId === bm.slotA.playerId) {
      const p = activePlayers.find(pl => pl.id === bm.slotA.playerId);
      bronzeWinners.push({ name: bm.slotA.playerName, club: p?.club || "" });
    } else if (bm.winnerId === bm.slotB.playerId) {
      const p = activePlayers.find(pl => pl.id === bm.slotB.playerId);
      bronzeWinners.push({ name: bm.slotB.playerName, club: p?.club || "" });
    }
  });

  const formatTime = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formattedDate = tournament?.date ? new Date(tournament.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Official Match Report - ${ageGroup} ${gender} ${weight}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #000; }
        .official-header {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        .official-header td {
          border: 1px solid #000;
          padding: 10px;
          font-size: 11px;
          font-weight: bold;
          vertical-align: middle;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .sub-header {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: bold;
          margin: 10px 0;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
        }

        .category-title {
          font-size: 20px;
          font-weight: 900;
          margin: 15px 0 10px 0;
          text-transform: uppercase;
        }

        .podium-box {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .podium-card {
          border: 2px solid #000;
          padding: 10px;
          text-align: center;
          border-radius: 6px;
          background-color: #f8fafc;
        }
        .podium-card.gold { border-color: #d97706; background-color: #fffbeb; }
        .podium-card.silver { border-color: #64748b; background-color: #f1f5f9; }
        .podium-card.bronze { border-color: #b45309; background-color: #fff7ed; }
        .podium-place { font-size: 11px; font-weight: 900; uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .podium-name { font-size: 14px; font-weight: bold; color: #0f172a; }
        .podium-club { font-size: 11px; color: #475569; }

        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin: 20px 0 8px 0;
          text-transform: uppercase;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
          font-size: 11px;
        }
        .data-table th, .data-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        .data-table th {
          background-color: #f1f5f9;
          font-weight: bold;
        }
        .data-table td.center, .data-table th.center {
          text-align: center;
        }
        .winner-text {
          font-weight: bold;
          color: #15803d;
        }
        .bye-text {
          color: #64748b;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <table class="official-header">
        <tr>
          <td style="width: 25%;">
            TNJA TOURNAMENT SYSTEM<br>
            <span style="font-weight:normal;">Tamil Nadu Judo Association</span>
          </td>
          <td class="text-center" style="font-size:15px; width:50%;">
            OFFICIAL TOURNAMENT MATCH REPORT<br>
            <span style="font-weight:normal; font-size:12px;">${tournament?.title || "Judo Championship"}</span>
          </td>
          <td class="text-right" style="width: 25%;">
            Date: ${formattedDate}<br>
            ${tournament?.location ? `Location: ${tournament.location}` : ""}
          </td>
        </tr>
      </table>

      <div class="category-title">
        ${ageGroup} — ${gender} — ${weight}${weight && !String(weight).includes("kg") && weight !== "Open" ? " kg" : ""}
      </div>
      <div class="sub-header">
        <span>Format: ${formatLabel}</span>
        <span>Assigned Mat: MAT ${draw.matNumber || 1}</span>
        <span>Total Competitors: ${activePlayers.length}</span>
      </div>

      <div class="podium-box">
        <div class="podium-card gold">
          <div class="podium-place" style="color: #b45309;">🥇 1ST PLACE (GOLD)</div>
          <div class="podium-name">${goldWinnerName}</div>
          <div class="podium-club">${goldWinnerClub || "—"}</div>
        </div>
        <div class="podium-card silver">
          <div class="podium-place" style="color: #475569;">🥈 2ND PLACE (SILVER)</div>
          <div class="podium-name">${silverWinnerName}</div>
          <div class="podium-club">${silverWinnerClub || "—"}</div>
        </div>
        <div class="podium-card bronze">
          <div class="podium-place" style="color: #9a3412;">🥉 3RD PLACE (BRONZE)</div>
          <div class="podium-name">${bronzeWinners[0]?.name || "—"}</div>
          <div class="podium-club">${bronzeWinners[0]?.club || "—"}</div>
        </div>
      </div>

      <div class="section-title">Entire Match Results (${allMatches.length} Matches)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="center" style="width: 8%;">Mat</th>
            <th class="center" style="width: 8%;">Match #</th>
            <th style="width: 16%;">Round</th>
            <th style="width: 23%;">White Athlete (Club)</th>
            <th style="width: 23%;">Blue Athlete (Club)</th>
            <th style="width: 14%;">Winner</th>
            <th class="center" style="width: 8%;">Scores / Time</th>
          </tr>
        </thead>
        <tbody>
          ${allMatches.map(m => {
            const isBye = m.slotA.isBye || m.slotB.isBye;
            const clubA = activePlayers.find(p => p.id === m.slotA.playerId)?.club || "—";
            const clubB = activePlayers.find(p => p.id === m.slotB.playerId)?.club || "—";
            const winnerName = m.winnerId === m.slotA.playerId
              ? m.slotA.playerName
              : m.winnerId === m.slotB.playerId
              ? m.slotB.playerName
              : isBye
              ? "BYE"
              : "—";

            const scoreA_str = m.scoreA ? `${m.scoreA.ippon || 0}.${m.scoreA.wazaAri || 0}.${m.scoreA.yuko || 0}` : "0.0.0";
            const scoreB_str = m.scoreB ? `${m.scoreB.ippon || 0}.${m.scoreB.wazaAri || 0}.${m.scoreB.yuko || 0}` : "0.0.0";
            const scoreDisplay = m.status === "COMPLETED" && !isBye ? `${scoreA_str} / ${scoreB_str}${m.elapsedSeconds ? ` (${formatTime(m.elapsedSeconds)})` : ""}` : "—";

            return `
              <tr>
                <td class="center" style="font-weight:bold;">${m.matNumber}</td>
                <td class="center" style="font-weight:bold;">#${m.matchNumber}</td>
                <td style="font-weight:bold;">${m.roundLabel}</td>
                <td>
                  <strong>${m.slotA.playerName}</strong><br>
                  <span style="font-size:10px; color:#475569;">(${clubA})</span>
                </td>
                <td>
                  <strong>${m.slotB.playerName}</strong><br>
                  <span style="font-size:10px; color:#475569;">(${clubB})</span>
                </td>
                <td>
                  ${
                    winnerName === "BYE"
                      ? '<span class="bye-text">BYE</span>'
                      : winnerName !== "—"
                      ? `<span class="winner-text">🏆 ${winnerName}</span>`
                      : "—"
                  }
                </td>
                <td class="center">${scoreDisplay}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <div class="section-title">Registered Competitors Roster (${activePlayers.length} Entries)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="center" style="width: 8%;">S.No</th>
            <th class="center" style="width: 14%;">TNJA ID</th>
            <th style="width: 32%;">Competitor Name</th>
            <th style="width: 26%;">Club / District</th>
            <th class="center" style="width: 10%;">Weight</th>
            <th class="center" style="width: 10%;">Belt</th>
          </tr>
        </thead>
        <tbody>
          ${activePlayers.map((p, idx) => `
            <tr>
              <td class="center" style="font-weight:bold;">${idx + 1}</td>
              <td class="center">${p.tnjaId || "—"}</td>
              <td style="font-weight:bold;">${p.name}</td>
              <td>${p.club || p.district || "—"}</td>
              <td class="center">${p.weight ? `${p.weight} kg` : "—"}</td>
              <td class="center">${p.belt || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="margin-top:20px; font-size:10px; color:#64748b; text-align:center;">
        TNJA Tournament Management System — Generated on ${new Date().toLocaleString("en-IN")}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  } else {
    alert("Please allow popups to print the report.");
  }
}

export function exportCategoryReport(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;
  if (isDrawRoundRobin(draw)) {
    exportRoundRobinPoolSheet(tournament, categoryKey, draw, players);
  } else {
    exportEliminationBracketSheet(tournament, categoryKey, draw, players);
  }
}

export function exportEliminationChartPDF(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;

  const catLabel = categoryKey.replace(/_/g, " ");
  const parts = catLabel.split(" ");
  const ageGroup = draw.ageGroup || parts[0] || "";
  const gender = draw.gender || parts[1] || "";
  const weight = draw.weightCategory === "ALL" ? "Open" : (draw.weightCategory || parts[2] || "");

  const activePlayers = players.filter(p => p.status === "APPROVED");
  const mainCount = mainBracketRoundCount(draw.rounds);
  const formatLabel = getEliminationFormatLabel(draw.rounds);

  let goldWinnerName = "-";
  let goldWinnerClub = "";
  let silverWinnerName = "-";
  let silverWinnerClub = "";
  const bronzeWinners: { name: string; club: string }[] = [];

  const allMatches: any[] = [];
  draw.rounds.forEach((roundMatches, ri) => {
    const roundLabel = getRoundLabel(draw.rounds, ri, false);
    const isFinal = (ri === mainCount - 1);
    const isBronze = (ri >= mainCount && ri === draw.rounds.length - 1);

    roundMatches.forEach(m => {
      allMatches.push({
        ...m,
        roundIndex: ri,
        roundLabel,
        isFinal,
        isBronze,
      });
    });
  });

  const finalMatch = allMatches.find(m => m.isFinal && !m.slotA.isBye && !m.slotB.isBye);
  if (finalMatch && finalMatch.status === "COMPLETED" && finalMatch.winnerId) {
    if (finalMatch.winnerId === finalMatch.slotA.playerId) {
      goldWinnerName = finalMatch.slotA.playerName;
      goldWinnerClub = activePlayers.find(p => p.id === finalMatch.slotA.playerId)?.club || "";
      silverWinnerName = finalMatch.slotB.playerName;
      silverWinnerClub = activePlayers.find(p => p.id === finalMatch.slotB.playerId)?.club || "";
    } else if (finalMatch.winnerId === finalMatch.slotB.playerId) {
      goldWinnerName = finalMatch.slotB.playerName;
      goldWinnerClub = activePlayers.find(p => p.id === finalMatch.slotB.playerId)?.club || "";
      silverWinnerName = finalMatch.slotA.playerName;
      silverWinnerClub = activePlayers.find(p => p.id === finalMatch.slotA.playerId)?.club || "";
    }
  }

  const bronzeMatches = allMatches.filter(m => m.isBronze && m.status === "COMPLETED" && m.winnerId);
  bronzeMatches.forEach(bm => {
    if (bm.winnerId === bm.slotA.playerId) {
      const p = activePlayers.find(pl => pl.id === bm.slotA.playerId);
      bronzeWinners.push({ name: bm.slotA.playerName, club: p?.club || "" });
    } else if (bm.winnerId === bm.slotB.playerId) {
      const p = activePlayers.find(pl => pl.id === bm.slotB.playerId);
      bronzeWinners.push({ name: bm.slotB.playerName, club: p?.club || "" });
    }
  });

  const formattedDate = tournament?.date ? new Date(tournament.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
  const mainRounds = draw.rounds.slice(0, mainCount);
  const repechageRounds = draw.rounds.slice(mainCount);

  const mainTree = renderMainBracketTree(mainRounds);
  const repTree = renderRepechageBracket(repechageRounds, mainTree.matchCount + 1);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TNJA_Bracket_Chart_${catLabel.replace(/[^a-zA-Z0-9]/g, "_")}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 15px; }
        
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }

        .no-print {
          background: #0f172a;
          color: #fff;
          padding: 12px 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .banner-title { font-weight: 800; font-size: 14px; display: block; color: #FF7400; }
        .banner-subtitle { font-size: 12px; color: #cbd5e1; }
        .print-btn {
          background: #FF7400;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          border: 2px solid #0f172a;
        }
        .header-table td {
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          vertical-align: middle;
        }
        .title-left { font-size: 11px; font-weight: 900; color: #FF7400; letter-spacing: 0.5px; }
        .title-center { text-align: center; font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
        .title-sub { font-size: 11px; font-weight: 600; color: #475569; margin-top: 2px; }
        .title-right { text-align: right; font-size: 11px; font-weight: bold; color: #334155; }

        .podium-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .podium-box {
          border: 2px solid #0f172a;
          border-radius: 8px;
          padding: 10px 14px;
          text-align: center;
        }
        .podium-box.gold { background: #fffbeb; border-color: #d97706; }
        .podium-box.silver { background: #f8fafc; border-color: #64748b; }
        .podium-box.bronze { background: #fff7ed; border-color: #b45309; }
        .podium-place { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .podium-box.gold .podium-place { color: #b45309; }
        .podium-box.silver .podium-place { color: #475569; }
        .podium-box.bronze .podium-place { color: #9a3412; }
        .podium-name { font-size: 15px; font-weight: 900; color: #0f172a; }
        .podium-club { font-size: 11px; color: #475569; }

        .section-header {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin: 24px 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .repechage-divider {
          border: none;
          border-top: 2px dashed #cbd5e1;
          margin: 30px 0;
        }
        ${BX_STYLES}

        .signatures-section {
          margin-top: 40px;
          padding-top: 25px;
          border-top: 1px solid #cbd5e1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          margin-top: 35px;
        }
        .footer-note {
          margin-top: 25px;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <div>
          <span class="banner-title">✨ Official TNJA Visual Competition Bracket Chart</span>
          <span class="banner-subtitle">Click "Save as PDF" in your browser's print dialog to download this official chart as a PDF file.</span>
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Download / Save as PDF</button>
      </div>

      <table class="header-table">
        <tr>
          <td style="width: 25%;">
            <div class="title-left">TNJA TOURNAMENT SYSTEM</div>
            <div style="font-size: 10px; color: #475569;">Tamil Nadu Judo Association • IJF Rules</div>
          </td>
          <td style="width: 50%;">
            <div class="title-center">OFFICIAL BRACKET CHART</div>
            <div class="title-sub" style="text-align:center;">
              <strong>${ageGroup}</strong> • <strong>${gender}</strong> • <strong>${weight}</strong> &nbsp;|&nbsp; MAT ${draw.matNumber || 1} &nbsp;|&nbsp; ${activePlayers.length} Competitors
            </div>
          </td>
          <td class="title-right" style="width: 25%;">
            <div>Date: ${formattedDate}</div>
            <div>${tournament?.location || 'Tamil Nadu'}</div>
          </td>
        </tr>
      </table>

      <div class="podium-bar">
        <div class="podium-box gold">
          <div class="podium-place">🥇 1ST PLACE (GOLD)</div>
          <div class="podium-name">${goldWinnerName}</div>
          <div class="podium-club">${goldWinnerClub || '—'}</div>
        </div>
        <div class="podium-box silver">
          <div class="podium-place">🥈 2ND PLACE (SILVER)</div>
          <div class="podium-name">${silverWinnerName}</div>
          <div class="podium-club">${silverWinnerClub || '—'}</div>
        </div>
        <div class="podium-box bronze">
          <div class="podium-place">🥉 3RD PLACE (BRONZE)</div>
          <div class="podium-name">${bronzeWinners[0]?.name || bronzeWinners.map(b => b.name).join(" / ") || '—'}</div>
          <div class="podium-club">${bronzeWinners[0]?.club || bronzeWinners.map(b => b.club).join(" / ") || '—'}</div>
        </div>
      </div>

      <div class="section-header">
        <span>🏆</span> MAIN CHAMPIONSHIP BRACKET (${formatLabel})
      </div>
      ${mainTree.html}

      ${repechageRounds.length > 0 ? `
        <hr class="repechage-divider" />
        <div class="section-header">
          <span>🛡️</span> REPECHAGE & BRONZE MEDAL BRACKET
        </div>
        ${repTree.html}
      ` : ''}

      <div class="signatures-section">
        <div>
          <div class="sig-line">Chief Referee Signature</div>
        </div>
        <div>
          <div class="sig-line">Tournament Director Signature</div>
        </div>
        <div>
          <div class="sig-line">TNJA Official Seal & Timestamp</div>
        </div>
      </div>

      <div class="footer-note">
        TNJA Tournament Management System — Generated on ${new Date().toLocaleString("en-IN")} — Official Competition Bracket Chart
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  } else {
    alert("Please allow popups to export the PDF Chart.");
  }
}

export function exportRoundRobinChartPDF(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;

  const catLabel = categoryKey.replace(/_/g, " ");
  const parts = catLabel.split(" ");
  const ageGroup = draw.ageGroup || parts[0] || "";
  const gender = draw.gender || parts[1] || "";
  const weight = draw.weightCategory === "ALL" ? "Open" : (draw.weightCategory || parts[2] || "");
  const activePlayers = players.filter(p => p.status === "APPROVED");

  const allMatches: any[] = [];
  draw.rounds.forEach(roundMatches => {
    roundMatches.forEach(m => {
      if (!m.slotA.isBye && !m.slotB.isBye) {
        allMatches.push(m);
      }
    });
  });

  const standingsMap: Record<string, {
    playerId: string;
    name: string;
    club: string;
    wins: number;
    points: number;
    totalWinningTime: number;
  }> = {};

  activePlayers.forEach(p => {
    standingsMap[p.id] = {
      playerId: p.id,
      name: p.name,
      club: p.club || "",
      wins: 0,
      points: 0,
      totalWinningTime: 0,
    };
  });

  allMatches.forEach(m => {
    if (m.status === "COMPLETED") {
      const ptsA = m.scoreA ? ((m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0)) : 0;
      const ptsB = m.scoreB ? ((m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0)) : 0;
      if (standingsMap[m.slotA.playerId]) standingsMap[m.slotA.playerId].points += Math.min(ptsA, 100);
      if (standingsMap[m.slotB.playerId]) standingsMap[m.slotB.playerId].points += Math.min(ptsB, 100);

      if (m.winnerId && standingsMap[m.winnerId]) {
        standingsMap[m.winnerId].wins += 1;
        standingsMap[m.winnerId].totalWinningTime += (m.elapsedSeconds || 0);
      }
    }
  });

  const sortedPlayers = Object.values(standingsMap).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.points !== a.points) return b.points - a.points;
    return a.totalWinningTime - b.totalWinningTime;
  });

  const goldWinner = sortedPlayers[0];
  const silverWinner = sortedPlayers[1];
  const bronzeWinner = sortedPlayers[2];

  const formatTime = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formattedDate = tournament?.date ? new Date(tournament.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TNJA_Bracket_Chart_${catLabel.replace(/[^a-zA-Z0-9]/g, "_")}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 15px; }
        
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }

        .no-print {
          background: #0f172a;
          color: #fff;
          padding: 12px 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .banner-title { font-weight: 800; font-size: 14px; color: #FF7400; display: block; }
        .banner-subtitle { font-size: 12px; color: #cbd5e1; }
        .print-btn {
          background: #FF7400;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          border: 2px solid #0f172a;
        }
        .header-table td {
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          vertical-align: middle;
        }
        .title-left { font-size: 11px; font-weight: 900; color: #FF7400; letter-spacing: 0.5px; }
        .title-center { text-align: center; font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
        .title-sub { font-size: 11px; font-weight: 600; color: #475569; margin-top: 2px; }
        .title-right { text-align: right; font-size: 11px; font-weight: bold; color: #334155; }

        .podium-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .podium-box {
          border: 2px solid #0f172a;
          border-radius: 8px;
          padding: 10px 14px;
          text-align: center;
        }
        .podium-box.gold { background: #fffbeb; border-color: #d97706; }
        .podium-box.silver { background: #f8fafc; border-color: #64748b; }
        .podium-box.bronze { background: #fff7ed; border-color: #b45309; }
        .podium-place { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .podium-box.gold .podium-place { color: #b45309; }
        .podium-box.silver .podium-place { color: #475569; }
        .podium-box.bronze .podium-place { color: #9a3412; }
        .podium-name { font-size: 15px; font-weight: 900; color: #0f172a; }
        .podium-club { font-size: 11px; color: #475569; }

        .section-header {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin: 24px 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pool-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
          font-size: 12px;
          border: 1.5px solid #0f172a;
        }
        .pool-table th, .pool-table td {
          border: 1px solid #cbd5e1;
          padding: 10px;
          text-align: left;
        }
        .pool-table th {
          background: #f8fafc;
          font-weight: 900;
          color: #334155;
          text-transform: uppercase;
          font-size: 11px;
        }
        .pool-table td.center, .pool-table th.center { text-align: center; }

        .matches-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .match-card {
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          overflow: hidden;
        }
        .match-card-top {
          background: #f8fafc;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 800;
          color: #475569;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
        }
        .match-num { color: #FF7400; }
        .player-slot {
          padding: 7px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }
        .player-slot.winner {
          background: #f0fdf4;
          font-weight: 800;
        }
        .player-name { font-weight: 700; color: #0f172a; }
        .player-club { font-size: 10px; color: #64748b; }
        .score-pill {
          background: #f1f5f9;
          color: #0f172a;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
        .player-slot.winner .score-pill {
          background: #16a34a;
          color: #fff;
        }
        .slot-divider { height: 1px; background: #e2e8f0; }

        .signatures-section {
          margin-top: 40px;
          padding-top: 25px;
          border-top: 1px solid #cbd5e1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          margin-top: 35px;
        }
        .footer-note {
          margin-top: 25px;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <div>
          <span class="banner-title">✨ Official TNJA Visual Pool Chart</span>
          <span class="banner-subtitle">Click "Save as PDF" in your browser's print dialog to download this official chart as a PDF file.</span>
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Download / Save as PDF</button>
      </div>

      <table class="header-table">
        <tr>
          <td style="width: 25%;">
            <div class="title-left">TNJA TOURNAMENT SYSTEM</div>
            <div style="font-size: 10px; color: #475569;">Tamil Nadu Judo Association • IJF Rules</div>
          </td>
          <td style="width: 50%;">
            <div class="title-center">ROUND ROBIN POOL CHART</div>
            <div class="title-sub" style="text-align:center;">
              <strong>${ageGroup}</strong> • <strong>${gender}</strong> • <strong>${weight}</strong> &nbsp;|&nbsp; MAT ${draw.matNumber || 1} &nbsp;|&nbsp; ${activePlayers.length} Competitors
            </div>
          </td>
          <td class="title-right" style="width: 25%;">
            <div>Date: ${formattedDate}</div>
            <div>${tournament?.location || 'Tamil Nadu'}</div>
          </td>
        </tr>
      </table>

      <div class="podium-bar">
        <div class="podium-box gold">
          <div class="podium-place">🥇 1ST PLACE (GOLD)</div>
          <div class="podium-name">${goldWinner ? goldWinner.name : '—'}</div>
          <div class="podium-club">${goldWinner ? goldWinner.club : '—'}</div>
        </div>
        <div class="podium-box silver">
          <div class="podium-place">🥈 2ND PLACE (SILVER)</div>
          <div class="podium-name">${silverWinner ? silverWinner.name : '—'}</div>
          <div class="podium-club">${silverWinner ? silverWinner.club : '—'}</div>
        </div>
        <div class="podium-box bronze">
          <div class="podium-place">🥉 3RD PLACE (BRONZE)</div>
          <div class="podium-name">${bronzeWinner ? bronzeWinner.name : '—'}</div>
          <div class="podium-club">${bronzeWinner ? bronzeWinner.club : '—'}</div>
        </div>
      </div>

      <div class="section-header">
        <span>📊</span> OFFICIAL ROUND ROBIN STANDINGS MATRIX
      </div>
      <table class="pool-table">
        <thead>
          <tr>
            <th class="center" style="width: 45px;">Rank</th>
            <th>Athlete Name</th>
            <th>Club / District</th>
            <th class="center" style="width: 70px;">Wins</th>
            <th class="center" style="width: 80px;">Points</th>
            <th class="center" style="width: 100px;">Winning Time</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlayers.map((p, idx) => `
            <tr>
              <td class="center" style="font-weight: 900; ${idx === 0 ? 'color: #b45309;' : idx === 1 ? 'color: #475569;' : idx === 2 ? 'color: #9a3412;' : ''}">${idx + 1}</td>
              <td style="font-weight: 700;">${p.name}</td>
              <td style="color: #64748b;">${p.club || '—'}</td>
              <td class="center" style="font-weight: 800; color: #16a34a;">${p.wins}</td>
              <td class="center" style="font-weight: 800; color: #2563eb;">${p.points}</td>
              <td class="center" style="color: #475569;">${formatTime(p.totalWinningTime)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="section-header">
        <span>⚔️</span> ROUND ROBIN CONTEST CARDS (${allMatches.length} Matches)
      </div>
      <div class="matches-grid">
        ${allMatches.map(m => {
          const clubA = activePlayers.find(p => p.id === m.slotA.playerId)?.club || "";
          const clubB = activePlayers.find(p => p.id === m.slotB.playerId)?.club || "";
          const winnerA = m.winnerId && m.winnerId === m.slotA.playerId;
          const winnerB = m.winnerId && m.winnerId === m.slotB.playerId;

          const scoreA_str = m.scoreA ? `${m.scoreA.ippon || 0}.${m.scoreA.wazaAri || 0}.${m.scoreA.yuko || 0}` : "0.0.0";
          const scoreB_str = m.scoreB ? `${m.scoreB.ippon || 0}.${m.scoreB.wazaAri || 0}.${m.scoreB.yuko || 0}` : "0.0.0";

          return `
            <div class="match-card">
              <div class="match-card-top">
                <span class="match-num">MATCH #${m.matchNumber}</span>
                <span class="mat-num">MAT ${m.matNumber || draw.matNumber || 1}</span>
              </div>
              <div class="player-slot ${winnerA ? 'winner' : ''}">
                <div>
                  <span class="player-name">${m.slotA.playerName}</span>
                  <span class="player-club">${clubA ? `(${clubA})` : ''}</span>
                </div>
                <div class="score-pill">${scoreA_str}</div>
              </div>
              <div class="slot-divider"></div>
              <div class="player-slot ${winnerB ? 'winner' : ''}">
                <div>
                  <span class="player-name">${m.slotB.playerName}</span>
                  <span class="player-club">${clubB ? `(${clubB})` : ''}</span>
                </div>
                <div class="score-pill">${scoreB_str}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="signatures-section">
        <div>
          <div class="sig-line">Chief Referee Signature</div>
        </div>
        <div>
          <div class="sig-line">Tournament Director Signature</div>
        </div>
        <div>
          <div class="sig-line">TNJA Official Seal & Timestamp</div>
        </div>
      </div>

      <div class="footer-note">
        TNJA Tournament Management System — Generated on ${new Date().toLocaleString("en-IN")} — Official Round Robin Chart
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  } else {
    alert("Please allow popups to export the PDF Chart.");
  }
}

export function exportCategoryChartPDF(
  tournament: Tournament | null,
  categoryKey: string,
  draw: DrawCategory,
  players: RegisteredPlayer[]
) {
  if (!draw || !draw.rounds) return;
  if (isDrawRoundRobin(draw)) {
    exportRoundRobinChartPDF(tournament, categoryKey, draw, players);
  } else {
    exportEliminationChartPDF(tournament, categoryKey, draw, players);
  }
}



