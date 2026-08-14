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
                  background:#300;color:#fff;padding:10px 14px;border-radius:8px;
                  border:1px solid rgba(255,255,255,0.15);font-family:Arial,sans-serif;">
        Navbar failed to load
      </div>
    `;
  }
}

function initNavbar() {
  const dropdown = document.querySelector(".dropdown");
  if (!dropdown) return;

  const button = dropdown.querySelector(".dropbtn");
  const menu = dropdown.querySelector("#singlePanelMenu");
  const menuViews = dropdown.querySelectorAll(".menu-view");
  const navButtons = dropdown.querySelectorAll(".menu-nav-btn");
  const backButtons = dropdown.querySelectorAll(".menu-back-btn");
  const menuLinks = dropdown.querySelectorAll(".dropdown-content a");

  function showMenuView(name) {
    menuViews.forEach((view) => {
      const isActive = view.dataset.menu === name;
      view.classList.toggle("active", isActive);

      if (isActive) {
        view.scrollTop = 0;
      }
    });
  }

  function resetMenuView() {
    showMenuView("root");
  }

  function setMenuOpen(isOpen) {
    dropdown.classList.toggle("open", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");

    if (!isOpen) {
      resetMenuView();
    }
  }

  if (dropdown && button && menu) {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenuOpen(!dropdown.classList.contains("open"));
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

    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        setMenuOpen(false);
      });
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdown.classList.contains("open")) {
        setMenuOpen(false);
        button.focus();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", loadNavbar);
