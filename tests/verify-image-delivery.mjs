import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {transformWithEsbuild} from 'vite';
import {isPublicShellAsset} from '../src/utils/publicAssetPolicy.js';
const size=name=>statSync(`src/assets/${name}`).size;
assert(size('lua-hero-720.jpg')<60_000);assert(size('lua-hero-1200.jpg')<150_000);
assert(size('lua-hero-1200.jpg')<size('lua-spa-hero-v1.png')*.1);
assert(size('bassi-hero-640.jpg')<100_000);assert(size('bassi-hero-941.jpg')<150_000);
for(const name of ['lua-hero-720.jpg','lua-hero-1200.jpg','bassi-hero-640.jpg','bassi-hero-941.jpg']){const bytes=readFileSync(`src/assets/${name}`);assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);}
function transparentPixels(name){const png=readFileSync(`src/assets/${name}`),width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.equal(png[24],8);assert.equal(png[25],6);assert(width>=600);let offset=8;const chunks=[];while(offset<png.length){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}const raw=inflateSync(Buffer.concat(chunks)),stride=width*4;let previous=Buffer.alloc(stride),position=0,transparent=0;const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};for(let y=0;y<height;y++){const filter=raw[position++],row=Buffer.from(raw.subarray(position,position+stride));position+=stride;for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;row[x]=(row[x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;if(x%4===3&&row[x]===0)transparent++;}previous=row;}assert(transparent>width*height*.2,'transparent background retained');}
transparentPixels('lua-logo-display.png');transparentPixels('bassi-logo-display.png');
assert(size('lua-logo-display.png')<size('lua-logo-v2.png')*.3);assert(size('bassi-logo-display.png')<size('bassi-logo-original.png')*.3);
const booking=readFileSync('src/booking/BookingExperience.tsx','utf8');assert.match(booking,/const heroSrcSet=config.presentation.hero\?'':heroSrcSetFallback/);assert.match(booking,/srcSet={heroSrcSet\|\|undefined}/);assert.match(booking,/loading="eager" decoding="async" fetchPriority="high"/);
for(const path of ['assets/lua-hero-1200-AbCd1234.jpg','assets/photo-AbCd1234.jpeg'])assert(isPublicShellAsset(path));
for(const path of ['media/private.jpg','api/photo.jpg','assets/nohash.jpg','https://elsewhere.test/photo-AbCd1234.jpg','assets/photo-AbCd1234.jpg?token=private'])assert(!isPublicShellAsset(path));
for(const file of ['src/pages/LuaPage.tsx','src/pages/BassiPage.tsx','src/booking/BookingExperience.tsx','src/components/LiveProductCard.tsx','src/components/UnifiedLivingMarket.tsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
const lua=readFileSync('src/pages/LuaPage.tsx','utf8');assert(!lua.includes("from '../assets/lua-spa-hero-v1.png'"));assert.match(lua,/lua-hero-720.jpg/);assert.match(lua,/lua-logo-display.png/);
console.log('OK: image byte budgets, real JPEG signatures, decoded PNG alpha, responsive fallback-only sources, loading priorities, hashed-public JPEG cache boundaries and TSX. No network-time or device screenshot claim.');
