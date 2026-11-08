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
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email-input');
  const messageInput = document.getElementById('contact-message');
  const hpInput = document.getElementById('contact-hp-company');

  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const messageError = document.getElementById('message-error');

  let isSubmitting = false;

  function clearErrors() {
    [nameInput, emailInput, messageInput].forEach((input) => {
      if (input) input.removeAttribute('aria-invalid');
    });
    [nameError, emailError, messageError].forEach((err) => {
      if (err) {
        err.textContent = '';
        err.classList.remove('visible');
      }
    });
  }

  function setFieldError(input, errorEl, message) {
    if (input) input.setAttribute('aria-invalid', 'true');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  function validateClientSide(name, email, message) {
    clearErrors();
    let isValid = true;

    if (!name) {
      setFieldError(nameInput, nameError, 'Please enter your name.');
      isValid = false;
    } else if (name.length < 2) {
      setFieldError(nameInput, nameError, 'Name must be at least 2 characters.');
      isValid = false;
    } else if (name.length > 100) {
      setFieldError(nameInput, nameError, 'Name cannot exceed 100 characters.');
      isValid = false;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!email) {
      setFieldError(emailInput, emailError, 'Please enter your email address.');
      isValid = false;
    } else if (email.length > 254 || !emailRegex.test(email)) {
      setFieldError(emailInput, emailError, 'Please enter a valid email address.');
      isValid = false;
    }

    if (!message) {
      setFieldError(messageInput, messageError, 'Please enter a message.');
      isValid = false;
    } else if (message.length < 10) {
      setFieldError(messageInput, messageError, 'Message must be at least 10 characters.');
      isValid = false;
    } else if (message.length > 3000) {
      setFieldError(messageInput, messageError, 'Message cannot exceed 3,000 characters.');
      isValid = false;
    }

    return isValid;
  }

  // Clear field-specific error dynamically when user starts editing
  [nameInput, emailInput, messageInput].forEach((input) => {
    if (input) {
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') {
          input.removeAttribute('aria-invalid');
          const errId = input.getAttribute('aria-describedby');
          const errEl = errId ? document.getElementById(errId) : null;
          if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
          }
        }
      });
    }
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Prevent duplicate rapid submissions
    if (isSubmitting) return;

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';
    const _hp_company = hpInput ? hpInput.value.trim() : '';

    if (!validateClientSide(name, email, message)) {
      if (formStatus) {
        formStatus.textContent = 'Please fix the highlighted fields above.';
        formStatus.className = 'form-status error';
      }
      return;
    }

    // Set loading state
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      if (btnText) {
        btnText.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending...';
      }
    }
    if (formStatus) {
      formStatus.textContent = 'Sending your message securely...';
      formStatus.className = 'form-status info';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _hp_company
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        if (formStatus) {
          formStatus.textContent = data.message || 'Thank you! Your message has been sent successfully.';
          formStatus.className = 'form-status success';
        }
        contactForm.reset();
        clearErrors();
      } else {
        const errorMsg = data.error || 'Failed to send message. Please try again or email directly.';
        if (formStatus) {
          formStatus.textContent = errorMsg;
          formStatus.className = 'form-status error';
        }
      }
    } catch (networkError) {
      console.error('Contact form submission error:', networkError);
      if (formStatus) {
        formStatus.textContent = 'Network error. Please check your connection or reach out via email directly.';
        formStatus.className = 'form-status error';
      }
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnText) {
          btnText.textContent = 'Send Message';
        }
      }
    }
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
