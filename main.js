/* ============================================
   LEVE MAIS FIBRA — Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Page Loader ----
  const loader = document.querySelector('.page-loader');
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('hidden'), 900);
  });
  setTimeout(() => loader.classList.add('hidden'), 3500);

  // ---- Header scroll ----
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.pageYOffset > 60);
  });

  // ---- Mobile Menu ----
  const hamburger = document.querySelector('.hamburger');
  const navMobile = document.querySelector('.nav-mobile');

  if (hamburger && navMobile) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMobile.classList.toggle('open');
      document.body.style.overflow = navMobile.classList.contains('open') ? 'hidden' : '';
    });

    navMobile.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMobile.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ---- Scroll Reveal ----
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ---- Parallax ----
  const heroBg = document.querySelector('.hero-bg');
  window.addEventListener('scroll', () => {
    if (heroBg && window.pageYOffset < window.innerHeight * 1.5) {
      heroBg.style.transform = `translateY(${window.pageYOffset * 0.25}px)`;
    }
  });

  // ---- Typing Effect ----
  const typedEl = document.querySelector('.typed-text');
  if (typedEl) {
    const phrases = [
      'Link dedicado com dupla abordagem e alta capacidade de banda.',
      'SLA de 4 horas — sua operação nunca para.',
      'Atendimento 100% humanizado, grupo de suporte exclusivo.',
      'Telefonia VoIP, ramais e portabilidade completa.',
      'Infraestrutura de ponta entregue de forma integral.'
    ];
    let pi = 0, ci = 0, deleting = false, speed = 60;

    function type() {
      const current = phrases[pi];
      if (!deleting) {
        typedEl.textContent = current.substring(0, ci + 1);
        ci++;
        speed = 45;
        if (ci === current.length) { speed = 2500; deleting = true; }
      } else {
        typedEl.textContent = current.substring(0, ci - 1);
        ci--;
        speed = 25;
        if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; speed = 300; }
      }
      setTimeout(type, speed);
    }
    setTimeout(type, 1500);
  }

  // ---- Service Card Mouse Follow ----
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--mouse-y', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });

  // ---- Counter Animation ----
  const statNumbers = document.querySelectorAll('[data-count]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const finalVal = parseInt(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || '';
        const prefix = el.getAttribute('data-prefix') || '';
        const duration = 2000;
        const startTime = performance.now();

        function update(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = prefix + Math.floor(eased * finalVal) + suffix;
          if (progress < 1) requestAnimationFrame(update);
          else el.textContent = prefix + finalVal + suffix;
        }

        requestAnimationFrame(update);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => counterObserver.observe(el));

  // ---- Particles Canvas ----
  const canvas = document.querySelector('.particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    }

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.8 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.opSpeed = (Math.random() - 0.5) * 0.004;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity += this.opSpeed;
        if (this.opacity <= 0.05 || this.opacity >= 0.5) this.opSpeed *= -1;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 60, 60, ${this.opacity})`;
        ctx.fill();
      }
    }

    function init() {
      particles = [];
      const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 18000));
      for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function connect() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(230, 0, 18, ${(1 - d / 130) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      connect();
      requestAnimationFrame(animate);
    }

    resize();
    init();
    animate();
    window.addEventListener('resize', () => { resize(); init(); });
  }

  // ---- Smooth Scroll ----
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.pageYOffset - header.offsetHeight,
          behavior: 'smooth'
        });
      }
    });
  });

  // ---- WhatsApp FAB & Back to Top ----
  const whatsappFab = document.getElementById('whatsappFab');
  const backToTop = document.getElementById('backToTop');

  function handleFloatingButtons() {
    const scrollY = window.pageYOffset;
    const threshold = window.innerHeight * 0.6;

    if (whatsappFab) {
      whatsappFab.classList.toggle('visible', scrollY > threshold);
    }
    if (backToTop) {
      backToTop.classList.toggle('visible', scrollY > threshold);
    }
  }

  window.addEventListener('scroll', handleFloatingButtons);
  handleFloatingButtons();

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---- Storytelling Parallax ----
  const storyBg = document.querySelector('.storytelling-bg-image');
  if (storyBg) {
    window.addEventListener('scroll', () => {
      const section = document.querySelector('.storytelling');
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        storyBg.style.transform = `translateY(${(progress - 0.5) * 60}px) scale(1.05)`;
      }
    });
  }

  // ---- Active Nav Link ----
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-desktop a[href^="#"]');

  function setActiveLink() {
    const scrollPos = window.pageYOffset + header.offsetHeight + 100;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', setActiveLink);
  setActiveLink();

});
