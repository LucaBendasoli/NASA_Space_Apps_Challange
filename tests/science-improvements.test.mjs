import test from 'node:test';
import assert from 'node:assert/strict';
import {createScienceState} from '../src/science-state.js';
import {createProvider,sourceInField} from '../src/science-data.js';
import {scienceShareHash,scienceShareURL,readScienceShare} from '../src/science-share.js';
import {regionMessage} from '../src/science-view.js';
import {linearTicks} from '../src/science-chart.js';
import {formatMeasurement} from '../src/measurement-interaction.js';
import {createImageStatus} from '../src/image-status.js';
const a={id:'a',surveyId:'dss',observationId:'obs',ra:10,dec:41,frame:'ICRS'},b={...a,id:'b'},data={rows:[{radiance:0}]};
const context={radius:1,surveyId:'dss',observationId:null};
test('estados de configuração, consulta, vazio, cobertura, parcial e erro são distintos',()=>{
  const states=[{status:'off'},{regionStatus:'loading'},{regionStatus:'ready',objects:[],coverage:'full'},{regionStatus:'ready',objects:[],coverage:'none'},{regionStatus:'ready',objects:[a],coverage:'partial',partial:true},{regionStatus:'error',regionError:'offline'}];
  const messages=states.map(s=>regionMessage({objects:[],...s}));assert.equal(new Set(messages).size,6);assert.doesNotMatch(messages[0],/0 fontes/);assert.match(messages[0],/conectada/);
});
test('fixação preserva análise sem adicionar fontes a região parcial ou campo amplo',async()=>{
  let latest,objects=[a,b];const state=createScienceState({list:async()=>({objects,partial:true}),measurements:async()=>data},s=>latest=s);
  await state.load(context);await state.select(a);state.setPinned(true);objects=[];await state.load({...context,radius:2});assert.equal(latest.selected.id,'a');assert.equal(latest.measurements,data);assert.deepEqual(latest.objects,[]);assert.equal(latest.regionalMissing,true);
  await state.load({...context,radius:30});assert.equal(latest.selected.id,'a');assert.equal(latest.regionStatus,'wide');state.setPinned(false);assert.equal(latest.selected.id,'a');await state.load(context);assert.equal(latest.selected,null);
});
test('selecionar B mantém fixação; limpar e trocar contexto removem dados incompatíveis',async()=>{
  let latest;const state=createScienceState({list:async c=>({objects:c.surveyId==='dss'?[a,b]:[]}),measurements:async()=>data},s=>latest=s);
  await state.load(context);await state.select(a);state.setPinned(true);await state.select(b);assert.equal(latest.pinned,true);assert.equal(latest.selected.id,'b');await state.load({...context,surveyId:'wise'});assert.equal(latest.selected,null);assert.equal(latest.pinned,false);
  await state.load(context);await state.select(a);state.setPinned(true);state.clear();assert.equal(latest.pinned,false);assert.equal(latest.measurements,null);
});
test('navegação mantém medição fixada em voo mas contexto incompatível invalida resposta',async()=>{
  let resolve,latest;const pending=new Promise(r=>resolve=r);let objects=[a];const state=createScienceState({list:async()=>({objects}),measurements:()=>pending},s=>latest=s);
  await state.load(context);const task=state.select(a);state.setPinned(true);objects=[];await state.load({...context,radius:2});resolve(data);await task;assert.equal(latest.status,'ready');assert.equal(latest.measurements,data);
});
test('visibilidade é projetada, independente da presença no catálogo',()=>{
  assert.equal(sourceInField({world2pix:()=>[50,40],getSize:()=>[100,100]},a),true);assert.equal(sourceInField({world2pix:()=>[-1,40],getSize:()=>[100,100]},a),false);assert.equal(sourceInField({world2pix(){throw Error();}},a),null);
});
test('link recupera identidade e fixação e preserva links antigos',()=>{
  const view={ra:10,dec:41,fov:3,survey:'dss',projection:'SIN'};
  const hash=scienceShareHash(view,a,true,'http');assert.deepEqual(readScienceShare(hash).reference,{id:'a',surveyId:'dss',observationId:'obs',pinned:true,provider:'http'});assert.equal(readScienceShare(scienceShareHash(view,null,false,'off')).reference,null);
  for(const bad of [hash+'&objectId=b',hash+'&ra=20',hash.replace('projection=SIN','projection=invalid'),hash.replace('pinned=1','pinned=yes'),hash.replace('objectSurvey=dss','objectSurvey=wise'),hash.replace('dataProvider=http','dataProvider=unknown'),hash.replace('observation=obs','observation=%00')])assert.ok(readScienceShare(bad).error);
  const url=scienceShareURL('https://name:secret@example.invalid/?science=http&token=secret&payload=private',view,a,true,'http');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.search,'?science=http');assert.doesNotMatch(url.href,/secret|private/);
  assert.throws(()=>scienceShareHash({...view,survey:'wise'},a,true,'http'));
});
test('recuperação usa endpoint por ID com contexto e valida identidade',async()=>{
  let url;const provider=createProvider({provider:'http',baseURL:'https://example.invalid/api/',limit:500},async u=>(url=u,{ok:true,json:async()=>a}));assert.equal((await provider.object(a)).id,'a');assert.match(url.pathname,/objects\/a$/);assert.equal(url.searchParams.get('observationId'),'obs');
  const wrong=createProvider({provider:'http',baseURL:'https://example.invalid/api/'},async()=>({ok:true,json:async()=>b}));await assert.rejects(wrong.object(a),/não corresponde/);
});
test('restaurar fonte fora da região não inventa marcador; falha permanece recuperável',async()=>{
  let latest,fail=true;const state=createScienceState({list:async()=>({objects:[]}),object:async()=>{if(fail)throw Error('404');return a;},measurements:async()=>data},s=>latest=s);
  await state.load(context);await state.restore({...a,pinned:true});assert.equal(latest.status,'error');fail=false;await state.restore({...a,pinned:true});assert.equal(latest.status,'ready');assert.equal(latest.pinned,true);assert.deepEqual(latest.objects,[]);
  await state.load({...context,surveyId:'wise'});await state.restore({...a,pinned:true});assert.equal(latest.selected,null);assert.equal(latest.status,'error');
});
test('tooltip preserva valores completos, zero, ausência, incerteza e qualidade desconhecida',()=>{
  const m={bandId:'B',wavelength:1.23456789123,wavelengthUnit:'um',radiance:0,radianceUnit:'R',uncertainty:.000000123456,quality:{flag:'X'}};assert.match(formatMeasurement(m),/1.23456789123/);assert.match(formatMeasurement(m),/Radiância: 0 R/);assert.match(formatMeasurement(m),/"flag":"X"/);assert.match(formatMeasurement({...m,radiance:null}),/Ausente/);assert.ok(linearTicks(-1,4).includes(0));assert.ok(linearTicks(.7,12).length>=3);
});
test('status de imagem não confunde camada preparada com tiles pintados e ignora callback antigo',()=>{
  let latest;const status=createImageStatus(s=>latest=s);assert.equal(latest.engine,'initializing');const old=status.request();status.engineReady();const next=status.request();old.errorCallback();assert.equal(latest.images,'requesting');next.successCallback();assert.equal(latest.images,'unconfirmed');const failed=status.request();failed.errorCallback();assert.equal(latest.images,'error');
});
