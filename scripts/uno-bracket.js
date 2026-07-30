(function () {
  const DATA_URLS = ["data/uno_bracket.json", "data/uno_data.json"];

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
    exportState: document.getElementById("exportState"),
    search: document.getElementById("participantSearch"),
    refresh: document.getElementById("refreshData"),
    copyPairings: document.getElementById("copyPairings"),
    toast: document.getElementById("toast")
  };

  let state = {
    participants: [],
    matches: [],
    rounds: [],
    sourceUrl: "",
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

  function nextPowerOfTwo(count) {
    let size = 2;
    const target = Math.max(2, count);

    while (size < target) {
      size *= 2;
    }

    return size;
  }

  function buildSeedOrder(size) {
    let order = [1, 2];

    while (order.length < size) {
      const nextSize = order.length * 2;
      order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
    }

    return order;
  }

  function roundName(roundIndex, totalRounds) {
    const remainingPlayers = 2 ** (totalRounds - roundIndex + 1);

    if (remainingPlayers === 2) return "Final";
    if (remainingPlayers === 4) return "Semifinals";
    if (remainingPlayers === 8) return "Quarterfinals";
    if (remainingPlayers === 16) return "Round of 16";

    return `Round of ${remainingPlayers}`;
  }

  function pairKey(firstId, secondId) {
    return [toId(firstId), toId(secondId)].sort().join(":");
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
        mention: String(participant.mention || ""),
        seed: Number(participant.seed || index + 1)
      }))
      .filter((participant) => participant.id)
      .sort((first, second) => {
        if (first.seed !== second.seed) return first.seed - second.seed;
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
      .filter((match) => match.gameId && match.playerOneId && match.playerTwoId)
      .sort((first, second) => first.gameId - second.gameId);
  }

  function getParticipantLabel(participantMap, id) {
    const participant = participantMap.get(toId(id));
    return participant ? participant.displayName : `User ${toId(id)}`;
  }

  function buildMatchLookup(matches) {
    const lookup = new Map();

    matches.forEach((match) => {
      const key = pairKey(match.playerOneId, match.playerTwoId);
      const bucket = lookup.get(key) || [];
      bucket.push(match);
      lookup.set(key, bucket);
    });

    return lookup;
  }

  function findSourceMatch(lookup, first, second) {
    if (!first || !second) return null;

    const bucket = lookup.get(pairKey(first.id, second.id)) || [];
    const finalized = bucket.find((match) => match.finalized);

    return finalized || bucket[bucket.length - 1] || null;
  }

  function createBracketMatch(options) {
    const {
      roundIndex,
      matchIndex,
      first,
      second,
      lookup,
      participantMap,
      allowBye
    } = options;

    const source = findSourceMatch(lookup, first, second);
    let winner = null;
    let stateName = "waiting";
    let note = "Waiting for players";

    if (first && second) {
      if (source && source.finalized && source.winnerId) {
        winner = participantMap.get(source.winnerId) || null;
        stateName = "complete";
        note = `Game #${source.gameId} complete`;
      } else if (source) {
        stateName = "active";
        note = `Game #${source.gameId} active`;
      } else {
        stateName = "ready";
        note = "Ready to create";
      }
    } else if (allowBye && (first || second)) {
      winner = first || second;
      stateName = "bye";
      note = "Bye";
    }

    return {
      roundIndex,
      matchIndex,
      first,
      second,
      winner,
      source,
      stateName,
      note
    };
  }

  function buildRounds(participants, matches) {
    const participantMap = new Map(
      participants.map((participant) => [participant.id, participant])
    );
    const lookup = buildMatchLookup(matches);
    const bracketSize = nextPowerOfTwo(participants.length);
    const bySeed = new Map(
      participants.map((participant) => [participant.seed, participant])
    );
    const seedOrder = buildSeedOrder(bracketSize);
    const slots = seedOrder.map((seed) => bySeed.get(seed) || null);
    const rounds = [];

    let currentRound = [];

    for (let index = 0; index < slots.length; index += 2) {
      currentRound.push(
        createBracketMatch({
          roundIndex: 1,
          matchIndex: currentRound.length + 1,
          first: slots[index],
          second: slots[index + 1],
          lookup,
          participantMap,
          allowBye: true
        })
      );
    }

    rounds.push(currentRound);

    let roundIndex = 2;

    while (currentRound.length > 1) {
      const nextRound = [];

      for (let index = 0; index < currentRound.length; index += 2) {
        nextRound.push(
          createBracketMatch({
            roundIndex,
            matchIndex: nextRound.length + 1,
            first: currentRound[index] ? currentRound[index].winner : null,
            second: currentRound[index + 1] ? currentRound[index + 1].winner : null,
            lookup,
            participantMap,
            allowBye: false
          })
        );
      }

      rounds.push(nextRound);
      currentRound = nextRound;
      roundIndex += 1;
    }

    return rounds;
  }

  function renderSlot(participant, winner) {
    if (!participant) {
      return `
        <div class="slot is-empty">
          <span class="slot-seed">-</span>
          <span class="slot-name">TBD</span>
          <span class="slot-detail"></span>
        </div>
      `;
    }

    const isWinner = winner && participant.id === winner.id;

    return `
      <div class="slot${isWinner ? " is-winner" : ""}">
        <span class="slot-seed">${escapeHtml(participant.seed)}</span>
        <span class="slot-name" title="${escapeHtml(participant.displayName)}">${escapeHtml(participant.displayName)}</span>
        <span class="slot-detail">${isWinner ? "Winner" : ""}</span>
      </div>
    `;
  }

  function renderBracket() {
    if (!elements.bracket) return;

    if (!state.participants.length) {
      elements.bracket.innerHTML = `
        <div class="empty-state">
          <strong>Roster not exported yet.</strong><br />
          The bracket will appear as soon as the cog writes the current signup list.
        </div>
      `;
      return;
    }

    const totalRounds = state.rounds.length;

    elements.bracket.innerHTML = state.rounds
      .map((round, roundOffset) => {
        const roundIndex = roundOffset + 1;

        return `
          <section class="bracket-round" aria-label="${escapeHtml(roundName(roundIndex, totalRounds))}">
            <div class="round-title">
              <h2>${escapeHtml(roundName(roundIndex, totalRounds))}</h2>
              <span>${round.length} match${round.length === 1 ? "" : "es"}</span>
            </div>
            ${round
              .map((match) => {
                const stateClass = `status-${match.stateName}`;
                const gameLabel = match.source ? `Game #${match.source.gameId}` : `Match ${match.matchIndex}`;

                return `
                  <article class="match-card" data-state="${escapeHtml(match.stateName)}">
                    <div class="match-meta">
                      <span>${escapeHtml(gameLabel)}</span>
                      <span class="match-pill ${stateClass}">
                        <span class="status-dot"></span>
                        ${escapeHtml(match.stateName)}
                      </span>
                    </div>
                    ${renderSlot(match.first, match.winner)}
                    ${renderSlot(match.second, match.winner)}
                    <div class="match-foot">
                      <span>${escapeHtml(match.note)}</span>
                      <span>${match.source && match.source.deadlineTimestamp ? escapeHtml(formatDate(match.source.deadlineTimestamp, "short")) : ""}</span>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </section>
        `;
      })
      .join("");
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
          <strong>No participants loaded.</strong><br />
          Export the roster from the cog to populate this list.
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
            <span class="seed-chip">Seed ${escapeHtml(participant.seed)}</span>
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
      elements.bracketSize.textContent = state.participants.length
        ? nextPowerOfTwo(state.participants.length)
        : "-";
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
        : "Waiting for export";
    }

    if (elements.exportState) {
      const sourceLabel = state.sourceUrl.includes("uno_bracket")
        ? "Bracket export loaded"
        : "Legacy match data loaded";
      elements.exportState.textContent = sourceLabel;
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
    let sourceUrl = "";
    let starterSourceUrl = "";
    let lastError = null;

    for (const url of DATA_URLS) {
      try {
        const loadedData = await loadJson(url);
        const loadedParticipants = normalizeParticipants(loadedData);
        const loadedMatches = normalizeMatches(loadedData);
        const isStarterExport =
          url.includes("uno_bracket") &&
          !loadedData.generated_at_timestamp &&
          !loadedParticipants.length &&
          !loadedMatches.length;

        if (isStarterExport) {
          starterData = loadedData;
          starterSourceUrl = url;
          continue;
        }

        rawData = loadedData;
        sourceUrl = url;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!rawData && starterData) {
      rawData = starterData;
      sourceUrl = starterSourceUrl;
    }

    if (!rawData) {
      throw lastError || new Error("UNO data could not be loaded.");
    }

    const participants = normalizeParticipants(rawData);
    const matches = normalizeMatches(rawData);

    state = {
      participants,
      matches,
      rounds: participants.length ? buildRounds(participants, matches) : [],
      sourceUrl,
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
    if (!state.rounds.length) return "";

    return state.rounds[0]
      .filter((match) => match.first && match.second && !match.source)
      .map((match) => {
        return `Seed ${match.first.seed} ${match.first.displayName} vs Seed ${match.second.seed} ${match.second.displayName}`;
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
          showToast("UNO bracket data refreshed.");
        } catch (error) {
          showToast("UNO bracket data could not be loaded.");
        } finally {
          elements.refresh.disabled = false;
        }
      });
    }

    if (elements.copyPairings) {
      elements.copyPairings.addEventListener("click", async () => {
        const pairings = currentFirstRoundPairings();

        if (!pairings) {
          showToast("No uncreated first-round pairings to copy.");
          return;
        }

        try {
          await navigator.clipboard.writeText(pairings);
          showToast("First-round pairings copied.");
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
      if (elements.exportState) {
        elements.exportState.textContent = "UNO data not found";
      }
    }
  });
})();
