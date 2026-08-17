(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const catalogStat = $('#catalogStat');
  if (catalogStat && Array.isArray(window.CHAINWAY_CATALOG)) catalogStat.textContent = window.CHAINWAY_CATALOG.length;

  const hero = $('.hero');
  const heroMedia = $('#heroMedia');
  const heroTitle = $('#heroTitleWrap');
  const mediaLabel = $('.media-label');
  const heroVideo = $('#heroVideo');
  const soundToggle = $('#soundToggle');
  let soundEnabled = false;

  function applyHeroAudio(scrollPosition = window.scrollY) {
    if (!heroVideo || !heroMedia) return;
    const fadeDistance = Math.max(1, heroMedia.offsetHeight * .9);
    const visibility = Math.max(0, Math.min(1, 1 - scrollPosition / fadeDistance));
    const scrollVolume = Math.pow(visibility, 1.5);
    heroVideo.volume = scrollVolume;
    heroVideo.muted = !soundEnabled || scrollVolume <= .01;
  }

  window.ChainwayHeroScroll = y => {
    applyHeroAudio(y);
    if (!hero || !heroMedia || !heroTitle || !mediaLabel) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const heroDistance = Math.max(1, hero.offsetHeight * .66);
      const heroProgress = Math.min(1, y / heroDistance);
      heroMedia.style.transform = `translate3d(0,${heroProgress * (innerWidth < 821 ? 82 : 185)}px,0)`;
      heroTitle.style.opacity = String(1 - heroProgress * .64);
      mediaLabel.style.opacity = String(1 - heroProgress * .78);
    }
  };

  if (heroVideo) {
    const startHeroPlayback = () => heroVideo.play().catch(() => {});
    startHeroPlayback();
    heroVideo.addEventListener('canplay', startHeroPlayback, { once: true });
  }

  soundToggle?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    applyHeroAudio();
    soundToggle.classList.toggle('active', soundEnabled);
    soundToggle.querySelector('span').textContent = soundEnabled ? 'Mute' : 'Sound';
    soundToggle.setAttribute('aria-label', soundEnabled ? 'Mute hero video' : 'Unmute hero video');
  });

  const stage = $('#deviceStage');
  if (stage) {
    stage.addEventListener('pointermove', event => {
      if (innerWidth < 821 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      stage.querySelector('img').style.transform = `rotateY(${x * 15 - 8}deg) rotateX(${-y * 8 + 2}deg) translate3d(${x * 8}px,${y * 8}px,0)`;
    });
    stage.addEventListener('pointerleave', () => { stage.querySelector('img').style.transform = 'rotateY(-8deg) rotateX(2deg)'; });
  }

  $('#finderForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const capture = new FormData(event.currentTarget).get('capture');
    window.ChainwayApp?.setCategoryFilter(capture);
  });

  $$('[data-industry-filter]').forEach(link => link.addEventListener('click', () => {
    window.ChainwayApp?.setCategoryFilter('Handheld RFID Readers');
  }));
})();
