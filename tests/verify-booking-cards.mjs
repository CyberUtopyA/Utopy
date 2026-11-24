import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
for(const name of ['BookingCardShelf','BookingEditorPopup','ServiceCatalogEditor','BookingResources']){
 const path=`src/booking/${name}.tsx`,source=readFileSync(path,'utf8');
 await transformWithEsbuild(source,path,{loader:'tsx'});
 assert.doesNotMatch(source,/bookingRequest|fetch\(|localStorage|publishAuthorized/);
}
const shelf=readFileSync('src/booking/BookingCardShelf.tsx','utf8');
assert.match(shelf,/Ver todos/);assert.match(shelf,/Carrusel/);assert.match(shelf,/aria-pressed/);assert(shelf.indexOf('lb-add-card')<shelf.indexOf('{children}'));
const popup=readFileSync('src/booking/BookingEditorPopup.tsx','utf8');
assert.match(popup,/showModal/);assert.match(popup,/onCancel/);assert.match(popup,/previous\?\.focus/);assert.match(popup,/configuración pendiente/);
for(const name of ['ServiceCatalogEditor','BookingResources']){const source=readFileSync(`src/booking/${name}.tsx`,'utf8');assert.match(source,/BookingCardShelf/);assert.match(source,/BookingEditorPopup/);assert.match(source,/aria-haspopup="dialog"/);}
const css=readFileSync('src/booking/bookingCards.css','utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/scroll-snap-type/);assert.match(css,/lb-card-grid/);assert.doesNotMatch(css,/infinite|backdrop-filter/);
console.log('OK: carousel/grid controls, add-first cards, shared modal accessibility lifecycle, retained draft-only editing, TSX. Browser visual validation pending.');
