/**
 * LEALTIX SITE BUILDER - GESTOR DE CARGA DE IMÁGENES & BANCO DE RECURSOS
 */

export const PRESET_IMAGES = {
  logos: [
    { name: 'Gourmet Bistro', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&h=200&q=80' },
    { name: 'Café & Bakery', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&h=200&q=80' },
    { name: 'Sushi & Grill', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=200&h=200&q=80' },
    { name: 'Cocktail Bar', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=200&h=200&q=80' }
  ],
  heroBanners: [
    { name: 'Terraza de Lujo', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Mesa Gourmet Elegante', url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Cocina & Fuego Vivo', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Cafetería Acogedora', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Bar Nocturno Contemporáneo', url: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1600&q=80' }
  ],
  about: [
    { name: 'Chef & Cocina', url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80' },
    { name: 'Horno & Masa Madre', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80' },
    { name: 'Cava & Bar', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80' }
  ],
  gallery: [
    { name: 'Platillo Insignia', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
    { name: 'Mixología de Autor', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80' },
    { name: 'Terraza Nocturna', url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80' },
    { name: 'Cortes a las Brasas', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' }
  ],
  dishes: [
    { name: 'Corte Rib Eye', url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80' },
    { name: 'Carpaccio Trufado', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
    { name: 'Tacos Gourmet', url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80' },
    { name: 'Pasta Fresca', url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80' },
    { name: 'Mixología & Cócteles', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80' },
    { name: 'Postre & Volcán', url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80' }
  ]
};

export class ImageUploader {
  static setupDropZone(dropZoneEl, fileInputEl, onImageLoaded) {
    if (!dropZoneEl || !fileInputEl) return;

    // Click to select
    dropZoneEl.addEventListener('click', (e) => {
      if (e.target !== fileInputEl) {
        fileInputEl.click();
      }
    });

    // File input change
    fileInputEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        ImageUploader.readFileAsDataURL(file, onImageLoaded);
      }
    });

    // Drag & drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneEl.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneEl.classList.remove('dragover');
      }, false);
    });

    dropZoneEl.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && file.type.startsWith('image/')) {
        ImageUploader.readFileAsDataURL(file, onImageLoaded);
      }
    });
  }

  static readFileAsDataURL(file, callback, maxWidth = 1600, maxHeight = 1200) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target.result;
      
      // If SVG or very small, use directly
      if (file.type === 'image/svg+xml' || file.size < 120 * 1024) {
        callback(rawDataUrl);
        return;
      }

      // Optimize image via Canvas to avoid localStorage quota issues
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const optimizedDataUrl = canvas.toDataURL(mimeType, 0.86);
        callback(optimizedDataUrl);
      };
      img.onerror = () => {
        callback(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }
}
