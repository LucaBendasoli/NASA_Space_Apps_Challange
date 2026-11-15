// O callback de HiPS confirma a preparação da camada, não a pintura dos tiles.
export function createImageStatus(emit) {
  let version=0,state={engine:'initializing',images:'idle'};
  const update=patch=>{state={...state,...patch};emit(state);};
  update({});
  return {
    engineReady(){update({engine:'ready'});},
    engineFailed(){update({engine:'error'});},
    request(){const request=++version;update({images:'requesting'});return {successCallback:()=>{if(request===version)update({images:'unconfirmed'});},errorCallback:()=>{if(request===version)update({images:'error'});}};},
  };
}
