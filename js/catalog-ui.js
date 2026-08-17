(() => {
  const products = Array.isArray(window.CHAINWAY_CATALOG) ? window.CHAINWAY_CATALOG : [];
  const categories = [...new Set(products.flatMap(product => product.categories))].sort();

  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const productById = id => products.find(product => product.id === Number(id));

  const grid = $('#productGrid');
  if (!grid) return; // this page has no catalog

  const filters = $('#categoryFilters');
  const count = $('#visibleCount');
  const loadMore = $('#loadMore');
  const search = $('#productSearch');
  const sort = $('#productSort');

  // Pages with a #loadMore button show a capped preview and send visitors
  // onward to products.html; pages without one (the dedicated catalog page)
  // show everything.
  const defaultLimit = () => (loadMore ? 16 : Infinity);
  const state = { category: 'All', search: '', sort: 'featured', limit: defaultLimit(), compare: [] };

  const params = new URLSearchParams(location.search);
  const initialCategory = params.get('category');
  const initialQuery = params.get('q');
  if (initialCategory && (initialCategory === 'All' || categories.includes(initialCategory))) state.category = initialCategory;
  if (initialQuery) { state.search = initialQuery; if (search) search.value = initialQuery; }

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
    if (!filters) return;
    filters.innerHTML = ['All', ...categories].map(category => `<button class="filter-chip${category === state.category ? ' active' : ''}" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
    filters.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
      state.category = button.dataset.category;
      state.limit = defaultLimit();
      renderFilters();
      renderProducts();
    }));
  }

  function productCard(product) {
    const selected = state.compare.includes(product.id);
    return `<article class="product-card reveal" data-product-id="${product.id}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View details for ${escapeHTML(product.name)}">
      <div class="product-image"><span class="product-category">${escapeHTML(product.categories[0])}</span><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy"></div>
      <div class="product-body"><h3 class="product-model">${escapeHTML(product.model)}</h3><p class="product-name">${escapeHTML(product.name)}</p><p class="product-description">${escapeHTML(product.description)}</p>
      <div class="product-actions"><button class="compare-toggle${selected ? ' selected' : ''}" type="button" data-compare-product="${product.id}" aria-pressed="${selected}">${selected ? 'Selected' : 'Compare'}</button></div></div>
    </article>`;
  }

  function renderProducts() {
    const result = filteredProducts();
    const visible = result.slice(0, state.limit);
    if (count) count.textContent = result.length;
    grid.innerHTML = visible.length ? visible.map(productCard).join('') : '<div class="empty-state"><h3>No matching products</h3><p>Try a broader category or a different search term.</p></div>';
    if (loadMore) loadMore.hidden = visible.length >= result.length;
    grid.querySelectorAll('[data-product-id]').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('[data-compare-product]')) return;
        openProduct(card.dataset.productId);
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        openProduct(card.dataset.productId);
      });
    });
    grid.querySelectorAll('[data-compare-product]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      toggleCompare(Number(button.dataset.compareProduct));
    }));
    window.ChainwayReveal?.(grid);
  }

  search?.addEventListener('input', event => { state.search = event.target.value.trim(); state.limit = defaultLimit(); renderProducts(); });
  sort?.addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
  loadMore?.addEventListener('click', () => {
    const qs = new URLSearchParams();
    if (state.category !== 'All') qs.set('category', state.category);
    if (state.search) qs.set('q', state.search);
    const suffix = qs.toString();
    location.href = `products.html${suffix ? `?${suffix}` : ''}`;
  });
  $('#clearFilters')?.addEventListener('click', () => {
    state.category = 'All'; state.search = ''; state.sort = 'featured'; state.limit = defaultLimit();
    if (search) search.value = '';
    if (sort) sort.value = 'featured';
    renderFilters();
    renderProducts();
  });

  const productDialog = $('#productDialog');
  function openProduct(id) {
    const product = productById(id);
    if (!product || !productDialog) return;
    $('#productDialogContent').innerHTML = `<div class="dialog-product"><div class="dialog-media"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"></div><div class="dialog-copy"><p class="kicker">${escapeHTML(product.categories[0])}</p><h2>${escapeHTML(product.model)}</h2><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.description)}</p><div class="dialog-tags">${product.categories.map(category => `<span>${escapeHTML(category)}</span>`).join('')}</div><button class="button yellow" type="button" data-quote-product="${product.id}">Request pricing <span>↗</span></button></div></div>`;
    productDialog.showModal();
    document.body.classList.add('dialog-open');
    productDialog.querySelector('[data-quote-product]').addEventListener('click', () => selectForQuote(product));
  }
  $('[data-close-dialog]')?.addEventListener('click', () => productDialog.close());
  productDialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  productDialog?.addEventListener('click', event => { if (event.target === productDialog) productDialog.close(); });

  function selectForQuote(product) {
    const interestField = $('#interestField');
    if (interestField) interestField.value = `${product.model} — ${product.name}`;
    productDialog.close();
    $('#contact')?.scrollIntoView({ behavior: 'smooth' });
  }

  function toggleCompare(id) {
    if (state.compare.includes(id)) state.compare = state.compare.filter(item => item !== id);
    else if (state.compare.length < 3) state.compare.push(id);
    else {
      const tray = $('#compareTray');
      tray?.animate([{ transform: 'translate(-50%,0)' }, { transform: 'translate(-52%,0)' }, { transform: 'translate(-48%,0)' }, { transform: 'translate(-50%,0)' }], { duration: 320 });
      return;
    }
    renderProducts();
    renderCompareTray();
  }

  function renderCompareTray() {
    const tray = $('#compareTray');
    if (!tray) return;
    const selected = state.compare.map(productById).filter(Boolean);
    tray.classList.toggle('show', selected.length > 0);
    $('#compareCount').textContent = `${selected.length} product${selected.length === 1 ? '' : 's'} selected`;
    $('#compareThumbs').innerHTML = selected.map(product => `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.model)}">`).join('');
  }

  $('#clearCompare')?.addEventListener('click', () => { state.compare = []; renderProducts(); renderCompareTray(); });
  const compareDialog = $('#compareDialog');
  function openCompareDialog() {
    const selected = state.compare.map(productById).filter(Boolean);
    if (!selected.length || !compareDialog) return false;
    $('#comparisonGrid').innerHTML = selected.map(product => `<article class="comparison-card"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"><h3>${escapeHTML(product.model)}</h3><p>${escapeHTML(product.name)}</p><ul><li>${escapeHTML(product.description)}</li>${product.categories.map(category => `<li>${escapeHTML(category)}</li>`).join('')}</ul></article>`).join('');
    compareDialog.showModal();
    document.body.classList.add('dialog-open');
    return true;
  }
  $('#openCompare')?.addEventListener('click', openCompareDialog);
  $('[data-close-compare]')?.addEventListener('click', () => compareDialog.close());
  compareDialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  compareDialog?.addEventListener('click', event => { if (event.target === compareDialog) compareDialog.close(); });
  $('#aiCompareBtn')?.addEventListener('click', () => {
    const selected = state.compare.map(productById).filter(Boolean);
    if (!selected.length) return;
    const lines = selected.map(product => `${product.model} — ${product.name}: ${product.description} [${product.categories.join(', ')}]`).join('\n');
    const prompt = `Give me a detailed side-by-side comparison of these products, with a Markdown table of the key differences and a recommendation for which one fits which use case:\n${lines}`;
    compareDialog.close();
    window.ChainwayChat?.ask(prompt);
  });

  window.ChainwayApp = {
    setCategoryFilter(category) {
      if (category !== 'All' && !categories.includes(category)) return;
      state.category = category;
      state.search = '';
      state.limit = defaultLimit();
      if (search) search.value = '';
      renderFilters();
      renderProducts();
      $('#catalog')?.scrollIntoView({ behavior: 'smooth' });
    },
    compareProducts(names) {
      if (!Array.isArray(names) || !names.length) return false;
      const chosen = [];
      names.forEach(name => {
        if (chosen.length >= 3 || typeof name !== 'string' || !name.trim()) return;
        const needle = name.toLowerCase();
        const match = products.find(product => !chosen.includes(product.id) && (
          `${product.model} ${product.name}`.toLowerCase().includes(needle) ||
          needle.includes(product.model.toLowerCase())
        ));
        if (match) chosen.push(match.id);
      });
      if (!chosen.length) return false;
      state.compare = chosen;
      renderProducts();
      renderCompareTray();
      return openCompareDialog();
    },
  };

  renderFilters();
  renderProducts();
  renderCompareTray();
})();
