const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = reduceMotionQuery.matches;

// Touch devices (phones/tablets) get native scrolling. Lenis's smoothTouch
// inertia fights the browser's address-bar-driven viewport changes and makes
// momentum feel sluggish, so it is desktop-only.
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const loadingScreen = document.querySelector('.loading-screen');
const cursor = document.querySelector('.cursor');
const cursorGlow = document.querySelector('.cursor-glow');
const navbar = document.querySelector('.navbar');
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const backToTop = document.querySelector('.back-to-top');
const contactForm = document.querySelector('.contact-form');
const sections = document.querySelectorAll('main section[id]');
const navItems = document.querySelectorAll('.nav-link');
const revealItems = document.querySelectorAll('.reveal');
const magneticButtons = document.querySelectorAll('.magnetic');
const tiltItems = document.querySelectorAll('.tilt-card');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealItems.forEach((item) => revealObserver.observe(item));

if (!prefersReducedMotion) {
  document.body.classList.add('cursor-active');
}

window.addEventListener('mousemove', (event) => {
  if (prefersReducedMotion) return;
  cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  cursorGlow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
});

let lenis = null;

if (!isTouchDevice && window.Lenis) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    touchInertiaMultiplier: 1.6,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    syncTouch: false
  });

  // Lenis drives the native scroll position; GSAP ScrollTrigger reads from it.
  // Wrapped in try/catch so a missing/optional library can never block the
  // rest of the script (and therefore can never trap the loading screen).
  try {
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  } catch (err) {
    console.warn('ScrollTrigger/Lenis sync failed, falling back to native scroll:', err);
    function raf(time) {
      if (lenis) lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
}

// Navbar / back-to-top react to Lenis's scroll position (single passive listener).
window.addEventListener('scroll', () => {
  navbar.classList.toggle('shrink', window.scrollY > 24);
  backToTop.classList.toggle('visible', window.scrollY > 700);
}, { passive: true });

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// Close mobile menu on Escape key or outside click
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks.classList.contains('open')) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('click', (event) => {
  if (navLinks.classList.contains('open') && !navbar.contains(event.target)) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 760 && navLinks.classList.contains('open')) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      navItems.forEach((navItem) => navItem.classList.toggle('active', navItem.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { threshold: 0.45 });

sections.forEach((section) => sectionObserver.observe(section));

magneticButtons.forEach((button) => {
  button.addEventListener('mousemove', (event) => {
    if (prefersReducedMotion) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const offsetX = (x / rect.width - 0.5) * 8;
    const offsetY = (y / rect.height - 0.5) * 8;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = '';
  });

  button.addEventListener('click', (event) => {
    if (prefersReducedMotion) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = button.getBoundingClientRect();
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
});

if (!prefersReducedMotion && window.VanillaTilt) {
  VanillaTilt.init(tiltItems, {
    max: 14,
    speed: 500,
    glare: true,
    'max-glare': 0.16,
    scale: 1.02
  });
}

if (window.Typed && document.querySelector('.typing-text')) {
  new Typed('.typing-text', {
    strings: ['Full Stack Developer', 'Next.js & React Engineer', 'AI Automation Builder', 'BCA Student & Problem Solver'],
    typeSpeed: 65,
    backSpeed: 40,
    backDelay: 1200,
    loop: true
  });
}

if (window.gsap && window.ScrollTrigger) {
  try {
    gsap.from('.hero-title', { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.2 });
    gsap.from('.hero-subtitle', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.35 });
    gsap.from('.hero-description', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.5 });
    gsap.from('.hero-actions .btn', { y: 20, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out', delay: 0.75 });
    gsap.from('.profile-card', { scale: 0.94, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.5 });

    gsap.utils.toArray('.section-title, .section-subtitle, .glass-card, .skill-card, .service-card, .project-card, .timeline-item').forEach((el) => {
      gsap.fromTo(el, { y: 28, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 86%'
        }
      });
    });
  } catch (err) {
    console.warn('GSAP animations failed (non-fatal):', err);
  }
}

if (contactForm) {
  const formStatus = document.getElementById('form-status');
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email-input');
    const messageInput = document.getElementById('contact-message');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';

    if (!name || !email || !message) {
      if (formStatus) {
        formStatus.textContent = 'Please fill out all required fields.';
        formStatus.className = 'form-status error';
      }
      return;
    }

    const subject = encodeURIComponent(`Portfolio Inquiry from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\n---\nSent via portfolio contact form`
    );
    const mailtoUrl = `mailto:shubhampatil282487@gmail.com?subject=${subject}&body=${body}`;

    if (formStatus) {
      formStatus.textContent = 'Opening your email client to send message to shubhampatil282487@gmail.com...';
      formStatus.className = 'form-status info';
    }

    window.location.href = mailtoUrl;
  });
}

backToTop.addEventListener('click', (event) => {
  event.preventDefault();
  if (lenis) {
    lenis.scrollTo(0, { immediate: prefersReducedMotion });
  } else {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }
});

// Touch devices get native smooth scrolling. Lenis handles desktop only, so
// enabling scroll-behavior here would only affect the touch fallback path.
if (isTouchDevice) {
  document.documentElement.style.scrollBehavior = 'smooth';
}

document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    event.preventDefault();
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { offset: -88, immediate: prefersReducedMotion });
    } else {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  });
});

// Hides the loading screen. Guaranteed to run even if every optional
// animation library fails to load — a hard fallback timer backs it up.
function hideLoadingScreen() {
  if (!loadingScreen) return;
  if (loadingScreen.classList.contains('hidden')) return;
  loadingScreen.classList.add('hidden');
}

function safeRefresh() {
  try {
    if (window.gsap && window.ScrollTrigger && typeof ScrollTrigger.refresh === 'function') {
      ScrollTrigger.refresh();
    }
  } catch (err) {
    console.warn('ScrollTrigger.refresh failed (non-fatal):', err);
  }
}

window.addEventListener('load', () => {
  // Refresh ScrollTrigger after layout/images settle so triggers are accurate.
  requestAnimationFrame(safeRefresh);
  setTimeout(safeRefresh, 600);
  setTimeout(safeRefresh, 2000);

  setTimeout(hideLoadingScreen, 1300);

  // Hard fallback: if anything above threw, the screen still disappears.
  setTimeout(hideLoadingScreen, 4000);
});
