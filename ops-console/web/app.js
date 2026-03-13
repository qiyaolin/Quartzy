const state = {
  logs: [],
  currentLogTarget: null,
  eventSource: null,
  connectedLogTarget: null,
  connectedLogPath: null,
  latestStatus: null,
  logLines: [],
  refreshTimer: null,
  refreshInFlight: false,
  statusSource: null,
};

const projectsEl = document.getElementById("projects");
const actionFeedEl = document.getElementById("actionFeed");
const actionStateEl = document.getElementById("actionState");
const logSelectorEl = document.getElementById("logSelector");
const logOutputEl = document.getElementById("logOutput");
const refreshButton = document.getElementById("refreshButton");
const projectTemplate = document.getElementById("projectTemplate");
const componentTemplate = document.getElementById("componentTemplate");

const PROJECT_ACTIONS = {
  quartzy: [
    { label: "Start Quartzy", endpoint: "/api/actions/quartzy/start" },
    { label: "Stop Quartzy", endpoint: "/api/actions/quartzy/stop" },
    { label: "Restart Quartzy", endpoint: "/api/actions/quartzy/restart" },
    { label: "Release Quartzy", endpoint: "/api/actions/quartzy/release", primary: true },
  ],
  cellstorage: [
    { label: "Start CellStorage", endpoint: "/api/actions/cellstorage/start" },
    { label: "Stop CellStorage", endpoint: "/api/actions/cellstorage/stop" },
    { label: "Restart CellStorage", endpoint: "/api/actions/cellstorage/restart", primary: true },
    { label: "Restart Print Agent", endpoint: "/api/actions/cellstorage/print-restart" },
  ],
};

const SYSTEM_ACTIONS = [
  { label: "Repair Boot Tasks", endpoint: "/api/actions/system/repair-startup" },
  { label: "Open Logs Folder", endpoint: "/api/actions/system/open-logs" },
];

function isActionDisabled(payload) {
  return payload.actions?.canInteract === false;
}

function scheduleRefresh(delay = 20000) {
  if (state.refreshTimer) {
    window.clearTimeout(state.refreshTimer);
  }
  state.refreshTimer = window.setTimeout(() => {
    refreshStatus();
    scheduleRefresh();
  }, delay);
}

function formatActionLines(item) {
  const details = [];
  if (item.phaseLabel) details.push(`Phase: ${item.phaseLabel}`);
  if (item.startedAt) details.push(`Started: ${item.startedAt}`);
  if (item.coreCompletedAt) details.push(`Core Complete: ${item.coreCompletedAt}`);
  if (item.finishedAt) details.push(`Finished: ${item.finishedAt}`);
  if (item.exitCode !== null && item.exitCode !== undefined) details.push(`Exit: ${item.exitCode}`);
  const lines = (item.lines || []).filter(Boolean).slice(-12);
  return [...details, ...lines];
}

function formatMeta(component) {
  const rows = [];
  if (component.port) rows.push(`Port: ${component.port}`);
  if (component.url) rows.push(`URL: ${component.url}`);
  if (component.wrapperPid) rows.push(`PID: ${component.wrapperPid}`);
  if (component.startedAt) rows.push(`Started: ${component.startedAt}`);
  if (component.logFile) rows.push(`Log: ${component.logFile}`);
  return rows;
}

function applyStatus(payload) {
  state.latestStatus = payload;
  renderProjects(payload);
  renderActions(payload);
  populateLogs(payload);
}

function renderProjects(payload) {
  projectsEl.innerHTML = "";
  payload.projects.forEach((project) => {
    const fragment = projectTemplate.content.cloneNode(true);
    fragment.querySelector(".project-tag").textContent = project.id;
    fragment.querySelector(".project-title").textContent = project.name;

    const actionsHost = fragment.querySelector(".project-actions");
    PROJECT_ACTIONS[project.id].forEach((action) => {
      const button = document.createElement("button");
      button.className = `button ${action.primary ? "button-primary" : ""}`;
      button.textContent = action.label;
      button.disabled = isActionDisabled(payload);
      button.onclick = () => triggerAction(action.endpoint);
      actionsHost.appendChild(button);
    });

    if (project.id === "quartzy") {
      SYSTEM_ACTIONS.forEach((action) => {
        const button = document.createElement("button");
        button.className = "button";
        button.textContent = action.label;
        button.disabled = isActionDisabled(payload);
        button.onclick = () => triggerAction(action.endpoint);
        actionsHost.appendChild(button);
      });
    }

    const grid = fragment.querySelector(".component-grid");
    project.components.forEach((component) => {
      const card = componentTemplate.content.cloneNode(true);
      card.querySelector(".component-name").textContent = component.name;
      card.querySelector(".component-message").textContent = component.message;
      const badge = card.querySelector(".component-status");
      badge.textContent = component.status;
      badge.classList.add(`status-${component.status}`);

      const meta = card.querySelector(".component-meta");
      formatMeta(component).forEach((line) => {
        const row = document.createElement("div");
        row.textContent = line;
        meta.appendChild(row);
      });

      grid.appendChild(card);
    });

    projectsEl.appendChild(fragment);
  });
}

