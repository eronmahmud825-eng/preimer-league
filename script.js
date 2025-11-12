// script.js - handles saving, loading, deleting matches and building table/history
// Requires firebase.js to have run (window.db)

const ADMIN_PASSWORD = "eron2025";
const coachesList = ["ERON", "ARIN", "LAWIN"];

/* ---------- Helpers ---------- */
function docToMatch(doc) {
    const d = doc.data();
    return { id: doc.id, p1: d.p1, p2: d.p2, s1: Number(d.s1), s2: Number(d.s2), date: d.date || "", savedAt: d.savedAt || "" };
}

/* apply a match to coaches accumulator */
function applyMatchToCoaches(match, coaches) {
    const a = coaches.find(c => c.name === match.p1);
    const b = coaches.find(c => c.name === match.p2);
    if (!a || !b) return;

    a.game += 1;
    b.game += 1;

    a.gf += match.s1;
    a.ga += match.s2;

    b.gf += match.s2;
    b.ga += match.s1;

    if (match.s1 > match.s2) {
        a.win += 1;
        b.lose += 1;
    } else if (match.s1 < match.s2) {
        b.win += 1;
        a.lose += 1;
    } else {
        a.draw += 1;
        b.draw += 1;
    }
}

/* compute coaches from match array */
function computeCoachesFromMatches(matches) {
    // baseline zeros
    const coaches = coachesList.map(name => ({
        name,
        game: 0,
        win: 0,
        lose: 0,
        draw: 0,
        ga: 0,
        gf: 0,
        diff: 0,
        point: 0
    }));

    matches.forEach(m => applyMatchToCoaches(m, coaches));

    coaches.forEach(c => { c.diff = c.gf - c.ga;
        c.point = c.win * 3 + c.draw; });

    // sort by points, diff, gf
    coaches.sort((x, y) => {
        if (y.point !== x.point) return y.point - x.point;
        if (y.diff !== x.diff) return y.diff - x.diff;
        return (y.gf || 0) - (x.gf || 0);
    });

    return coaches;
}

/* ---------- Render Table (stack-friendly) ---------- */
function renderLeagueTable(matches) {
    const tbody = document.querySelector("#leagueTable tbody");
    if (!tbody) return;
    const coaches = computeCoachesFromMatches(matches);
    tbody.innerHTML = "";

    coaches.forEach((c, idx) => {
        // create row with data-label attributes for mobile stacked layout
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td data-label="Rank"><span class="value">${idx+1}</span></td>
      <td data-label="Coach"><span class="value">${c.name}</span></td>
      <td data-label="Game"><span class="value">${c.game}</span></td>
      <td data-label="Win"><span class="value">${c.win}</span></td>
      <td data-label="Lose"><span class="value">${c.lose}</span></td>
      <td data-label="Draw"><span class="value">${c.draw}</span></td>
      <td data-label="GA"><span class="value">${c.ga}</span></td>
      <td data-label="GF"><span class="value">${c.gf}</span></td>
      <td data-label="Diff"><span class="value">${c.diff}</span></td>
      <td data-label="Point"><span class="value">${c.point}</span></td>
    `;
        tbody.appendChild(tr);
    });
}

/* ---------- Render History (stack-friendly) ---------- */
function renderHistoryList(matchesWithIds) {
    const tbody = document.querySelector("#historyTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // newest first
    const arr = matchesWithIds.slice().reverse();
    arr.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td data-label="Date"><span class="value">${m.date}</span></td>
      <td data-label="Match"><span class="value">${m.p1} vs ${m.p2}</span></td>
      <td data-label="Score"><span class="value">${m.s1}-${m.s2}</span></td>
      <td data-label="Action"><span class="value"><button class="delete-btn" data-id="${m.id}">🗑 Delete</button></span></td>
    `;
        tbody.appendChild(tr);
    });

    // attach delete handlers
    tbody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.getAttribute("data-id");
            onDeleteMatchClick(id);
        });
    });
}

