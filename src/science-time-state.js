import {objectKey} from './science-data.js';
import {createComparisonState} from './science-comparison.js';

// O histórico é da identidade científica, não do campo regional nem dos pixels HiPS.
export function createTimeState(provider,getPrimary,emit) {
  let version=0,controller,referenceKey=null;
  let history={historyStatus:'idle',observations:[],partial:false,historyError:null};
  const cache=new Map();
  const notify=()=>emit(api.value);
  const comparison=createComparisonState(provider,getPrimary,notify);
  const api={
    get value(){
      const object=getPrimary().selected;
      return {...comparison.value,...history,reference:history.observations.find(o=>objectKey(o)===objectKey(object||{}))||object};
    },
    reset(){version++;controller?.abort();referenceKey=null;history={historyStatus:'idle',observations:[],partial:false,historyError:null};comparison.reset();comparison.setCandidates([]);},
    async load(force=false){
      const object=getPrimary().selected;
      if(!object)return;
      const key=objectKey(object);
      if(!force&&referenceKey===key&&history.historyStatus!=='idle')return;
      referenceKey=key;controller?.abort();controller=new AbortController();const request=++version;
      if(force){cache.delete(key);comparison.reset();comparison.setCandidates([]);}
      const cached=cache.get(key);
      if(!cached){history={historyStatus:'loading',observations:[],partial:false,historyError:null};notify();}
      try {
        const result=cached||await provider.observations(object,controller.signal);
        if(request!==version||objectKey(getPrimary().selected||{})!==key)return;
        cache.set(key,result);if(cache.size>100)cache.delete(cache.keys().next().value);
        history={...result,historyStatus:'ready',historyError:null};
        comparison.setCandidates(result.observations.filter(o=>objectKey(o)!==key));notify();
      }catch(error){if(request===version&&objectKey(getPrimary().selected||{})===key){history={historyStatus:'error',observations:[],partial:false,historyError:`Não foi possível carregar as datas deste astro: ${error.message}`};notify();}}
    },
    select(object){return comparison.select(object);},
    retry(){return history.historyStatus==='error'?this.load(true):comparison.retry();},
  };
  return api;
}