function renderActions(payload) {
  const active = payload.actions?.active || [];
  const history = payload.actions?.history || [];
  const blocking = payload.actions?.blocking;
  const current = blocking || active[0] || null;

  actionStateEl.textContent = current ? current.phaseLabel || current.name : "Idle";
  actionStateEl.className = `badge ${current ? `status-${current.status || "running"}` : "status-idle"}`;

  actionFeedEl.innerHTML = "";
  const items = [...active, ...history];
  if (!items.length) {
    actionFeedEl.textContent = "No actions recorded yet.";
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "action-item";
    wrapper.innerHTML = `
      <div class="action-title">
        <strong>${item.name || item.id}</strong>
        <span class="badge status-${item.status || "idle"}">${item.status || "queued"}</span>
      </div>
      <div class="action-lines">${formatActionLines(item).join("\n")}</div>
    `;
    actionFeedEl.appendChild(wrapper);
  });
}

function populateLogs(payload) {
  const nextLogs = payload.logs || [];
  const previousSignature = state.logs.map((log) => `${log.id}:${log.path}`).join("|");
  const nextSignature = nextLogs.map((log) => `${log.id}:${log.path}`).join("|");
  state.logs = nextLogs;

  if (previousSignature !== nextSignature) {
    logSelectorEl.innerHTML = "";
    state.logs.forEach((log) => {
      const option = document.createElement("option");
      option.value = log.id;
      option.textContent = log.label;
      logSelectorEl.appendChild(option);
    });
  }

  if (!state.currentLogTarget && state.logs.length) {
    state.currentLogTarget = state.logs[0].id;
  }
  if (state.currentLogTarget && !state.logs.some((log) => log.id === state.currentLogTarget)) {
    state.currentLogTarget = state.logs.length ? state.logs[0].id : null;
  }

  if (state.currentLogTarget) {
    logSelectorEl.value = state.currentLogTarget;
    const currentLog = state.logs.find((log) => log.id === state.currentLogTarget);
    const currentPath = currentLog ? currentLog.path : null;
    if (state.connectedLogTarget !== state.currentLogTarget || state.connectedLogPath !== currentPath) {
      connectLogStream(state.currentLogTarget, currentPath);
    }
  }
}

function connectLogStream(target, path = null) {
  if (state.connectedLogTarget === target && state.connectedLogPath === path && state.eventSource) return;
  if (state.eventSource) state.eventSource.close();
  state.connectedLogTarget = target;
  state.connectedLogPath = path;
  state.logLines = [];
  logOutputEl.textContent = "Connecting...\n";
  state.eventSource = new EventSource(`/api/logs/stream?target=${encodeURIComponent(target)}`);
  state.eventSource.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    state.logLines.push(payload.line);
    state.logLines = state.logLines.slice(-400);
    logOutputEl.textContent = `${state.logLines.join("\n")}\n`;
    logOutputEl.scrollTop = logOutputEl.scrollHeight;
  };
}

function connectStatusStream() {
  if (state.statusSource) state.statusSource.close();
  state.statusSource = new EventSource("/api/status/stream");
  state.statusSource.onmessage = (event) => {
    applyStatus(JSON.parse(event.data));
  };
  state.statusSource.onerror = () => {
    scheduleRefresh(2500);
  };
}

async function triggerAction(endpoint) {
  const response = await fetch(endpoint, { method: "POST" });
  if (!response.ok) {
    const detail = await response.text();
    alert(detail || "Action failed to start.");
    return;
  }
  await refreshStatus();
}

async function refreshStatus() {
  if (state.refreshInFlight) return state.latestStatus;
  state.refreshInFlight = true;
  refreshButton.disabled = true;
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error(`Status refresh failed with ${response.status}`);
    const payload = await response.json();
    applyStatus(payload);
    return payload;
  } catch (error) {
    console.error(error);
    return state.latestStatus;
  } finally {
    refreshButton.disabled = false;
    state.refreshInFlight = false;
  }
}

refreshButton.addEventListener("click", () => refreshStatus());
logSelectorEl.addEventListener("change", (event) => {
  state.currentLogTarget = event.target.value;
  connectLogStream(state.currentLogTarget);
});

connectStatusStream();
refreshStatus().finally(() => {
  scheduleRefresh();
});
