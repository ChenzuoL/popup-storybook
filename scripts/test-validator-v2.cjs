'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {validate}=require('./validate-book-v2.cjs');
const dir=path.resolve(__dirname,'..');
const template=JSON.parse(fs.readFileSync(path.join(dir,'templates/book-v2.json')));
function check(mutator,needle){const b=structuredClone(template);mutator(b);return validate(b,dir,{production:true}).errors.some(e=>e.includes(needle));}
assert.deepEqual(validate(template,dir,{production:false}).errors,[]);
assert.deepEqual(validate(template,dir,{production:true}).errors,[]);
assert(check(b=>b.sceneContractVersion=9,'sceneContractVersion'));
assert(check(b=>b.spreads[0].pageArt.left='subject-standee','ground-only'));
assert(check(b=>delete b.spreads[0].scenePolicy.requiredLayers,'scenePolicy.requiredLayers'));
assert(check(b=>b.spreads[0].scene[0].mechanism='magic','invalid mechanism'));
assert(check(b=>b.spreads[0].scene[0].reveal={start:.9,end:.1},'reveal'));
assert(check(b=>b.assets[1].maskFile='missing-mask.png','missing'));
assert(check(b=>b.spreads[0].scene[0].anchor=[1.2,.4],'page bounds'));
assert(check(b=>b.spreads[0].scenePolicy={requiredLayers:['background','midground','foreground'],sparseIntent:true},'sparseIntent'));
assert(check(b=>b.spreads[0].scene=[], 'background'));
assert(check(b=>delete b.assets[0].provenance,'provenance'));
console.log('PASS v2 template draft/production and 10 negative contract cases');
