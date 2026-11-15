import { objectKey } from './science-data.js';
export function createScienceState(provider, emit) {
  let regionVersion = 0, selectionVersion = 0, regionAbort, selectionAbort, context;
  const cache = new Map();
  let state = { status: 'initial', objects: [], selected: null };
  const update = patch => { state = {...state,...patch}; emit(state); };
  function clear() { selectionVersion++; selectionAbort?.abort(); update({selected:null, measurements:null, status:'initial', error:null, candidates:null}); }
  return {
    clear,
    invalidate(preserve = false) {
      regionVersion++; regionAbort?.abort();
      if (!preserve) { clear(); update({objects:[],regionStatus:'loading',regionError:null}); }
      else { selectionVersion++; selectionAbort?.abort(); update({regionStatus:'loading',regionError:null}); }
    },
    async load(next) {
      const preserve = context && context.surveyId === next.surveyId && context.observationId === next.observationId;
      this.invalidate(preserve); context = next;
      const version = regionVersion;
      if (next.radius > 10) { clear(); update({objects:[],regionStatus:'wide'}); return; }
      regionAbort = new AbortController();
      try {
        const result = await provider.list(next, regionAbort.signal);
        if (version === regionVersion) {
          const selected = state.selected && result.objects.find(o=>objectKey(o) === objectKey(state.selected));
          if (!selected) clear();
          update({...result,regionStatus:'ready'});
          if (selected) this.select(selected);
        }
      } catch(error) { if (version === regionVersion) update({regionStatus:'error',regionError:error.message}); }
    },
    choose(candidates) { clear(); update({candidates}); },
    async select(object) {
      if (!state.objects.some(o => objectKey(o) === objectKey(object))) return;
      selectionAbort?.abort(); selectionAbort = new AbortController();
      const version = ++selectionVersion, region = regionVersion;
      update({selected:object,status:'loading',measurements:null,error:null,candidates:null});
      const key = objectKey(object);
      try {
        const data = cache.get(key) || await provider.measurements(object, selectionAbort.signal);
        if (version !== selectionVersion || region !== regionVersion) return;
        cache.set(key,data); if (cache.size > 100) cache.delete(cache.keys().next().value);
        update({measurements:data,status:data.rows.some(r=>r.radiance !== null)?'ready':'empty'});
      } catch(error) { if(version === selectionVersion && region === regionVersion) update({status:'error',error:error.message}); }
    },
    retry() { if(state.selected) this.select(state.selected); else if(context) this.load(context); },
  };
}
