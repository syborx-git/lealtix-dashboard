/**
 * LEALTIX SITE BUILDER - SISTEMA DE 7 COLORES Y 7 TIPOGRAFÍAS
 */

export const COLOR_PALETTES = [
  {
    id: 'gold-obsidian',
    name: 'Lealtix Obsidian & Gold',
    badge: 'Firma / Lujo',
    primary: '#D4AF37', // Gold
    primaryHover: '#C29B27',
    primaryText: '#071220', // Dark text on gold
    heroBadgeText: '#D4AF37',
    heroBadgeBorder: '#D4AF37',
    secondary: '#2DD4BF', // Teal
    background: '#071220', // Deep Obsidian
    surface: '#0B1C30',
    surfaceHover: '#132B47',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.1)',
    cardBg: 'rgba(11, 28, 48, 0.7)',
    dark: true,
    previewColors: ['#D4AF37', '#071220', '#2DD4BF']
  },
  {
    id: 'terracotta-bistro',
    name: 'Terracotta Bistro',
    badge: 'Cálido & Artesanal',
    primary: '#E05A47', // Terracotta
    primaryHover: '#C84534',
    primaryText: '#FFFFFF', // White text
    heroBadgeText: '#FFFFFF',
    heroBadgeBorder: '#E05A47',
    secondary: '#D97706', // Amber
    background: '#FFFDF9', // Warm Cream
    surface: '#FFFFFF',
    surfaceHover: '#FAF5EF',
    textMain: '#291811',
    textMuted: '#78655E',
    border: '#EFE7DD',
    cardBg: '#FFFFFF',
    dark: false,
    previewColors: ['#E05A47', '#FFFDF9', '#D97706']
  },
  {
    id: 'emerald-gourmet',
    name: 'Emerald Gourmet',
    badge: 'Fresco & Orgánico',
    primary: '#059669', // Emerald
    primaryHover: '#047857',
    primaryText: '#FFFFFF', // White text
    heroBadgeText: '#10B981',
    heroBadgeBorder: '#10B981',
    secondary: '#10B981', // Mint Sage
    background: '#062319', // Dark Emerald
    surface: '#0C3527',
    surfaceHover: '#134635',
    textMain: '#F2FBF7',
    textMuted: '#A7D4C3',
    border: 'rgba(167, 212, 195, 0.15)',
    cardBg: 'rgba(12, 53, 39, 0.8)',
    dark: true,
    previewColors: ['#059669', '#062319', '#10B981']
  },
  {
    id: 'midnight-lounge',
    name: 'Midnight Lounge',
    badge: 'Nocturno & Cóctel',
    primary: '#6366F1', // Indigo
    primaryHover: '#4F46E5',
    primaryText: '#FFFFFF', // White text
    heroBadgeText: '#A855F7',
    heroBadgeBorder: '#6366F1',
    secondary: '#A855F7', // Purple Neon
    background: '#0B0F19', // Midnight Navy
    surface: '#111827',
    surfaceHover: '#1E293B',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    cardBg: 'rgba(17, 24, 39, 0.85)',
    dark: true,
    previewColors: ['#6366F1', '#0B0F19', '#A855F7']
  },
  {
    id: 'berry-wine',
    name: 'Berry & Wine',
    badge: 'Enológico & Bohemio',
    primary: '#9F1239', // Rose wine
    primaryHover: '#881337',
    primaryText: '#FFFFFF', // White text
    heroBadgeText: '#FFFFFF', // Texto en blanco en el hero badge
    heroBadgeBorder: '#E11D48', // Borde en rojo vibrante
    secondary: '#E11D48', // Coral berry
    background: '#FAF7F5', // Soft stone
    surface: '#FFFFFF',
    surfaceHover: '#F4ECE7',
    textMain: '#2B1219',
    textMuted: '#735E63',
    border: '#E8DED8',
    cardBg: '#FFFFFF',
    dark: false,
    previewColors: ['#9F1239', '#FAF7F5', '#E11D48']
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean & Seafood',
    badge: 'Costero & Dinámico',
    primary: '#0284C7', // Ocean Blue
    primaryHover: '#0369A1',
    primaryText: '#FFFFFF', // White text
    heroBadgeText: '#38BDF8',
    heroBadgeBorder: '#0284C7',
    secondary: '#06B6D4', // Cyan
    background: '#F0F9FF', // Sky Mist
    surface: '#FFFFFF',
    surfaceHover: '#E0F2FE',
    textMain: '#0C2840',
    textMuted: '#476582',
    border: '#BAE6FD',
    cardBg: '#FFFFFF',
    dark: false,
    previewColors: ['#0284C7', '#F0F9FF', '#06B6D4']
  },
  {
    id: 'nordic-minimalist',
    name: 'Nordic Minimalist',
    badge: 'Monocromo & Moderno',
    primary: '#18181B', // Pure Onyx
    primaryHover: '#27272A',
    primaryText: '#FFFFFF', // Pure White text inside black buttons
    heroBadgeText: '#FFFFFF',
    heroBadgeBorder: '#71717A',
    secondary: '#71717A', // Slate
    background: '#F4F4F5', // Soft Zinc
    surface: '#FFFFFF',
    surfaceHover: '#E4E4E7',
    textMain: '#09090B',
    textMuted: '#52525B',
    border: '#E4E4E7',
    cardBg: '#FFFFFF',
    dark: false,
    previewColors: ['#18181B', '#F4F4F5', '#71717A']
  },
  {
    id: 'caramel-espresso',
    name: 'Caramel & Espresso Roast',
    badge: 'Cafetería & Panadería',
    primary: '#B45309', // Warm Caramel Amber
    primaryHover: '#92400E',
    primaryText: '#FFFFFF',
    heroBadgeText: '#F59E0B',
    heroBadgeBorder: '#B45309',
    secondary: '#78350F', // Dark Roast
    background: '#FFFDF7', // Warm Cream
    surface: '#FFFFFF',
    surfaceHover: '#FDF8EB',
    textMain: '#27180D',
    textMuted: '#78604F',
    border: '#F4E8D6',
    cardBg: '#FFFFFF',
    dark: false,
    previewColors: ['#B45309', '#FFFDF7', '#78350F']
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Sunset & Neon Coral',
    badge: 'Asiático & Ramen Bar',
    primary: '#F43F5E', // Vibrant Coral Pink
    primaryHover: '#E11D48',
    primaryText: '#FFFFFF',
    heroBadgeText: '#FB7185',
    heroBadgeBorder: '#F43F5E',
    secondary: '#F59E0B', // Sunset Gold
    background: '#0F172A', // Deep Slate
    surface: '#1E293B',
    surfaceHover: '#334155',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    border: 'rgba(244, 63, 94, 0.2)',
    cardBg: 'rgba(30, 41, 59, 0.85)',
    dark: true,
    previewColors: ['#F43F5E', '#0F172A', '#F59E0B']
  },
  {
    id: 'tuscan-olive',
    name: 'Tuscan Olive & Gold',
    badge: 'Mediterráneo & Trattoria',
    primary: '#65A30D', // Olive Green
    primaryHover: '#4D7C0F',
    primaryText: '#FFFFFF',
    heroBadgeText: '#A3E635',
    heroBadgeBorder: '#65A30D',
    secondary: '#CA8A04', // Golden Olive
    background: '#141C12', // Forest Olive
    surface: '#1B2719',
    surfaceHover: '#253622',
    textMain: '#F7FEE7',
    textMuted: '#A1B59C',
    border: 'rgba(163, 230, 53, 0.15)',
    cardBg: 'rgba(27, 39, 25, 0.85)',
    dark: true,
    previewColors: ['#65A30D', '#141C12', '#CA8A04']
  }
];

