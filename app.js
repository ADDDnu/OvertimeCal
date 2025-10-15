(function(){
function parseTimeStr(t){const [H,M]=t.split(':').map(Number);return H*60+M;}
// Core compute function
function computeHoursFlexible(entry){
  const mStart=parseTimeStr(entry.start);
  const mEnd=parseTimeStr(entry.end);
  let totalMin=mEnd-mStart;
  if(totalMin<0) totalMin+=24*60;
  if(!entry.noCut && totalMin>=30) totalMin-=30;
  // ✅ New rule: Sat/Sun 08:00–16:00 => deduct 1h
  const dObj=new Date(entry.date+"T00:00:00");
  const day=dObj.getDay(); // 0=Sun,6=Sat
  if((day===0||day===6)&&entry.start==="08:00"&&entry.end==="16:00"){
    totalMin-=60;
  }
  return {hoursNet: totalMin/60};
}
// Example test
console.log('Test Sun 08:00-16:00 => expect 7:', computeHoursFlexible({date:"2025-10-12",start:"08:00",end:"16:00"}));
console.log('Test Fri 08:00-16:00 => expect 7.5 (30min cut):', computeHoursFlexible({date:"2025-10-10",start:"08:00",end:"16:00"}));
})();