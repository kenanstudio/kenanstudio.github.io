(() => {
  const cfg = window.KENAN_STUDIO_CONFIG || {};
  document.getElementById('year').textContent = new Date().getFullYear();

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
  if (cfg.contactEmail && cfg.contactEmail.includes('@')) {
    emailLink.href = `mailto:${cfg.contactEmail}`;
    emailLink.textContent = cfg.contactEmail;
    hint.textContent = 'For support and business inquiries.';
  } else {
    emailLink.href = '#contact';
    emailLink.addEventListener('click', e => e.preventDefault());
    emailLink.classList.add('button-disabled');
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const close = document.querySelector('.lightbox-close');
  const closeLightbox = () => { lightbox.hidden = true; lightboxImage.removeAttribute('src'); document.body.style.overflow=''; };
  document.querySelectorAll('[data-lightbox]').forEach(item => item.addEventListener('click', () => {
    lightboxImage.src = item.dataset.lightbox;
    lightbox.hidden = false;
    document.body.style.overflow='hidden';
  }));
  close?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
})();
