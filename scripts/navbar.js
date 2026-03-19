.dropdown {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
}

.dropbtn {
  background: rgba(35, 10, 10, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  padding: 10px;
  border-radius: 999px;
  backdrop-filter: blur(10px);
}

.dropbtn:hover {
  transform: translateY(-1px) scale(1.03);
  background: rgba(50, 16, 16, 0.98);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
}

.hamburger {
  width: 26px;
  height: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hamburger span {
  display: block;
  height: 3px;
  background: linear-gradient(90deg, #800000, #ff0040);
  border-radius: 999px;
}

.dropdown-content {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background-color: rgba(35, 10, 10, 0.96);
  width: 350px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 40px);
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  border-radius: 20px;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dropdown.open .dropdown-content {
  display: block;
}

.menu-view {
  display: none;
  padding: 8px 0;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.menu-view.active {
  display: block;
}

.dropdown-content a,
.menu-nav-btn,
.menu-back-btn {
  width: 100%;
  color: #ffffff;
  padding: 16px 22px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  font-size: 0.98rem;
  transition: background 0.22s ease, color 0.22s ease, padding-left 0.22s ease;
  background: transparent;
  border: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.dropdown-content a i:first-child,
.menu-nav-btn span,
.menu-back-btn span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.menu-nav-btn .fa-chevron-right {
  margin-left: auto;
}

.dropdown-content a:hover,
.menu-nav-btn:hover,
.menu-back-btn:hover {
  background: rgba(255, 255, 255, 0.045);
  color: #800000;
  padding-left: 26px;
}

.menu-back-btn {
  justify-content: flex-start;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}

.submenu-title {
  padding: 13px 22px 10px;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}

.beta-glow,
.highlight-glow {
  color: #ff4d4d !important;
  font-weight: 700;
  text-shadow:
    0 0 8px rgba(255, 0, 0, 0.75),
    0 0 12px rgba(255, 0, 0, 0.55);
  animation: betaPulse 1.6s ease-in-out infinite;
}

.beta-glow:hover,
.highlight-glow:hover {
  background: rgba(255, 0, 0, 0.12) !important;
  color: #ff8080 !important;
  text-shadow:
    0 0 10px rgba(255, 50, 50, 1),
    0 0 16px rgba(255, 0, 0, 0.9);
}

@keyframes betaPulse {
  0% {
    text-shadow:
      0 0 6px rgba(255, 0, 0, 0.7),
      0 0 12px rgba(255, 0, 0, 0.4);
  }
  50% {
    text-shadow:
      0 0 12px rgba(255, 60, 60, 1),
      0 0 24px rgba(255, 0, 0, 0.9);
  }
  100% {
    text-shadow:
      0 0 6px rgba(255, 0, 0, 0.7),
      0 0 12px rgba(255, 0, 0, 0.4);
  }
}
