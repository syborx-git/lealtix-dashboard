/**
 * LEALTIX SITE BUILDER - RENDERIZADOR DE PIEZAS DEL ROMPECABEZAS (CANVAS EN VIVO)
 */

export class PiecesRenderer {
  static renderAll(state, activeMenuCategory = null) {
    let html = '';

    // Render pieces in order defined in state.pieces
    for (const piece of state.pieces) {
      if (!piece.enabled) continue;

      switch (piece.id) {
        case 'navbar':
          html += PiecesRenderer.renderNavbar(state);
          break;
        case 'hero':
          html += PiecesRenderer.renderHero(state);
          break;
        case 'loyalty':
          html += PiecesRenderer.renderLoyalty(state);
          break;
        case 'menu':
          html += PiecesRenderer.renderMenu(state, activeMenuCategory);
          break;
        case 'about':
          html += PiecesRenderer.renderAbout(state);
          break;
        case 'gallery':
          html += PiecesRenderer.renderGallery(state);
          break;
        case 'contact':
          html += PiecesRenderer.renderContact(state);
          break;
        case 'footer':
          html += PiecesRenderer.renderFooter(state);
          break;
      }
    }

    return html;
  }

  static renderNavbar(state) {
    const hasSocials = state.socials && Object.values(state.socials).some(s => s && s.trim() !== '');

    return `
      <!-- PIEZA 1: BARRA DE NAVEGACIÓN -->
      <nav class="preview-navbar" id="preview-navbar">
        <div class="preview-container preview-navbar-inner">
          <div class="preview-brand">
            ${state.logoUrl ? `<img src="${state.logoUrl}" alt="${state.businessName}" class="preview-logo-img">` : `
              <div class="preview-logo-placeholder">
                <i class="pi pi-sparkles"></i>
              </div>
            `}
            <div class="preview-brand-info">
              <span class="preview-brand-name">${state.businessName || 'Nombre del Restaurante'}</span>
              ${state.slogan ? `<span class="preview-brand-slogan">${state.slogan}</span>` : ''}
            </div>
          </div>

          <div class="preview-nav-links">
            <a href="#menu-section" class="preview-nav-link">Menú</a>
            <a href="#about-section" class="preview-nav-link">Nosotros</a>
            <a href="#loyalty-section" class="preview-nav-link">Club Lealtix</a>
            <a href="#contact-section" class="preview-nav-link">Contacto</a>
          </div>

          <div class="preview-nav-actions">
            ${state.whatsapp ? `
              <a href="https://wa.me/${state.whatsapp}" target="_blank" class="preview-btn-primary preview-btn-sm">
                <i class="pi pi-whatsapp"></i>
                <span>Pedir / Reservar</span>
              </a>
            ` : `
              <a href="#contact-section" class="preview-btn-primary preview-btn-sm">
                <i class="pi pi-calendar"></i>
                <span>Reservar Mesa</span>
              </a>
            `}
          </div>
        </div>
      </nav>
    `;
  }

