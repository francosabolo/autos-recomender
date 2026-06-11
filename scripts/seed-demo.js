// scripts/seed-demo.js
// Setup limpio para probar el MVP: re-persiste las recetas de extracción de los portales
// y carga una búsqueda demo "Ford Ka" con fotos para ver la vista "Hoy".
// Uso: npm run seed
import { createBoard, saveListingsToBoard, markBoardListingsSeen, getTodayDigest, saveRecipe } from '../lib/db.js';

// --- Recetas de extracción (las que descubrimos en vivo) ---
saveRecipe('kavak', {
  item: 'a[data-testid^="card-product"]',
  fields: {
    titulo: { sel: 'h3', attr: 'text' },
    precio: { sel: '[class*="amount__large__price"]', attr: 'text' },
    link: { attr: 'href' },
    imagen: { sel: 'img', attr: 'src' },
    anio: { sel: '[class*="subtitle"]', attr: 'text' },
    km: { sel: '[class*="subtitle"]', attr: 'text' }
  }
});
saveRecipe('rosariogarage', {
  item: '.box_aviso_base',
  fields: {
    titulo: { sel: '.box_aviso_tit a', attr: 'text' },
    precio: { sel: '.precio', attr: 'text' },
    link: { sel: '.box_aviso_tit a', attr: 'href' },
    imagen: { sel: 'img.lazyload', attr: 'data-src' }
  }
});

// --- Búsqueda demo con fotos ---
const IMG = [
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80'
];

const board = createBoard({
  name: 'Ford Ka (demo)',
  filters: { marca: 'Ford', modelo: 'Ka', precioMax: 20000000 },
  portals: ['kavak', 'rosariogarage']
});

saveListingsToBoard(board.id, [
  { titulo: 'Ford Ka SE 1.5 2019', precio: 15000000, link: 'https://demo.local/ka/1', source: 'kavak', año: 2019, kilometros: 62000, ubicacion: 'Rosario, Santa Fe', imagen: IMG[0] },
  { titulo: 'Ford Ka S 1.5 2018', precio: 12500000, link: 'https://demo.local/ka/2', source: 'rosariogarage', año: 2018, kilometros: 80000, ubicacion: 'Santa Fe', imagen: IMG[1] }
], { markNew: false });
markBoardListingsSeen(board.id);

const { newIds } = saveListingsToBoard(board.id, [
  { titulo: 'Ford Ka SE 1.5 2019', precio: 13500000, link: 'https://demo.local/ka/1', source: 'kavak', año: 2019, kilometros: 62000, ubicacion: 'Rosario, Santa Fe', imagen: IMG[0] },
  { titulo: 'Ford Ka S 1.5 2018', precio: 12500000, link: 'https://demo.local/ka/2', source: 'rosariogarage', año: 2018, kilometros: 80000, ubicacion: 'Santa Fe', imagen: IMG[1] },
  { titulo: 'Ford Ka SEL 1.5 2020', precio: 18200000, link: 'https://demo.local/ka/3', source: 'kavak', año: 2020, kilometros: 45000, ubicacion: 'Rosario, Santa Fe', imagen: IMG[2] }
], { markNew: true });

const dig = getTodayDigest();
console.log('Recetas Kavak + Rosario Garage persistidas.');
console.log(`Búsqueda demo "${board.name}" lista — Nuevos: ${dig.counts.nuevos} · Bajaron: ${dig.counts.bajaron}`);
console.log('Abrí http://localhost:3000');
