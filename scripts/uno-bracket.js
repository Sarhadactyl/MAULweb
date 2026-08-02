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

  function firstText(...values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function isRawIdLike(value) {
    return /^\d{12,}$/.test(String(value ?? "").trim());
  }

  const LOOKALIKE_LETTERS = new Map([
    ["ᕼ", "H"],
    ["ყ", "y"],
    ["σ", "o"],
    ["ι", "i"],
    ["ꜱ", "s"],
    ["ɪ", "i"],
    ["ᴇ", "e"],
    ["ʀ", "r"],
    ["ɴ", "n"],
    ["ᴀ", "a"],
    ["ʙ", "b"],
    ["ᴄ", "c"],
    ["ᴅ", "d"],
    ["ꜰ", "f"],
    ["ɢ", "g"],
    ["ʜ", "h"],
    ["ᴊ", "j"],
    ["ᴋ", "k"],
    ["ʟ", "l"],
    ["ᴍ", "m"],
    ["ᴏ", "o"],
    ["ᴘ", "p"],
    ["ǫ", "q"],
    ["ᴛ", "t"],
    ["ᴜ", "u"],
    ["ᴠ", "v"],
    ["ᴡ", "w"],
    ["ʏ", "y"],
    ["ᴢ", "z"]
  ]);

  function stripToPlainName(value) {
    const mapped = Array.from(String(value ?? ""))
      .map((character) => LOOKALIKE_LETTERS.get(character) || character)
      .join("");
    return mapped
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanDisplayLabel(value, id) {
    const label = stripToPlainName(value);
    if (!label || label === toId(id) || isRawIdLike(label)) return "";
    return label;
  }

  function isUsefulPlainName(value) {
    return stripToPlainName(value).replace(/[^A-Za-z]/g, "").length >= 2;
  }

  function channelFallbackName(match, slot) {
    const gamePrefix = `uno-${Number(match.gameId || 0)}-`;
    const channelName = String(match.channelName || "").toLowerCase();
    const slug = channelName.startsWith(gamePrefix)
      ? channelName.slice(gamePrefix.length)
      : channelName.replace(/^uno-\d+-/, "");
    const pieces = slug.split("-").filter(Boolean);
    if (!pieces.length) return "";
    return slot === 1 ? pieces[0] : pieces[pieces.length - 1];
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
      .map((participant, index) => {
        const id = toId(participant.id ?? participant.user_id);
        const displayName =
          cleanDisplayLabel(
            firstText(
              participant.display_name,
              participant.displayName,
              participant.username,
              participant.name
            ),
            id
          ) || `Participant ${index + 1}`;

        return {
          id,
          displayName,
          username: String(participant.username || ""),
          mention: String(participant.mention || "")
        };
      })
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
        playerOneName: firstText(
          match.player_one_name,
          match.player_one_display_name,
          match.player_one_username,
          match.playerOneName
        ),
        playerTwoName: firstText(
          match.player_two_name,
          match.player_two_display_name,
          match.player_two_username,
          match.playerTwoName
        ),
        winnerName: firstText(
          match.winner_name,
          match.winner_display_name,
          match.winner_username,
          match.winnerName
        ),
        createdAtTimestamp: Number(match.created_at_timestamp || 0),
        deadlineTimestamp: Number(match.deadline_timestamp || 0),
        finalized: Boolean(match.finalized),
        resultStatus: (firstText(match.result_status, match.status) || "")
          .trim()
          .toLowerCase(),
        resultNote: firstText(match.result_note, match.cancel_reason, match.reason)
      }))
      .filter((match) => {
        return match.channelId && match.gameId && match.playerOneId && match.playerTwoId;
      })
      .sort((first, second) => first.gameId - second.gameId);
  }

  function getParticipantLabel(participantMap, id, fallbackName, match = null, slot = 1) {
    const participant = participantMap.get(toId(id));
    const participantName = participant
      ? cleanDisplayLabel(participant.displayName, id)
      : "";
    const fallback = cleanDisplayLabel(fallbackName, id);
    const channelFallback = match
      ? cleanDisplayLabel(channelFallbackName(match, slot), id)
      : "";

    if (
      participantName &&
      !/^Participant \d+$/.test(participantName) &&
      isUsefulPlainName(participantName)
    ) {
      return participantName;
    }

    if (fallback && isUsefulPlainName(fallback)) return fallback;
    if (channelFallback && isUsefulPlainName(channelFallback)) return channelFallback;
    if (participantName) return participantName;
    return "Player";
  }

  function renderSlot(name, isWinner, winnerDetail = "Winner") {
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
        <span class="slot-detail">${isWinner ? escapeHtml(winnerDetail) : ""}</span>
      </div>
    `;
  }

  function participantMap() {
    return new Map(
      state.participants.map((participant) => [participant.id, participant])
    );
  }

  function matchStatus(match) {
    if (match.resultStatus === "cancelled" || match.resultStatus === "canceled") {
      return "cancelled";
    }
    if (match.resultStatus === "forfeit" || match.resultStatus === "forfeited") {
      return "forfeit";
    }
    return match.finalized ? "complete" : "active";
  }

  function matchStatusLabel(status) {
    if (status === "cancelled") return "Cancelled";
    if (status === "forfeit") return "Forfeit";
    if (status === "complete") return "Complete";
    return "Open";
  }

  function renderBracketMatch(match, map) {
    const firstName = getParticipantLabel(map, match.playerOneId, match.playerOneName, match, 1);
    const secondName = getParticipantLabel(map, match.playerTwoId, match.playerTwoName, match, 2);
    const firstIsWinner = Boolean(match.winnerId && match.winnerId === match.playerOneId);
    const secondIsWinner = Boolean(match.winnerId && match.winnerId === match.playerTwoId);
    const status = matchStatus(match);
    const winnerDetail = status === "forfeit" ? "Forfeit" : "Winner";

    return `
      <article class="match-card bracket-match bracket-match-compact" data-state="${status}">
        <div class="match-meta">
          <span>Game #${escapeHtml(match.gameId)}</span>
          <span class="match-pill status-${status}">
            <span class="status-dot"></span>
            ${escapeHtml(matchStatusLabel(status))}
          </span>
        </div>
        ${renderSlot(firstName, firstIsWinner, winnerDetail)}
        ${renderSlot(secondName, secondIsWinner, winnerDetail)}
      </article>
    `;
  }

  function renderEmptyBracketRail() {
    const rounds = [
      { title: "Round 1", slots: 4 },
      { title: "Round 2", slots: 2 },
      { title: "Finals", slots: 1 }
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

  function bracketRoundSizes(participantCount, matchCount) {
    const sizes = [];
    let slots = Math.max(1, Math.ceil(Number(participantCount || matchCount || 0) / 2));

    while (slots > 1) {
      sizes.push(slots);
      slots = Math.ceil(slots / 2);
    }

    sizes.push(1);

    const minimumCreatedSlots = Math.max(1, Number(matchCount || 0));
    while (sizes.reduce((total, size) => total + size, 0) < minimumCreatedSlots) {
      sizes.unshift(minimumCreatedSlots);
    }

    return sizes;
  }

  function roundTitle(index, total) {
    if (index === total - 1) return "Finals";
    return `Round ${index + 1}`;
  }

  function buildBracketRounds(matches, participantCount) {
    const orderedMatches = matches
      .slice()
      .sort((first, second) => first.gameId - second.gameId);
    const sizes = bracketRoundSizes(participantCount, orderedMatches.length);
    let cursor = 0;

    return sizes.map((size, index) => {
      const slots = Array.from({ length: size }, () => {
        const match = orderedMatches[cursor] || null;
        cursor += 1;
        return match;
      });

      return {
        index,
        title: roundTitle(index, sizes.length),
        filled: slots.filter(Boolean).length,
        size,
        slots
      };
    });
  }

  function renderRoundPlaceholder(round) {
    return `
      <article class="bracket-placeholder" aria-label="${escapeHtml(round.title)} game waiting">
        <div class="placeholder-line"></div>
        <div class="placeholder-line short"></div>
      </article>
    `;
  }

  function renderRoundColumn(round, map) {
    const roundWidth = 178;

    return `
      <section
        class="bracket-column bracket-round-column"
        style="--round-depth: ${escapeHtml(round.index || 0)}; --round-width: ${escapeHtml(roundWidth)}px;"
      >
        <div class="bracket-column-title">
          <h2>${escapeHtml(round.title)}</h2>
          <span>${escapeHtml(`${round.filled}/${round.size} games`)}</span>
        </div>
        <div class="bracket-lineup">
          ${round.slots
            .map((match) => (match ? renderBracketMatch(match, map) : renderRoundPlaceholder(round)))
            .join("")}
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
      `;
      return;
    }

    const rounds = buildBracketRounds(state.matches, state.participants.length);

    elements.bracket.innerHTML = `
      <section class="bracket-stage">
        <div class="bracket-stage-head">
          <div>
            <div class="section-kicker">Live bracket</div>
            <h2>Created match channels</h2>
            <p>Actual created games are shown as compact bracket cards. Future rounds stay neutral until match channels exist.</p>
          </div>
          <div class="board-count">
            <strong>${escapeHtml(state.matches.length)}</strong>
            <span>created games</span>
          </div>
        </div>
        <div class="bracket-track bracket-clean">
          ${rounds.map((round) => renderRoundColumn(round, map)).join("")}
        </div>
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
        const firstName = getParticipantLabel(participantMap, match.playerOneId, match.playerOneName, match, 1);
        const secondName = getParticipantLabel(participantMap, match.playerTwoId, match.playerTwoName, match, 2);
        const winnerSlot = match.winnerId === match.playerTwoId ? 2 : 1;
        const winnerName = match.winnerId
          ? getParticipantLabel(participantMap, match.winnerId, match.winnerName, match, winnerSlot)
          : "Pending";
        const status = matchStatus(match);

        return `
          <article class="list-item">
            <div class="list-top">
              <span class="list-name">Game #${escapeHtml(match.gameId)}</span>
              <span class="state-chip ${status}">${escapeHtml(matchStatusLabel(status))}</span>
            </div>
            <div class="list-meta">
              ${escapeHtml(firstName)} vs. ${escapeHtml(secondName)}<br />
              Winner: ${escapeHtml(winnerName)}<br />
              ${match.resultNote ? `Note: ${escapeHtml(match.resultNote)}<br />` : ""}
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
    const active = state.matches.filter((match) => matchStatus(match) === "active").length;
    const complete = state.matches.filter((match) => matchStatus(match) !== "active").length;

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
      .filter((match) => matchStatus(match) === "active")
      .map((match) => {
        const firstName = getParticipantLabel(map, match.playerOneId, match.playerOneName, match, 1);
        const secondName = getParticipantLabel(map, match.playerTwoId, match.playerTwoName, match, 2);
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
