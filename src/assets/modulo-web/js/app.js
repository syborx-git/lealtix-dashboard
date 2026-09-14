/**
 * LEALTIX SITE BUILDER - APLICACIÓN PRINCIPAL (ORQUESTADOR)
 */

import { COLOR_PALETTES, TYPOGRAPHY_OPTIONS, HIGHLIGHT_ICONS } from './themes.js';
import { StateManager, INITIAL_STATE } from './state.js';
import { PiecesRenderer } from './pieces.js';
import { MenuEditor } from './menu-editor.js';
import { ImageUploader, PRESET_IMAGES } from './uploader.js';

class SiteBuilderApp {
  constructor() {
    this.stateManager = new StateManager();
    this.currentTab = 'tab-pieces';
    this.currentDevice = 'desktop';
    this.activeMenuCategory = null;
    this.menuEditor = new MenuEditor(this.stateManager, () => this.handleStateUpdated());

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupTabNavigation();
    this.setupDeviceSwitcher();
    this.renderCurrentTab();
    this.applyThemeAndTypography();
    this.renderLivePreview();

    // Subscribe to state changes
    this.stateManager.subscribe(() => {
      this.applyThemeAndTypography();
      this.renderLivePreview();
    });
  }

  handleStateUpdated() {
    this.applyThemeAndTypography();
    this.renderLivePreview();
    this.renderCurrentTab();
    this.showToast('Cambios actualizados');
  }

