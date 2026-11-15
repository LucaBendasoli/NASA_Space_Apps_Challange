import { objectKey } from './science-data.js';
export function comparisonCompatible(primary,secondary){
  const a=primary.rows[0],b=secondary.rows[0];
  return !a||!b||(a.wavelengthUnit===b.wavelengthUnit&&a.radianceUnit===b.radianceUnit);
}
export function createComparisonState(provider,getPrimary,emit){
  let version=0,controller;
  let state={status:'idle',selected:null,measurements:null,objects:[],resetId:0,error:null};
  const cache=new Map();
  const update=patch=>{state={...state,...patch};emit(state);};
  return {
    get value(){return state;},
    reset(collapse=true){version++;controller?.abort();update({status:'idle',selected:null,measurements:null,error:null,resetId:state.resetId+(collapse?1:0)});},
    setCandidates(objects){
      if(JSON.stringify(objects)===JSON.stringify(state.objects))return;
      if(state.selected&&!objects.some(o=>objectKey(o)===objectKey(state.selected)))this.reset(false);
      update({objects});
    },
    async select(object){
      if(!object){this.reset(false);return;}
      const primary=getPrimary();
      if(primary.status!=='ready'||!primary.selected||objectKey(primary.selected)===objectKey(object)||!state.objects.some(o=>objectKey(o)===objectKey(object)))return;
      controller?.abort();controller=new AbortController();const request=++version,key=objectKey(object),primaryKey=objectKey(primary.selected);
      const cached=cache.get(key);
      if(!cached)update({selected:object,status:'loading',measurements:null,error:null});
      try{
        const data=cached||await provider.measurements(object,controller.signal);
        if(request!==version||objectKey(getPrimary().selected||{})!==primaryKey)return;
        if(!comparisonCompatible(getPrimary().measurements,data))throw Error('Unidades incompatíveis com o astro principal. O backend deve fornecer a mesma unidade de comprimento de onda e de radiância.');
        cache.set(key,data);if(cache.size>100)cache.delete(cache.keys().next().value);
        update({selected:object,measurements:data,status:data.rows.some(r=>r.radiance!==null)?'ready':'empty',error:null});
      }catch(error){if(request===version)update({selected:object,status:'error',measurements:null,error:error.message});}
    },
    retry(){if(state.selected){cache.delete(objectKey(state.selected));return this.select(state.selected);}},
  };
}
