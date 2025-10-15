(function(){
  const LS_ENTRIES = 'ot_entries_v1';
  const LS_SETTINGS = 'ot_settings_v1';

  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const fmtNum = v => (Math.round((v||0)*100)/100).toFixed(2);
  const fmtMoney = v => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(v||0).replace('THB','฿').trim();
  const parseTimeStr = t => { const [H,M] = t.split(':').map(Number); return H*60+M; };
  const loadEntries = () => { try { return JSON.parse(localStorage.getItem(LS_ENTRIES))||[] } catch(e){ return [] } };
  const saveEntries = arr => localStorage.setItem(LS_ENTRIES, JSON.stringify(arr));
  const loadSettings = () => { let s={rate1:62}; try{ const g=JSON.parse(localStorage.getItem(LS_SETTINGS)); if(g) s=Object.assign(s,g);}catch(e){} return s; };
  const saveSettings = s => localStorage.setItem(LS_SETTINGS, JSON.stringify(s));

  // nav
  qa('.navbtn').forEach(b=>b.addEventListener('click',()=>{
    const tab=b.dataset.tab;
    qa('.navbtn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    qa('main section').forEach(s=>s.classList.remove('active')); q('#'+tab).classList.add('active');
    if(tab==='home') renderHome();
    if(tab==='entry') renderEntry();
    if(tab==='report') renderReport();
    if(tab==='settings') renderSettings();
    window.scrollTo({top:0,behavior:'smooth'});
  }));

  // helpers
  function isWeekend(dateISO){ const d=new Date(dateISO+'T00:00:00'), day=d.getDay(); return (day===0||day===6); }
  function weekdayMultiplier(dateISO, isHoliday){ return (isHoliday||isWeekend(dateISO))?1.0:1.5; }
  function payFor(h,m,rate1){ const r=(m===1?rate1:(m===1.5?rate1*1.5:(m===3?rate1*3:rate1*m))); return h*r; }

  function computeHoursFlexible(e){
    const mStart=parseTimeStr(e.start), mEnd=parseTimeStr(e.end);
    let totalMin=mEnd-mStart; if(totalMin<0) totalMin+=24*60;
    const CUT=16*60;
    const crossesSameDay=(mStart<=CUT && mEnd>CUT && mEnd>mStart);
    const allAfter=(mStart>=CUT);
    const crossesMidnight=(mEnd<mStart);
    const hasAfterWhenCrossMid=crossesMidnight && (mStart>=CUT || (CUT<mEnd));
    const holidayLike = e.isHoliday || isWeekend(e.date);

    if(holidayLike){
      if(e.start==='08:00' && e.end==='16:00' && totalMin>=60) totalMin-=60; // 1h lunch
    }else{
      if(!e.continuous && totalMin>=30 && (crossesSameDay || allAfter || hasAfterWhenCrossMid)){
        totalMin-=30; // 30-min cut after 16:00
      }
    }
    return {hoursNet: totalMin/60};
  }

  // HOME
  function renderHome(){
    const entries=loadEntries(), s=loadSettings(), now=new Date(), y=now.getFullYear(), m=now.getMonth();
    q('#home-month').textContent=new Date(y,m,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    q('#home-rate1').textContent=fmtNum(s.rate1); q('#home-rate15').textContent=fmtNum(s.rate1*1.5); q('#home-rate3').textContent=fmtNum(s.rate1*3);
    const monthEntries=entries.filter(e=>{ const d=new Date(e.date+'T00:00:00'); return d.getFullYear()===y&&d.getMonth()===m; }).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    const tb=q('#home-table tbody'); tb.innerHTML=''; let tH=0,tP=0;
    for(const e of monthEntries){ const mult=e.mult||weekdayMultiplier(e.date,e.isHoliday); const {hoursNet}=computeHoursFlexible(e); const pay=payFor(hoursNet,mult,s.rate1); tH+=hoursNet; tP+=pay;
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${new Date(e.date).toLocaleDateString('th-TH')}</td><td>${e.start}</td><td>${e.end}</td><td>${fmtNum(hoursNet)}</td><td>${mult}x</td><td class="nowrap">${fmtMoney(pay)}</td><td><button class="btn ghost btnDel" data-id="${e.id}">ลบ</button></td>`; tb.appendChild(tr); }
    q('#home-hours-total').textContent=fmtNum(tH)+' h'; q('#home-pay-total').textContent=fmtMoney(tP);
    tb.querySelectorAll('.btnDel').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.id; const arr=loadEntries().filter(x=>String(x.id)!==String(id)); saveEntries(arr); renderHome(); }));
    q('#btnAddQuick').onclick=()=>{ qa('.navbtn').forEach(x=>x.classList.remove('active')); q('.navbtn[data-tab=\"entry\"]').classList.add('active'); qa('main section').forEach(s=>s.classList.remove('active')); q('#entry').classList.add('active'); const d=new Date(); q('#e-date').value=d.toISOString().slice(0,10); q('#e-start').value='16:00'; q('#e-end').value='20:00'; q('#e-mult').value=''; q('#e-continuous').checked=false; q('#e-holiday').checked=false; };
    renderHomeCalendar(monthEntries);
  }
  function renderHomeCalendar(monthEntries){
    const cal=q('#home-calendar'); if(!cal) return;
    const today=new Date(), y=today.getFullYear(), m=today.getMonth(); const first=new Date(y,m,1), startDay=(first.getDay()+7)%7, dim=new Date(y,m+1,0).getDate();
    const label=new Date(y,m,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'}); const calMonth=q('#cal-month'); if(calMonth) calMonth.textContent=label;
    cal.innerHTML='';
    for(const n of ['อา','จ','อ','พ','พฤ','ศ','ส']){ const h=document.createElement('div'); h.className='wday'; h.textContent=n; cal.appendChild(h); }
    for(let i=0;i<startDay;i++){ const c=document.createElement('div'); c.className='cell empty'; cal.appendChild(c); }
    const perDay={};
    for(const e of monthEntries){ const d=new Date(e.date+'T00:00:00'); const dd=d.getDate(); const {hoursNet}=computeHoursFlexible(e); perDay[dd]=(perDay[dd]||0)+hoursNet; }
    for(let d=1; d<=dim; d++){ const c=document.createElement('div'); c.className='cell'; if(d===today.getDate()) c.classList.add('today'); const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; const hv=document.createElement('div'); hv.className='h'; hv.textContent='OT '+fmtNum(perDay[d]||0)+' ชม.'; c.appendChild(dn); c.appendChild(hv); cal.appendChild(c); }
  }

  // ENTRY
  function renderEntry(){
    if(!q('#e-date').value){ q('#e-date').value=new Date().toISOString().slice(0,10); }
    drawEntryTable();
    q('#e-save').onclick=saveEntryFromForm;
    q('#e-clear').onclick=()=>{ q('#e-start').value=''; q('#e-end').value=''; q('#e-mult').value=''; q('#e-continuous').checked=false; q('#e-holiday').checked=false; };
    q('#btnExport').onclick=exportEntries; q('#btnImport').onclick=()=>q('#fileImport').click(); q('#fileImport').onchange=importEntries;
  }
  function saveEntryFromForm(){
    const date=q('#e-date').value, start=q('#e-start').value, end=q('#e-end').value, multStr=q('#e-mult').value;
    const continuous=q('#e-continuous')?q('#e-continuous').checked:false;
    const isHoliday=q('#e-holiday')?q('#e-holiday').checked:false;
    if(!date||!start||!end){ alert('กรุณากรอกวันที่/เวลาให้ครบ'); return; }
    const mult=multStr?Number(multStr):null; const arr=loadEntries(); const id=Date.now(); arr.push({id,date,start,end,mult,continuous,isHoliday}); saveEntries(arr);
    drawEntryTable(); alert('บันทึกสำเร็จ'); q('#e-start').value=''; q('#e-end').value=''; q('#e-mult').value=''; q('#e-continuous').checked=false; q('#e-holiday').checked=false;
  }
  function exportEntries(){ const blob=new Blob([JSON.stringify(loadEntries(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ot_entries_backup.json'; a.click(); URL.revokeObjectURL(a.href); }
  async function importEntries(e){ const f=e.target.files[0]; if(!f) return; const text=await f.text(); try{ const arr=JSON.parse(text); if(!Array.isArray(arr)) throw new Error('ไฟล์ไม่ถูกต้อง'); saveEntries(arr); drawEntryTable(); alert('นำเข้าสำเร็จ'); }catch(err){ alert('ไม่สามารถอ่านไฟล์: '+err.message); } finally{ e.target.value=''; } }
  function drawEntryTable(){
    const entries=loadEntries(), s=loadSettings(), tb=q('#entry-table tbody'); tb.innerHTML=''; const sorted=entries.slice().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    for(const e of sorted){ const mult=e.mult||weekdayMultiplier(e.date,e.isHoliday); const {hoursNet}=computeHoursFlexible(e); const pay=payFor(hoursNet,mult,s.rate1);
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${new Date(e.date).toLocaleDateString('th-TH')}</td><td>${e.start}</td><td>${e.end}</td><td>${fmtNum(hoursNet)}</td><td>${mult}x</td><td class="nowrap">${fmtMoney(pay)}</td><td><button class="btn ghost btnDel" data-id="${e.id}">ลบ</button></td>`; tb.appendChild(tr);
    }
    tb.querySelectorAll('.btnDel').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.id; const arr=loadEntries().filter(x=>String(x.id)!==String(id)); saveEntries(arr); drawEntryTable(); }));
  }

  // REPORT
  let chart;
  function renderReport(){
    const ys=q('#r-year'); ys.innerHTML=''; const entries=loadEntries(); const now=new Date().getFullYear(); const years=new Set(entries.map(e=>new Date(e.date).getFullYear())); years.add(now);
    const sorted=Array.from(years).sort((a,b)=>b-a); for(const y of sorted){ const o=document.createElement('option'); o.value=y; o.textContent=y; ys.appendChild(o); }
    q('#r-year').value=String(now); q('#r-refresh').onclick=drawReport; drawReport();
  }
  function drawReport(){
    const year=Number(q('#r-year').value); q('#r-year-label').textContent=year; const entries=loadEntries(), s=loadSettings(); const mh=Array(12).fill(0); let tH=0,tP=0;
    for(const e of entries){ const d=new Date(e.date+'T00:00:00'); if(d.getFullYear()!==year) continue; const mult=e.mult||weekdayMultiplier(e.date,e.isHoliday); const {hoursNet}=computeHoursFlexible(e); mh[d.getMonth()]+=hoursNet; tH+=hoursNet; tP+=payFor(hoursNet,mult,s.rate1); }
    q('#r-hours').textContent=fmtNum(tH); q('#r-pay').textContent=Math.round(tP).toLocaleString('th-TH');
    const ctx=q('#r-chart').getContext('2d'); const labels=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; if(chart) chart.destroy();
    chart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'ชั่วโมงโอที',data:mh}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${fmtNum(c.parsed.y)} ชม.`}}},scales:{y:{beginAtZero:true,title:{display:true,text:'ชั่วโมง'}}}}});
  }

  // SETTINGS
  function renderSettings(){
    const s=loadSettings(); q('#s-rate1').value=s.rate1; q('#s-rate15').textContent=(s.rate1*1.5).toFixed(2); q('#s-rate3').textContent=(s.rate1*3).toFixed(2);
    q('#s-save').onclick=()=>{ const rate1=Number(q('#s-rate1').value||0); if(rate1<=0){alert('กรุณาระบุค่า 1x (>0)');return;} saveSettings({rate1}); renderSettings(); renderHome(); alert('บันทึกแล้ว'); };
    q('#s-reset').onclick=()=>{ saveSettings({rate1:62}); renderSettings(); renderHome(); };
    q('#s-export').onclick=()=>{ const payload={settings: loadSettings(), entries: loadEntries()}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ot_backup.json'; a.click(); URL.revokeObjectURL(a.href); };
    q('#s-import').onclick=()=>q('#s-import-file').click();
    q('#s-import-file').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const text=await f.text(); try{ const data=JSON.parse(text); if(data.settings&&data.entries){ saveSettings(data.settings); saveEntries(data.entries); alert('กู้คืนข้อมูลสำเร็จ'); renderHome(); renderEntry(); renderReport(); renderSettings(); } else { alert('ไฟล์ไม่ถูกต้อง'); } }catch(err){ alert('ไม่สามารถอ่านไฟล์: '+err.message); } finally{ e.target.value=''; } };
  }

  // Default
  renderHome();
})();