export const TYPOGRAPHY_OPTIONS = [
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'Sans-Serif Moderna',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    description: 'Geométrica, ultra nítida y vanguardista. Identidad Lealtix.',
    weights: '400,600,700,800',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    category: 'Serif Elegante',
    fontFamily: "'Playfair Display', serif",
    description: 'Estilo clásico editorial de alta cocina, bistró y restaurantes de autor.',
    weights: '400,600,700,900',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap'
  },
  {
    id: 'inter',
    name: 'Inter Clean',
    category: 'Sans-Serif Minimalista',
    fontFamily: "'Inter', sans-serif",
    description: 'Legibilidad perfecta, neutral y altamente versátil para todo tipo de menú.',
    weights: '300,400,500,600,700',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
  },
  {
    id: 'montserrat',
    name: 'Montserrat Impact',
    category: 'Sans-Serif Urbana',
    fontFamily: "'Montserrat', sans-serif",
    description: 'Fuerte, enérgica y contemporánea. Ideal para hamburgueserías, pubs y pizzerías.',
    weights: '400,600,700,800',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap'
  },
  {
    id: 'cinzel',
    name: 'Cinzel Luxury',
    category: 'Serif Clásica de Lujo',
    fontFamily: "'Cinzel', serif",
    description: 'Inspiración clásica imperial, ideal para cavas de vinos, cortes finos y experiencias premium.',
    weights: '500,700,800',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&display=swap'
  },
  {
    id: 'poppins',
    name: 'Poppins Friendly',
    category: 'Geométrica Amigable',
    fontFamily: "'Poppins', sans-serif",
    description: 'Formas redondeadas, fresca, cálida y acogedora para cafeterías, brunch y repostería.',
    weights: '400,500,600,700',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  },
  {
    id: 'outfit',
    name: 'Outfit Geometric',
    category: 'Sans Geométrica Tech',
    fontFamily: "'Outfit', sans-serif",
    description: 'Equilibrada, limpia y vanguardista para conceptos gastronómicos modernos.',
    weights: '400,600,700,800',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap'
  }
];

export const HIGHLIGHT_ICONS = [
  { icon: 'pi-check-circle', label: 'Verificado' },
  { icon: 'pi-star-fill', label: 'Estrella' },
  { icon: 'pi-shield', label: 'Escudo / Calidad' },
  { icon: 'pi-wallet', label: 'Wallet / Digital' },
  { icon: 'pi-heart-fill', label: 'Corazón / Pasión' },
  { icon: 'pi-sparkles', label: 'Destellos / Lujo' },
  { icon: 'pi-crown', label: 'Corona / VIP' },
  { icon: 'pi-clock', label: 'Reloj / Horario' },
  { icon: 'pi-map-marker', label: 'Ubicación / Local' },
  { icon: 'pi-tag', label: 'Etiqueta / Descuento' },
  { icon: 'pi-bolt', label: 'Rayo / Rápido' },
  { icon: 'pi-gift', label: 'Regalo / Premios' },
  { icon: 'pi-truck', label: 'Envío / Domicilio' },
  { icon: 'pi-thumbs-up-fill', label: 'Recomendado' },
  { icon: 'pi-sun', label: 'Sol / Terraza' },
  { icon: 'pi-moon', label: 'Noche / Bar' },
  { icon: 'pi-bell', label: 'Campana / Servicio' },
  { icon: 'pi-compass', label: 'Brújula / Experiencia' },
  { icon: 'pi-shopping-bag', label: 'Bolsa / Llevar' },
  { icon: 'pi-verified', label: 'Certificado' }
];

