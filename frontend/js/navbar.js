(() => {
  const token = localStorage.getItem('ascend_token');
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem('ascend_user') || 'null');
  } catch {
    user = null;
  }

  const isLoggedIn = Boolean(token);
  const mount = document.getElementById('app-navbar');
  const isLandingPage = document.body.classList.contains('landing-page');

  if (mount && !isLandingPage && !isLoggedIn) {
    window.location.replace('index.html');
    return;
  }

  if (mount && isLandingPage && !isLoggedIn) {
    mount.innerHTML = `
      <header class="site-header">
        <nav class="navbar container" aria-label="Main navigation">
          <a class="brand" href="home.html" aria-label="ASCEND home">
            <img src="assets/logo.png" alt="">
            <span>ASCEND</span>
          </a>
          <button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
          </button>
          <div class="nav-content" id="primary-navigation">
            <div class="nav-links">
              <a href="#home" class="active">Home</a>
              <a href="#about">About</a>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#contact">Contact</a>
            </div>
            <div class="nav-actions" id="nav-actions">
              <a class="nav-login" href="index.html">Login</a>
              <a class="button button-small button-primary" href="index.html?mode=signup">Get Started</a>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  if (mount && isLoggedIn) {
    const name = typeof user?.name === 'string' && user.name.trim()
      ? user.name.trim()
      : 'ASCEND User';
    const initial = name.charAt(0).toUpperCase();
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const livePage = currentPage === 'technical_test.html' || currentPage === 'mock_interview_session.html';

    if (livePage) {
      mount.innerHTML = `
        <header class="site-header live-site-header">
          <nav class="navbar live-navbar" aria-label="Live test navigation">
            <a class="brand" href="dashboard.html" aria-label="ASCEND dashboard">
              <img src="assets/logo.png" alt="">
              <span>ASCEND</span>
            </a>
            <a class="button button-outline button-small live-back-link" href="dashboard.html">Back to Dashboard</a>
          </nav>
        </header>
      `;
    } else {
      const assessmentActive = currentPage.startsWith('technical_test') || currentPage === 'communication_test.html';
      const activeHref = currentPage.startsWith('technical_test')
        ? 'technical_test_setup.html'
        : currentPage.startsWith('mock_interview')
          ? 'mock_interview_setup.html'
          : currentPage === 'roadmap_setup.html'
            ? 'roadmap.html'
            : currentPage;

      mount.innerHTML = `
        <header class="site-header">
          <nav class="navbar" style="width:100%;max-width:none;margin:0;padding:0 32px" aria-label="Main navigation">
            <a class="brand" href="dashboard.html" aria-label="ASCEND dashboard">
              <img src="assets/logo.png" alt="">
              <span>ASCEND</span>
            </a>
            <button class="menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation">
              <span></span><span></span><span></span>
            </button>
            <div class="nav-content" id="primary-navigation">
              <div class="nav-links">
                <a href="home.html"${activeHref === 'home.html' ? ' class="active" aria-current="page"' : ''}>Home</a>
                <a href="dashboard.html"${activeHref === 'dashboard.html' ? ' class="active" aria-current="page"' : ''}>Dashboard</a>
                <a href="resume_upload.html"${activeHref === 'resume_upload.html' ? ' class="active" aria-current="page"' : ''}>Resume Analyzer</a>
                <div class="nav-dropdown">
                  <button type="button" class="nav-dropdown-button${assessmentActive ? ' active' : ''}" aria-expanded="false" aria-haspopup="menu">
                    Assessment <span aria-hidden="true">⌄</span>
                  </button>
                  <div class="nav-dropdown-menu" role="menu">
                    <a href="technical_test_setup.html"${currentPage.startsWith('technical_test') ? ' class="active" aria-current="page"' : ''} role="menuitem">Technical Test</a>
                    <a href="communication_test.html"${currentPage === 'communication_test.html' ? ' class="active" aria-current="page"' : ''} role="menuitem">Communication Test</a>
                  </div>
                </div>
                <a href="mock_interview_setup.html"${activeHref === 'mock_interview_setup.html' ? ' class="active" aria-current="page"' : ''}>Mock Interview</a>
                <a href="opportunities.html"${activeHref === 'opportunities.html' ? ' class="active" aria-current="page"' : ''}>Opportunities</a>
                <a href="roadmap.html"${activeHref === 'roadmap.html' ? ' class="active" aria-current="page"' : ''}>Roadmap</a>
              </div>
              <div class="nav-actions">
                <div class="nav-user">
                  <button type="button" class="nav-user-button" aria-expanded="false" aria-haspopup="menu">
                    <span class="nav-avatar">${initial.replace(/[<>&"]/g, '')}</span>
                    <span class="nav-user-name">${name.replace(/[<>&"]/g, '')}</span>
                  </button>
                  <div class="nav-user-menu" role="menu">
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
  }

  const navContent = document.querySelector('.nav-content');
  const menuButton = document.querySelector('.menu-toggle');
  const closeMenu = () => {
    if (!menuButton || !navContent) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation menu');
    navContent.classList.remove('is-open');
  };

  menuButton?.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');
    navContent?.classList.toggle('is-open', !isOpen);
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
      dropdownControls.forEach(otherButton => {
        if (otherButton !== button) {
          otherButton.setAttribute('aria-expanded', 'false');
          otherButton.nextElementSibling?.classList.remove('open');
        }
      });
      button.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('open', !open);
    });

    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        button.setAttribute('aria-expanded', 'true');
        menu.classList.add('open');
        menu.querySelector('a, button')?.focus();
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
      dropdownControls.forEach(button => {
        button.setAttribute('aria-expanded', 'false');
        button.nextElementSibling?.classList.remove('open');
      });
      closeMenu();
    }
  });

  navContent?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });

  document.querySelector('.nav-logout')?.addEventListener('click', () => {
    localStorage.removeItem('ascend_user');
    localStorage.removeItem('ascend_token');
    localStorage.removeItem('ATS_DATA');
    window.location.href = 'home.html';
  });

  document.querySelectorAll('[data-logged-out]').forEach(element => {
    element.hidden = isLoggedIn;
  });
  document.querySelectorAll('[data-logged-in]').forEach(element => {
    element.hidden = !isLoggedIn;
  });

  const year = document.getElementById('current-year');
  if (year) year.textContent = new Date().getFullYear();

  if (isLandingPage || window.location.pathname.endsWith('/home.html') || window.location.pathname === '/') {
    const sections = ['home', 'about', 'features', 'how-it-works', 'contact'];
    const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
    const updateActive = () => {
      const offset = 120;
      let active = 'home';
      sections.forEach(id => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= offset) active = id;
      });
      links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${active}`));
    };
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }
})();
