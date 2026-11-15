import { objectKey } from './science-data.js';
export function createScienceCatalog(A, aladin, onSelect, onAmbiguous) {
  let sources = [], signature = '';
  const catalog = A.catalog({name:'Astros · medições do backend',shape:'circle',sourceSize:18,color:'#b8efbd',hoverColor:'#ffffff',selectionColor:'#ffcd7b',onClick: source => {
    const p = aladin.world2pix(source.ra, source.dec);
    const near = sources.filter(s => { const q = aladin.world2pix(s.ra,s.dec); return p && q && Math.hypot(p[0]-q[0],p[1]-q[1]) < 28; });
    if(near.length > 1) onAmbiguous(near.map(s=>s.data.object)); else onSelect(source.data.object);
  }});
  aladin.addCatalog(catalog);
  return {
    render(objects,selected) {
      const next = JSON.stringify(objects);
      if(next !== signature) { signature = next; catalog.removeAll(); sources = objects.map(object=>A.source(object.ra,object.dec,{id:object.id,observationId:object.observationId,surveyId:object.surveyId,object})); catalog.addSources(sources); }
      for(const source of sources) selected && objectKey(source.data.object) === objectKey(selected) ? source.select() : source.deselect();
    },
  };
}
