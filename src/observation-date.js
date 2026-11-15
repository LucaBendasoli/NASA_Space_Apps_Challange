// Datas sem horário não ganham uma precisão fictícia. Horários exigem fuso explícito.
export function validateObservationDate(value) {
  if(typeof value!=='string')throw Error('Data da observação inválida.');
  const match=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if(!match||!Number.isFinite(Date.parse(value)))throw Error('Data da observação inválida; use ISO 8601 com fuso ou YYYY-MM-DD.');
  const [,year,month,day,hour,minute,second,zone]=match;
  const calendar=new Date(`${year}-${month}-${day}T00:00:00Z`);
  if(calendar.toISOString().slice(0,10)!==value.slice(0,10)||Number(hour||0)>23||Number(minute||0)>59||Number(second||0)>59||(zone&&zone!=='Z'&&(Number(zone.slice(1,3))>23||Number(zone.slice(4))>59)))throw Error('Data da observação inválida.');
  return value;
}
export function formatObservationDate(value, locale = 'pt-BR') {
  if(!value)return 'Data não informada';
  const timed=value.includes('T');
  return new Intl.DateTimeFormat(locale,{dateStyle:'short',...(timed?{timeStyle:'short'}:{}),timeZone:'UTC'}).format(new Date(value))+(timed?' UTC':'');
}
export const observationLabel = (object, locale = 'pt-BR') => `${formatObservationDate(object.observedAt, locale)} · ${object.observationName||object.observationId} [${object.observationId}]`;
