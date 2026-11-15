// Respostas científicas não abrem o painel: só uma ação explícita pode fazê-lo.
export function createPresentationState(emit) {
  let state={open:false,expanded:false};
  return {
    get value(){return state;},
    open(){if(!state.open){state={...state,open:true};emit(state);}},
    close(){if(state.open){state={...state,open:false};emit(state);}},
    expand(){state={...state,expanded:!state.expanded};emit(state);},
  };
}