/* ---------- Delete match (admin prompt) ---------- */
function onDeleteMatchClick(docId) {
    const pass = prompt("Enter admin password to delete:");
    if (pass !== ADMIN_PASSWORD) { alert("❌ Wrong password"); return; }

    if (!window.db) { alert("Database not initialized"); return; }
    window.db.collection("matches").doc(docId).delete()
        .then(() => {
            alert("✅ Match deleted");
            // realtime listener will update table/history automatically
        })
        .catch(err => {
            console.error(err);
            alert("❌ Error deleting match");
        });
}

/* ---------- Save match (admin only) ---------- */
function setupSaveMatch() {
    const saveBtn = document.getElementById("saveMatchBtn");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", () => {
        const pass = document.getElementById("adminPass").value || "";
        if (pass !== ADMIN_PASSWORD) { alert("❌ Wrong password"); return; }

        const p1 = document.getElementById("player1").value;
        const p2 = document.getElementById("player2").value;
        const s1raw = document.getElementById("score1").value;
        const s2raw = document.getElementById("score2").value;
        const date = document.getElementById("matchDate").value;

        const s1 = Number(s1raw);
        const s2 = Number(s2raw);

        if (!p1 || !p2 || p1 === p2) { alert("❌ Choose two different players"); return; }
        if (date === "") { alert("❌ Choose a date"); return; }
        if (!Number.isFinite(s1) || !Number.isFinite(s2)) { alert("❌ Enter valid scores"); return; }

        const matchDoc = {
            p1,
            p2,
            s1: String(s1),
            s2: String(s2),
            date,
            savedAt: new Date().toLocaleString()
        };

        if (!window.db) { alert("Database not initialized"); return; }
        window.db.collection("matches").add(matchDoc)
            .then(() => {
                alert("✅ Match saved");
                // clear form
                document.getElementById("player1").value = "";
                document.getElementById("player2").value = "";
                document.getElementById("score1").value = "";
                document.getElementById("score2").value = "";
                document.getElementById("matchDate").value = "";
                document.getElementById("adminPass").value = "";
                // realtime will update UI
            })
            .catch(err => {
                console.error(err);
                alert("❌ Error saving match");
            });
    });
}

/* ---------- Real-time listeners ---------- */
function startRealtimeListeners() {
    if (!window.db) {
        console.error("db not available");
        return;
    }

    // Listen for matches collection changes and update UI live
    window.db.collection("matches").onSnapshot(snapshot => {
        const matches = [];
        snapshot.forEach(doc => matches.push(docToMatch(doc)));
        // render
        renderLeagueTable(matches);
        renderHistoryList(matches.map(m => m)); // includes id from docToMatch
    }, err => {
        console.error("Snapshot error:", err);
    });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
    // Start save handler if on match page
    setupSaveMatch();

    // Start realtime only once (safe to call on all pages)
    startRealtimeListeners();
    // ==========================
    // Load Encounters (Head-to-Head)
    // ==========================
    function loadEncounters() {
        const tbody = document.querySelector("#encountersTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        db.collection("matches").get().then(snapshot => {
            const results = {};

            snapshot.forEach(doc => {
                const m = doc.data();
                const p1 = m.p1,
                    p2 = m.p2,
                    s1 = Number(m.s1),
                    s2 = Number(m.s2);

                if (!results[p1]) results[p1] = {};
                if (!results[p2]) results[p2] = {};
                if (!results[p1][p2]) results[p1][p2] = { wins: 0, losses: 0 };
                if (!results[p2][p1]) results[p2][p1] = { wins: 0, losses: 0 };

                if (s1 > s2) {
                    results[p1][p2].wins++;
                    results[p2][p1].losses++;
                } else if (s2 > s1) {
                    results[p2][p1].wins++;
                    results[p1][p2].losses++;
                }
            });

            Object.keys(results).forEach(coach => {
                Object.keys(results[coach]).forEach(opp => {
                    const { wins, losses } = results[coach][opp];
                    if (wins > 0 || losses > 0) {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
            <td data-label="Coach">${coach}</td>
            <td data-label="Opponent">${opp}</td>
            <td data-label="Wins">${wins}</td>
            <td data-label="Losses">${losses}</td>
          `;
                        tbody.appendChild(tr);
                    }
                });
            });
        });
    }

    window.addEventListener("load", loadEncounters);

});
