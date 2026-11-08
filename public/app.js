// Pharos Whale-Watching Agent Frontend Client
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const currentBlockEl = document.getElementById('currentBlock');
  const mcpDotEl = document.getElementById('mcpDot');
  const mcpLabelEl = document.getElementById('mcpLabel');
  const btnManualScan = document.getElementById('btnManualScan');

  const statWhalesCountEl = document.getElementById('statWhalesCount');
  const statWhalesActiveEl = document.getElementById('statWhalesActive');
  const statTotalVolumeEl = document.getElementById('statTotalVolume');
  const statUsdcVolumeEl = document.getElementById('statUsdcVolume');
  const statMovementCountEl = document.getElementById('statMovementCount');
  const statThresholdInfoEl = document.getElementById('statThresholdInfo');

  const whaleMatrixBody = document.getElementById('whaleMatrixBody');
  const movementFeed = document.getElementById('movementFeed');
  const streamCounter = document.getElementById('streamCounter');

  // Modals
  const modalWatchlist = document.getElementById('modalWatchlist');
  const btnOpenWatchlist = document.getElementById('btnOpenWatchlist');
  const btnCloseWatchlist = document.getElementById('btnCloseWatchlist');
  const closeWatchlistBackdrop = document.getElementById('closeWatchlistBackdrop');
  const watchlistContainer = document.getElementById('watchlistContainer');
  const formAddWhale = document.getElementById('formAddWhale');

  const modalThresholds = document.getElementById('modalThresholds');
  const btnOpenThresholds = document.getElementById('btnOpenThresholds');
  const btnCloseThresholds = document.getElementById('btnCloseThresholds');
  const closeThresholdsBackdrop = document.getElementById('closeThresholdsBackdrop');
  const thresholdsContainer = document.getElementById('thresholdsContainer');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Polling State Guard
  let isPolling = false;
  let pollTimeoutId = null;

  async function fetchSummary() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/summary', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.summary) return;

      renderSummary(data.summary);
    } catch (err) {
      console.warn('Telemetry refresh warning:', err);
    }
  }

  async function fetchMovements() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/movements?limit=30', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.movements) return;

      renderMovements(data.movements);
    } catch (err) {
      console.warn('Movements fetch warning:', err);
    }
  }

  async function fetchTelemetry() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/telemetry', { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.telemetry) return;

      const t = data.telemetry;
      if (t.latestBlock && currentBlockEl) {
        currentBlockEl.textContent = '#' + t.latestBlock.toLocaleString();
      }

      if (mcpDotEl && mcpLabelEl) {
        if (t.mcpAvailable) {
          mcpDotEl.className = 'status-dot green';
          mcpLabelEl.textContent = 'MCP: Live (14 tools)';
        } else {
          mcpDotEl.className = 'status-dot pulse';
          mcpLabelEl.textContent = 'MCP: Synced';
        }
      }
    } catch (err) {
      console.warn('Telemetry fetch warning:', err);
    }
  }

  function renderSummary(summary) {
    if (statWhalesCountEl) statWhalesCountEl.textContent = `${summary.activeWatchedAddresses} / ${summary.totalWatchedAddresses}`;
    if (statWhalesActiveEl) statWhalesActiveEl.textContent = `${summary.activeWatchedAddresses} Active (Min 5 Requirement Met)`;

    if (statTotalVolumeEl) {
      statTotalVolumeEl.textContent = `$${summary.totalVolumeUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (statUsdcVolumeEl) {
      statUsdcVolumeEl.textContent = `${summary.totalUsdcVolume.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} USDC`;
    }

    if (statMovementCountEl) {
      statMovementCountEl.textContent = summary.totalMovementsDetected.toLocaleString();
    }

    // Render Matrix Table
    if (whaleMatrixBody && summary.whaleBreakdown) {
      if (summary.whaleBreakdown.length === 0) {
        whaleMatrixBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No whales in watchlist.</td></tr>`;
        return;
      }

      let html = '';
      for (const whale of summary.whaleBreakdown) {
        const netClass = whale.netFlowUsd > 0 ? 'positive-flow' : whale.netFlowUsd < 0 ? 'negative-flow' : '';
        const netSign = whale.netFlowUsd > 0 ? '+' : '';

        html += `
          <tr>
            <td class="whale-label-cell">${escapeHtml(whale.label)}</td>
            <td class="whale-address-cell">
              <a href="https://atlantic.pharosscan.xyz/address/${whale.address}" target="_blank" rel="noopener" class="explorer-link">
                ${whale.address.substring(0, 6)}...${whale.address.substring(whale.address.length - 4)} ↗
              </a>
            </td>
            <td class="mono-num">$${whale.inflowUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="mono-num">$${whale.outflowUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="mono-num ${netClass}">${netSign}$${whale.netFlowUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="mono-num">${whale.movementCount}</td>
            <td><span class="status-dot green"></span> Active</td>
          </tr>
        `;
      }
      whaleMatrixBody.innerHTML = html;
    }
  }

  function renderMovements(movements) {
    if (streamCounter) {
      streamCounter.textContent = `${movements.length} Movements Logged`;
    }

    if (!movementFeed) return;

    if (movements.length === 0) {
      movementFeed.innerHTML = `<div class="empty-state">No whale movements detected above threshold yet. Click "Scan Now" or wait for next block poll.</div>`;
      return;
    }

    let html = '';
    for (const m of movements) {
      const badgeClass =
        m.direction === 'INFLOW' ? 'badge-inflow' : m.direction === 'OUTFLOW' ? 'badge-outflow' : 'badge-internal';

      const timeStr = new Date(m.timestamp).toLocaleTimeString();

      html += `
        <div class="movement-card">
          <div class="movement-top">
            <span class="direction-badge ${badgeClass}">${m.direction}</span>
            <span class="movement-time">${timeStr} (Block #${m.blockNumber})</span>
          </div>
          <div class="movement-explanation">${escapeHtml(m.semanticExplanation)}</div>
          <div class="movement-bottom">
            <div class="movement-meta-item">
              <span>Token: <strong>${m.tokenSymbol}</strong></span>
              <span>•</span>
              <span>Source: <strong>${m.source || 'RPC'}</strong></span>
            </div>
            <a href="${m.explorerUrl}" target="_blank" rel="noopener" class="explorer-link">
              View on PharosScan ↗
            </a>
          </div>
        </div>
      `;
    }
    movementFeed.innerHTML = html;
  }

  async function loadWatchlistModal() {
    try {
      const res = await fetch('/api/whales');
      const data = await res.json();
      if (!data.success || !watchlistContainer) return;

      let html = '';
      for (const w of data.whales) {
        html += `
          <div class="whale-row">
            <div class="whale-row-info">
              <span class="whale-row-label">${escapeHtml(w.label)}</span>
              <span class="whale-row-address">${w.address}</span>
            </div>
            <div class="row-actions">
              <button class="btn-danger" onclick="window.removeWhale('${w.id}')">Remove</button>
            </div>
          </div>
        `;
      }
      watchlistContainer.innerHTML = html;
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    }
  }

  window.removeWhale = async function (id) {
    if (!confirm('Remove this whale from monitoring?')) return;
    try {
      const res = await fetch(`/api/whales/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to remove whale');
        return;
      }
      await loadWatchlistModal();
      await fetchSummary();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  async function loadThresholdsModal() {
    try {
      const res = await fetch('/api/thresholds');
      const data = await res.json();
      if (!data.success || !thresholdsContainer) return;

      let html = '';
      for (const t of data.thresholds) {
        html += `
          <div class="threshold-row">
            <div class="threshold-row-info">
              <span class="whale-row-label">${escapeHtml(t.name)}</span>
              <span class="whale-row-address">Token: ${t.tokenSymbol} | Min Amount: ${t.minAmount} ${t.tokenSymbol}</span>
            </div>
            <div class="row-actions">
              <button class="btn btn-secondary btn-sm" onclick="window.promptEditThreshold('${t.id}', ${t.minAmount})">Edit Min</button>
            </div>
          </div>
        `;
      }
      thresholdsContainer.innerHTML = html;
    } catch (err) {
      console.error('Failed to load thresholds:', err);
    }
  }

  window.promptEditThreshold = async function (id, currentVal) {
    const newVal = prompt('Enter new minimum token threshold:', currentVal);
    if (!newVal || isNaN(parseFloat(newVal))) return;
    try {
      const res = await fetch(`/api/thresholds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minAmount: parseFloat(newVal) }),
      });
      const data = await res.json();
      if (data.success) {
        await loadThresholdsModal();
        await fetchSummary();
      } else {
        alert(data.error || 'Failed to update threshold');
      }
    } catch (err) {
      alert('Error updating threshold: ' + err.message);
    }
  };

  // Form submit for adding a whale
  if (formAddWhale) {
    formAddWhale.addEventListener('submit', async (e) => {
      e.preventDefault();
      const addrInput = document.getElementById('inputWhaleAddress');
      const labelInput = document.getElementById('inputWhaleLabel');
      if (!addrInput || !labelInput) return;

      try {
        const res = await fetch('/api/whales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: addrInput.value.trim(),
            label: labelInput.value.trim(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          addrInput.value = '';
          labelInput.value = '';
          await loadWatchlistModal();
          await fetchSummary();
        } else {
          alert(data.error || 'Failed to add whale');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Manual Scan Trigger
  if (btnManualScan) {
    btnManualScan.addEventListener('click', async () => {
      btnManualScan.disabled = true;
      btnManualScan.innerHTML = `<span class="icon">⏳</span> Scanning...`;
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxBlocks: 200 }),
        });
        const data = await res.json();
        if (data.success) {
          await fetchSummary();
          await fetchMovements();
          await fetchTelemetry();
        }
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        btnManualScan.disabled = false;
        btnManualScan.innerHTML = `<span class="icon">⚡</span> Scan Now`;
      }
    });
  }

  // Modal Open/Close Event Listeners
  if (btnOpenWatchlist) {
    btnOpenWatchlist.addEventListener('click', () => {
      loadWatchlistModal();
      modalWatchlist.classList.add('active');
    });
  }
  if (btnCloseWatchlist) {
    btnCloseWatchlist.addEventListener('click', () => modalWatchlist.classList.remove('active'));
  }
  if (closeWatchlistBackdrop) {
    closeWatchlistBackdrop.addEventListener('click', () => modalWatchlist.classList.remove('active'));
  }

  if (btnOpenThresholds) {
    btnOpenThresholds.addEventListener('click', () => {
      loadThresholdsModal();
      modalThresholds.classList.add('active');
    });
  }
  if (btnCloseThresholds) {
    btnCloseThresholds.addEventListener('click', () => modalThresholds.classList.remove('active'));
  }
  if (closeThresholdsBackdrop) {
    closeThresholdsBackdrop.addEventListener('click', () => modalThresholds.classList.remove('active'));
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Self-Paced Polling Loop with recursive setTimeout
  async function runPoll() {
    if (isPolling) return;
    isPolling = true;

    try {
      await fetchTelemetry();
      await fetchSummary();
      await fetchMovements();
    } catch (err) {
      console.warn('Poll iteration error:', err);
    } finally {
      isPolling = false;
      pollTimeoutId = setTimeout(runPoll, 6000);
    }
  }

  // Initial Run
  runPoll();
});
