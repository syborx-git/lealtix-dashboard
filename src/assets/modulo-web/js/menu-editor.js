/**
 * LEALTIX SITE BUILDER - GESTOR DE MENÚ Y PRODUCTOS
 */

import { ImageUploader, PRESET_IMAGES } from './uploader.js';

export class MenuEditor {
  constructor(stateManager, onStateChangeCallback) {
    this.stateManager = stateManager;
    this.onStateChange = onStateChangeCallback;
    this.editingProductId = null;
  }

  renderMenuEditorView(containerEl) {
    const state = this.stateManager.getState();
    const categories = state.menuCategories || [];
    const products = state.menuProducts || [];

    containerEl.innerHTML = `
      <div class="menu-editor-wrapper">
        <div class="menu-editor-header">
          <div>
            <h3 class="editor-section-title">
              <i class="pi pi-book"></i> Catálogo de Menú
            </h3>
            <p class="editor-section-desc">Organiza tus categorías y platillos para que tus clientes exploren tu carta.</p>
          </div>
          <button class="btn-builder-primary btn-sm" id="btn-open-add-product">
            <i class="pi pi-plus"></i>
            <span>Nuevo Platillo</span>
          </button>
        </div>

        <!-- Barra de Categorías -->
        <div class="categories-bar">
          <div class="categories-list">
            ${categories.map(cat => `
              <div class="category-chip ${cat.active ? 'active' : ''}">
                <span>${cat.icon || '🍽️'} ${cat.name}</span>
                <span class="category-count">(${products.filter(p => p.categoryId === cat.id).length})</span>
                <button class="btn-cat-delete" data-cat-id="${cat.id}" title="Eliminar categoría">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <button class="btn-builder-ghost btn-sm" id="btn-add-category">
            <i class="pi pi-plus-circle"></i>
            <span>Agregar Categoría</span>
          </button>
        </div>

        <!-- Lista de Productos -->
        <div class="products-table-wrapper">
          ${products.length > 0 ? `
            <div class="products-list-grid">
              ${products.map(prod => {
                const cat = categories.find(c => c.id === prod.categoryId);
                return `
                  <div class="product-item-card">
                    <div class="product-item-thumb">
                      <img src="${prod.image || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=120&q=80'}" alt="${prod.name}">
                      ${prod.badge ? `<span class="product-item-badge">${prod.badge}</span>` : ''}
                    </div>
                    <div class="product-item-info">
                      <div class="product-item-top">
                        <span class="product-item-cat">${cat ? cat.name : 'Sin Categoría'}</span>
                        <span class="product-item-price">${prod.price}</span>
                      </div>
                      <h4 class="product-item-name">${prod.name}</h4>
                      <p class="product-item-desc">${prod.description || 'Sin descripción'}</p>
                    </div>
                    <div class="product-item-actions">
                      <button class="btn-icon-action btn-edit-product" data-prod-id="${prod.id}" title="Editar">
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button class="btn-icon-action btn-delete-product text-danger" data-prod-id="${prod.id}" title="Eliminar">
                        <i class="pi pi-trash"></i>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="empty-state-card">
              <i class="pi pi-inbox"></i>
              <h4>No tienes platillos agregados</h4>
              <p>Comienza agregando tu primer producto para mostrarlo en el menú de tu sitio web.</p>
              <button class="btn-builder-primary btn-sm mt-3" id="btn-empty-add-product">
                <i class="pi pi-plus"></i>
                <span>Crear Primer Platillo</span>
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents(containerEl);
  }

  bindEvents(containerEl) {
    // Add Category Button
    const btnAddCat = containerEl.querySelector('#btn-add-category');
    if (btnAddCat) {
      btnAddCat.addEventListener('click', () => {
        const catName = prompt('Ingresa el nombre de la nueva categoría (ej: Desayunos, Vinos, Especiales):');
        if (catName && catName.trim() !== '') {
          this.stateManager.addMenuCategory(catName.trim());
          this.onStateChange();
        }
      });
    }

    // Delete Category Button
    containerEl.querySelectorAll('.btn-cat-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catId = btn.dataset.catId;
        if (confirm('¿Deseas eliminar esta categoría y todos sus productos asignados?')) {
          this.stateManager.deleteMenuCategory(catId);
          this.onStateChange();
        }
      });
    });

    // Add Product Modal trigger
    const btnAddProd = containerEl.querySelector('#btn-open-add-product');
    const btnEmptyAdd = containerEl.querySelector('#btn-empty-add-product');
    const openAddModal = () => {
      this.editingProductId = null;
      this.showProductModal();
    };

    if (btnAddProd) btnAddProd.addEventListener('click', openAddModal);
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openAddModal);

    // Edit Product Button
    containerEl.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.dataset.prodId;
        this.editingProductId = prodId;
        const product = this.stateManager.getState().menuProducts.find(p => p.id === prodId);
        if (product) {
          this.showProductModal(product);
        }
      });
    });

    // Delete Product Button
    containerEl.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.dataset.prodId;
        if (confirm('¿Eliminar este platillo del menú?')) {
          this.stateManager.deleteMenuProduct(prodId);
          this.onStateChange();
        }
      });
    });
  }

  showProductModal(product = null) {
    const modalBackdrop = document.getElementById('builder-modal-backdrop');
    const modalContainer = document.getElementById('builder-modal-content');
    if (!modalBackdrop || !modalContainer) return;

    const state = this.stateManager.getState();
    const categories = state.menuCategories || [];

    const isEdit = !!product;
    const initialData = product || {
      name: '',
      price: '$',
      categoryId: categories[0]?.id || '',
      badge: '',
      description: '',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'
    };

    modalContainer.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">
          <i class="pi ${isEdit ? 'pi-pencil' : 'pi-plus-circle'} text-[#2dd4bf]"></i>
          <span>${isEdit ? 'Editar Platillo' : 'Agregar Nuevo Platillo'}</span>
        </h3>
        <button class="btn-modal-close" id="btn-close-modal"><i class="pi pi-times"></i></button>
      </div>

      <form id="product-form" class="modal-body space-y-3">
        <div class="form-group mb-3">
          <label class="form-label">Nombre del Platillo *</label>
          <input type="text" id="prod-form-name" class="form-input" required value="${initialData.name}" placeholder="ej. Tacos de Rib Eye con Tuétano">
        </div>

        <div class="form-row-2 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Precio *</label>
            <input type="text" id="prod-form-price" class="form-input" required value="${initialData.price}" placeholder="ej. $220">
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Categoría *</label>
            <select id="prod-form-category" class="form-select" required>
              ${categories.map(c => `
                <option value="${c.id}" ${c.id === initialData.categoryId ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Insignia / Etiqueta Destacada (Opcional)</label>
          <input type="text" id="prod-form-badge" class="form-input" value="${initialData.badge || ''}" placeholder="ej. Especial del Chef, Más Pedido, Vegano">
        </div>

        <!-- Fotografía del Platillo (Dropzone, Explorador, URL & Presets) -->
        <div class="form-group pt-2 border-t border-white/10 space-y-2 mb-3">
          <label class="form-label flex items-center justify-between mb-0">
            <span class="text-white font-semibold">Fotografía del Platillo</span>
            <span class="text-[10px] text-[#2dd4bf] font-medium">Arrastrar o Archivo</span>
          </label>
          
          <!-- URL Input & Live Thumbnail & Clear Button -->
          <div class="flex items-center gap-2 mb-2">
            <div class="w-14 h-12 rounded-lg border border-white/20 overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
              <img src="${initialData.image || ''}" id="preview-thumb-dish" class="w-full h-full object-cover ${initialData.image ? '' : 'hidden'}" alt="Platillo" onerror="this.classList.add('hidden')">
              ${!initialData.image ? `<i class="pi pi-image text-slate-500 text-sm"></i>` : ''}
            </div>
            <div class="flex-1">
              <input type="text" id="prod-form-image" class="form-input text-xs" value="${initialData.image || ''}" placeholder="Pega URL o sube una foto abajo">
            </div>
            <button type="button" class="btn-clear-dish-img px-2.5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 flex-shrink-0 ${initialData.image ? '' : 'hidden'}" id="btn-clear-dish-img" title="Quitar fotografía">
              <i class="pi pi-times text-[10px]"></i>
              <span>Quitar</span>
            </button>
          </div>

          <!-- Dropzone para arrastrar o abrir explorador -->
          <div class="dropzone-container" id="dish-dropzone">
            <i class="pi pi-upload dropzone-icon"></i>
            <div class="dropzone-text">Arrastra una foto de tu platillo o haz clic aquí</div>
            <div class="dropzone-subtext">Abre el explorador de archivos (PNG, JPG o WebP)</div>
            <input type="file" id="dish-file-input" accept="image/*" class="hidden">
          </div>

          <!-- Tira de Platillos de Muestra (Presets) con botón X para eliminar -->
          <div class="mt-2">
            <span class="text-[11px] text-slate-400">O selecciona una foto gastronómica de muestra:</span>
            <div class="preset-images-strip" id="modal-dish-presets-strip">
              ${(PRESET_IMAGES.dishes || []).map((d, idx) => `
                <div class="relative group/preset flex-shrink-0">
                  <img src="${d.url}" alt="${d.name}" class="preset-img-thumb preset-dish-select ${initialData.image === d.url ? 'active' : ''}" data-url="${d.url}" title="${d.name}">
                  <button type="button" class="btn-remove-preset-dish absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow transition-all cursor-pointer opacity-80 hover:opacity-100 hover:scale-110" data-idx="${idx}" title="Eliminar muestra">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Descripción & Ingredientes</label>
          <textarea id="prod-form-desc" class="form-textarea" rows="2" placeholder="Detalle de ingredientes, técnica o acompañamientos...">${initialData.description || ''}</textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-builder-ghost" id="btn-cancel-modal">Cancelar</button>
          <button type="submit" class="btn-builder-primary">
            <i class="pi pi-check"></i>
            <span>${isEdit ? 'Guardar Cambios' : 'Agregar al Menú'}</span>
          </button>
        </div>
      </form>
    `;

    modalBackdrop.classList.remove('hidden');

    // Close handlers
    const closeModal = () => modalBackdrop.classList.add('hidden');
    modalContainer.querySelector('#btn-close-modal').addEventListener('click', closeModal);
    modalContainer.querySelector('#btn-cancel-modal').addEventListener('click', closeModal);

    // Setup Image Dropzone
    ImageUploader.setupDropZone(
      modalContainer.querySelector('#dish-dropzone'),
      modalContainer.querySelector('#dish-file-input'),
      (dataUrl) => {
        const inpImg = modalContainer.querySelector('#prod-form-image');
        const thumb = modalContainer.querySelector('#preview-thumb-dish');
        const clearBtn = modalContainer.querySelector('#btn-clear-dish-img');
        if (inpImg) inpImg.value = dataUrl;
        if (thumb) {
          thumb.src = dataUrl;
          thumb.classList.remove('hidden');
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        modalContainer.querySelectorAll('.preset-dish-select').forEach(p => p.classList.remove('active'));
      }
    );

    // Live URL input change
    const inpImg = modalContainer.querySelector('#prod-form-image');
    if (inpImg) {
      inpImg.addEventListener('input', () => {
        const url = inpImg.value.trim();
        const thumb = modalContainer.querySelector('#preview-thumb-dish');
        const clearBtn = modalContainer.querySelector('#btn-clear-dish-img');
        if (thumb) {
          thumb.src = url;
          if (url) thumb.classList.remove('hidden');
          else thumb.classList.add('hidden');
        }
        if (clearBtn) {
          if (url) clearBtn.classList.remove('hidden');
          else clearBtn.classList.add('hidden');
        }
      });
    }

    // Clear dish image button
    const clearBtn = modalContainer.querySelector('#btn-clear-dish-img');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const inp = modalContainer.querySelector('#prod-form-image');
        const thumb = modalContainer.querySelector('#preview-thumb-dish');
        if (inp) inp.value = '';
        if (thumb) {
          thumb.src = '';
          thumb.classList.add('hidden');
        }
        clearBtn.classList.add('hidden');
        modalContainer.querySelectorAll('.preset-dish-select').forEach(p => p.classList.remove('active'));
      });
    }

    // Bind Preset Events
    this.bindModalPresetEvents(modalContainer);

    // Form submit
    const form = modalContainer.querySelector('#product-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('prod-form-name').value.trim();
      const price = document.getElementById('prod-form-price').value.trim();
      const categoryId = document.getElementById('prod-form-category').value;
      const badge = document.getElementById('prod-form-badge').value.trim();
      const image = document.getElementById('prod-form-image').value.trim();
      const description = document.getElementById('prod-form-desc').value.trim();

      if (!name || !price) return;

      const productPayload = {
        name,
        price,
        categoryId,
        badge,
        image,
        description
      };

      if (isEdit && this.editingProductId) {
        this.stateManager.updateMenuProduct(this.editingProductId, productPayload);
      } else {
        this.stateManager.addMenuProduct(productPayload);
      }

      closeModal();
      this.onStateChange();
    });
  }

  bindModalPresetEvents(modalContainer) {
    // Preset Dish select clicks
    modalContainer.querySelectorAll('.preset-dish-select').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.dataset.url;
        const inp = modalContainer.querySelector('#prod-form-image');
        const thumb = modalContainer.querySelector('#preview-thumb-dish');
        const clearBtn = modalContainer.querySelector('#btn-clear-dish-img');
        if (inp) inp.value = url;
        if (thumb) {
          thumb.src = url;
          thumb.classList.remove('hidden');
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        modalContainer.querySelectorAll('.preset-dish-select').forEach(p => p.classList.remove('active'));
        img.classList.add('active');
      });
    });

    // Remove preset dish button (X)
    modalContainer.querySelectorAll('.btn-remove-preset-dish').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (PRESET_IMAGES.dishes) {
          PRESET_IMAGES.dishes.splice(idx, 1);
          const strip = modalContainer.querySelector('#modal-dish-presets-strip');
          if (strip) {
            strip.innerHTML = (PRESET_IMAGES.dishes || []).map((d, i) => `
              <div class="relative group/preset flex-shrink-0">
                <img src="${d.url}" alt="${d.name}" class="preset-img-thumb preset-dish-select" data-url="${d.url}" title="${d.name}">
                <button type="button" class="btn-remove-preset-dish absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow transition-all cursor-pointer opacity-80 hover:opacity-100" data-idx="${i}" title="Eliminar muestra">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            `).join('');
            this.bindModalPresetEvents(modalContainer);
          }
        }
      });
    });
  }
}

