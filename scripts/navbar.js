async function loadNavbar() {
  const navbarContainer = document.getElementById("navbar");
  if (!navbarContainer) return;

  try {
    const response = await fetch("/components/navbar.html", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load navbar: ${response.status}`);
    }

    const html = await response.text();
    navbarContainer.innerHTML = html;
    initNavbar();
  } catch (error) {
    console.error("Failed to load navbar:", error);
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
