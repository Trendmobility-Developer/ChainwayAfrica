(() => {
  const products = Array.isArray(window.CHAINWAY_CATALOG) ? window.CHAINWAY_CATALOG : [];
  const categories = [...new Set(products.flatMap(product => product.categories))].sort();
  const state = { category: 'All', search: '', sort: 'featured', limit: 16, compare: [] };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const productById = id => products.find(product => product.id === Number(id));

  const grid = $('#productGrid');
  const filters = $('#categoryFilters');
  const count = $('#visibleCount');
  const loadMore = $('#loadMore');
  const search = $('#productSearch');
  const sort = $('#productSort');

  $('#catalogStat').textContent = products.length;

  function filteredProducts() {
    const query = state.search.toLowerCase();
    const result = products.filter(product => {
      const inCategory = state.category === 'All' || product.categories.includes(state.category);
      const haystack = `${product.model} ${product.name} ${product.description} ${product.categories.join(' ')}`.toLowerCase();
      return inCategory && (!query || haystack.includes(query));
    });
    if (state.sort === 'model') result.sort((a, b) => a.model.localeCompare(b.model));
    if (state.sort === 'category') result.sort((a, b) => a.categories[0].localeCompare(b.categories[0]) || a.model.localeCompare(b.model));
    return result;
  }

  function renderFilters() {
    filters.innerHTML = ['All', ...categories].map(category => `<button class="filter-chip${category === state.category ? ' active' : ''}" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
    filters.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
      state.category = button.dataset.category;
      state.limit = 16;
      renderFilters();
      renderProducts();
    }));
  }

  function productCard(product) {
    const selected = state.compare.includes(product.id);
    return `<article class="product-card reveal" data-product-id="${product.id}">
      <div class="product-image"><span class="product-category">${escapeHTML(product.categories[0])}</span><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy"></div>
      <div class="product-body"><h3 class="product-model">${escapeHTML(product.model)}</h3><p class="product-name">${escapeHTML(product.name)}</p><p class="product-description">${escapeHTML(product.description)}</p>
      <div class="product-actions"><button class="detail-button" type="button" data-open-product="${product.id}">View details →</button><button class="compare-toggle${selected ? ' selected' : ''}" type="button" data-compare-product="${product.id}" aria-pressed="${selected}">${selected ? 'Selected' : 'Compare'}</button></div></div>
    </article>`;
  }

  function renderProducts() {
    const result = filteredProducts();
    const visible = result.slice(0, state.limit);
    count.textContent = result.length;
    grid.innerHTML = visible.length ? visible.map(productCard).join('') : '<div class="empty-state"><h3>No matching products</h3><p>Try a broader category or a different search term.</p></div>';
    loadMore.hidden = visible.length >= result.length;
    grid.querySelectorAll('[data-open-product]').forEach(button => button.addEventListener('click', () => openProduct(button.dataset.openProduct)));
    grid.querySelectorAll('[data-compare-product]').forEach(button => button.addEventListener('click', () => toggleCompare(Number(button.dataset.compareProduct))));
    observeReveals(grid);
  }

  search.addEventListener('input', event => { state.search = event.target.value.trim(); state.limit = 16; renderProducts(); });
  sort.addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
  loadMore.addEventListener('click', () => { state.limit += 16; renderProducts(); });
  $('#clearFilters').addEventListener('click', () => { state.category = 'All'; state.search = ''; state.sort = 'featured'; state.limit = 16; search.value = ''; sort.value = 'featured'; renderFilters(); renderProducts(); });

  const productDialog = $('#productDialog');
  function openProduct(id) {
    const product = productById(id);
    if (!product) return;
    $('#productDialogContent').innerHTML = `<div class="dialog-product"><div class="dialog-media"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"></div><div class="dialog-copy"><p class="kicker">${escapeHTML(product.categories[0])}</p><h2>${escapeHTML(product.model)}</h2><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.description)}</p><div class="dialog-tags">${product.categories.map(category => `<span>${escapeHTML(category)}</span>`).join('')}</div><button class="button yellow" type="button" data-quote-product="${product.id}">Request pricing <span>↗</span></button><br><a class="dialog-source" href="${escapeHTML(product.source)}" target="_blank" rel="noopener">Official Chainway product source ↗</a></div></div>`;
    productDialog.showModal();
    document.body.classList.add('dialog-open');
    productDialog.querySelector('[data-quote-product]').addEventListener('click', () => selectForQuote(product));
  }
  $('[data-close-dialog]').addEventListener('click', () => productDialog.close());
  productDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  productDialog.addEventListener('click', event => { if (event.target === productDialog) productDialog.close(); });

  function selectForQuote(product) {
    $('#interestField').value = `${product.model} — ${product.name}`;
    productDialog.close();
    $('#contact').scrollIntoView({ behavior: 'smooth' });
  }

  function toggleCompare(id) {
    if (state.compare.includes(id)) state.compare = state.compare.filter(item => item !== id);
    else if (state.compare.length < 3) state.compare.push(id);
    else {
      const tray = $('#compareTray');
      tray.animate([{ transform: 'translate(-50%,0)' }, { transform: 'translate(-52%,0)' }, { transform: 'translate(-48%,0)' }, { transform: 'translate(-50%,0)' }], { duration: 320 });
      return;
    }
    renderProducts();
    renderCompareTray();
  }

  function renderCompareTray() {
    const selected = state.compare.map(productById).filter(Boolean);
    $('#compareTray').classList.toggle('show', selected.length > 0);
    $('#compareCount').textContent = `${selected.length} product${selected.length === 1 ? '' : 's'} selected`;
    $('#compareThumbs').innerHTML = selected.map(product => `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.model)}">`).join('');
  }

  $('#clearCompare').addEventListener('click', () => { state.compare = []; renderProducts(); renderCompareTray(); });
  const compareDialog = $('#compareDialog');
  $('#openCompare').addEventListener('click', () => {
    const selected = state.compare.map(productById).filter(Boolean);
    if (!selected.length) return;
    $('#comparisonGrid').innerHTML = selected.map(product => `<article class="comparison-card"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"><h3>${escapeHTML(product.model)}</h3><p>${escapeHTML(product.name)}</p><ul><li>${escapeHTML(product.description)}</li>${product.categories.map(category => `<li>${escapeHTML(category)}</li>`).join('')}</ul></article>`).join('');
    compareDialog.showModal();
    document.body.classList.add('dialog-open');
  });
  $('[data-close-compare]').addEventListener('click', () => compareDialog.close());
  compareDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  compareDialog.addEventListener('click', event => { if (event.target === compareDialog) compareDialog.close(); });

  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: .12, rootMargin: '0px 0px -30px' });
  function observeReveals(root = document) { root.querySelectorAll('.reveal:not(.visible)').forEach(element => revealObserver.observe(element)); }

  const header = $('#siteHeader');
  const progress = $('.scroll-progress i');
  const hero = $('.hero');
  const heroMedia = $('#heroMedia');
  const heroTitle = $('#heroTitleWrap');
  const mediaLabel = $('.media-label');
  let scrollQueued = false;
  function paintScroll() {
    const y = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${documentHeight > 0 ? y / documentHeight : 0})`;
    document.body.classList.toggle('utility-hidden', y > 0);
    header.classList.toggle('scrolled', y > 24);
    applyHeroAudio(y);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const heroDistance = Math.max(1, hero.offsetHeight * .66);
      const heroProgress = Math.min(1, y / heroDistance);
      heroMedia.style.transform = `translate3d(0,${heroProgress * (innerWidth < 821 ? 82 : 185)}px,0)`;
      heroTitle.style.transform = `translate3d(0,${heroProgress * (innerWidth < 821 ? 35 : 105)}px,0)`;
      heroTitle.style.opacity = String(1 - heroProgress * .64);
      mediaLabel.style.opacity = String(1 - heroProgress * .78);
    }
    scrollQueued = false;
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(paintScroll); } }, { passive: true });
  addEventListener('resize', paintScroll, { passive: true });

  const glow = $('.cursor-glow');
  addEventListener('pointermove', event => { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; glow.style.opacity = '1'; }, { passive: true });

  const stage = $('#deviceStage');
  stage.addEventListener('pointermove', event => {
    if (innerWidth < 821 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    stage.querySelector('img').style.transform = `rotateY(${x * 15 - 8}deg) rotateX(${-y * 8 + 2}deg) translate3d(${x * 8}px,${y * 8}px,0)`;
  });
  stage.addEventListener('pointerleave', () => { stage.querySelector('img').style.transform = 'rotateY(-8deg) rotateX(2deg)'; });

  const heroVideo = $('#heroVideo');
  const soundToggle = $('#soundToggle');
  let soundEnabled = false;

  function applyHeroAudio(scrollPosition = window.scrollY) {
    const fadeDistance = Math.max(1, heroMedia.offsetHeight * .9);
    const visibility = Math.max(0, Math.min(1, 1 - scrollPosition / fadeDistance));
    const scrollVolume = Math.pow(visibility, 1.5);

    heroVideo.volume = scrollVolume;
    heroVideo.muted = !soundEnabled || scrollVolume <= .01;
  }

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    applyHeroAudio();
    soundToggle.classList.toggle('active', soundEnabled);
    soundToggle.querySelector('span').textContent = soundEnabled ? 'Mute' : 'Sound';
    soundToggle.setAttribute('aria-label', soundEnabled ? 'Mute hero video' : 'Unmute hero video');
  });

  const menuButton = $('#menuButton');
  const mobileNav = $('#mobileNav');
  menuButton.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mobileNav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));

  $('#finderForm').addEventListener('submit', event => {
    event.preventDefault();
    state.category = new FormData(event.currentTarget).get('capture');
    state.search = '';
    state.limit = 16;
    search.value = '';
    renderFilters();
    renderProducts();
    $('#catalog').scrollIntoView({ behavior: 'smooth' });
  });

  $$('[data-industry-filter]').forEach(link => link.addEventListener('click', () => {
    state.category = 'Handheld RFID Readers';
    state.limit = 16;
    renderFilters();
    renderProducts();
  }));

  $('#quoteForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = `Chainway Southern Africa enquiry — ${data.get('company')}`;
    const body = `Name: ${data.get('name')}\nCompany: ${data.get('company')}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone')}\nInterest: ${data.get('interest')}\n\nApplication:\n${data.get('message')}`;
    location.href = `mailto:sales@chainwayafrica.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  renderFilters();
  renderProducts();
  renderCompareTray();
  observeReveals();
  paintScroll();
})();
