(() => {
  const cfg = window.KIANAN_STUDIO_CONFIG || {};
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav-links');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));

  document.querySelectorAll('[data-store-link]').forEach(link => {
    if (cfg.assetStoreUrl) link.href = cfg.assetStoreUrl;
  });

  const emailLink = document.getElementById('email-link');
  const hint = document.getElementById('contact-hint');
  if (emailLink) {
    if (cfg.contactEmail && cfg.contactEmail.includes('@')) {
      emailLink.href = `mailto:${cfg.contactEmail}`;
      emailLink.textContent = cfg.contactEmail;
      if (hint) hint.textContent = 'For support and business inquiries.';
    } else {
      emailLink.href = '#contact';
      emailLink.classList.add('button-disabled');
      emailLink.addEventListener('click', e => e.preventDefault());
    }
  }

  const categoryGrid = document.getElementById('category-grid');
  const sidebar = document.getElementById('catalog-sidebar');
  const list = document.getElementById('catalog-list');
  const title = document.getElementById('catalog-title');
  let catalog = null;
  let activeCategory = 'unity-tools';

  const categoryIcon = id => ({
    'unity-tools': '◇',
    'games': '🎮',
    '3d-assets': '⬡'
  }[id] || '◆');

  function renderCategories() {
    categoryGrid.innerHTML = catalog.categories.map(cat => {
      const count = catalog.products.filter(p => p.category === cat.id).length;
      return `<button class="category-card ${cat.id === activeCategory ? 'active' : ''}" data-category="${cat.id}">
        <span class="category-icon">${categoryIcon(cat.id)}</span>
        <span><strong>${cat.title}</strong><small>${cat.description}</small></span>
        <em>${count}</em>
      </button>`;
    }).join('');

    categoryGrid.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategories();
      renderCatalog();
      document.getElementById('catalog-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function renderCatalog() {
    const cat = catalog.categories.find(c => c.id === activeCategory);
    const products = catalog.products.filter(p => p.category === activeCategory);
    if (title) title.textContent = cat?.title || 'Projects';

    sidebar.innerHTML = catalog.categories.map(c => {
      const count = catalog.products.filter(p => p.category === c.id).length;
      return `<button class="sidebar-link ${c.id === activeCategory ? 'active' : ''}" data-sidebar-category="${c.id}">
        <span>${c.title}</span><em>${count}</em>
      </button>`;
    }).join('');

    sidebar.querySelectorAll('[data-sidebar-category]').forEach(btn => btn.addEventListener('click', () => {
      activeCategory = btn.dataset.sidebarCategory;
      renderCategories();
      renderCatalog();
    }));

    if (!products.length) {
      list.innerHTML = `<div class="empty-state"><strong>Coming soon.</strong><span>New ${cat?.title || 'projects'} will appear here.</span></div>`;
      return;
    }

    list.innerHTML = products.map(product => {
      const visual = product.cover
        ? `<img src="${product.cover}" alt="${product.title}" loading="lazy">`
        : `<div class="item-placeholder">${product.title.slice(0,2).toUpperCase()}</div>`;
      return `<a class="catalog-item" href="product.html?id=${encodeURIComponent(product.id)}">
        <div class="catalog-thumb">${visual}</div>
        <div class="catalog-item-copy">
          <div class="catalog-meta"><span>${product.status || ''}</span>${product.version ? `<span>v${product.version}</span>` : ''}</div>
          <h4>${product.title}</h4>
          <p>${product.shortDescription || ''}</p>
        </div>
        <span class="catalog-arrow">→</span>
      </a>`;
    }).join('');
  }

  if (categoryGrid && sidebar && list) {
    fetch('data/products.json', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`Catalog load failed: ${r.status}`);
        return r.json();
      })
      .then(data => {
        catalog = data;
        renderCategories();
        renderCatalog();
      })
      .catch(err => {
        console.error(err);
        categoryGrid.innerHTML = '<p class="load-error">Catalog is temporarily unavailable.</p>';
      });
  }
})();
