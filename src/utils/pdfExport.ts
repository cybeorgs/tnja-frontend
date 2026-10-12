export function roundName(ri: number, total: number): string {
  const fromEnd = total - ri;
  if (fromEnd === 1) return "🏆 Final";
  if (fromEnd === 2) return "Semi-Final";
  if (fromEnd === 3) return "Quarter-Final";
  return `Round ${ri + 1}`;
}

export function exportMatchToPDF(
  match: any,
  winner: any,
  loser: any,
  tournament: any,
  roundIndex: number,
  nextMatchInfo: any,
) {
  const logs = match.logs || [];
  const fighterA = match.slotA || { playerName: "Player A", club: "" };
  const fighterB = match.slotB || { playerName: "Player B", club: "" };
  const scoreA = match.scoreA || { ippon: 0, wazaAri: 0, yuko: 0, shido: 0 };
  const scoreB = match.scoreB || { ippon: 0, wazaAri: 0, yuko: 0, shido: 0 };

  const logsHtml = logs.length > 0 
    ? logs.map((log: any) => {
        const time = new Date(log.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
        const comp = log.fighter === "A" ? fighterA.playerName : (log.fighter === "B" ? fighterB.playerName : "System");
        return `
          <tr>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px;">${time}</td>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px;">${comp}</td>
            <td style="border: 1px solid #d1d5db; padding: 12px 16px;">
              ${log.type === "score" ? "✅ " : (log.type === "penalty" ? "⚠️ " : "")}${log.text}
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="3" style="border: 1px solid #d1d5db; padding: 16px; text-align: center; color: #6b7280;">No timeline data available for this match.</td></tr>`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TNJA Official Match Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @page { size: auto; margin: 0mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', sans-serif;
          background-color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          padding: 48px 64px;
          color: #000;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 24px;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .header img {
          width: 96px;
          height: 96px;
          object-fit: contain;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 36px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .header h2 {
          font-size: 24px;
          font-weight: 700;
          color: #4b5563;
          text-transform: uppercase;
        }
        .vs-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }
        .player-box {
          flex: 1;
          border: 2px solid #000;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
        }
        .player-box h3 {
          font-size: 14px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
        }
        .player-box.white h2, .player-box.white h4 { color: #ea580c; }
        .player-box.blue h2, .player-box.blue h4 { color: #d97706; }
        .player-box h2 {
          font-size: 30px;
          font-weight: 900;
          line-height: 1.2;
        }
        .player-box h4 {
          font-size: 20px;
          font-weight: 700;
          margin-top: 4px;
        }
        .vs-text {
          padding: 0 32px;
          font-size: 36px;
          font-weight: 900;
          color: #9ca3af;
        }
        .section-title {
          font-size: 20px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          margin-bottom: 40px;
        }
        th {
          background-color: #f9fafb;
          border: 1px solid #d1d5db;
          padding: 12px 16px;
          font-weight: 700;
          text-align: center;
        }
        th.left { text-align: left; }
        td {
          border: 1px solid #d1d5db;
          padding: 16px;
          font-weight: 700;
        }
        td.center {
          text-align: center;
          font-size: 24px;
          font-weight: 900;
        }
        td.shido { color: #dc2626; }
        .winner-box {
          border: 2px solid #000;
          background-color: #f9fafb;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
        }
        .winner-box h3 {
          font-size: 14px;
          font-weight: 900;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .winner-box h2 {
          font-size: 36px;
          font-weight: 900;
          color: #16a34a;
        }
        .footer {
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
          margin-top: 40px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/navbar/Logo.png" alt="TNJA Logo" />
        <h1>Tamil Nadu Judo Association</h1>
        <h2>Official Match Report</h2>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding: 20px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px;">
        <div>
          <p style="font-size: 12px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Tournament</p>
          <p style="font-size: 18px; font-weight: 800; color: #1f2937;">${tournament?.title || "TNJA Championship"}</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Mat Number</p>
          <p style="font-size: 18px; font-weight: 800; color: #ea580c;">${match?.matNumber || "N/A"}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 12px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Match Number</p>
          <p style="font-size: 18px; font-weight: 800; color: #3b82f6;">#${match?.matchNumber || "N/A"}</p>
        </div>
      </div>

      <div class="vs-box">
        <div class="player-box white">
          <h3>Player 1 (White)</h3>
          <h2>${fighterA.playerName}</h2>
          <h4>${fighterA.club || ""}</h4>
        </div>
        <div class="vs-text">VS</div>
        <div class="player-box blue">
          <h3>Player 2 (Blue)</h3>
          <h2>${fighterB.playerName}</h2>
          <h4>${fighterB.club || ""}</h4>
        </div>
      </div>

      <div class="section-title">Final Score</div>
      <table>
        <thead>
          <tr>
            <th class="left">Player</th>
            <th>Ippon</th>
            <th>Waza-Ari</th>
            <th>Yuko</th>
            <th>Shido</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${fighterA.playerName}</td>
            <td class="center">${scoreA.ippon}</td>
            <td class="center">${scoreA.wazaAri}</td>
            <td class="center">${scoreA.yuko}</td>
            <td class="center shido">${scoreA.shido}</td>
          </tr>
          <tr>
            <td>${fighterB.playerName}</td>
            <td class="center">${scoreB.ippon}</td>
            <td class="center">${scoreB.wazaAri}</td>
            <td class="center">${scoreB.yuko}</td>
            <td class="center shido">${scoreB.shido}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Match Log / Timeline</div>
      <table>
        <thead>
          <tr>
            <th class="left" style="width: 100px;">Time</th>
            <th class="left" style="width: 200px;">Competitor</th>
            <th class="left">Action / Description</th>
          </tr>
        </thead>
        <tbody>
          ${logsHtml}
        </tbody>
      </table>

      <div class="winner-box">
        <h3>Officially Declared Winner</h3>
        <h2>${winner.playerName}</h2>
      </div>

      <div class="footer">
        Generated by TNJA Tournament Management System on ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  // Give the browser a moment to parse the HTML and apply styles
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    // Clean up after printing
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
