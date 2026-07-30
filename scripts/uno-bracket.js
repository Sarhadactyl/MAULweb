(function () {
  window.__unoBracketLoaded = true;

  const DATA_URLS = [
    "/data/uno_bracket.json",
    "/data/uno_data.json",
    "data/uno_bracket.json",
    "data/uno_data.json"
  ];

  const elements = {
    bracket: document.getElementById("bracketGrid"),
    matchList: document.getElementById("matchList"),
    participantList: document.getElementById("participantList"),
    participantCount: document.getElementById("participantCount"),
    bracketSize: document.getElementById("bracketSize"),
    activeMatches: document.getElementById("activeMatches"),
    completedMatches: document.getElementById("completedMatches"),
    deadline: document.getElementById("deadline"),
    generatedAt: document.getElementById("generatedAt"),
    rosterState: document.getElementById("rosterState"),
    search: document.getElementById("participantSearch"),
    refresh: document.getElementById("refreshData"),
    copyPairings: document.getElementById("copyPairings"),
    toast: document.getElementById("toast")
  };

  let state = {
    participants: [],
    matches: [],
    rounds: [],
    dataUrl: "",
    deadlineTimestamp: null,
    generatedAtTimestamp: null,
    nextGameId: null
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toId(value) {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }

  function formatDate(timestamp, style) {
    if (!timestamp) return "Not set";

    const date = new Date(Number(timestamp) * 1000);

    if (Number.isNaN(date.getTime())) return "Not set";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: style || "medium",
      timeStyle: "short"
    }).format(date);
  }

  function normalizeParticipants(rawData) {
    const participants = Array.isArray(rawData.participants)
      ? rawData.participants
      : [];

    return participants
      .map((participant, index) => ({
        id: toId(participant.id ?? participant.user_id),
        displayName: String(
          participant.display_name ||
            participant.displayName ||
            participant.username ||
            participant.name ||
            `Participant ${index + 1}`
        ),
        username: String(participant.username || ""),
        mention: String(participant.mention || "")
      }))
      .filter((participant) => participant.id)
      .sort((first, second) => {
        return first.displayName.localeCompare(second.displayName);
      });
  }

  function normalizeMatches(rawData) {
    const rawMatches = Array.isArray(rawData.matches)
      ? rawData.matches
      : Object.values(rawData.matches || {});

    return rawMatches
      .map((match) => ({
        gameId: Number(match.game_id),
        channelId: toId(match.channel_id),
        channelName: String(match.channel_name || ""),
        playerOneId: toId(match.player_one_id),
        playerTwoId: toId(match.player_two_id),
        winnerId: toId(match.winner_id),
        createdAtTimestamp: Number(match.created_at_timestamp || 0),
        deadlineTimestamp: Number(match.deadline_timestamp || 0),
        finalized: Boolean(match.finalized)
      }))
      .filter((match) => {
        return match.channelId && match.gameId && match.playerOneId && match.playerTwoId;
      })
      .sort((first, second) => first.gameId - second.gameId);
  }

  function getParticipantLabel(participantMap, id) {
    const participant = participantMap.get(toId(id));
    return participant ? participant.displayName : `User ${toId(id)}`;
  }

  function renderSlot(name, isWinner) {
    if (!name) {
      return `
        <div class="slot is-empty">
          <span class="slot-name">TBD</span>
          <span class="slot-detail"></span>
        </div>
      `;
    }

    return `
      <div class="slot${isWinner ? " is-winner" : ""}">
        <span class="slot-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="slot-detail">${isWinner ? "Winner" : ""}</span>
      </div>
    `;
  }

  function participantMap() {
    return new Map(
      state.participants.map((participant) => [participant.id, participant])
    );
  }

  function matchStatus(match) {
    return match.finalized ? "complete" : "active";
  }

  function renderBracketMatch(match, map) {
    const firstName = getParticipantLabel(map, match.playerOneId);
    const secondName = getParticipantLabel(map, match.playerTwoId);
    const winnerName = match.winnerId ? getParticipantLabel(map, match.winnerId) : "";
    const status = matchStatus(match);

    return `
      <article class="match-card bracket-match" data-state="${status}">
        <div class="match-meta">
          <span>Game #${escapeHtml(match.gameId)}</span>
          <span class="match-pill status-${status}">
            <span class="status-dot"></span>
            ${match.finalized ? "Complete" : "Open"}
          </span>
        </div>
        ${renderSlot(firstName, winnerName === firstName)}
        ${renderSlot(secondName, winnerName === secondName)}
        <div class="match-foot">
          <span>${match.finalized ? `Winner: ${escapeHtml(winnerName || "Saved")}` : "Discord match channel created"}</span>
          <span>${match.deadlineTimestamp ? escapeHtml(formatDate(match.deadlineTimestamp, "short")) : ""}</span>
        </div>
        ${match.channelName ? `<div class="match-channel">${escapeHtml(match.channelName)}</div>` : ""}
      </article>
    `;
  }

  function renderEmptyBracketRail() {
    const rounds = [
      { title: "Opening Games", slots: 4 },
      { title: "Next Round", slots: 2 },
      { title: "Final", slots: 1 }
    ];

    return `
      <div class="bracket-track is-waiting">
        ${rounds
          .map((round) => `
            <section class="bracket-column">
              <div class="bracket-column-title">
                <h2>${escapeHtml(round.title)}</h2>
                <span>Waiting</span>
              </div>
              <div class="bracket-lineup">
                ${Array.from({ length: round.slots })
                  .map(() => `
                    <article class="bracket-placeholder" aria-label="Match channel waiting">
                      <span></span>
                      <span></span>
                    </article>
                  `)
                  .join("")}
              </div>
            </section>
          `)
          .join("")}
      </div>
    `;
  }

  function renderBracketColumn(title, note, matches, map, emptyCopy) {
    return `
      <section class="bracket-column">
        <div class="bracket-column-title">
          <h2>${escapeHtml(title)}</h2>
          <span>${escapeHtml(note)}</span>
        </div>
        <div class="bracket-lineup">
          ${
            matches.length
              ? matches.map((match) => renderBracketMatch(match, map)).join("")
              : `<div class="bracket-empty-slot">${escapeHtml(emptyCopy)}</div>`
          }
        </div>
      </section>
    `;
  }

  function renderParticipantCloud(limit) {
    if (!state.participants.length) {
      return `
        <div class="empty-state">
          <strong>No players listed yet.</strong><br />
          The player list will appear here once signups are loaded.
        </div>
      `;
    }

    const visibleParticipants = state.participants.slice(0, limit || state.participants.length);
    const remaining = state.participants.length - visibleParticipants.length;

    return `
      <div class="player-cloud">
        ${visibleParticipants
          .map((participant) => `
            <span class="player-chip" title="${escapeHtml(participant.displayName)}">${escapeHtml(participant.displayName)}</span>
          `)
          .join("")}
        ${remaining > 0 ? `<span class="player-chip muted">+${remaining} more</span>` : ""}
      </div>
    `;
  }

  function renderBracket() {
    if (!elements.bracket) return;

    const map = participantMap();
    const openMatches = state.matches.filter((match) => !match.finalized);
    const completedMatches = state.matches.filter((match) => match.finalized).slice().reverse();

    if (!state.matches.length) {
      elements.bracket.innerHTML = `
        <section class="bracket-stage">
          <div class="bracket-stage-head">
            <div>
              <div class="section-kicker">Waiting for match channels</div>
              <h2>No created games yet</h2>
              <p>
                The roster is loaded. Matchups will appear only after real Discord
                match channels are opened.
              </p>
            </div>
            <div class="board-count">
              <strong>${escapeHtml(state.participants.length)}</strong>
              <span>players signed up</span>
            </div>
          </div>
          ${renderEmptyBracketRail()}
        </section>
        <section class="board-section full">
          <div class="section-heading">
            <h2>Players</h2>
            <span>${state.participants.length} total</span>
          </div>
          ${renderParticipantCloud(80)}
        </section>
      `;
      return;
    }

    elements.bracket.innerHTML = `
      <section class="bracket-stage">
        <div class="bracket-stage-head">
          <div>
            <div class="section-kicker">Live bracket</div>
            <h2>Created match channels</h2>
            <p>Only games with opened Discord match channels are shown.</p>
          </div>
          <div class="board-count">
            <strong>${escapeHtml(state.matches.length)}</strong>
            <span>created games</span>
          </div>
        </div>
        <div class="bracket-track">
          ${renderBracketColumn("Open Games", `${openMatches.length} active`, openMatches, map, "No open games")}
          ${renderBracketColumn("Results", `${completedMatches.length} finished`, completedMatches, map, "No results yet")}
          <section class="bracket-column bracket-column-final">
            <div class="bracket-column-title">
              <h2>Champion</h2>
              <span>Pending</span>
            </div>
            <div class="bracket-lineup">
              <div class="bracket-empty-slot">Winner pending</div>
            </div>
          </section>
        </div>
      </section>
      <section class="board-section full">
        <div class="section-heading">
          <h2>Players</h2>
          <span>${state.participants.length} total</span>
        </div>
        ${renderParticipantCloud(80)}
      </section>
    `;
  }

  function renderMatches() {
    if (!elements.matchList) return;

    if (!state.matches.length) {
      elements.matchList.innerHTML = `
        <div class="empty-state">
          <strong>No match channels saved yet.</strong><br />
          Created games and finalized results will show here.
        </div>
      `;
      return;
    }

    const participantMap = new Map(
      state.participants.map((participant) => [participant.id, participant])
    );

    elements.matchList.innerHTML = state.matches
      .slice()
      .reverse()
      .map((match) => {
        const firstName = getParticipantLabel(participantMap, match.playerOneId);
        const secondName = getParticipantLabel(participantMap, match.playerTwoId);
        const winnerName = match.winnerId
          ? getParticipantLabel(participantMap, match.winnerId)
          : "Pending";
        const status = match.finalized ? "complete" : "active";

        return `
          <article class="list-item">
            <div class="list-top">
              <span class="list-name">Game #${escapeHtml(match.gameId)}</span>
              <span class="state-chip ${status}">${match.finalized ? "Complete" : "Active"}</span>
            </div>
            <div class="list-meta">
              ${escapeHtml(firstName)} vs. ${escapeHtml(secondName)}<br />
              Winner: ${escapeHtml(winnerName)}<br />
              ${match.channelName ? `Channel: ${escapeHtml(match.channelName)}<br />` : ""}
              ${match.deadlineTimestamp ? `Deadline: ${escapeHtml(formatDate(match.deadlineTimestamp, "short"))}` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderParticipants() {
    if (!elements.participantList) return;

    const query = (elements.search ? elements.search.value : "").trim().toLowerCase();
    const participants = state.participants.filter((participant) => {
      if (!query) return true;

      return (
        participant.displayName.toLowerCase().includes(query) ||
        participant.username.toLowerCase().includes(query) ||
        participant.id.includes(query)
      );
    });

    if (!state.participants.length) {
      elements.participantList.innerHTML = `
        <div class="empty-state">
          <strong>No players listed yet.</strong><br />
          The player list will appear here once signups are loaded.
        </div>
      `;
      return;
    }

    if (!participants.length) {
      elements.participantList.innerHTML = `
        <div class="empty-state">
          <strong>No matching participants.</strong>
        </div>
      `;
      return;
    }

    elements.participantList.innerHTML = participants
      .map((participant) => `
        <article class="list-item">
          <div class="list-top">
            <span class="list-name" title="${escapeHtml(participant.displayName)}">${escapeHtml(participant.displayName)}</span>
          </div>
          <div class="list-meta">${escapeHtml(participant.username || participant.mention || participant.id)}</div>
        </article>
      `)
      .join("");
  }

  function renderStats() {
    const active = state.matches.filter((match) => !match.finalized).length;
    const complete = state.matches.filter((match) => match.finalized).length;

    if (elements.participantCount) {
      elements.participantCount.textContent = state.participants.length;
    }

    if (elements.bracketSize) {
      elements.bracketSize.textContent = state.matches.length;
    }

    if (elements.activeMatches) {
      elements.activeMatches.textContent = active;
    }

    if (elements.completedMatches) {
      elements.completedMatches.textContent = complete;
    }

    if (elements.deadline) {
      elements.deadline.textContent = state.deadlineTimestamp
        ? formatDate(state.deadlineTimestamp, "short")
        : "Not set";
    }

    if (elements.generatedAt) {
      elements.generatedAt.textContent = state.generatedAtTimestamp
        ? formatDate(state.generatedAtTimestamp, "short")
        : "Waiting for update";
    }

    if (elements.rosterState) {
      const stateLabel = state.dataUrl.includes("uno_bracket")
        ? "Roster loaded"
        : "Tournament data loaded";
      elements.rosterState.textContent = stateLabel;
    }
  }

  function renderAll() {
    renderStats();
    renderBracket();
    renderMatches();
    renderParticipants();
  }

  async function loadJson(url) {
    const cacheBust = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${cacheBust}v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    return response.json();
  }

  async function loadData() {
    let rawData = null;
    let starterData = null;
    let dataUrl = "";
    let starterDataUrl = "";
    let lastError = null;
    const scriptData = window.UNO_BRACKET_DATA
      ? JSON.parse(JSON.stringify(window.UNO_BRACKET_DATA))
      : null;

    if (window.location.protocol === "file:" && scriptData) {
      rawData = scriptData;
      dataUrl = "data/uno_bracket.js";
    }

    if (!rawData) {
      for (const url of DATA_URLS) {
        try {
          const loadedData = await loadJson(url);
          const loadedParticipants = normalizeParticipants(loadedData);
          const loadedMatches = normalizeMatches(loadedData);
          const isStarterFile =
            url.includes("uno_bracket") &&
            !loadedData.generated_at_timestamp &&
            !loadedParticipants.length &&
            !loadedMatches.length;

          if (isStarterFile) {
            starterData = loadedData;
            starterDataUrl = url;
            continue;
          }

          rawData = loadedData;
          dataUrl = url;
          break;
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (!rawData && scriptData) {
      rawData = scriptData;
      dataUrl = "data/uno_bracket.js";
    }

    if (!rawData && starterData) {
      rawData = starterData;
      dataUrl = starterDataUrl;
    }

    if (!rawData) {
      throw lastError || new Error("Tournament data could not be loaded.");
    }

    const participants = normalizeParticipants(rawData);
    const matches = normalizeMatches(rawData);

    state = {
      participants,
      matches,
      rounds: [],
      dataUrl,
      deadlineTimestamp:
        rawData.signup_deadline_timestamp ||
        (rawData.event && rawData.event.signup_deadline_timestamp) ||
        null,
      generatedAtTimestamp: rawData.generated_at_timestamp || null,
      nextGameId: rawData.next_game_id || null
    };

    renderAll();
  }

  function showToast(message) {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 2200);
  }

  function currentFirstRoundPairings() {
    if (!state.matches.length) return "";

    const map = participantMap();

    return state.matches
      .filter((match) => !match.finalized)
      .map((match) => {
        const firstName = getParticipantLabel(map, match.playerOneId);
        const secondName = getParticipantLabel(map, match.playerTwoId);
        return `Game #${match.gameId}: ${firstName} vs ${secondName}`;
      })
      .join("\n");
  }

  function bindEvents() {
    document.querySelectorAll(".uno-tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".uno-tab").forEach((tab) => {
          tab.classList.toggle("is-active", tab === button);
        });

        document.querySelectorAll(".uno-view").forEach((view) => {
          view.classList.toggle("is-active", view.id === button.dataset.view);
        });
      });
    });

    if (elements.search) {
      elements.search.addEventListener("input", renderParticipants);
    }

    if (elements.refresh) {
      elements.refresh.addEventListener("click", async () => {
        elements.refresh.disabled = true;

        try {
          await loadData();
          showToast("Tournament board updated.");
        } catch (error) {
          showToast("Tournament board could not be loaded.");
        } finally {
          elements.refresh.disabled = false;
        }
      });
    }

    if (elements.copyPairings) {
      elements.copyPairings.addEventListener("click", async () => {
        const pairings = currentFirstRoundPairings();

        if (!pairings) {
          showToast("No open match channels to copy.");
          return;
        }

        try {
          await navigator.clipboard.writeText(pairings);
          showToast("Open matches copied.");
        } catch (error) {
          showToast("Clipboard is unavailable in this browser.");
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();

    try {
      await loadData();
    } catch (error) {
      renderAll();
      if (elements.rosterState) {
        elements.rosterState.textContent = "Tournament data unavailable";
      }
    }
  });
})();
