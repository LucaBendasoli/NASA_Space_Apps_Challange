import { objectKey } from './science-data.js';
export function createScienceState(provider, emit) {
  let regionVersion = 0, selectionVersion = 0, regionAbort, selectionAbort, context;
  const cache = new Map();
  let state = { status: 'initial', objects: [], selected: null, pinned:false, inField:null };
  const update = patch => { state = {...state,...patch}; emit(state); };
  function clear() { selectionVersion++; selectionAbort?.abort(); update({selected:null, measurements:null, status:'initial', error:null, candidates:null,pinned:false,inField:null,regionalMissing:false}); }
  return {
    clear,
    get value(){return state;},
    setPinned(pinned){update({pinned:Boolean(pinned)&&Boolean(state.selected)});},
    setInField(inField){if(state.inField!==inField)update({inField});},
    invalidate(preserve = false) {
      regionVersion++; regionAbort?.abort();
      if (!preserve) { clear(); update({objects:[],regionStatus:'loading',regionError:null}); }
      else update({regionStatus:'loading',regionError:null});
    },
    async load(next) {
      const preserve = context && context.surveyId === next.surveyId && context.observationId === next.observationId;
      this.invalidate(preserve); context = next;
      const version = regionVersion;
      if (next.radius > 10) { if(!state.pinned)clear(); update({objects:[],regionStatus:'wide',regionalMissing:Boolean(state.selected)}); return; }
      regionAbort = new AbortController();
      try {
        const result = await provider.list(next, regionAbort.signal);
        if (version === regionVersion) {
          const selected = state.selected && result.objects.find(o=>objectKey(o) === objectKey(state.selected));
          if (!selected&&!state.pinned&&state.selected) clear();
          update({...result,regionStatus:'ready',regionalMissing:Boolean(state.selected&&!selected)});
        }
      } catch(error) { if (version === regionVersion) update({regionStatus:'error',regionError:error.message}); }
    },
    choose(candidates) { clear(); update({candidates}); },
    async restore(reference) {
      if(context&&(context.surveyId!==reference.surveyId||(context.observationId&&context.observationId!==reference.observationId))){update({status:'error',error:'A análise compartilhada pertence a outro contexto científico.'});return;}
      selectionAbort?.abort();selectionAbort=new AbortController();const version=++selectionVersion;
      update({status:'restoring',selected:null,measurements:null,error:null});
      try {const object=await provider.object(reference,selectionAbort.signal);if(version!==selectionVersion)return;const task=this.select(object,true);this.setPinned(reference.pinned);await task;}
      catch(error){if(version===selectionVersion)update({status:'error',error:`Não foi possível recuperar a fonte compartilhada: ${error.message}`});}
    },
    async select(object, trusted = false) {
      if (!trusted && !state.objects.some(o => objectKey(o) === objectKey(object)) && objectKey(state.selected||{})!==objectKey(object)) return;
      selectionAbort?.abort(); selectionAbort = new AbortController();
      const version = ++selectionVersion;
      const selection={selected:object,inField:null,regionalMissing:!state.objects.some(o=>objectKey(o)===objectKey(object)),error:null,candidates:null};
      const cached = cache.get(objectKey(object));
      if(cached) { update({...selection,measurements:cached,status:cached.rows.some(r=>r.radiance!==null)?'ready':'empty'}); return; }
      update({...selection,status:'loading',measurements:null});
      const key = objectKey(object);
      try {
        const data = cache.get(key) || await provider.measurements(object, selectionAbort.signal);
        if (version !== selectionVersion) return;
        cache.set(key,data); if (cache.size > 100) cache.delete(cache.keys().next().value);
        update({measurements:data,status:data.rows.some(r=>r.radiance !== null)?'ready':'empty'});
      } catch(error) { if(version === selectionVersion) update({status:'error',error:error.message}); }
    },
    retry() { if(state.regionStatus==='error'&&context) this.load(context); else if(state.selected) this.select(state.selected); else if(context) this.load(context); },
  };
}
