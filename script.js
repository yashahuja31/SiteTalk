// Loops a tiny scripted conversation inside the hero mockup so the
// landing page demonstrates the product instead of just describing it.
const SCRIPT = [
  { name: "Quiet Otter", text: "anyone else reading this live blog rn", mine: false },
  { name: "You", text: "yep, refresh is wild today", mine: true },
  { name: "Bright Falcon", text: "that update at 2:04 changes everything", mine: false },
  { name: "You", text: "calling it now", mine: true },
];

const container = document.getElementById("widgetMessages");
const liveCount = document.getElementById("liveCount");
let i = 0;

function step() {
  if (!container) return;
  if (i >= SCRIPT.length) {
    container.innerHTML = "";
    i = 0;
  }
  const msg = SCRIPT[i++];
  const row = document.createElement("div");
  row.className = `wm-row ${msg.mine ? "mine" : ""}`;
  row.innerHTML = `<div class="wm-bubble">${msg.text}</div>`;
  container.appendChild(row);
  if (container.children.length > 4) container.removeChild(container.firstChild);

  if (liveCount) {
    const counts = ["2 online", "3 online", "3 online", "4 online"];
    liveCount.textContent = counts[(i - 1) % counts.length];
  }
}

step();
setInterval(step, 2200);
