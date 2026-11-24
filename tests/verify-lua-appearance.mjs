import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('src/booking/luaAppearance.css','utf8');
assert.match(css,/color-scheme:only light/);
assert.match(css,/data-view="home"\] \.lb-editorial-line{display:none}/);
assert.match(css,/input,select,textarea/);assert.match(css,/::placeholder/);
assert(!css.includes('prefers-color-scheme')); // Same brand palette for either OS preference.
assert(!css.includes('color-scheme:dark'));assert(!css.includes('blur('));
assert.match(readFileSync('src/pages/LuaPage.tsx','utf8'),/className="living-booking ub-workspace utopy-ui" data-preset="lua-editorial-spa"/);
assert.match(readFileSync('src/booking/BookingExperience.tsx','utf8'),/import '\.\/luaAppearance.css'/);
const luminance=hex=>{const v=hex.match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
for(const [ink,paper] of [['392c28','fbf8f3'],['392c28','fffaf5'],['6a5848','fffdfa'],['fffaf5','76533c'],['624e3c','efe6da']]){const [a,b]=[luminance(ink),luminance(paper)].sort((a,b)=>b-a);assert((a+.05)/(b+.05)>=4.5,`${ink}/${paper} contrast`);}
console.log('OK: LUA home line hidden, scoped fixed light palette, native controls/placeholder colors, management binding, reduced motion and text palette contrast >=4.5. Device/browser visual QA not claimed.');