  static renderHero(state) {
    return `
      <!-- PIEZA 2: PORTADA HERO -->
      <header class="preview-hero" id="hero-section" style="${state.heroImage ? `background-image: linear-gradient(180deg, rgba(7, 18, 32, 0.45) 0%, rgba(7, 18, 32, 0.88) 100%), url('${state.heroImage}');` : `background: linear-gradient(135deg, rgba(11, 28, 48, 0.95) 0%, rgba(7, 18, 32, 0.98) 100%);`}">
        <div class="preview-container preview-hero-content">
          ${state.heroBadge ? `<div class="preview-hero-badge"><i class="pi pi-crown"></i> ${state.heroBadge}</div>` : ''}
          <h1 class="preview-hero-title">${state.heroTitle || 'Sabor inigualable en cada detalle'}</h1>
          <p class="preview-hero-subtitle">${state.heroSubtitle || 'Disfruta de platillos excepcionales preparados con ingredientes selectos en un ambiente inigualable.'}</p>
          
          <div class="preview-hero-buttons">
            <a href="${state.heroCtaAction || '#menu-section'}" class="preview-btn-primary preview-btn-lg">
              <span>${state.heroCtaText || 'Explorar Nuestro Menú'}</span>
              <i class="pi pi-arrow-right"></i>
            </a>
            <a href="#loyalty-section" class="preview-btn-glass preview-btn-lg">
              <i class="pi pi-wallet"></i>
              <span>Unirse al Club Digital</span>
            </a>
          </div>

          <div class="preview-hero-quick-features">
            ${(state.highlights && state.highlights.length ? state.highlights : [
              { icon: 'pi-check-circle', text: 'Ingredientes Frescos' },
              { icon: 'pi-star-fill', text: 'Coctelería de Autor' },
              { icon: 'pi-shield', text: 'Pase Wallet Oficial' }
            ]).map(h => `
              <div class="quick-feature-item">
                <i class="pi ${h.icon || 'pi-check-circle'}"></i>
                <span>${h.text || ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </header>
    `;
  }

  static renderLoyalty(state) {
    const l = state.loyalty || {};
    return `
      <!-- PIEZA 3: CLUB DE FIDELIZACIÓN & WALLET -->
      <section class="preview-section preview-loyalty-section" id="loyalty-section">
        <div class="preview-container">
          <div class="preview-loyalty-card">
            <div class="preview-loyalty-left">
              <div class="preview-section-tag">
                <i class="pi pi-sparkles"></i>
                <span>${l.badge || 'CLUB DE BENEFICIOS'}</span>
              </div>
              <h2 class="preview-section-title">${l.title || 'Tu Pase Digital de Socio en el Móvil'}</h2>
              <p class="preview-section-desc">${l.description || 'Instala tu tarjeta de recompensas en Apple Wallet o Google Wallet con un solo toque y acumula sellos y beneficios cada vez que nos visites.'}</p>
              
              <div class="preview-reward-callout">
                <div class="reward-icon-box">
                  <i class="pi pi-gift"></i>
                </div>
                <div class="reward-text-box">
                  <strong>Beneficio de Bienvenida</strong>
                  <p>${l.rewardHighlight || '10% de descuento en tu primera visita + bebida de cortesía'}</p>
                </div>
              </div>

              <div class="preview-loyalty-actions">
                <button class="preview-btn-primary" onclick="alert('Demostración: Enlace a registro directo y descarga a Apple / Google Wallet.')">
                  <i class="pi pi-apple"></i>
                  <i class="pi pi-android"></i>
                  <span>${l.ctaText || 'Obtener Tarjeta Digital'}</span>
                </button>
              </div>
            </div>

            <div class="preview-loyalty-right">
              <div class="preview-pass-mockup">
                <div class="pass-header">
                  <div class="pass-brand">${state.businessName}</div>
                  <span class="pass-vip-tag">VIP MEMBER</span>
                </div>
                <div class="pass-body">
                  <div class="pass-qr-frame">
                    <img src="${l.qrPreviewUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=LealtixClub'}" alt="QR Fidelización" class="pass-qr-img">
                  </div>
                  <div class="pass-holder-info">
                    <span>SOCIO DISTINGUIDO</span>
                    <small>Nivel: Platino &bull; 4 Sellos Acumulados</small>
                  </div>
                </div>
                <div class="pass-footer">
                  <span>Powered by Lealtix Wallet</span>
                  <i class="pi pi-verified"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  static renderMenu(state, activeCategoryId = null) {
    const categories = state.menuCategories || [];
    const products = state.menuProducts || [];

    // Select first active category by default if not set
    const currentCatId = activeCategoryId || (categories.length > 0 ? categories[0].id : null);
    const filteredProducts = currentCatId ? products.filter(p => p.categoryId === currentCatId) : products;

    return `
      <!-- PIEZA 4: CATÁLOGO DE MENÚ -->
      <section class="preview-section preview-menu-section" id="menu-section">
        <div class="preview-container">
          <div class="preview-section-header">
            <div class="preview-section-tag">
              <i class="pi pi-book"></i>
              <span>NUESTRA CARTA</span>
            </div>
            <h2 class="preview-section-title">Menú Culinario</h2>
            <p class="preview-section-desc">Selecciona una categoría para explorar nuestras creaciones gastronómicas y especialidades de la casa.</p>
          </div>

          <!-- Selector de Categorías (Pestañas) -->
          <div class="preview-menu-tabs">
            ${categories.map(cat => `
              <button class="preview-cat-tab ${cat.id === currentCatId ? 'active' : ''}" 
                      data-category-id="${cat.id}">
                <span class="cat-icon">${cat.icon || '🍽️'}</span>
                <span class="cat-name">${cat.name}</span>
              </button>
            `).join('')}
          </div>

          <!-- Grid de Productos -->
          <div class="preview-products-grid">
            ${filteredProducts.length > 0 ? filteredProducts.map(prod => `
              <div class="preview-product-card">
                ${prod.image ? `
                  <div class="product-img-wrapper">
                    <img src="${prod.image}" alt="${prod.name}" class="product-img" loading="lazy">
                    ${prod.badge ? `<span class="product-badge">${prod.badge}</span>` : ''}
                  </div>
                ` : ''}
                <div class="product-content">
                  <div class="product-title-row">
                    <h3 class="product-title">${prod.name}</h3>
                    <span class="product-price">${prod.price}</span>
                  </div>
                  <p class="product-desc">${prod.description || ''}</p>
                </div>
              </div>
            `).join('') : `
              <div class="preview-empty-products">
                <i class="pi pi-inbox"></i>
                <p>No hay productos en esta categoría todavía.</p>
              </div>
            `}
          </div>
        </div>
      </section>
    `;
  }

  static renderAbout(state) {
    const ab = state.about || {};
    return `
      <!-- PIEZA 5: SOBRE NOSOTROS / HISTORIA -->
      <section class="preview-section preview-about-section" id="about-section">
        <div class="preview-container">
          <div class="preview-about-grid">
            <div class="preview-about-image-wrapper">
              <img src="${ab.aboutImage || 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80'}" alt="Chef & Cocina" class="preview-about-img">
              ${state.since ? `
                <div class="preview-experience-badge">
                  <span class="exp-number">Est. ${state.since}</span>
                  <span class="exp-label">Calidad Garantizada</span>
                </div>
              ` : ''}
            </div>

            <div class="preview-about-content">
              <div class="preview-section-tag">
                <i class="pi pi-heart"></i>
                <span>HISTORIA & TRADICIÓN</span>
              </div>
              <h2 class="preview-section-title">${ab.title || 'Nuestra Pasión por el Buen Comer'}</h2>
              <p class="preview-about-text">${ab.story || 'Cuidamos cada detalle desde el origen de los ingredientes hasta la presentación final.'}</p>
              
              ${ab.vision ? `
                <div class="preview-about-vision">
                  <i class="pi pi-compass"></i>
                  <p>${ab.vision}</p>
                </div>
              ` : ''}

              ${ab.chefQuote ? `
                <blockquote class="preview-chef-quote">
                  <p>"${ab.chefQuote}"</p>
                  ${ab.chefName ? `<cite>&mdash; ${ab.chefName}</cite>` : ''}
                </blockquote>
              ` : ''}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  static renderGallery(state) {
    const images = state.gallery || [];
    if (images.length === 0) return '';

    const layout = state.galleryLayout || 'mosaic';

    let layoutClass = 'preview-gallery-mosaic';
    if (layout === 'grid') layoutClass = 'preview-gallery-grid';
    if (layout === 'masonry') layoutClass = 'preview-gallery-masonry';

    return `
      <!-- PIEZA 6: GALERÍA DE FOTOS (DISEÑO: ${layout.toUpperCase()}) -->
      <section class="preview-section preview-gallery-section" id="gallery-section">
        <div class="preview-container">
          <div class="preview-section-header">
            <div class="preview-section-tag">
              <i class="pi pi-images"></i>
              <span>GALERÍA VISUAL</span>
            </div>
            <h2 class="preview-section-title">El Arte de Nuestra Mesa</h2>
            <p class="preview-section-desc">Instalaciones, momentos especiales y creaciones de nuestra cocina.</p>
          </div>

          <div class="${layoutClass}">
            ${images.map((item, index) => {
              let itemClass = 'preview-gallery-item';
              if (layout === 'mosaic' && index === 0) itemClass += ' gallery-item-featured';
              if (layout === 'masonry' && index % 3 === 0) itemClass += ' gallery-item-tall';

              return `
                <div class="${itemClass}">
                  <img src="${item.url}" alt="${item.caption || 'Foto de restaurante'}" class="gallery-img" loading="lazy">
                  ${item.caption ? `<div class="gallery-overlay"><span>${item.caption}</span></div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  static renderContact(state) {
    return `
      <!-- PIEZA 7: HORARIOS, CONTACTO & UBICACIÓN -->
      <section class="preview-section preview-contact-section" id="contact-section">
        <div class="preview-container">
          <div class="preview-section-header">
            <div class="preview-section-tag">
              <i class="pi pi-map-marker"></i>
              <span>UBICACIÓN & HORARIOS</span>
            </div>
            <h2 class="preview-section-title">Te Esperamos</h2>
            <p class="preview-section-desc">Visítanos o contáctanos para asegurar tu mesa en nuestra próxima velada.</p>
          </div>

          <div class="preview-contact-grid">
            <div class="preview-contact-card">
              <div class="contact-icon-circle">
                <i class="pi pi-map-marker"></i>
              </div>
              <h3 class="contact-card-title">Dirección</h3>
              <p class="contact-card-info">${state.address || 'Av. Insurgentes Sur 1425, Col. Nápoles, CDMX'}</p>
              ${state.socials?.googleMaps ? `
                <a href="${state.socials.googleMaps}" target="_blank" class="contact-card-link">
                  <span>Abrir en Google Maps</span>
                  <i class="pi pi-external-link"></i>
                </a>
              ` : ''}
            </div>

            <div class="preview-contact-card">
              <div class="contact-icon-circle">
                <i class="pi pi-clock"></i>
              </div>
              <h3 class="contact-card-title">Horarios de Atención</h3>
              <p class="contact-card-info">${state.schedules || 'Martes a Domingo: 13:00 hrs - 23:30 hrs'}</p>
              <span class="contact-highlight-badge">Cocina abierta hasta 23:00 hrs</span>
            </div>

            <div class="preview-contact-card">
              <div class="contact-icon-circle">
                <i class="pi pi-phone"></i>
              </div>
              <h3 class="contact-card-title">Contacto Directo</h3>
              <p class="contact-card-info">${state.phone || '+52 (55) 8492-1049'}</p>
              ${state.email ? `<p class="contact-email">${state.email}</p>` : ''}
              ${state.whatsapp ? `
                <a href="https://wa.me/${state.whatsapp}" target="_blank" class="preview-btn-primary preview-btn-sm mt-3">
                  <i class="pi pi-whatsapp"></i>
                  <span>Escribir por WhatsApp</span>
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  static renderFooter(state) {
    const s = state.socials || {};
    return `
      <!-- PIEZA 8: FOOTER -->
      <footer class="preview-footer">
        <div class="preview-container preview-footer-inner">
          <div class="preview-footer-brand">
            <span class="footer-brand-name">${state.businessName}</span>
            <p class="footer-brand-slogan">${state.slogan || 'Experiencia culinaria única'}</p>
            <p class="footer-copy">&copy; ${new Date().getFullYear()} ${state.businessName}. Todos los derechos reservados.</p>
          </div>

          <div class="preview-footer-socials">
            ${s.instagram ? `<a href="${s.instagram}" target="_blank" class="social-icon" aria-label="Instagram"><i class="pi pi-instagram"></i></a>` : ''}
            ${s.facebook ? `<a href="${s.facebook}" target="_blank" class="social-icon" aria-label="Facebook"><i class="pi pi-facebook"></i></a>` : ''}
            ${s.tiktok ? `<a href="${s.tiktok}" target="_blank" class="social-icon" aria-label="TikTok"><i class="pi pi-video"></i></a>` : ''}
            ${s.googleMaps ? `<a href="${s.googleMaps}" target="_blank" class="social-icon" aria-label="Google Maps"><i class="pi pi-map"></i></a>` : ''}
          </div>
        </div>
        <div class="preview-footer-bottom">
          <span>Sitio creado con tecnología Lealtix Web Studio</span>
        </div>
      </footer>
    `;
  }
}
