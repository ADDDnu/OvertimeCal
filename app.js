/* OT Calculator App (LocalStorage) */
(function(){
  const LS_ENTRIES = 'ot_entries_v1';
  const LS_SETTINGS = 'ot_settings_v1';

  // --- Utilities ---
  const pad2 = n => String(n).padStart(2,'0');
  const fmtMoney = v => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(v||0).replace('THB','฿').trim();
  const fmtNum = v => (Math.round((v||0)*100)/100).toFixed(2);

  const today = new Date();
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth(); // 0..11

  const q = sel => document.querySelector(sel);
  const qa = sel => Array.from(document.querySelectorAll(sel));

  function loadEntries(){
    try{
      return JSON.parse(localStorage.getItem(LS_ENTRIES))||[];
    }catch(e){ return []; }
  }
  function saveEntries(arr){
    localStorage.setItem(LS_ENTRIES, JSON.stringify(arr));
  }
  function loadSettings(){
    let s = { rate1: 62 };
    try{
      const got = JSON.parse(localStorage.getItem(LS_SETTINGS));
      if(got) s = Object.assign(s, got);
    }catch(e){}
    return s;
  }
  function saveSettings(s){
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }

  function parseTimeStr(t){ // "HH:MM" -> minutes
    const [H,M] = t.split(':').map(Number);
    return H*60 + M;
  }

  function computeHours(dateISO, tStart, tEnd){
    // returns {hoursRaw, hoursNet, breakApplied}
    // If any portion crosses >=16:00 on same day, subtract 0.5h once.
    const mStart = parseTimeStr(tStart);
    const mEnd = parseTimeStr(tEnd);
    let totalMin = mEnd - mStart;
    if(totalMin < 0) totalMin += 24*60; // allow crossing midnight
    let breakApplied = false;

    // Determine if segment reaches 16:00 of the start day
    // Consider range modulo 24h starting at mStart
    const CUT = 16*60;
    // For simplicity: if either start<16:00 and end>=16:00 (same-day), or
    // if start>=16:00 (entirely after), or if crosses midnight but any
    // portion after 16:00 on either day -> apply once.
    // We'll apply if (mStart < CUT && mEnd >= CUT) || (mStart >= CUT) || (mStart > mEnd && (CUT >= 0))
    const crossesSameDay = (mStart <= CUT && mEnd > CUT && mEnd > mStart);
    const allAfter = (mStart >= CUT);
    const crossesMidnight = (mEnd < mStart);
    const hasAfterWhenCrossMid = crossesMidnight && (mStart >= CUT || (CUT < mEnd)); // ends next day after midnight, if end past 00:00 before CUT, still previous day had after 16:00

    if(totalMin >= 30 && (crossesSameDay || allAfter || hasAfterWhenCrossMid)){
      totalMin -= 30;
      breakApplied = true;
    }
    return { hoursRaw: totalMin/60 + (breakApplied?0.5:0), hoursNet: totalMin/60, breakApplied };
  }

  function weekdayMultiplier(dateISO){
    const d = new Date(dateISO + "T00:00:00");
    const day = d.getDay(); // 0=Sun,6=Sat
    if(day===0 || day===6) return 1.0; // Weekend
    return 1.5; // Weekday
  }

  function payFor(hours, mult, rate1){
    const r = (mult===1? rate1 : mult===1.5? rate1*1.5 : mult===3? rate1*3 : rate1*mult);
    return hours * r;
  }

  function computeHoursFlexible(entry){
    // If entry has explicit noCut flag (true => DO NOT cut 30 min, false => cut 30 if >=30)
    if(Object.prototype.hasOwnProperty.call(entry,'noCut')){
      const mStart = parseTimeStr(entry.start);
      const mEnd = parseTimeStr(entry.end);
      let totalMin = mEnd - mStart;
      if(totalMin < 0) totalMin += 24*60; // allow crossing midnight
      if(!entry.noCut && totalMin >= 30) totalMin -= 30;
      return { hoursNet: totalMin/60 };
    }
    // Fallback to legacy behavior
    const {hoursNet} = computeHours(entry.date, entry.start, entry.end);
    return { hoursNet };
  }


  // --- DOM setup ---
  qa('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      qa('.tab-btn').forEach(b=>b.classList.remove('active'));
      qa('main section').forEach(s=>s.classList.remove('active'));
      btn.classList.add('active');
      q('#'+btn.dataset.tab).classList.add('active');
      if(btn.dataset.tab==='home') renderHome();
      if(btn.dataset.tab==='entry') renderEntry();
      if(btn.dataset.tab==='report') renderReport();
      if(btn.dataset.tab==='settings') renderSettings();
    });
  });

  // --- Home ---

    // --- Calendar (Home) ---
    function renderHomeCalendar(monthEntries){
      const cal = q('#home-calendar'); if(!cal) return;
      cal.innerHTML = '';
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const first = new Date(year, month, 1);
      const startDay = (first.getDay()+7)%7; // Sunday start
      const daysInMonth = new Date(year, month+1, 0).getDate();
      const monthName = new Date(year, month, 1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});
      const calMonthLabel = q('#cal-month'); if(calMonthLabel) calMonthLabel.textContent = monthName;

      // weekday header
      const names = ['อา','จ','อ','พ','พฤ','ศ','ส'];
      for(const n of names){
        const h = document.createElement('div'); h.className='wday'; h.textContent=n; cal.appendChild(h);
      }

      // empty cells before first day
      for(let i=0;i<startDay;i++){ const c=document.createElement('div'); c.className='cell empty'; cal.appendChild(c); }

      // aggregate hours per day
      const perDay = {};
      for(const e of monthEntries){
        const d = new Date(e.date+'T00:00:00');
        const dd = d.getDate();
        const {hoursNet} = computeHoursFlexible(e);
        perDay[dd] = (perDay[dd]||0) + hoursNet;
      }

      for(let d=1; d<=daysInMonth; d++){
        const c = document.createElement('div'); c.className='cell';
        if(d===today.getDate()) c.classList.add('today');
        const dn = document.createElement('div'); dn.className='d'; dn.textContent = d;
        const hv = document.createElement('div'); hv.className='h'; hv.textContent = 'OT ' + (Math.round((perDay[d]||0)*100)/100).toFixed(2) + ' ชม.';
        c.appendChild(dn); c.appendChild(hv);
        cal.appendChild(c);
      }
    }

  function renderHome(){
    const entries = loadEntries();
    const settings = loadSettings();
    // set month label
    const mLabel = new Date(nowYear, nowMonth, 1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    q('#home-month').textContent = mLabel;
    q('#home-rate1').textContent = fmtNum(settings.rate1);
    q('#home-rate15').textContent = fmtNum(settings.rate1*1.5);
    q('#home-rate3').textContent = fmtNum(settings.rate1*3);

    // filter current month
    const monthEntries = entries.filter(e=>{
      const d = new Date(e.date+"T00:00:00");
      return d.getFullYear()==nowYear && d.getMonth()==nowMonth;
    });

    // build table
    const tb = q('#home-table tbody');
    tb.innerHTML='';
    let totalHours=0, totalPay=0, h1=0,h15=0,h3=0;
    monthEntries.sort((a,b)=> (a.date+a.start).localeCompare(b.date+b.start));
    for(const e of monthEntries){
      const mult = e.mult || weekdayMultiplier(e.date);
      const {hoursNet} = computeHoursFlexible(e);
      const pay = payFor(hoursNet, mult, settings.rate1);
      totalHours += hoursNet;
      totalPay += pay;
      if(mult==1) h1+=hoursNet; else if(mult==1.5) h15+=hoursNet; else if(mult==3) h3+=hoursNet;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(e.date).toLocaleDateString('th-TH')}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
        <td>${fmtNum(hoursNet)}</td>
        <td>${mult}x</td>
        <td class="nowrap">${fmtMoney(pay)}</td>
        <td><button class="btn ghost btnDel" data-id="${e.id}">ลบ</button></td>
      `;
      tb.appendChild(tr);
    }
    q('#home-hours-total').textContent = fmtNum(totalHours)+' h';
    q('#home-pay-total').textContent = fmtMoney(totalPay);
    q('#home-hours-1').textContent = fmtNum(h1);
    q('#home-hours-15').textContent = fmtNum(h15);
    q('#home-hours-3').textContent = fmtNum(h3);

    renderHomeCalendar(monthEntries);

    tb.querySelectorAll('.btnDel').forEach(b=> b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      const arr = loadEntries().filter(x=> String(x.id)!==String(id));
      saveEntries(arr);
      renderHome(); // refresh
    }));

    // quick add setup
    q('#btnAddQuick').onclick = ()=>{
      // switch to entry tab and prefill today
      document.querySelector('.tab-btn[data-tab="entry"]').click();
      const d = new Date();
      q('#e-date').value = d.toISOString().slice(0,10);
      q('#e-start').value = '16:00';
      q('#e-end').value = '20:00';
      q('#e-note').value = '';
      q('#e-mult').value = '';
    };
  }

  // --- Entry ---
  function renderEntry(){
    // default today if empty
    if(!q('#e-date').value){
      q('#e-date').value = new Date().toISOString().slice(0,10);
    }
    // table
    drawEntryTable();
    // hooks
    q('#e-save').onclick = saveEntryFromForm;
    q('#e-clear').onclick = ()=>{
      q('#e-start').value='';
      q('#e-end').value='';
      q('#e-mult').value='';
      q('#e-note').value='';
    };
    q('#btnExport').onclick = exportEntries;
    q('#btnImport').onclick = ()=> q('#fileImport').click();
    q('#fileImport').onchange = importEntries;
    q('#search').oninput = drawEntryTable;
  }

  function saveEntryFromForm(){
    const date = q('#e-date').value;
    const start = q('#e-start').value;
    const end = q('#e-end').value;
    const multStr = q('#e-mult').value;
    const noCut = q('#e-no-cut') ? q('#e-no-cut').checked : false;
    const note = q('#e-note').value.trim();
    if(!date || !start || !end){
      alert('กรุณากรอกวันที่/เวลาให้ครบ');
      return;
    }
    const mult = multStr? Number(multStr): null;

    const entries = loadEntries();
    const id = Date.now();
    entries.push({ id, date, start, end, mult, note, noCut });
    saveEntries(entries);
    drawEntryTable();
    // clear form after save
    q('#e-start').value='';
    q('#e-end').value='';
    if(q('#e-mult')) q('#e-mult').value='';
    if(q('#e-no-cut')) q('#e-no-cut').checked=false;
    q('#e-note').value='';
    alert('บันทึกสำเร็จ');
  }

  function exportEntries(){
    const blob = new Blob([JSON.stringify(loadEntries(),null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ot_entries_backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importEntries(e){
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    try{
      const arr = JSON.parse(text);
      if(!Array.isArray(arr)) throw new Error('ไฟล์ไม่ถูกต้อง');
      saveEntries(arr);
      drawEntryTable();
      alert('นำเข้าสำเร็จ');
    }catch(err){
      alert('ไม่สามารถอ่านไฟล์: '+err.message);
    }finally{
      e.target.value = '';
    }
  }

  function drawEntryTable(){
    const entries = loadEntries();
    const settings = loadSettings();
    const tb = q('#entry-table tbody');
    tb.innerHTML='';
    const kw = q('#search').value?.toLowerCase()||'';
    const filtered = entries.filter(e => (e.note||'').toLowerCase().includes(kw));
    filtered.sort((a,b)=> (a.date+a.start).localeCompare(b.date+b.start));
    for(const e of filtered){
      const mult = e.mult || weekdayMultiplier(e.date);
      const {hoursNet} = computeHoursFlexible(e);
      const pay = payFor(hoursNet, mult, settings.rate1);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(e.date).toLocaleDateString('th-TH')}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
        <td>${fmtNum(hoursNet)}</td>
        <td>${mult}x</td>
        <td class="nowrap">${fmtMoney(pay)}</td>
        <td>${e.note||''}</td>
        <td><button class="btn ghost btnDel" data-id="${e.id}">ลบ</button></td>
      `;
      tb.appendChild(tr);
    }
    renderHomeCalendar(monthEntries);

    tb.querySelectorAll('.btnDel').forEach(b=> b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      const arr = loadEntries().filter(x=> String(x.id)!==String(id));
      saveEntries(arr);
      drawEntryTable();
    }));
  }

  // --- Report ---
  let chart;
  function renderReport(){
    // year dropdown
    const ys = q('#r-year');
    ys.innerHTML='';
    const entries = loadEntries();
    const years = new Set(entries.map(e=> new Date(e.date).getFullYear()));
    const now = new Date().getFullYear();
    years.add(now);
    const sorted = Array.from(years).sort((a,b)=>b-a);
    for(const y of sorted){
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      ys.appendChild(opt);
    }
    q('#r-year').value = String(now);
    q('#r-refresh').onclick = drawReport;
    drawReport();
  }

  function drawReport(){
    const year = Number(q('#r-year').value);
    q('#r-year-label').textContent = year;
    const entries = loadEntries();
    const settings = loadSettings();
    const monthHours = Array(12).fill(0);
    let totalH = 0;
    let totalPay = 0;
    for(const e of entries){
      const d = new Date(e.date+"T00:00:00");
      if(d.getFullYear()!==year) continue;
      const mult = e.mult || weekdayMultiplier(e.date);
      const {hoursNet} = computeHoursFlexible(e);
      monthHours[d.getMonth()] += hoursNet;
      totalH += hoursNet;
      totalPay += payFor(hoursNet, mult, settings.rate1);
    }
    q('#r-hours').textContent = fmtNum(totalH);
    q('#r-pay').textContent = Math.round(totalPay).toLocaleString('th-TH');

    const ctx = q('#r-chart').getContext('2d');
    const labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    if(chart){ chart.destroy(); }
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'ชั่วโมงโอที', data: monthHours }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx)=> `${fmtNum(ctx.parsed.y)} ชม.` } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'ชั่วโมง' } }
        }
      }
    });
  }

  // --- Settings ---
  function renderSettings(){
    const s = loadSettings();
    q('#s-rate1').value = s.rate1;
    q('#s-rate15').textContent = (s.rate1*1.5).toFixed(2);
    q('#s-rate3').textContent = (s.rate1*3).toFixed(2);
    q('#s-save').onclick = ()=>{
      const rate1 = Number(q('#s-rate1').value||0);
      if(rate1<=0){ alert('กรุณาระบุค่า 1x (>0)'); return; }
      saveSettings({rate1});
      renderSettings();
      renderHome();
      alert('บันทึกแล้ว');
    };
    q('#s-reset').onclick = ()=>{
      saveSettings({rate1:62});
      renderSettings();
      renderHome();
    };

    // backup
    q('#s-export').onclick = ()=>{
      const payload = { settings: loadSettings(), entries: loadEntries() };
      const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ot_backup.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
    q('#s-import').onclick = ()=> q('#s-import-file').click();
    q('#s-import-file').onchange = async e=>{
      const file = e.target.files[0];
      if(!file) return;
      const text = await file.text();
      try{
        const data = JSON.parse(text);
        if(data.settings && data.entries){
          saveSettings(data.settings);
          saveEntries(data.entries);
          alert('กู้คืนข้อมูลสำเร็จ');
          renderHome(); renderEntry(); renderReport(); renderSettings();
        }else{
          alert('ไฟล์ไม่ถูกต้อง');
        }
      }catch(err){
        alert('ไม่สามารถอ่านไฟล์: '+err.message);
      }finally{
        e.target.value='';
      }
    };
  }

  // init first render
  renderHome();

})();