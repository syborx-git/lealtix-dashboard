/**
 * LEALTIX SITE BUILDER - GESTIÓN DE ESTADO Y PIEZAS DE ROMPECABEZAS
 */

export const INITIAL_STATE = {
  themeId: 'gold-obsidian',
  typographyId: 'plus-jakarta',
  
  // Identidad Básica
  businessName: 'Aura Cocina & Coctelería',
  slogan: 'Experiencia sensorial y gastronomía de autor',
  logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&h=200&q=80',
  
  // Puntos Destacados / Características Rápidas (3 campos con íconos seleccionables)
  highlights: [
    { icon: 'pi-check-circle', text: 'Ingredientes Frescos' },
    { icon: 'pi-star-fill', text: 'Coctelería de Autor' },
    { icon: 'pi-shield', text: 'Pase Wallet Oficial' }
  ],

  heroBadge: 'Tradición Culinaria • Desde 2021',
  heroImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
  heroTitle: 'Sabor auténtico, momentos memorables',
  heroSubtitle: 'Descubre nuestra carta de temporada con ingredientes frescos de origen local y coctelería contemporánea.',
  heroCtaText: 'Explorar Menú',
  heroCtaAction: '#menu-section',
  
  // Contacto & Ubicación
  phone: '+52 (55) 8492-1049',
  whatsapp: '525584921049',
  email: 'contacto@aurarestaurante.mx',
  address: 'Av. Insurgentes Sur 1425, Col. Nápoles, CDMX',
  schedules: 'Martes a Domingo: 13:00 hrs - 23:30 hrs',
  
  // Redes Sociales
  socials: {
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    tiktok: 'https://tiktok.com',
    googleMaps: 'https://maps.google.com'
  },

  // Historia & Filosofía
  about: {
    title: 'Nuestra Pasión',
    story: 'Nacimos con la convicción de que comer bien es un arte compartido. Seleccionamos cuidadosamente a productores locales para llevar a tu mesa platillos que rinden homenaje a la tradición con un toque de innovación culinaria.',
    vision: 'Crear un espacio cálido donde cada platillo despierte recuerdos y celebre la buena mesa.',
    chefQuote: 'La cocina honesta no necesita artificios, solo pasión, técnica y respeto absoluto por el ingrediente.',
    chefName: 'Chef Alejandro Morales',
    aboutImage: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80'
  },

  // Fidelización / Wallet Lealtix
  loyalty: {
    badge: 'LEALTIX CLUB DE SOCIOS',
    title: 'Únete a nuestro Club de Beneficios Exclusivo',
    description: 'Guarda tu pase digital directamente en Apple Wallet o Google Wallet al instante. Sin aplicaciones pesadas.',
    rewardHighlight: '10% de descuento en tu primera visita + cóctel de cortesía en tu cumpleaños',
    ctaText: 'Obtener mi Tarjeta de Socio Digital',
    qrPreviewUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://lealtix.com/aura-demo'
  },

  // Galería de Fotos y Diseño de Presentación (3 opciones)
  galleryLayout: 'mosaic', // 'mosaic' (Facebook collage), 'grid' (Cuadrícula simétrica), 'masonry' (Muro asimétrico)
  gallery: [
    { url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80', caption: 'Platillo Insignia' },
    { url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', caption: 'Mixología de Autor' },
    { url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80', caption: 'Terraza Nocturna' },
    { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', caption: 'Cortes a las Brasas' }
  ],

  // PIEZAS DEL ROMPECABEZAS (Bloques modulares con orden y visibilidad)
  pieces: [
    { id: 'navbar', name: 'Barra de Navegación & Logo', icon: 'pi pi-compass', enabled: true, locked: true },
    { id: 'hero', name: 'Portada Hero & Bienvenida', icon: 'pi pi-image', enabled: true, locked: false },
    { id: 'loyalty', name: 'Club de Fidelización (Lealtix)', icon: 'pi pi-gift', enabled: true, locked: false },
    { id: 'menu', name: 'Catálogo de Menú & Categorías', icon: 'pi pi-book', enabled: true, locked: false },
    { id: 'about', name: 'Sobre Nosotros & Historia', icon: 'pi pi-info-circle', enabled: true, locked: false },
    { id: 'gallery', name: 'Galería de Ambiente & Platos', icon: 'pi pi-images', enabled: true, locked: false },
    { id: 'contact', name: 'Horarios, Ubicación & Reserva', icon: 'pi pi-map-marker', enabled: true, locked: false },
    { id: 'footer', name: 'Pie de Página (Footer)', icon: 'pi pi-align-bottom', enabled: true, locked: true }
  ],

  // Categorías de Menú
  menuCategories: [
    { id: 'cat-1', name: 'Entradas & Tapas', icon: '🍲', active: true },
    { id: 'cat-2', name: 'Platos Fuertes', icon: '🥩', active: true },
    { id: 'cat-3', name: 'Coctelería de Autor', icon: '🍸', active: true },
    { id: 'cat-4', name: 'Postres Artesanales', icon: '🍰', active: true }
  ],

  // Lista de Productos de Menú
  menuProducts: [
    {
      id: 'prod-1',
      categoryId: 'cat-1',
      name: 'Carpaccio de Res Trufado',
      price: '$210',
      description: 'Láminas finas de filete con vinagreta de trufa blanca, alcaparras baby, arúgula y lascas de parmesano.',
      badge: 'Especial del Chef',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'prod-2',
      categoryId: 'cat-1',
      name: 'Tacos de Pulpo al Carbón (3 piezas)',
      price: '$195',
      description: 'Pulpo marinado en adobo de chiles secos sobre tortilla azul nixtamalizada con emulsión de cilantro.',
      badge: 'Más Pedido',
      image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'prod-3',
      categoryId: 'cat-2',
      name: 'Rib Eye Añejado a la Leña (400g)',
      price: '$460',
      description: 'Corte calidad Prime con mantequilla de romero y ajo confitado, servido con papas cambray al tomillo.',
      badge: 'Corte Estrella',
      image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'prod-4',
      categoryId: 'cat-2',
      name: 'Salmón Glaseado con Miso y Maracuyá',
      price: '$340',
      description: 'Filete fresco sellado en costra crujiente sobre cama de quinoa roja y espárragos salteados.',
      badge: 'Recomendado',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'prod-5',
      categoryId: 'cat-3',
      name: 'Smoked Mezcalita Oaxaqueña',
      price: '$165',
      description: 'Mezcal espadín artesanal, jugo fresco de toronja tatemada, infusión de romero y sal de gusano.',
      badge: 'Cóctel Insignia',
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'prod-6',
      categoryId: 'cat-4',
      name: 'Volcán de Chocolate Oaxaqueño 70%',
      price: '$140',
      description: 'Bizcocho tibio de corazón fundido servido con helado artesanal de vainilla de Papantla y praliné.',
      badge: 'Favorito',
      image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80'
    }
  ]
};

const STORAGE_KEY = 'lealtix_site_builder_state_v1';

export class StateManager {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...JSON.parse(JSON.stringify(INITIAL_STATE)),
          ...parsed,
          highlights: (parsed.highlights && Array.isArray(parsed.highlights) && parsed.highlights.length === 3)
            ? parsed.highlights
            : INITIAL_STATE.highlights
        };
      }
    } catch (e) {
      console.warn('No se pudo cargar el estado previo, usando inicial:', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Error al guardar estado en LocalStorage:', e);
    }
  }

  getState() {
    return this.state;
  }

  update(partialState) {
    this.state = { ...this.state, ...partialState };
    this.saveState();
    this.notify();
  }

  setTheme(themeId) {
    this.state.themeId = themeId;
    this.saveState();
    this.notify();
  }

  setTypography(typographyId) {
    this.state.typographyId = typographyId;
    this.saveState();
    this.notify();
  }

  togglePiece(pieceId, enabled) {
    const piece = this.state.pieces.find(p => p.id === pieceId);
    if (piece && !piece.locked) {
      piece.enabled = enabled !== undefined ? enabled : !piece.enabled;
      this.saveState();
      this.notify();
    }
  }

  movePiece(pieceId, direction) {
    const index = this.state.pieces.findIndex(p => p.id === pieceId);
    if (index === -1) return;

    // Do not move first (navbar) or last (footer) if locked
    const targetIndex = index + direction;
    if (targetIndex <= 0 || targetIndex >= this.state.pieces.length - 1) return;

    const [movedPiece] = this.state.pieces.splice(index, 1);
    this.state.pieces.splice(targetIndex, 0, movedPiece);
    this.saveState();
    this.notify();
  }

  addMenuProduct(product) {
    product.id = 'prod-' + Date.now();
    this.state.menuProducts.push(product);
    this.saveState();
    this.notify();
  }

  updateMenuProduct(productId, updatedData) {
    const idx = this.state.menuProducts.findIndex(p => p.id === productId);
    if (idx !== -1) {
      this.state.menuProducts[idx] = { ...this.state.menuProducts[idx], ...updatedData };
      this.saveState();
      this.notify();
    }
  }

  deleteMenuProduct(productId) {
    this.state.menuProducts = this.state.menuProducts.filter(p => p.id !== productId);
    this.saveState();
    this.notify();
  }

  addMenuCategory(name, icon = '🍽️') {
    const newCategory = {
      id: 'cat-' + Date.now(),
      name,
      icon,
      active: true
    };
    this.state.menuCategories.push(newCategory);
    this.saveState();
    this.notify();
  }

  deleteMenuCategory(categoryId) {
    this.state.menuCategories = this.state.menuCategories.filter(c => c.id !== categoryId);
    this.state.menuProducts = this.state.menuProducts.filter(p => p.categoryId !== categoryId);
    this.saveState();
    this.notify();
  }

  resetToDefaults() {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
