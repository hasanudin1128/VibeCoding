(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { courts: [], selectedStart: '', booking: null, toastTimer: null };
  const slots = Array.from({length:16},(_,i)=>String(i+7).padStart(2,'0')+':00');
  const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  async function request(url, options={}) {
    const response = await fetch(url, {headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    let data; try { data = await response.json(); } catch { throw new Error('Respons server tidak valid. Pastikan PHP berjalan.'); }
    if (!response.ok || !data.ok) throw new Error(data.message || 'Permintaan gagal.');
    return data;
  }
  function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>el.classList.remove('show'),3500); }
  function selectedCourt() { return state.courts.find(c=>String(c.id)===$('#courtSelect').value); }
  async function loadCourts() {
    try {
      const result=await request('api/courts.php'); state.courts=result.data;
      $('#courtSelect').innerHTML='<option value="">Pilih lapangan</option>'+state.courts.map(c=>`<option value="${c.id}">${esc(c.nama_lapangan)} — ${esc(c.jenis)}</option>`).join('');
      $('#courtGrid').innerHTML=state.courts.map(c=>`<article class="court-card"><div class="court-image"><img src="${esc(c.foto || 'assets/futsal.svg')}" alt="Ilustrasi ${esc(c.nama_lapangan)}" loading="lazy"><span class="court-type">${esc(c.jenis.toUpperCase())}</span><span class="availability">● BOOKING ONLINE</span></div><div class="court-info"><h3>${esc(c.nama_lapangan)}</h3><p>Fasilitas nyaman · Pilih slot sesuai kebutuhan</p><div class="court-card-bottom"><div class="court-price"><strong>${money(c.harga_per_jam)}</strong> <span>/ jam</span></div><button class="mini-book" data-book-court="${c.id}">Pilih lapangan ↗</button></div></div></article>`).join('') || '<p>Belum ada data lapangan. Isi tabel lapangan pada database.</p>';
      $('#courtGrid').querySelectorAll('[data-book-court]').forEach(btn=>btn.addEventListener('click',()=>{ $('#courtSelect').value=btn.dataset.bookCourt; $('#booking').scrollIntoView({behavior:'smooth'}); loadSlots(); updatePrice(); }));
    } catch(e) { $('#courtGrid').innerHTML=`<div class="loading-card">${esc(e.message)} Pastikan database sudah diimpor.</div>`; $('#slotHint').textContent='Database belum terhubung'; }
  }
  async function loadSlots() {
    const court=$('#courtSelect').value, date=$('#bookingDate').value;
    state.selectedStart=''; $('#startTime').value=''; $('#endTime').value=''; updatePrice();
    if(!court || !date) { $('#slotGrid').innerHTML='<div class="slot-placeholder">Pilih lapangan dan tanggal dulu</div>'; $('#slotHint').textContent='Pilih lapangan dan tanggal dulu'; return; }
    if(date<today()) { $('#slotGrid').innerHTML='<div class="slot-placeholder">Tanggal tidak boleh di masa lalu.</div>'; $('#slotHint').textContent='Tanggal tidak valid'; return; }
    $('#slotGrid').innerHTML='<div class="slot-placeholder">Memeriksa ketersediaan...</div>';
    try {
      const result=await request(`api/slots.php?court=${encodeURIComponent(court)}&date=${encodeURIComponent(date)}`);
      const booked=result.data;
      $('#slotGrid').innerHTML=slots.map(start=>{
        const h=Number(start.slice(0,2)), end=String(h+1).padStart(2,'0')+':00';
        const occupied=booked.some(b=>start < b.jam_selesai.slice(0,5) && end > b.jam_mulai.slice(0,5));
        return `<button type="button" class="slot-btn" data-slot="${start}" ${occupied?'disabled title="Sudah dipesan"':''}>${start}</button>`;
      }).join('');
      $('#slotGrid').querySelectorAll('[data-slot]').forEach(btn=>btn.addEventListener('click',()=>selectSlot(btn.dataset.slot)));
      $('#slotHint').textContent='Pilih jam mulai · slot penuh dinonaktifkan';
    } catch(e) { $('#slotGrid').innerHTML=`<div class="slot-placeholder">${esc(e.message)}</div>`; $('#slotHint').textContent='Gagal memuat slot'; }
  }
  function selectSlot(start) {
    const duration=Number($('#duration').value), endHour=Number(start.slice(0,2))+duration;
    if(endHour>23) { $('#formMessage').textContent='Durasi melewati jam operasional (maksimal 23.00).'; return; }
    const buttons=[...$('#slotGrid').querySelectorAll('[data-slot]')];
    const needed=Array.from({length:duration},(_,i)=>String(Number(start.slice(0,2))+i).padStart(2,'0')+':00');
    const unavailable=needed.some(t=>{const b=buttons.find(x=>x.dataset.slot===t);return !b||b.disabled;});
    if(unavailable){$('#formMessage').textContent='Rentang jam tersebut mencakup slot yang sudah terisi. Pilih jam atau durasi lain.';state.selectedStart='';$('#startTime').value='';$('#endTime').value='';updatePrice();return;}
    state.selectedStart=start; $('#startTime').value=start; $('#endTime').value=String(endHour).padStart(2,'0')+':00';
    $('#formMessage').textContent=''; buttons.forEach(b=>b.classList.toggle('selected',needed.includes(b.dataset.slot))); updatePrice();
  }
  function updatePrice() {
    const court=selectedCourt(), duration=Number($('#duration').value)||1;
    $('#totalPrice').textContent=money(court && state.selectedStart ? Number(court.harga_per_jam)*duration : 0);
  }
  function formatDate(date){ if(!date)return '-'; const d=new Date(`${date}T00:00:00`); return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
  function statusTag(status){ const cl=status==='Lunas'?'lunas':status==='Batal'?'batal':'pending';return `<span class="status status-${cl}">${esc(status)}</span>`; }
  async function loadHistory() {
    try {
      const result=await request('api/bookings.php'); const rows=result.data;
      $('#historyBody').innerHTML=rows.length?rows.map(b=>`<tr><td>#SB-${String(b.id).padStart(5,'0')}</td><td>${esc(b.nama_pemesan)}</td><td>${esc(b.nama_lapangan)}</td><td>${formatDate(b.tanggal)}<br><span style="color:#91a3aa">${esc(b.jam_mulai.slice(0,5))}–${esc(b.jam_selesai.slice(0,5))}</span></td><td>${money(b.total_harga)}</td><td>${statusTag(b.status_pembayaran)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Belum ada pemesanan. Booking pertama bisa dimulai sekarang.</td></tr>';
      $('#adminBody').innerHTML=rows.length?rows.map(b=>`<tr><td>#SB-${String(b.id).padStart(5,'0')}<br><span style="color:#91a3aa">${esc(b.nama_pemesan)}</span></td><td>${esc(b.nama_lapangan)}</td><td>${formatDate(b.tanggal)}<br><span style="color:#91a3aa">${esc(b.jam_mulai.slice(0,5))}–${esc(b.jam_selesai.slice(0,5))}</span></td><td>${money(b.total_harga)}</td><td>${statusTag(b.status_pembayaran)}</td><td><div class="admin-actions"><select class="admin-select" aria-label="Status pesanan ${b.id}" data-status-for="${b.id}">${['Pending','Lunas','Batal'].map(s=>`<option ${s===b.status_pembayaran?'selected':''}>${s}</option>`).join('')}</select><button class="admin-update" data-update-status="${b.id}">Simpan</button></div></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Belum ada transaksi.</td></tr>';
      $('#adminBody').querySelectorAll('[data-update-status]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.updateStatus,status=$(`[data-status-for="${id}"]`).value;btn.disabled=true;try{await request('api/admin.php',{method:'PATCH',body:JSON.stringify({id:Number(id),status})});toast('Status pembayaran berhasil diperbarui.');await Promise.all([loadHistory(),loadSlots()]);}catch(e){toast(e.message);}finally{btn.disabled=false;}}));
    } catch(e) { $('#historyBody').innerHTML=`<tr><td colspan="6" class="empty-state">${esc(e.message)}</td></tr>`; $('#adminBody').innerHTML=`<tr><td colspan="6" class="empty-state">${esc(e.message)}</td></tr>`; }
  }
  function showPayment(b) {
    state.booking=b;
    $('#receiptDetails').innerHTML=`<div class="receipt-row"><span>Kode booking</span><strong>#SB-${String(b.id).padStart(5,'0')}</strong></div><div class="receipt-row"><span>Pemesan</span><strong>${esc(b.nama_pemesan)}</strong></div><div class="receipt-row"><span>Lapangan</span><strong>${esc(b.nama_lapangan)}</strong></div><div class="receipt-row"><span>Tanggal</span><strong>${formatDate(b.tanggal)}</strong></div><div class="receipt-row"><span>Waktu</span><strong>${esc(b.jam_mulai.slice(0,5))}–${esc(b.jam_selesai.slice(0,5))}</strong></div><div class="receipt-row"><span>Status</span><strong>${esc(b.status_pembayaran)}</strong></div><div class="receipt-row receipt-total"><span>Total biaya</span><strong>${money(b.total_harga)}</strong></div>`;
    $('#paymentModal').classList.add('open'); $('#paymentModal').setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  }
  function closePayment(){ $('#paymentModal').classList.remove('open'); $('#paymentModal').setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  $('#bookingForm').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget; const btn=$('#submitBooking');
    if(!state.selectedStart){$('#formMessage').textContent='Pilih slot jam mulai terlebih dahulu.';return;}
    if(!form.reportValidity())return;
    const payload=Object.fromEntries(new FormData(form).entries()); payload.jam_mulai=state.selectedStart; payload.jam_selesai=$('#endTime').value;
    btn.disabled=true;btn.textContent='Menyimpan booking...';$('#formMessage').textContent='';
    try { const result=await request('api/bookings.php',{method:'POST',body:JSON.stringify(payload)}); showPayment(result.data); form.reset(); state.selectedStart=''; $('#bookingDate').value=today(); updatePrice(); await Promise.all([loadSlots(),loadHistory()]); toast('Booking tersimpan di database.'); }
    catch(e){$('#formMessage').textContent=e.message; if(e.message.toLowerCase().includes('slot'))loadSlots();}
    finally{btn.disabled=false;btn.innerHTML='Lanjutkan Booking <span>↗</span>';}
  });
  $('#courtSelect').addEventListener('change',()=>{loadSlots();updatePrice();});
  $('#bookingDate').addEventListener('change',loadSlots);
  $('#duration').addEventListener('change',()=>{if(state.selectedStart)selectSlot(state.selectedStart);updatePrice();});
  $('#refreshHistory').addEventListener('click',()=>loadHistory());
  $('#closeModal').addEventListener('click',closePayment);$('#finishPayment').addEventListener('click',()=>{closePayment();$('#riwayat').scrollIntoView({behavior:'smooth'});});
  $('#paymentModal').addEventListener('click',e=>{if(e.target===$('#paymentModal'))closePayment();});
  document.querySelectorAll('[data-method]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-method]').forEach(b=>b.classList.toggle('active',b===btn));const qris=btn.dataset.method==='QRIS';$('#fakePaymentVisual').style.display=qris?'grid':'none';$('#paymentInstruction').textContent=qris?'Gunakan QRIS simulasi ini sebagai ilustrasi. Tidak ada transaksi uang sungguhan.':'Transfer simulasi: Bank SportBook · 0000 1234 5678. Jangan melakukan transfer sungguhan.';}));
  $('#menuToggle').addEventListener('click',()=>{const nav=$('#nav'),open=nav.classList.toggle('open');$('#menuToggle').setAttribute('aria-expanded',String(open));});
  $('#nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#nav').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');}));
  $('#bookingDate').min=today();$('#bookingDate').value=today();
  loadCourts().then(()=>{loadSlots();updatePrice();});loadHistory();
})();
