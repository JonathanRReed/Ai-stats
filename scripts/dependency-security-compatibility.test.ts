import {expect,test} from 'bun:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {gte}=require('semver');

const minimumVersions = {
 'postcss-selector-parser':'7.1.6',
 sharp:'0.35.5',
 'smol-toml':'1.9.1',
 'source-map-js':'1.2.2',
};
for(const [name,minimum] of Object.entries(minimumVersions)){
 test(name+' resolves at or above the reviewed security floor',()=>{
  expect(gte(require(name+'/package.json').version,minimum)).toBe(true);
 });
}
test('indexed source maps reject amplifying offsets but retain ordinary mappings',()=>{
 const {SourceMapConsumer}=require('source-map-js');
 const map={version:3,sources:['input.js'],names:[],mappings:'AAAA'};
 expect(()=>new SourceMapConsumer({version:3,sections:[{offset:{line:1e9,column:0},map}]})).toThrow();
 expect(()=>new SourceMapConsumer({version:3,sections:[{offset:{line:0,column:Infinity},map}]})).toThrow();
 const consumer=new SourceMapConsumer({version:3,sections:[{offset:{line:2,column:0},map}]});
 const mappings:unknown[]=[];consumer.eachMapping((mapping:unknown)=>mappings.push(mapping));
 expect(mappings).toEqual([{source:'input.js',generatedLine:3,generatedColumn:0,originalLine:1,originalColumn:0,name:null}]);
});
test('selector parser preserves complex and repeated-class selectors',()=>{
 const parser=require('postcss-selector-parser');
 for(const selector of ['main > .card:is(.active, #selected)::before','[data-name="a,b"] .x\\:y','.a'.repeat(2000)]){
  expect(parser().processSync(selector)).toBe(selector);
 }
});
test('TOML parsing preserves typed values, quoted keys, and long flat documents',()=>{
 const {parse}=require('smol-toml');
 expect(parse('"quoted.key" = "Value"\nport = 8_080\nactive = true\nweights = [1.5, 2.5]\n')).toEqual({'quoted.key':'Value',port:8080,active:true,weights:[1.5,2.5]});
 const input=Array.from({length:2000},(_,i)=>`key_${i} = ${i}`).join('\n');
 const value=parse(input);expect(Object.keys(value)).toHaveLength(2000);expect(value.key_1999).toBe(1999);
 expect(()=>parse('broken = [1,')).toThrow();
});
test('sharp loads the fixed librsvg and renders a small trusted SVG',async()=>{
 const sharp=require('sharp');
 expect(gte(sharp.versions.rsvg,'2.63.2')).toBe(true);
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="red"/></svg>')).png().toBuffer();
 const metadata=await sharp(png).metadata();
 expect(metadata).toMatchObject({format:'png',width:4,height:3});
});

test('TOML rejects duplicate exponent signs while preserving valid exponents',()=>{
 const {parse}=require('smol-toml');
 for(const value of ['1e++2','1e+-2','1e--2','1e-+2'])expect(()=>parse('value = '+value)).toThrow();
 expect(parse('positive = 1e+2\nnegative = 1e-2')).toEqual({positive:100,negative:0.01});
});
