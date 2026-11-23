(() => {
  const links = [
    ['home.html', 'Home'],
    ['dashboard.html', 'Dashboard'],
    ['resume_upload.html', 'Resume Analyzer'],
    ['mock_interview_setup.html', 'Mock Interview'],
    ['opportunities.html', 'Opportunities'],
    ['roadmap.html', 'Roadmap']
  ];

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

  function renderPublicNavigation(mount) {
    mount.innerHTML = `
      <header class="site-header">
        <nav class="navbar" aria-label="Main navigation">
          <a class="brand" href="home.html" aria-label="ASCEND home">
            <img src="assets/logo.png" alt="">
            <span>ASCEND</span>
          </a>
          <button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
          </button>
          <div class="nav-content" id="primary-navigation">
            <div class="nav-links">
              <a href="#home" data-section="home">Home</a>
              <a href="#about" data-section="about">About</a>
              <a href="#features" data-section="features">Features</a>
              <a href="#how-it-works" data-section="how-it-works">How It Works</a>
              <a href="#contact" data-section="contact">Contact</a>
            </div>
            <div class="nav-actions">
              <a class="nav-login" href="index.html">Login</a>
              <a class="button button-small button-primary" href="index.html?mode=signup">Get Started</a>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  function renderApplicationNavigation(mount, user, currentPage) {
    const name = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : 'ASCEND User';
    const initial = Array.from(name)[0]?.toLocaleUpperCase() || 'A';
    const livePage = currentPage === 'technical_test.html' || currentPage === 'mock_interview_session.html';

    if (livePage) {
      mount.innerHTML = `
        <header class="site-header live-site-header">
          <nav class="navbar live-navbar" aria-label="Live session navigation">
            <a class="brand" href="dashboard.html" aria-label="ASCEND dashboard">
              <img src="assets/logo.png" alt="">
              <span>ASCEND</span>
            </a>
            <a class="button button-outline button-small live-back-link" href="dashboard.html">Back to Dashboard</a>
          </nav>
        </header>
      `;
      return;
    }

    const assessmentActive = currentPage.startsWith('technical_test') || currentPage === 'communication_test.html';
    const activePage = currentPage.startsWith('technical_test')
      ? 'technical_test_setup.html'
      : currentPage.startsWith('mock_interview')
        ? 'mock_interview_setup.html'
        : currentPage === 'roadmap_setup.html'
          ? 'roadmap.html'
          : currentPage;

    mount.innerHTML = `
      <header class="site-header">
        <nav class="navbar" aria-label="Main navigation">
          <a class="brand" href="dashboard.html" aria-label="ASCEND dashboard">
            <img src="assets/logo.png" alt="">
            <span>ASCEND</span>
          </a>
          <button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
          </button>
          <div class="nav-content" id="primary-navigation">
            <div class="nav-links">
              <a href="home.html"${activePage === 'home.html' ? ' class="active" aria-current="page"' : ''}>Home</a>
              <a href="dashboard.html"${activePage === 'dashboard.html' ? ' class="active" aria-current="page"' : ''}>Dashboard</a>
              <a href="resume_upload.html"${activePage === 'resume_upload.html' ? ' class="active" aria-current="page"' : ''}>Resume Analyzer</a>
              <div class="nav-dropdown">
                <button type="button" class="nav-dropdown-button${assessmentActive ? ' active' : ''}" aria-expanded="false" aria-haspopup="true" aria-controls="assessment-menu">
                  Assessment
                  <svg class="nav-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4"/></svg>
                </button>
                <div class="nav-dropdown-menu" id="assessment-menu" role="menu">
                  <a href="technical_test_setup.html"${currentPage.startsWith('technical_test') ? ' class="active" aria-current="page"' : ''} role="menuitem">Technical Test</a>
                  <a href="communication_test.html"${currentPage === 'communication_test.html' ? ' class="active" aria-current="page"' : ''} role="menuitem">Communication Test</a>
                </div>
              </div>
              ${links.slice(3).map(([href, label]) => `<a href="${href}"${activePage === href ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}
            </div>
            <div class="nav-actions">
              <div class="nav-user">
                <button type="button" class="nav-user-button" aria-expanded="false" aria-haspopup="true" aria-controls="user-menu">
                  <span class="nav-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
                  <span class="nav-user-name">${escapeHtml(name)}</span>
                  <svg class="nav-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4"/></svg>
                </button>
                <div class="nav-user-menu" id="user-menu" role="menu">
                  <a href="profile.html" role="menuitem">My Profile</a>
                  <button type="button" class="nav-logout" role="menuitem">Logout</button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  function closeDropdowns(controls, except = null) {
    controls.forEach(button => {
      if (button === except) return;
      button.setAttribute('aria-expanded', 'false');
      button.nextElementSibling?.classList.remove('open');
    });
  }

  function bindNavigation() {
    const navContent = document.querySelector('.nav-content');
    const menuButton = document.querySelector('.menu-toggle');
    const closeMenu = () => {
      if (!menuButton || !navContent) return;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation menu');
      navContent.classList.remove('is-open');
    };

    menuButton?.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      menuButton.setAttribute('aria-label', open ? 'Open navigation menu' : 'Close navigation menu');
      navContent?.classList.toggle('is-open', !open);
    });

    const dropdownControls = [
      ...document.querySelectorAll('.nav-dropdown-button'),
      ...document.querySelectorAll('.nav-user-button')
    ];

    dropdownControls.forEach(button => {
      const menu = button.nextElementSibling;
      if (!menu) return;

      button.addEventListener('click', event => {
        event.stopPropagation();
        const open = button.getAttribute('aria-expanded') === 'true';
        closeDropdowns(dropdownControls, button);
        button.setAttribute('aria-expanded', String(!open));
        menu.classList.toggle('open', !open);
      });

      button.addEventListener('keydown', event => {
        const items = [...menu.querySelectorAll('a, button')];
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          closeDropdowns(dropdownControls, button);
          button.setAttribute('aria-expanded', 'true');
          menu.classList.add('open');
          (event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus();
        } else if (event.key === 'Escape') {
          button.setAttribute('aria-expanded', 'false');
          menu.classList.remove('open');
        }
      });

      menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          button.setAttribute('aria-expanded', 'false');
          menu.classList.remove('open');
          button.focus();
        }
      });
    });

    document.addEventListener('click', event => {
      dropdownControls.forEach(button => {
        if (!button.contains(event.target) && !button.nextElementSibling?.contains(event.target)) {
          button.setAttribute('aria-expanded', 'false');
          button.nextElementSibling?.classList.remove('open');
        }
      });
      if (navContent && menuButton && !navContent.contains(event.target) && !menuButton.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDropdowns(dropdownControls);
        closeMenu();
      }
    });

    navContent?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.querySelector('.nav-logout')?.addEventListener('click', () => UserContext.logout());

    const year = document.getElementById('current-year');
    if (year) year.textContent = new Date().getFullYear();

    if (document.body.classList.contains('landing-page')) bindLandingActiveState();
  }

  function bindLandingActiveState() {
    const linksInNav = [...document.querySelectorAll('.nav-links [data-section]')];
    const sections = linksInNav.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
    if (!sections.length) return;

    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      linksInNav.forEach(link => {
        const active = link.dataset.section === visible.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .1, .3, .6] });

    sections.forEach(section => observer.observe(section));
  }

  async function initializeNavigation() {
    const mount = document.getElementById('app-navbar');
    if (!mount) return;

    const landingPage = document.body.classList.contains('landing-page');
    let user = null;
    if (UserContext.getToken()) {
      try {
        user = await UserContext.fetchUser();
      } catch (error) {
        if (UserContext.isSessionExpired(error)) return;
        if (landingPage) renderPublicNavigation(mount);
        else mount.innerHTML = '<p class="nav-session-error" role="status">Unable to verify your session. Refresh when service is available.</p>';
        return;
      }
    }

    if (!landingPage && !user) {
      window.location.replace('index.html');
      return;
    }

    if (landingPage && !user) {
      renderPublicNavigation(mount);
    } else {
      const currentPage = window.location.pathname.split('/').pop() || (landingPage ? 'home.html' : 'dashboard.html');
      renderApplicationNavigation(mount, user, currentPage);
    }
    bindNavigation();
  }

  initializeNavigation();
})();
