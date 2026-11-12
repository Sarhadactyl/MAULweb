"use strict";

(() => {
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const apiBase = window.MAUL_LOBBIES_API_BASE || (local
    ? "http://127.0.0.1:8094/api/maulpost"
    : "https://api.moddedamong.us/api/maulpost");
  const accountApi = "/lobbies/account";
  const el = (id) => document.getElementById(id);
  const state = { enabled: false, user: null, lobbies: [], tokenCommand: "", busy: false };
  const notices = {
    registered: "Verify your Among Us account or link your Discord website login to view lobbies.",
    pending: "Waiting for your Among Us friend request.",
    verified: "Your account can view live lobbies.",
    banned: "This account is restricted from viewing lobbies.",
    suspended: "This account is suspended from viewing lobbies.",
    check_unavailable: "Lobby access checks are temporarily unavailable.",
    discord_unverified: "Your Discord login needs the MAUL Verified role. You can sign out and verify with Among Us.",
  };

  try {
    localStorage.removeItem("maulLobbiesSession");
    sessionStorage.removeItem("maulLobbiesSession");
  } catch { /* Browsers may disable storage for local previews. */ }

  function notice(message = "") {
    el("accountMessage").textContent = message;
  }

  async function api(path, body) {
    const options = { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(25000) };
    if (body !== undefined) {
      options.method = "POST";
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${apiBase}${path}`, options);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = new Error(data?.message || `Request failed with HTTP ${response.status}.`);
      error.status = response.status;
      error.code = data?.code;
      throw error;
    }
    return data;
  }

  function render() {
    const user = state.user;
    const website = user?.accountType === "website";
    const restricted = ["banned", "suspended"].includes(user?.status);
    const challenge = user?.challenge;
    const allowed = !!user && (state.enabled ? user.canViewLobbies === true : true);
    el("verificationIntro").textContent = state.enabled
      ? "Verify in Among Us or verify in Discord to see live MAUL lobbies."
      : "Verify in Discord to see live MAUL lobbies.";
    el("accountEntry").hidden = !state.enabled || !!user;
    el("loginPanel").hidden = !!user;
    el("accountPanel").hidden = !website;
    el("logoutBtn").hidden = !user;
    el("sessionBadge").textContent = user ? `${user.username}${allowed ? " · Verified" : ""}` : "Not logged in";
    el("accountStatus").textContent = notices[user?.status] || "";
    el("accountIdentity").hidden = !user?.friendCode;
    el("accountIdentity").textContent = user?.friendCode ? `Verified Among Us friend code ${user.friendCode}` : "";
    el("verificationProgress").hidden = !challenge || restricted;
    el("verificationStart").hidden = !!challenge || restricted;
    el("startVerification").textContent = user?.friendCode ? "Reverify in Among Us" : "Verify in Among Us";
    el("verificationCode").textContent = challenge?.addFriendCode || "";
    el("verificationDeadline").textContent = challenge
      ? `Send the request by ${new Date(challenge.expiresAt * 1000).toLocaleTimeString()}. This page checks every 10 seconds.` : "";
    el("linkDiscord").hidden = !!user?.discordLinked || restricted;
    el("unlinkDiscord").hidden = !user?.discordLinked || restricted;

    el("lobbyBody").replaceChildren();
    const query = el("searchInput").value.trim().toLowerCase();
    const rows = allowed ? state.lobbies.filter((lobby) => [lobby.hostName, lobby.discordUsername,
      lobby.gameCode, lobby.region, ...(Array.isArray(lobby.mods) ? lobby.mods : [])]
      .join(" ").toLowerCase().includes(query)) : [];
    for (const lobby of rows) {
      const row = document.createElement("tr");
      row.insertCell().textContent = lobby.hostName || "Unknown host";
      const code = document.createElement("span");
      code.className = "code";
      code.textContent = lobby.gameCode || "-";
      row.insertCell().append(code);
      row.insertCell().textContent = lobby.region || "MAUL";
      const pills = document.createElement("div");
      pills.className = "pill-list";
      for (const mod of Array.isArray(lobby.mods) && lobby.mods.length ? lobby.mods : ["Unknown"]) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = mod;
        pills.append(pill);
      }
      row.insertCell().append(pills);
      const players = document.createElement("span");
      players.className = "players";
      players.textContent = `${Number(lobby.playerCount || 0)}/${Number(lobby.maxPlayers || 0)}`;
      row.insertCell().append(players);
      el("lobbyBody").append(row);
    }
    el("tableWrap").hidden = rows.length === 0;
    el("emptyState").hidden = rows.length > 0;
    el("emptyState").textContent = !user ? "Log in to see MAUL public lobbies."
      : !allowed ? notices[user.status] || "Lobby access is unavailable."
      : state.lobbies.length ? "No matching lobbies found."
      : "No public MAUL lobbies are listed right now.";
  }

  async function refresh() {
    let profile;
    try {
      profile = await api(accountApi);
      state.enabled = profile.enabled === true;
      state.user = profile.user || null;
    } catch (error) {
      if (error.status !== 404) {
        state.lobbies = [];
        render();
        throw error;
      }
      state.enabled = false;
      state.user = null;
    }
    if (profile && !state.user?.canViewLobbies) {
      state.lobbies = [];
      render();
      return;
    }
    try {
      const data = await api("/lobbies");
      state.user = data.user;
      state.lobbies = Array.isArray(data.lobbies) ? data.lobbies : [];
    } catch (error) {
      state.lobbies = [];
      if (error.status === 401) state.user = null;
      if (error.status !== 401) {
        if (state.user) state.user.canViewLobbies = false;
        render();
        throw error;
      }
    }
    render();
  }

  async function action(callback, button) {
    if (state.busy) return;
    state.busy = true;
    if (button) button.disabled = true;
    try { await callback(); }
    catch (error) { notice(error.message || "Request failed. Try again."); }
    finally {
      state.busy = false;
      if (button) button.disabled = false;
    }
  }

  function showRecovery(code) {
    el("recoveryCode").textContent = code || "";
    el("recoveryPanel").hidden = !code;
    if (code) el("recoveryPanel").scrollIntoView({ block: "nearest" });
  }

  function form(id, callback) {
    el(id).addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      action(async () => {
        notice();
        await callback(data, event.submitter);
        el(id).reset();
      }, event.submitter);
    });
  }

  async function update(path, data) {
    const reply = await api(accountApi + path, data);
    if (reply.recoveryCode) showRecovery(reply.recoveryCode);
    await refresh();
  }

  form("accountLogin", (data) => update("/login", data));
  form("accountRegister", (data) => update("/register", data));
  form("accountRecover", async (data) => {
    await update("/recover", data);
    notice("Password reset. Save your new recovery code and log in.");
  });
  form("verificationStart", (data) => update("/verify/start", data));
  form("discordLinkForm", (data) => update("/discord/link", data));
  form("discordUnlinkForm", (data) => update("/discord/unlink", data));
  form("accountSettings", async (data, button) => {
    if (button?.value === "delete") {
      if (!window.confirm("Delete your MAUL website account and sign out its sessions?")) return;
      await api(accountApi + "/delete", data);
      showRecovery();
      await refresh();
      notice("Website account deleted.");
    } else if (button?.value === "recovery-code") {
      await update("/recovery-code", data);
    }
  });
  form("loginForm", async (data) => {
    await api("/lobbies/login", data);
    showRecovery();
    await refresh();
  });

  async function checkVerification(manual = false) {
    if (!state.user?.challenge) return;
    try {
      const result = await api(accountApi + "/verify/check", {});
      if (result.status === "finished") {
        await refresh();
        notice("Among Us verification complete.");
      } else if (manual) notice("Waiting for your friend request.");
    } catch (error) {
      if ([401, 403, 409, 410, 502].includes(error.status)) await refresh();
      throw error;
    }
  }

  el("checkVerification").onclick = () => action(() => checkVerification(true), el("checkVerification"));
  el("cancelVerification").onclick = () => action(() => update("/verify/cancel", {}), el("cancelVerification"));
  el("copyVerification").onclick = () => action(async () => {
    if (state.user?.challenge?.addFriendCode) await navigator.clipboard.writeText(state.user.challenge.addFriendCode);
    notice("Friend code copied.");
  });
  el("dismissRecovery").onclick = () => showRecovery();
  el("logoutBtn").onclick = () => action(async () => {
    await api("/lobbies/logout", {});
    state.user = null;
    state.lobbies = [];
    showRecovery();
    notice();
    render();
  }, el("logoutBtn"));
  el("tokenBtn").onclick = () => action(async () => {
    const data = await api("/lobbies/token", {});
    state.tokenCommand = data.command;
    el("tokenBox").textContent = data.command;
    el("copyTokenBtn").disabled = false;
    notice("Run that command in the MAUL Discord website login channel.");
  }, el("tokenBtn"));
  el("copyTokenBtn").onclick = () => action(async () => {
    if (state.tokenCommand) await navigator.clipboard.writeText(state.tokenCommand);
    notice("Command copied.");
  });
  el("refreshBtn").onclick = () => action(async () => { notice(); await refresh(); }, el("refreshBtn"));
  el("searchInput").oninput = render;
  render();
  action(refresh);
  window.setInterval(() => { if (state.user) action(refresh); }, 30000);
  window.setInterval(() => { if (state.user?.challenge) action(checkVerification); }, 10000);
})();
