async function loadNavbar() {
  const navbarContainer = document.getElementById("navbar");
  if (!navbarContainer) return;

  const possiblePaths = [
    "/components/navbar.html",
    "./components/navbar.html",
    "../components/navbar.html"
  ];

  let loaded = false;
  let lastError = null;

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${path}`);
      }

      const html = await response.text();
      navbarContainer.innerHTML = html;
      initNavbar();
      loaded = true;
      console.log("Navbar loaded from:", path);
      break;
    } catch (error) {
      lastError = error;
      console.warn("Navbar failed from:", path, error);
    }
  }

  if (!loaded) {
    console.error("Navbar failed to load.", lastError);
    navbarContainer.innerHTML = `
      <div style="position:fixed;top:20px;left:20px;z-index:1000;
                  background:#300;color:#fff;padding:10px 14px;border-radius:12px;
                  border:1px solid rgba(255,255,255,0.15);font-family:Arial,sans-serif;">
        Navbar failed to load
      </div>
    `;
  }
}

function initNavbar() {
  const dropdown = document.querySelector(".dropdown");
  const button = document.querySelector(".dropbtn");
  const menu = document.getElementById("singlePanelMenu");
  const menuViews = document.querySelectorAll(".menu-view");
  const navButtons = document.querySelectorAll(".menu-nav-btn");
  const backButtons = document.querySelectorAll(".menu-back-btn");

  function showMenuView(name) {
    menuViews.forEach((view) => {
      view.classList.toggle("active", view.dataset.menu === name);
    });
  }

  function resetMenuView() {
    showMenuView("root");
  }

  if (dropdown && button && menu) {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");

      if (!dropdown.classList.contains("open")) {
        resetMenuView();
      }
    });

    navButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = btn.dataset.target;
        if (target) showMenuView(target);
      });
    });

    backButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = btn.dataset.back || "root";
        showMenuView(target);
      });
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("open");
        resetMenuView();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", loadNavbar);
