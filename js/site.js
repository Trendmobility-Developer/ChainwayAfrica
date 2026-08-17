(() => {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: .12, rootMargin: '0px 0px -30px' });
  function observeReveals(root = document) { root.querySelectorAll('.reveal:not(.visible)').forEach(element => revealObserver.observe(element)); }
  window.ChainwayReveal = observeReveals;

  const header = document.querySelector('#siteHeader');
  const progress = document.querySelector('.scroll-progress i');
  let scrollQueued = false;

  function paintScroll() {
    const y = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${documentHeight > 0 ? y / documentHeight : 0})`;
    document.body.classList.toggle('utility-hidden', y > 0);
    if (header) header.classList.toggle('scrolled', y > 24);
    if (typeof window.ChainwayHeroScroll === 'function') window.ChainwayHeroScroll(y);
    scrollQueued = false;
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(paintScroll); } }, { passive: true });
  addEventListener('resize', paintScroll, { passive: true });

  const glow = document.querySelector('.cursor-glow');
  if (glow) addEventListener('pointermove', event => { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; glow.style.opacity = '1'; }, { passive: true });

  const menuButton = document.querySelector('#menuButton');
  const mobileNav = document.querySelector('#mobileNav');
  if (menuButton && mobileNav) {
    menuButton.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mobileNav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
  }

  const quoteForm = document.querySelector('#quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = document.querySelector('#quoteSubmit');
      const status = document.querySelector('#quoteStatus');
      const originalLabel = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = 'Sending…';
      status.className = 'form-status';
      status.textContent = '';
      try {
        const response = await fetch('https://formsubmit.co/ajax/sales@chainwayafrica.co.za', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        });
        if (!response.ok) throw new Error('Submission failed');
        form.reset();
        status.classList.add('success');
        status.textContent = 'Thank you — your enquiry has been sent to our sales team.';
      } catch (error) {
        status.classList.add('error');
        status.innerHTML = 'We could not send that enquiry. Please email <a href="mailto:sales@chainwayafrica.co.za">sales@chainwayafrica.co.za</a>.';
      } finally {
        submit.disabled = false;
        submit.innerHTML = originalLabel;
      }
    });
  }

  observeReveals();
  paintScroll();
})();
