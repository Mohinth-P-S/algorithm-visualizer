/**
 * Algorithm Visualizer - Frontend Application
 * Pure Vanilla JavaScript, zero external libraries.
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const algoSelect = document.getElementById("algo-select");
  const sizeSlider = document.getElementById("size-slider");
  const sizeValBadge = document.getElementById("size-val");
  const speedSlider = document.getElementById("speed-slider");
  const speedValBadge = document.getElementById("speed-val");
  const searchGroup = document.getElementById("search-target-group");
  const searchInput = document.getElementById("search-target");

  const btnNew = document.getElementById("btn-new");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const btnClearHistory = document.getElementById("btn-clear-history");

  const compCountEl = document.getElementById("comp-count");
  const writeCountEl = document.getElementById("write-count");
  const statusBox = document.getElementById("status-message");
  const barsContainer = document.getElementById("bars-container");

  const runsTableBody = document.getElementById("runs-table-body");
  const statsTableBody = document.getElementById("stats-table-body");

  // State
  let array = [];
  let isRunning = false;
  let stopRequested = false;
  let comparisons = 0;
  let writes = 0;

  function setStatus(msg) {
    statusBox.textContent = msg;
  }

  function getAlgorithm(key) {
    if (typeof window !== "undefined" && window.ALGORITHMS && window.ALGORITHMS[key]) {
      return window.ALGORITHMS[key];
    }
    if (typeof ALGORITHMS !== "undefined" && ALGORITHMS[key]) {
      return ALGORITHMS[key];
    }
    return null;
  }

  function formatAlgorithmName(algoKey) {
    const algo = getAlgorithm(algoKey);
    if (algo) {
      return algo.name;
    }
    return algoKey.charAt(0).toUpperCase() + algoKey.slice(1);
  }

  function formatLocalTime(timestamp) {
    if (!timestamp) return "—";
    try {
      // SQLite timestamp default: "YYYY-MM-DD HH:MM:SS" (in UTC)
      const isoStr = timestamp.replace(" ", "T") + "Z";
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) {
        return timestamp;
      }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return timestamp;
    }
  }

  function getDelayMs() {
    const val = parseInt(speedSlider.value, 10);
    // 1 -> 400ms (slow), 100 -> 2ms (very fast)
    const factor = (101 - val) / 100;
    return Math.max(2, Math.round(400 * factor * factor));
  }

  function updateSpeedBadge() {
    const val = parseInt(speedSlider.value, 10);
    if (val < 30) speedValBadge.textContent = "Slow";
    else if (val < 75) speedValBadge.textContent = "Normal";
    else speedValBadge.textContent = "Fast";
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isArraySorted(arr) {
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] > arr[i + 1]) return false;
    }
    return true;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  function generateNewArray() {
    if (isRunning) return;
    const size = parseInt(sizeSlider.value, 10);
    sizeValBadge.textContent = String(size);

    array = [];
    for (let i = 0; i < size; i++) {
      // Random integer between 5 and 100
      array.push(Math.floor(Math.random() * 96) + 5);
    }

    // Pre-fill search target with an element from the array
    if (array.length > 0) {
      const randomItem = array[Math.floor(Math.random() * array.length)];
      searchInput.value = String(randomItem);
    }

    renderBars();
    resetMetrics();
    setStatus("Generated new array. Ready to run.");
  }

  function resetMetrics() {
    comparisons = 0;
    writes = 0;
    compCountEl.textContent = "0";
    writeCountEl.textContent = "0";
  }

  function renderBars(activeIndices = {}, dimmedRange = null) {
    // Clear container
    barsContainer.textContent = "";

    const maxVal = Math.max(...array, 100);
    const showNumbers = array.length <= 40;

    for (let i = 0; i < array.length; i++) {
      const val = array[i];
      const bar = document.createElement("div");
      bar.className = "array-bar";

      // Height proportional to value
      const heightPercent = Math.max(8, Math.round((val / maxVal) * 94));
      bar.style.height = `${heightPercent}%`;

      if (showNumbers) {
        bar.textContent = String(val);
      }

      // Highlighting classes
      if (activeIndices.comparing && activeIndices.comparing.includes(i)) {
        bar.classList.add("bar-comparing");
      } else if (activeIndices.changed && activeIndices.changed.includes(i)) {
        bar.classList.add("bar-changed");
      } else if (activeIndices.found && activeIndices.found.includes(i)) {
        bar.classList.add("bar-found");
      }

      // Range dimming for binary search
      if (dimmedRange !== null) {
        if (i < dimmedRange.lo || i > dimmedRange.hi) {
          bar.classList.add("bar-dimmed");
        }
      }

      barsContainer.appendChild(bar);
    }
  }

  function setControlsRunning(running) {
    isRunning = running;
    btnStart.disabled = running;
    algoSelect.disabled = running;
    sizeSlider.disabled = running;
    btnNew.disabled = running;
    btnStop.disabled = !running;
    if (searchInput) searchInput.disabled = running;
  }

  function onAlgoChange() {
    const key = algoSelect.value;
    const algo = getAlgorithm(key);

    if (algo && algo.kind === "search") {
      searchGroup.style.display = "flex";
      if (!searchInput.value && array.length > 0) {
        searchInput.value = String(array[Math.floor(Math.random() * array.length)]);
      }
    } else {
      searchGroup.style.display = "none";
    }
  }

  async function startVisualization() {
    if (isRunning) return;

    const algoKey = algoSelect.value;
    const algo = getAlgorithm(algoKey);
    if (!algo) {
      setStatus("Selected algorithm not found.");
      return;
    }

    let target = null;
    if (algo.kind === "search") {
      const inputStr = searchInput.value.trim();
      const num = parseInt(inputStr, 10);
      if (!inputStr || isNaN(num) || num < 1 || num > 100 || String(num) !== inputStr) {
        setStatus("Please enter a valid whole number between 1 and 100 to search for.");
        return;
      }
      target = num;
    }

    setControlsRunning(true);
    resetMetrics();
    stopRequested = false;

    // Check pre-conditions
    if (algo.kind === "sort") {
      if (isArraySorted(array)) {
        setStatus("Array was already sorted. Shuffling before sorting...");
        shuffle(array);
        renderBars();
        await sleep(400);
      }
    } else if (algo.needsSorted) {
      if (!isArraySorted(array)) {
        setStatus("Array sorted before running binary search.");
        array.sort((a, b) => a - b);
        renderBars();
        await sleep(500);
      }
    }

    setStatus(`Running ${algo.name}...`);

    const generator = algo.fn(array, target);
    let activeRange = null;
    let foundIndex = null;
    let isMiss = false;

    try {
      while (!stopRequested) {
        const { value: event, done } = generator.next();
        if (done) break;

        if (event.t === "cmp") {
          comparisons++;
          compCountEl.textContent = String(comparisons);
          renderBars({ comparing: event.k }, activeRange);
        } else if (event.t === "write") {
          writes += event.k.length;
          writeCountEl.textContent = String(writes);
          renderBars({ changed: event.k }, activeRange);
        } else if (event.t === "range") {
          activeRange = { lo: event.lo, hi: event.hi };
          renderBars({}, activeRange);
        } else if (event.t === "found") {
          foundIndex = event.i;
          renderBars({ found: [foundIndex] }, null);
        } else if (event.t === "miss") {
          isMiss = true;
          renderBars({}, null);
        }

        const delay = getDelayMs();
        await sleep(delay);
      }
    } catch (err) {
      console.error("Execution error:", err);
      setStatus(`Error during execution: ${err.message}`);
    }

    if (stopRequested) {
      setStatus("Run stopped by user.");
      renderBars({}, null);
      setControlsRunning(false);
      return;
    }

    // Finished successfully
    let summary = "";
    if (algo.kind === "sort") {
      // Mark all bars green/teal sequentially or at once
      const allIndices = array.map((_, idx) => idx);
      renderBars({ found: allIndices }, null);
      summary = `${algo.name} completed! Size: ${array.length}, Comparisons: ${comparisons}, Writes: ${writes}.`;
    } else {
      if (foundIndex !== null) {
        renderBars({ found: [foundIndex] }, null);
        summary = `${algo.name} found ${target} at position ${foundIndex}! Comparisons: ${comparisons}.`;
      } else if (isMiss) {
        summary = `${algo.name}: ${target} not found in array. Comparisons: ${comparisons}.`;
      } else {
        summary = `${algo.name} finished. Comparisons: ${comparisons}.`;
      }
    }

    setStatus(summary);
    setControlsRunning(false);

    // Save run to API
    await saveRun(algoKey, array.length, comparisons, writes, summary);
  }

  function stopVisualization() {
    if (!isRunning) return;
    stopRequested = true;
  }

  async function saveRun(algorithm, size, comp, wr, summaryMessage) {
    const payload = {
      algorithm,
      size,
      comparisons: comp,
      writes: wr,
    };

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setStatus(`${summaryMessage} (Note: Run was not saved to history).`);
      } else {
        await loadHistory();
      }
    } catch {
      setStatus(`${summaryMessage} (Note: Run was not saved to history).`);
    }
  }

  async function loadHistory() {
    await Promise.all([loadLatestRuns(), loadStats()]);
  }

  async function loadLatestRuns() {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) return;
      const runs = await res.json();

      runsTableBody.textContent = "";

      if (!Array.isArray(runs) || runs.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "empty-state";
        td.textContent = "No runs recorded yet.";
        tr.appendChild(td);
        runsTableBody.appendChild(tr);
        return;
      }

      for (const r of runs) {
        const tr = document.createElement("tr");

        const tdAlgo = document.createElement("td");
        tdAlgo.textContent = formatAlgorithmName(r.algorithm);
        tr.appendChild(tdAlgo);

        const tdSize = document.createElement("td");
        tdSize.textContent = String(r.size);
        tr.appendChild(tdSize);

        const tdComp = document.createElement("td");
        tdComp.textContent = Number(r.comparisons).toLocaleString();
        tr.appendChild(tdComp);

        const tdWrites = document.createElement("td");
        tdWrites.textContent = Number(r.writes).toLocaleString();
        tr.appendChild(tdWrites);

        const tdTime = document.createElement("td");
        tdTime.textContent = formatLocalTime(r.created_at);
        tr.appendChild(tdTime);

        runsTableBody.appendChild(tr);
      }
    } catch (e) {
      console.warn("Failed to load runs:", e);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      const stats = await res.json();

      statsTableBody.textContent = "";

      if (!Array.isArray(stats) || stats.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "empty-state";
        td.textContent = "No stats available yet.";
        tr.appendChild(td);
        statsTableBody.appendChild(tr);
        return;
      }

      for (const s of stats) {
        const tr = document.createElement("tr");

        const tdAlgo = document.createElement("td");
        tdAlgo.textContent = formatAlgorithmName(s.algorithm);
        tr.appendChild(tdAlgo);

        const tdRuns = document.createElement("td");
        tdRuns.textContent = String(s.runs);
        tr.appendChild(tdRuns);

        const tdAvgSize = document.createElement("td");
        tdAvgSize.textContent = Number(s.avg_size).toFixed(1);
        tr.appendChild(tdAvgSize);

        const tdAvgComp = document.createElement("td");
        tdAvgComp.textContent = Number(s.avg_comparisons).toFixed(1);
        tr.appendChild(tdAvgComp);

        const tdAvgWrites = document.createElement("td");
        tdAvgWrites.textContent = Number(s.avg_writes).toFixed(1);
        tr.appendChild(tdAvgWrites);

        statsTableBody.appendChild(tr);
      }
    } catch (e) {
      console.warn("Failed to load stats:", e);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Are you sure you want to clear all run history?")) {
      return;
    }

    try {
      const res = await fetch("/api/runs", { method: "DELETE" });
      if (res.ok) {
        setStatus("Run history cleared successfully.");
        await loadHistory();
      } else {
        setStatus("Failed to clear history.");
      }
    } catch {
      setStatus("Failed to connect to server to clear history.");
    }
  }

  // Event Listeners
  sizeSlider.addEventListener("input", () => {
    sizeValBadge.textContent = sizeSlider.value;
    generateNewArray();
  });

  speedSlider.addEventListener("input", updateSpeedBadge);
  algoSelect.addEventListener("change", onAlgoChange);

  btnNew.addEventListener("click", generateNewArray);
  btnStart.addEventListener("click", startVisualization);
  btnStop.addEventListener("click", stopVisualization);
  btnClearHistory.addEventListener("click", clearHistory);

  // Initialize
  updateSpeedBadge();
  onAlgoChange();
  generateNewArray();
  loadHistory();
});
