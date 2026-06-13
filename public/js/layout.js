(function () {
  "use strict";

  const body = document.body;
  const navbarBtn = document.getElementById("navSidebarToggle");
  const navbar = document.querySelector(".navbar");
  const tabs = document.querySelector(".nav-tabs-group");

  // ─────────────────────────────
  // Breakpoint helper
  // ─────────────────────────────
  const isMobile = () => window.innerWidth <= 991;

  // ─────────────────────────────
  // Restore sidebar state (desktop)
  // ─────────────────────────────
  const collapsed = localStorage.getItem("sn_sidebar_collapsed");

  if (!isMobile() && collapsed === "1") {
    body.classList.add("sidebar-collapsed");
  }

  // ─────────────────────────────
  // Mobile drawer toggle
  // ─────────────────────────────
  function toggleMobileDrawer() {
    body.classList.toggle("mobile-drawer-open");
  }

  if (navbarBtn) {
    navbarBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      if (isMobile()) {
        toggleMobileDrawer();
      }
    });
  }

  // ─────────────────────────────
  // Navbar scroll animation
  // ─────────────────────────────
  function handleNavbarScroll() {

    if (!navbar) return;

    if (window.scrollY > 40) {

      navbar.classList.add("scrolled");

      if (tabs) {
        tabs.classList.add("hidden");
      }

    } else {

      navbar.classList.remove("scrolled");

      if (tabs) {
        tabs.classList.remove("hidden");
      }

    }
  }

  window.addEventListener("scroll", handleNavbarScroll);

})();