import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {transformWithEsbuild} from 'vite';
const image=readFileSync('src/assets/lua-logo-v2.png');assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
const width=image.readUInt32BE(16),height=image.readUInt32BE(20);assert.equal(image[24],8);assert.equal(image[25],6,'RGBA transparency required');assert.ok(width>=1024);
let offset=8;const data=[];while(offset<image.length){const size=image.readUInt32BE(offset),type=image.toString('ascii',offset+4,offset+8);if(type==='IDAT')data.push(image.subarray(offset+8,offset+8+size));offset+=size+12;}
const pixels=inflateSync(Buffer.concat(data)),stride=width*4;let previous=Buffer.alloc(stride),position=0,transparent=0,visible=0;
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
for(let y=0;y<height;y++){const filter=pixels[position++],row=Buffer.from(pixels.subarray(position,position+stride));position+=stride;for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;const adjustment=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);row[x]=(row[x]+adjustment)&255;if(x%4===3){if(row[x]===0)transparent++;else visible++;}}previous=row;}
assert.ok(transparent>width*height*.25,'actual transparent background, not an opaque matte');assert.ok(visible>width*height*.05,'logo content exists');
const source=readFileSync('src/booking/BookingExperience.tsx','utf8');assert.match(source,/view==='home'&&brandInHero\?<span aria-hidden="true"/);assert.match(source,/!brandInHero\?<small>/);assert.match(source,/className="lb-hero-brand"/);
for(const file of ['src/booking/BookingExperience.tsx','src/pages/LuaPage.tsx'])await transformWithEsbuild(readFileSync(file,'utf8'),file,{loader:'tsx'});
console.log(`OK: ${width}x${height} logo, decoded genuine alpha, one home hero brand, no repeated home header/caption and TSX. Browser visual QA not claimed.`);