  setupEventListeners() {
    // Save / Export button
    const btnSave = document.getElementById('btn-save-site');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.exportConfig());
    }

    // Reset button
    const btnReset = document.getElementById('btn-reset-defaults');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('¿Restablecer todo a la plantilla original de demostración?')) {
          this.stateManager.resetToDefaults();
          this.handleStateUpdated();
          this.showToast('Plantilla restablecida');
        }
      });
    }

    // Fullscreen preview button
    const btnPreviewFull = document.getElementById('btn-preview-fullscreen');
    const btnExitFull = document.getElementById('btn-exit-fullscreen');
    const canvasArea = document.getElementById('studio-canvas-area');

    if (btnPreviewFull && canvasArea) {
      btnPreviewFull.addEventListener('click', () => {
        canvasArea.classList.add('fullscreen-mode');
      });
    }

    if (btnExitFull && canvasArea) {
      btnExitFull.addEventListener('click', () => {
        canvasArea.classList.remove('fullscreen-mode');
      });
    }
  }

  setupTabNavigation() {
    const tabs = document.querySelectorAll('.sidebar-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this.renderCurrentTab();
      });
    });
  }

  setupDeviceSwitcher() {
    const buttons = document.querySelectorAll('.btn-viewport');
    const frame = document.getElementById('preview-device-frame');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentDevice = btn.dataset.device;

        frame.className = `preview-device-frame mode-${this.currentDevice}`;
      });
    });
  }

  renderCurrentTab() {
    const container = document.getElementById('sidebar-content-area');
    if (!container) return;

    switch (this.currentTab) {
      case 'tab-pieces':
        this.renderPiecesTab(container);
        break;
      case 'tab-colors':
        this.renderColorsTab(container);
        break;
      case 'tab-fonts':
        this.renderFontsTab(container);
        break;
      case 'tab-content':
        this.renderContentTab(container);
        break;
      case 'tab-menu':
        this.menuEditor.renderMenuEditorView(container);
        break;
    }
  }

  /* ------------------------------------------------------------------------
     TAB 1: PIEZAS DEL ROMPECABEZAS (MODULAR BLOCKS)
     ------------------------------------------------------------------------ */
  renderPiecesTab(container) {
    const state = this.stateManager.getState();

    container.innerHTML = `
      <div class="pieces-tab-wrapper">
        <h3 class="editor-section-title">
          <i class="pi pi-th-large"></i> Rompecabezas del Sitio
        </h3>
        <p class="editor-section-desc">Activa, desactiva y reordena los bloques modulares de tu página web con un solo clic.</p>

        <div class="puzzle-pieces-container">
          ${state.pieces.map((piece, index) => `
            <div class="puzzle-piece-card ${!piece.enabled ? 'disabled' : ''}" data-piece-id="${piece.id}">
              <div class="puzzle-piece-left">
                <div class="puzzle-piece-icon">
                  <i class="${piece.icon}"></i>
                </div>
                <div>
                  <span class="puzzle-piece-title">${piece.name}</span>
                  ${piece.locked ? `<span class="puzzle-piece-badge">Obligatorio</span>` : ''}
                </div>
              </div>

              <div class="puzzle-piece-controls">
                ${!piece.locked && index > 1 ? `
                  <button class="btn-icon-action btn-move-piece" data-piece-id="${piece.id}" data-dir="-1" title="Subir bloque">
                    <i class="pi pi-arrow-up"></i>
                  </button>
                ` : ''}
                ${!piece.locked && index < state.pieces.length - 2 ? `
                  <button class="btn-icon-action btn-move-piece" data-piece-id="${piece.id}" data-dir="1" title="Bajar bloque">
                    <i class="pi pi-arrow-down"></i>
                  </button>
                ` : ''}

                <label class="custom-switch">
                  <input type="checkbox" class="piece-toggle" data-piece-id="${piece.id}" 
                         ${piece.enabled ? 'checked' : ''} ${piece.locked ? 'disabled' : ''}>
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="mt-4 p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
          💡 <strong>Tip Lealtix:</strong> Tu sitio web se adapta automáticamente a computadoras y teléfonos. Puedes cambiar el orden de las piezas en cualquier momento.
        </div>
      </div>
    `;

    // Bind piece toggles
    container.querySelectorAll('.piece-toggle').forEach(input => {
      input.addEventListener('change', (e) => {
        const pieceId = e.target.dataset.pieceId;
        this.stateManager.togglePiece(pieceId, e.target.checked);
        this.handleStateUpdated();
      });
    });

    // Bind move buttons
    container.querySelectorAll('.btn-move-piece').forEach(btn => {
      btn.addEventListener('click', () => {
        const pieceId = btn.dataset.pieceId;
        const dir = parseInt(btn.dataset.dir, 10);
        this.stateManager.movePiece(pieceId, dir);
        this.handleStateUpdated();
      });
    });
  }

  /* ------------------------------------------------------------------------
     TAB 2: 7 PALETAS DE COLOR CURADAS
     ------------------------------------------------------------------------ */
  renderColorsTab(container) {
    const state = this.stateManager.getState();

    container.innerHTML = `
      <div class="colors-tab-wrapper">
        <h3 class="editor-section-title">
          <i class="pi pi-palette"></i> Paletas de Color (${COLOR_PALETTES.length} Estilos)
        </h3>
        <p class="editor-section-desc">Selecciona la armonía cromática que mejor representa la personalidad y ambientación de tu restaurante.</p>

        <div class="theme-palettes-grid">
          ${COLOR_PALETTES.map(palette => {
            const isSelected = palette.id === state.themeId;
            return `
              <div class="palette-card ${isSelected ? 'selected' : ''}" data-theme-id="${palette.id}">
                <div class="palette-info">
                  <div class="palette-name-row">
                    <span class="palette-name">${palette.name}</span>
                    <span class="palette-badge">${palette.badge}</span>
                  </div>
                </div>

                <div class="palette-swatches">
                  ${palette.previewColors.map(c => `
                    <span class="color-swatch-dot" style="background-color: ${c};"></span>
                  `).join('')}
                  ${isSelected ? `<i class="pi pi-check text-[#2dd4bf] ml-2 font-bold"></i>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.palette-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        this.stateManager.setTheme(themeId);
        this.handleStateUpdated();
      });
    });
  }

  /* ------------------------------------------------------------------------
     TAB 3: 7 FAMILIAS TIPOGRÁFICAS
     ------------------------------------------------------------------------ */
  renderFontsTab(container) {
    const state = this.stateManager.getState();

    container.innerHTML = `
      <div class="fonts-tab-wrapper">
        <h3 class="editor-section-title">
          <i class="pi pi-font"></i> Tipografías (7 Familias)
        </h3>
        <p class="editor-section-desc">Tipografías modernas optimizadas para menús gastronómicos y alta legibilidad.</p>

        <div class="typography-grid">
          ${TYPOGRAPHY_OPTIONS.map(font => {
            const isSelected = font.id === state.typographyId;
            return `
              <div class="typography-card ${isSelected ? 'selected' : ''}" data-font-id="${font.id}">
                <div class="typography-card-header">
                  <span class="typography-name">${font.name}</span>
                  <span class="typography-category">${font.category}</span>
                </div>
                <div class="typography-preview-sample" style="font-family: ${font.fontFamily};">
                  ${state.businessName || 'Gastronomía & Placer'}
                </div>
                <p class="typography-desc">${font.description}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.typography-card').forEach(card => {
      card.addEventListener('click', () => {
        const fontId = card.dataset.fontId;
        this.stateManager.setTypography(fontId);
        this.handleStateUpdated();
      });
    });
  }

  /* ------------------------------------------------------------------------
     TAB 4: CONTENIDO, TEXTOS & CARGA DE IMÁGENES
     ------------------------------------------------------------------------ */
  renderContentTab(container) {
    const state = this.stateManager.getState();
    const galleryImages = state.gallery || [];
    const highlights = (state.highlights && Array.isArray(state.highlights) && state.highlights.length === 3)
      ? state.highlights
      : INITIAL_STATE.highlights;

    container.innerHTML = `
      <div class="content-tab-wrapper">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 class="editor-section-title mb-0.5">
              <i class="pi pi-images"></i> Imágenes & Textos
            </h3>
            <p class="editor-section-desc mb-0">Carga y personaliza fotografías e identidad.</p>
          </div>
          <button type="button" class="btn-builder-primary btn-sm flex-shrink-0" id="btn-save-top-content" title="Guardar cambios de textos e imágenes">
            <i class="pi pi-check"></i>
            <span>Guardar</span>
          </button>
        </div>

        <form id="general-content-form" class="space-y-4">
          
          <!-- 1. IDENTIDAD & LOGO -->
          <div class="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-3">
            <h4 class="text-xs uppercase font-bold text-[#2dd4bf] tracking-wider flex items-center gap-1.5">
              <i class="pi pi-id-card"></i>
              <span>1. Identidad Básica & Logo</span>
            </h4>
            
            <div class="form-group">
              <label class="form-label">Nombre del Restaurante / Negocio</label>
              <input type="text" id="inp-businessName" class="form-input" value="${state.businessName}">
            </div>

            <div class="form-group">
              <label class="form-label">Eslogan / Subtítulo</label>
              <input type="text" id="inp-slogan" class="form-input" value="${state.slogan || ''}" placeholder="ej. Experiencia sensorial y gastronomía de autor">
            </div>

            <!-- Logo Upload & URL -->
            <div class="form-group">
              <label class="form-label flex items-center justify-between">
                <span>Logo del Restaurante</span>
                ${state.logoUrl ? `<span class="text-[11px] text-emerald-400 font-semibold">✓ Imagen cargada</span>` : ''}
              </label>
              
              <!-- URL Input & Live Thumbnail & Clear Button -->
              <div class="flex items-center gap-2 mb-2">
                <div class="w-11 h-11 rounded-lg border border-white/20 overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  <img src="${state.logoUrl || ''}" id="preview-thumb-logo" class="w-full h-full object-cover ${state.logoUrl ? '' : 'hidden'}" alt="Logo Preview" onerror="this.classList.add('hidden')">
                  ${!state.logoUrl ? `<i class="pi pi-image text-slate-500 text-sm"></i>` : ''}
                </div>
                <div class="flex-1">
                  <input type="text" id="inp-logoUrl" class="form-input text-xs" value="${state.logoUrl || ''}" placeholder="Pega URL del logo o sube un archivo abajo">
                </div>
                ${state.logoUrl ? `
                  <button type="button" class="btn-clear-image px-2.5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 flex-shrink-0" data-target="logo" title="Quitar logo actual">
                    <i class="pi pi-times text-[10px]"></i>
                    <span>Quitar</span>
                  </button>
                ` : ''}
              </div>

              <div class="dropzone-container" id="logo-dropzone">
                <i class="pi pi-upload dropzone-icon"></i>
                <div class="dropzone-text">Arrastra tu logo aquí o haz clic para subir</div>
                <div class="dropzone-subtext">PNG transparente, JPG o SVG recomendado</div>
                <input type="file" id="logo-file-input" accept="image/*" class="hidden">
              </div>
              <div class="mt-2">
                <span class="text-[11px] text-slate-400">O elige un logo preset:</span>
                <div class="preset-images-strip">
                  ${PRESET_IMAGES.logos.map((l, idx) => `
                    <div class="relative group/preset flex-shrink-0">
                      <img src="${l.url}" alt="${l.name}" class="preset-img-thumb preset-logo-select ${state.logoUrl === l.url ? 'active' : ''}" data-url="${l.url}" title="${l.name}">
                      <button type="button" class="btn-remove-preset-item absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow transition-all cursor-pointer opacity-80 hover:opacity-100 hover:scale-110" data-preset-type="logos" data-idx="${idx}" title="Eliminar preset">
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. PORTADA HERO -->
          <div class="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-3">
            <h4 class="text-xs uppercase font-bold text-[#2dd4bf] tracking-wider flex items-center gap-1.5">
              <i class="pi pi-image"></i>
              <span>2. Foto de Portada Principal (Hero Banner)</span>
            </h4>
            
            <div class="form-group">
              <label class="form-label">Insignia / Etiqueta Superior del Hero</label>
              <input type="text" id="inp-heroBadge" class="form-input" value="${state.heroBadge || ''}" placeholder="ej. Tradición Culinaria • Desde 2021">
            </div>

            <div class="form-group">
              <label class="form-label">Título Principal</label>
              <input type="text" id="inp-heroTitle" class="form-input" value="${state.heroTitle || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">Subtítulo de Bienvenida</label>
              <textarea id="inp-heroSubtitle" class="form-textarea" rows="2">${state.heroSubtitle || ''}</textarea>
            </div>

            <!-- Puntos Clave Destacados (3 Ítems con 20 Iconos Seleccionables) -->
            <div class="pt-3 border-t border-white/10 space-y-2">
              <label class="form-label flex items-center justify-between mb-0">
                <span class="text-white font-semibold">3 Puntos Clave / Destacados</span>
                <span class="text-[10px] text-[#2dd4bf] font-medium">Texto + 20 Íconos</span>
              </label>
              <p class="text-[11px] text-slate-400 leading-snug">Personaliza las 3 etiquetas de confianza que aparecen en la portada de tu sitio web.</p>
              
              <div class="space-y-2.5 mt-2">
                ${highlights.map((h, idx) => `
                  <div class="p-2.5 bg-slate-800/80 rounded-xl border border-white/10 space-y-2">
                    <div class="flex items-center gap-2">
                      <button type="button" class="btn-toggle-h-icons flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/90 border border-teal-500/40 text-teal-300 hover:bg-slate-700 hover:border-teal-400 transition-all cursor-pointer flex-shrink-0 text-xs font-semibold" data-idx="${idx}" title="Cambiar ícono (20 opciones disponibles)">
                        <i class="pi ${h.icon || 'pi-check-circle'} text-sm text-teal-400"></i>
                        <span class="text-[10px] text-slate-300">Ícono</span>
                        <i class="pi pi-chevron-down text-[9px] text-slate-400"></i>
                      </button>
                      <input type="hidden" id="inp-highlight-icon-${idx}" value="${h.icon || 'pi-check-circle'}">
                      <div class="flex-1">
                        <input type="text" id="inp-highlight-text-${idx}" class="form-input text-xs py-1.5" value="${h.text || ''}" placeholder="Punto destacado ${idx + 1}">
                      </div>
                    </div>

                    <!-- Desplegable con los 20 íconos seleccionables -->
                    <div class="highlight-icon-grid hidden mt-2 p-2 bg-slate-900 rounded-lg border border-teal-500/40 shadow-xl" id="highlight-icons-grid-${idx}">
                      <div class="text-[10px] text-slate-300 mb-1.5 font-semibold flex items-center justify-between">
                        <span>Elige 1 de los 20 íconos:</span>
                        <span class="text-[9px] text-teal-400">20 opciones</span>
                      </div>
                      <div class="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        ${HIGHLIGHT_ICONS.map(ico => `
                          <button type="button" class="btn-select-h-icon p-1.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${h.icon === ico.icon ? 'border-teal-400 bg-teal-500/25 text-teal-300 ring-1 ring-teal-400 shadow-sm' : 'border-white/10 bg-slate-800/80 text-slate-300 hover:border-white/30 hover:bg-slate-700'}" data-idx="${idx}" data-icon="${ico.icon}" title="${ico.label}">
                            <i class="pi ${ico.icon} text-sm"></i>
                            <span class="text-[8px] truncate max-w-full leading-tight text-slate-400">${ico.label}</span>
                          </button>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Hero Image Upload & URL -->
            <div class="form-group pt-2">
              <label class="form-label flex items-center justify-between">
                <span>Imagen de Fondo de Portada</span>
                ${state.heroImage ? `<span class="text-[11px] text-emerald-400 font-semibold">✓ Portada activa</span>` : ''}
              </label>
              
              <!-- URL Input & Live Thumbnail & Clear Button -->
              <div class="flex items-center gap-2 mb-2">
                <div class="w-14 h-11 rounded-lg border border-white/20 overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  <img src="${state.heroImage || ''}" id="preview-thumb-hero" class="w-full h-full object-cover ${state.heroImage ? '' : 'hidden'}" alt="Hero Preview" onerror="this.classList.add('hidden')">
                  ${!state.heroImage ? `<i class="pi pi-image text-slate-500 text-sm"></i>` : ''}
                </div>
                <div class="flex-1">
                  <input type="text" id="inp-heroImage" class="form-input text-xs" value="${state.heroImage || ''}" placeholder="Pega URL de imagen o sube un archivo abajo">
                </div>
                ${state.heroImage ? `
                  <button type="button" class="btn-clear-image px-2.5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 flex-shrink-0" data-target="hero" title="Quitar portada hero actual">
                    <i class="pi pi-times text-[10px]"></i>
                    <span>Quitar</span>
                  </button>
                ` : ''}
              </div>

              <div class="dropzone-container" id="hero-dropzone">
                <i class="pi pi-image dropzone-icon"></i>
                <div class="dropzone-text">Arrastra una imagen de fondo de alta calidad</div>
                <div class="dropzone-subtext">Recomendado: 1600x900px o foto de salón/terraza</div>
                <input type="file" id="hero-file-input" accept="image/*" class="hidden">
              </div>
              <div class="mt-2">
                <span class="text-[11px] text-slate-400">O elige una foto gastronómica de muestra:</span>
                <div class="preset-images-strip">
                  ${PRESET_IMAGES.heroBanners.map((h, idx) => `
                    <div class="relative group/preset flex-shrink-0">
                      <img src="${h.url}" alt="${h.name}" class="preset-img-thumb preset-hero-select ${state.heroImage === h.url ? 'active' : ''}" data-url="${h.url}" title="${h.name}">
                      <button type="button" class="btn-remove-preset-item absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow transition-all cursor-pointer opacity-80 hover:opacity-100 hover:scale-110" data-preset-type="heroBanners" data-idx="${idx}" title="Eliminar preset">
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- 3. SOBRE NOSOTROS / HISTORIA & FOTO DE COCINA -->
          <div class="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-3">
            <h4 class="text-xs uppercase font-bold text-[#2dd4bf] tracking-wider flex items-center gap-1.5">
              <i class="pi pi-heart"></i>
              <span>3. Sobre Nosotros & Foto de Cocina/Chef</span>
            </h4>
            
            <div class="form-group">
              <label class="form-label">Título de la Sección</label>
              <input type="text" id="inp-aboutTitle" class="form-input" value="${state.about?.title || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">Historia del Negocio</label>
              <textarea id="inp-aboutStory" class="form-textarea" rows="3">${state.about?.story || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Cita del Chef o Filosofía</label>
              <input type="text" id="inp-aboutQuote" class="form-input" value="${state.about?.chefQuote || ''}">
            </div>

            <!-- About Image Upload & URL -->
            <div class="form-group">
              <label class="form-label flex items-center justify-between">
                <span>Fotografía de Cocina, Chef o Salón</span>
                ${state.about?.aboutImage ? `<span class="text-[11px] text-emerald-400 font-semibold">✓ Imagen asignada</span>` : ''}
              </label>
              
              <!-- URL Input & Live Thumbnail & Clear Button -->
              <div class="flex items-center gap-2 mb-2">
                <div class="w-14 h-11 rounded-lg border border-white/20 overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  <img src="${state.about?.aboutImage || ''}" id="preview-thumb-about" class="w-full h-full object-cover ${state.about?.aboutImage ? '' : 'hidden'}" alt="About Preview" onerror="this.classList.add('hidden')">
                  ${!state.about?.aboutImage ? `<i class="pi pi-camera text-slate-500 text-sm"></i>` : ''}
                </div>
                <div class="flex-1">
                  <input type="text" id="inp-aboutImage" class="form-input text-xs" value="${state.about?.aboutImage || ''}" placeholder="Pega URL de imagen o sube un archivo abajo">
                </div>
                ${state.about?.aboutImage ? `
                  <button type="button" class="btn-clear-image px-2.5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 flex-shrink-0" data-target="about" title="Quitar foto actual">
                    <i class="pi pi-times text-[10px]"></i>
                    <span>Quitar</span>
                  </button>
                ` : ''}
              </div>

              <div class="dropzone-container" id="about-dropzone">
                <i class="pi pi-camera dropzone-icon"></i>
                <div class="dropzone-text">Arrastra una foto del chef, cocina o ambiente</div>
                <input type="file" id="about-file-input" accept="image/*" class="hidden">
              </div>
              <div class="mt-2">
                <span class="text-[11px] text-slate-400">O elige un preset:</span>
                <div class="preset-images-strip">
                  ${PRESET_IMAGES.about.map((a, idx) => `
                    <div class="relative group/preset flex-shrink-0">
                      <img src="${a.url}" alt="${a.name}" class="preset-img-thumb preset-about-select ${state.about?.aboutImage === a.url ? 'active' : ''}" data-url="${a.url}" title="${a.name}">
                      <button type="button" class="btn-remove-preset-item absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow transition-all cursor-pointer opacity-80 hover:opacity-100 hover:scale-110" data-preset-type="about" data-idx="${idx}" title="Eliminar preset">
                        <i class="pi pi-times"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- 4. GALERÍA DE FOTOS -->
          <div class="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-3">
            <h4 class="text-xs uppercase font-bold text-[#2dd4bf] tracking-wider flex items-center gap-1.5">
              <i class="pi pi-images"></i>
              <span>4. Galería de Ambiente & Platillos</span>
            </h4>
            
            <p class="text-xs text-slate-400">Elige cómo se presentarán las imágenes y sube fotografías de tu restaurante.</p>

            <!-- Selector de 3 estilos de presentación (Tipo Facebook / Cuadrícula / Muro) -->
            <div class="form-group">
              <label class="form-label">Diseño de Presentación (Elige 1 de 3)</label>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" class="gallery-layout-btn p-2 rounded-xl border text-center transition-all cursor-pointer ${state.galleryLayout === 'mosaic' || !state.galleryLayout ? 'border-[#2dd4bf] bg-[#2dd4bf]/15 text-white shadow-sm' : 'border-white/10 bg-slate-800/60 text-slate-400 hover:border-white/20'}" data-layout="mosaic">
                  <div class="text-lg mb-0.5">🔲</div>
                  <div class="text-[11px] font-bold leading-tight">Mosaico</div>
                  <div class="text-[9px] text-[#2dd4bf] font-medium mt-0.5">Tipo Facebook</div>
                </button>

                <button type="button" class="gallery-layout-btn p-2 rounded-xl border text-center transition-all cursor-pointer ${state.galleryLayout === 'grid' ? 'border-[#2dd4bf] bg-[#2dd4bf]/15 text-white shadow-sm' : 'border-white/10 bg-slate-800/60 text-slate-400 hover:border-white/20'}" data-layout="grid">
                  <div class="text-lg mb-0.5">▦</div>
                  <div class="text-[11px] font-bold leading-tight">Cuadrícula</div>
                  <div class="text-[9px] text-slate-400 mt-0.5">Fotos uniformes</div>
                </button>

                <button type="button" class="gallery-layout-btn p-2 rounded-xl border text-center transition-all cursor-pointer ${state.galleryLayout === 'masonry' ? 'border-[#2dd4bf] bg-[#2dd4bf]/15 text-white shadow-sm' : 'border-white/10 bg-slate-800/60 text-slate-400 hover:border-white/20'}" data-layout="masonry">
                  <div class="text-lg mb-0.5">▥</div>
                  <div class="text-[11px] font-bold leading-tight">Muro</div>
                  <div class="text-[9px] text-slate-400 mt-0.5">Dinámico</div>
                </button>
              </div>
            </div>

            <!-- Dropzone para añadir foto a galería -->
            <div class="dropzone-container" id="gallery-dropzone">
              <i class="pi pi-plus-circle dropzone-icon"></i>
              <div class="dropzone-text">Subir nueva foto a la galería</div>
              <input type="file" id="gallery-file-input" accept="image/*" class="hidden">
            </div>

            <!-- Fotos actuales en la galería -->
            <div class="mt-2">
              <label class="form-label">Fotos actualmente en galería (${galleryImages.length}):</label>
              <div class="grid grid-cols-2 gap-2 mt-1">
                ${galleryImages.map((g, idx) => `
                  <div class="relative group rounded-lg overflow-hidden border border-white/15 h-20">
                    <img src="${g.url}" alt="Galería" class="w-full h-full object-cover">
                    <button type="button" class="btn-remove-gallery-img absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-90 hover:opacity-100" data-idx="${idx}" title="Eliminar de galería">
                      <i class="pi pi-times"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- 5. CONTACTO & UBICACIÓN -->
          <div class="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-3">
            <h4 class="text-xs uppercase font-bold text-[#2dd4bf] tracking-wider flex items-center gap-1.5">
              <i class="pi pi-map-marker"></i>
              <span>5. Contacto & Ubicación</span>
            </h4>
            
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" id="inp-phone" class="form-input" value="${state.phone || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp (Para pedidos)</label>
                <input type="text" id="inp-whatsapp" class="form-input" value="${state.whatsapp || ''}" placeholder="5255...">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección Física</label>
              <input type="text" id="inp-address" class="form-input" value="${state.address || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">Horarios de Atención</label>
              <input type="text" id="inp-schedules" class="form-input" value="${state.schedules || ''}">
            </div>
          </div>

          <div class="pt-2">
            <button type="submit" class="btn-builder-primary w-full justify-center py-2.5">
              <i class="pi pi-check"></i>
              <span>Guardar Textos & Ajustes</span>
            </button>
          </div>
        </form>
      </div>
    `;

    // Bind Uploaders
    ImageUploader.setupDropZone(
      container.querySelector('#logo-dropzone'),
      container.querySelector('#logo-file-input'),
      (dataUrl) => {
        const inp = container.querySelector('#inp-logoUrl');
        if (inp) inp.value = dataUrl;
        const thumb = container.querySelector('#preview-thumb-logo');
        if (thumb) {
          thumb.src = dataUrl;
          thumb.classList.remove('hidden');
        }
        this.stateManager.update({ logoUrl: dataUrl });
        this.handleStateUpdated();
      }
    );

    ImageUploader.setupDropZone(
      container.querySelector('#hero-dropzone'),
      container.querySelector('#hero-file-input'),
      (dataUrl) => {
        const inp = container.querySelector('#inp-heroImage');
        if (inp) inp.value = dataUrl;
        const thumb = container.querySelector('#preview-thumb-hero');
        if (thumb) {
          thumb.src = dataUrl;
          thumb.classList.remove('hidden');
        }
        this.stateManager.update({ heroImage: dataUrl });
        this.handleStateUpdated();
      }
    );

    ImageUploader.setupDropZone(
      container.querySelector('#about-dropzone'),
      container.querySelector('#about-file-input'),
      (dataUrl) => {
        const inp = container.querySelector('#inp-aboutImage');
        if (inp) inp.value = dataUrl;
        const thumb = container.querySelector('#preview-thumb-about');
        if (thumb) {
          thumb.src = dataUrl;
          thumb.classList.remove('hidden');
        }
        this.stateManager.update({
          about: { ...state.about, aboutImage: dataUrl }
        });
        this.handleStateUpdated();
      }
    );

    ImageUploader.setupDropZone(
      container.querySelector('#gallery-dropzone'),
      container.querySelector('#gallery-file-input'),
      (dataUrl) => {
        const currentGallery = [...(this.stateManager.getState().gallery || [])];
        currentGallery.push({ url: dataUrl, caption: 'Nueva foto de ambiente' });
        this.stateManager.update({ gallery: currentGallery });
        this.handleStateUpdated();
      }
    );

    // Live URL inputs listeners
    const inpLogo = container.querySelector('#inp-logoUrl');
    if (inpLogo) {
      inpLogo.addEventListener('input', () => {
        const url = inpLogo.value.trim();
        const thumb = container.querySelector('#preview-thumb-logo');
        if (thumb) {
          thumb.src = url;
          if (url) thumb.classList.remove('hidden');
          else thumb.classList.add('hidden');
        }
        this.stateManager.state.logoUrl = url;
        this.renderLivePreview();
      });
    }

    const inpHero = container.querySelector('#inp-heroImage');
    if (inpHero) {
      inpHero.addEventListener('input', () => {
        const url = inpHero.value.trim();
        const thumb = container.querySelector('#preview-thumb-hero');
        if (thumb) {
          thumb.src = url;
          if (url) thumb.classList.remove('hidden');
          else thumb.classList.add('hidden');
        }
        this.stateManager.state.heroImage = url;
        this.renderLivePreview();
      });
    }

    const inpAbout = container.querySelector('#inp-aboutImage');
    if (inpAbout) {
      inpAbout.addEventListener('input', () => {
        const url = inpAbout.value.trim();
        const thumb = container.querySelector('#preview-thumb-about');
        if (thumb) {
          thumb.src = url;
          if (url) thumb.classList.remove('hidden');
          else thumb.classList.add('hidden');
        }
        if (this.stateManager.state.about) {
          this.stateManager.state.about.aboutImage = url;
        }
        this.renderLivePreview();
      });
    }

    // Bind Preset Logo Clicks
    container.querySelectorAll('.preset-logo-select').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.dataset.url;
        this.stateManager.update({ logoUrl: url });
        this.handleStateUpdated();
      });
    });

    // Bind Preset Hero Clicks
    container.querySelectorAll('.preset-hero-select').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.dataset.url;
        this.stateManager.update({ heroImage: url });
        this.handleStateUpdated();
      });
    });

    // Bind Preset About Clicks
    container.querySelectorAll('.preset-about-select').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.dataset.url;
        this.stateManager.update({
          about: { ...state.about, aboutImage: url }
        });
        this.handleStateUpdated();
      });
    });

    // Bind Remove Preset Item Buttons (Delete from strip)
    container.querySelectorAll('.btn-remove-preset-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const type = btn.dataset.presetType;
        const idx = parseInt(btn.dataset.idx, 10);
        if (PRESET_IMAGES[type]) {
          PRESET_IMAGES[type].splice(idx, 1);
          this.renderCurrentTab();
          this.showToast('Imagen de muestra eliminada');
        }
      });
    });

    // Bind Clear Active Image Buttons (Logo, Hero, About)
    container.querySelectorAll('.btn-clear-image').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        if (target === 'logo') {
          this.stateManager.update({ logoUrl: '' });
        } else if (target === 'hero') {
          this.stateManager.update({ heroImage: '' });
        } else if (target === 'about') {
          this.stateManager.update({
            about: { ...state.about, aboutImage: '' }
          });
        }
        this.handleStateUpdated();
        this.showToast('Imagen quitada');
      });
    });

    // Bind Remove Gallery Image Buttons
    container.querySelectorAll('.btn-remove-gallery-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx, 10);
        const currentGallery = [...(this.stateManager.getState().gallery || [])];
        currentGallery.splice(idx, 1);
        this.stateManager.update({ gallery: currentGallery });
        this.handleStateUpdated();
      });
    });

    // Bind Gallery Layout Selector (Mosaic Facebook, Grid, Masonry)
    container.querySelectorAll('.gallery-layout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const layout = btn.dataset.layout;
        this.stateManager.update({ galleryLayout: layout });
        this.handleStateUpdated();
      });
    });

    // Toggle 20-icon selector dropdowns
    container.querySelectorAll('.btn-toggle-h-icons').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = btn.dataset.idx;
        const grid = container.querySelector(`#highlight-icons-grid-${idx}`);
        if (grid) {
          const isHidden = grid.classList.contains('hidden');
          container.querySelectorAll('.highlight-icon-grid').forEach(g => g.classList.add('hidden'));
          if (isHidden) {
            grid.classList.remove('hidden');
          }
        }
      });
    });

    // Select icon from 20-icon grid
    container.querySelectorAll('.btn-select-h-icon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx, 10);
        const icon = btn.dataset.icon;
        
        const currentHighlights = [0, 1, 2].map(i => ({
          icon: i === idx ? icon : (document.getElementById(`inp-highlight-icon-${i}`)?.value || 'pi-check-circle'),
          text: document.getElementById(`inp-highlight-text-${i}`) ? document.getElementById(`inp-highlight-text-${i}`).value.trim() : ''
        }));
        
        this.stateManager.update({ highlights: currentHighlights });
        this.handleStateUpdated();
      });
    });

    // Live text input changes for highlights
    [0, 1, 2].forEach(idx => {
      const inp = container.querySelector(`#inp-highlight-text-${idx}`);
      if (inp) {
        inp.addEventListener('input', () => {
          const currentHighlights = [0, 1, 2].map(i => ({
            icon: document.getElementById(`inp-highlight-icon-${i}`)?.value || 'pi-check-circle',
            text: document.getElementById(`inp-highlight-text-${i}`) ? document.getElementById(`inp-highlight-text-${i}`).value : ''
          }));
          this.stateManager.state.highlights = currentHighlights;
          this.renderLivePreview();
        });
      }
    });

    // Top Save Button click handler
    const btnSaveTop = container.querySelector('#btn-save-top-content');
    if (btnSaveTop) {
      btnSaveTop.addEventListener('click', () => {
        form.requestSubmit();
      });
    }

    // Form Submit
    const form = container.querySelector('#general-content-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const updatedHighlights = [0, 1, 2].map(idx => ({
        icon: document.getElementById(`inp-highlight-icon-${idx}`)?.value || 'pi-check-circle',
        text: document.getElementById(`inp-highlight-text-${idx}`) ? document.getElementById(`inp-highlight-text-${idx}`).value.trim() : ''
      }));

      const stateNow = this.stateManager.getState();

      this.stateManager.update({
        businessName: document.getElementById('inp-businessName').value.trim(),
        slogan: document.getElementById('inp-slogan').value.trim(),
        logoUrl: document.getElementById('inp-logoUrl') ? document.getElementById('inp-logoUrl').value.trim() : stateNow.logoUrl,
        highlights: updatedHighlights,
        heroBadge: document.getElementById('inp-heroBadge') ? document.getElementById('inp-heroBadge').value.trim() : '',
        heroTitle: document.getElementById('inp-heroTitle').value.trim(),
        heroSubtitle: document.getElementById('inp-heroSubtitle').value.trim(),
        heroImage: document.getElementById('inp-heroImage') ? document.getElementById('inp-heroImage').value.trim() : stateNow.heroImage,
        phone: document.getElementById('inp-phone').value.trim(),
        whatsapp: document.getElementById('inp-whatsapp').value.trim(),
        address: document.getElementById('inp-address').value.trim(),
        schedules: document.getElementById('inp-schedules').value.trim(),
        about: {
          ...stateNow.about,
          title: document.getElementById('inp-aboutTitle').value.trim(),
          story: document.getElementById('inp-aboutStory').value.trim(),
          chefQuote: document.getElementById('inp-aboutQuote').value.trim(),
          aboutImage: document.getElementById('inp-aboutImage') ? document.getElementById('inp-aboutImage').value.trim() : stateNow.about?.aboutImage
        }
      });
      this.handleStateUpdated();
    });
  }

  /* ------------------------------------------------------------------------
     APPLY THEME COLORS & FONTS VIA CSS VARIABLES
     ------------------------------------------------------------------------ */
  applyThemeAndTypography() {
    const state = this.stateManager.getState();
    const theme = COLOR_PALETTES.find(t => t.id === state.themeId) || COLOR_PALETTES[0];
    const font = TYPOGRAPHY_OPTIONS.find(f => f.id === state.typographyId) || TYPOGRAPHY_OPTIONS[0];

    const canvas = document.getElementById('site-preview-canvas');
    if (!canvas) return;

    // Apply color CSS variables
    canvas.style.setProperty('--site-primary', theme.primary);
    canvas.style.setProperty('--site-primary-hover', theme.primaryHover);
    canvas.style.setProperty('--site-primary-text', theme.primaryText || (theme.id === 'gold-obsidian' ? '#071220' : '#FFFFFF'));
    canvas.style.setProperty('--site-hero-badge-text', theme.heroBadgeText || theme.primary);
    canvas.style.setProperty('--site-hero-badge-border', theme.heroBadgeBorder || theme.primary);
    canvas.style.setProperty('--site-secondary', theme.secondary);
    canvas.style.setProperty('--site-bg', theme.background);
    canvas.style.setProperty('--site-surface', theme.surface);
    canvas.style.setProperty('--site-surface-hover', theme.surfaceHover);
    canvas.style.setProperty('--site-text', theme.textMain);
    canvas.style.setProperty('--site-text-muted', theme.textMuted);
    canvas.style.setProperty('--site-border', theme.border);
    canvas.style.setProperty('--site-card-bg', theme.cardBg);

    // Apply font family
    canvas.style.setProperty('--site-font', font.fontFamily);
  }

  /* ------------------------------------------------------------------------
     RENDER LIVE PREVIEW CANVAS
     ------------------------------------------------------------------------ */
  renderLivePreview() {
    const canvas = document.getElementById('site-preview-canvas');
    if (!canvas) return;

    const state = this.stateManager.getState();
    canvas.innerHTML = PiecesRenderer.renderAll(state, this.activeMenuCategory);

    // Bind interactive category clicks in preview canvas
    canvas.querySelectorAll('.preview-cat-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        this.activeMenuCategory = tab.dataset.categoryId;
        this.renderLivePreview();
      });
    });
  }

  /* ------------------------------------------------------------------------
     EXPORT CONFIGURATION / JSON
     ------------------------------------------------------------------------ */
  async exportConfig() {
    const canvas = document.getElementById('site-preview-canvas');
    if (!canvas) return;

    const innerHTML = canvas.innerHTML;
    const inlineStyle = canvas.getAttribute('style') || '';

    // Inline CSS (theme/pieces) para que la landing sea autónoma
    let css = '';
    for (const file of ['css/preview.css', 'css/components.css']) {
      try {
        const res = await fetch(file);
        css += await res.text() + '\n';
      } catch (e) {
        // ignore
      }
    }

    const fonts = '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@400;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">';

    const html = `${fonts}<style>${css}</style><div class="site-preview-canvas" id="site-preview-canvas" style="${inlineStyle}">${innerHTML}</div>`;

    this.showToast('Guardando cambios...');
    try {
      window.parent.postMessage({ type: 'lealtix-save-site', html }, '*');
    } catch (e) {
      this.showToast('No se pudo guardar');
    }
  }

  showToast(message) {
    const toast = document.getElementById('builder-toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.lealtixApp = new SiteBuilderApp();
});
