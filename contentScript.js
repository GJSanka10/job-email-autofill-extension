
// Content script v1.1.2 (robust parsing)
(function(){
  let overlayRoot=null, selectionRect=null, selectionStart=null, currentModal=null;
  let lastCroppedImage=null, lastPageKey=null, lastSentText=null;

  function ensureOverlayRoot() {
    if (overlayRoot && document.body.contains(overlayRoot)) return overlayRoot;
    overlayRoot = document.createElement("div");
    overlayRoot.id = "jea-overlay-root"; overlayRoot.style.pointerEvents = "none";
    document.documentElement.appendChild(overlayRoot); return overlayRoot;
  }
  function removeOverlay(){ if(overlayRoot && overlayRoot.parentNode) overlayRoot.parentNode.removeChild(overlayRoot); overlayRoot=null; selectionRect=null; selectionStart=null; }
  function createSelectionRect(){ const rect = document.createElement("div"); rect.id="jea-selection-rect"; rect.style.pointerEvents="none"; ensureOverlayRoot().appendChild(rect); selectionRect=rect; return rect; }
  function drawSelection(e){ if(!selectionStart || !selectionRect) return; const x=Math.min(selectionStart.x, e.clientX); const y=Math.min(selectionStart.y, e.clientY);
    const w=Math.abs(selectionStart.x-e.clientX); const h=Math.abs(selectionStart.y-e.clientY); Object.assign(selectionRect.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}); }
  function rectFromSelection(){ if(!selectionRect) return null; const r = selectionRect.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height }; }

  function makeModal(title){ if(currentModal) try{currentModal.remove();}catch(e){} const modal=document.createElement('div'); modal.className='jea-modal';
    const header=document.createElement('header'); const h=document.createElement('h3'); h.textContent=title||'Email Draft';
    const close=document.createElement('button'); close.className='jea-close'; close.textContent='×'; close.addEventListener('click', ()=>modal.remove());
    header.appendChild(h); header.appendChild(close); const body=document.createElement('div'); body.className='jea-body';
    modal.appendChild(header); modal.appendChild(body); document.documentElement.appendChild(modal); currentModal=modal; return {modal, body}; }

  function showToast(text){ const toast=document.createElement('div'); toast.className='jea-toast'; toast.textContent = text; document.body.appendChild(toast);
    requestAnimationFrame(()=> toast.classList.add('show')); setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=> toast.remove(), 200); }, 1200); }
  function copyText(s){ try{ navigator.clipboard.writeText(s); showToast('Copied'); }catch(e){} }

  function fieldWithCopy(el){ const wrap=document.createElement('div'); wrap.className='field'; const btn=document.createElement('button'); btn.className='icon-btn'; btn.title='Copy'; btn.textContent='📋'; btn.addEventListener('click', ()=> copyText(el.value || el.textContent || '')); wrap.appendChild(el); wrap.appendChild(btn); return { wrap, btn }; }

  function encodeMailto({to, subject, body}){ const toStr = (to||'').trim(); const params = new URLSearchParams({ subject: subject||'', body: body||'' }); return `mailto:${encodeURIComponent(toStr)}?${params.toString()}`; }

  function parseDraftText(t){
    if (!t) return { heading:'', body:'' };
    t = String(t).replace(/```[\s\S]*?```/g, '').replace(/\r/g,'').trim();
    let heading = '';
    const headMatch = t.match(/(?:^|\n)\s*(Heading|Subject)\s*[:：-]\s*(.+)/i);
    if (headMatch) { heading = headMatch[2].split('\n')[0].trim(); t = t.replace(headMatch[0], '').trim(); }
    t = t.replace(/(?:^|\n)\s*Body\s*[:：-]\s*/i, '').trim();
    if (!heading) {
      const firstLine = t.split('\n').find(line => line.trim().length>0) || '';
      heading = firstLine.trim().slice(0,120);
      if (t.startsWith(firstLine)) t = t.slice(firstLine.length).trimStart();
    }
    return { heading, body: t };
  }

  function renderDraft(textOut, meta){
    const ui = makeModal('Generated Email');
    const parts = parseDraftText(textOut);

    const bar=document.createElement('div'); bar.className='row';
    const sentBadge=document.createElement('div'); sentBadge.className='jea-chip badge-sent'; sentBadge.style.display='none'; sentBadge.textContent='Sent mail ✓';
    const copySent=document.createElement('button'); copySent.className='icon-btn'; copySent.title='Copy sent message'; copySent.textContent='📋'; copySent.style.display='none';
    copySent.addEventListener('click', ()=>{ if (lastSentText) copyText(lastSentText); }); sentBadge.appendChild(copySent);

    const toLabel=document.createElement('div'); toLabel.className='muted'; toLabel.textContent='To';
    const toInput=document.createElement('input'); toInput.placeholder='name@example.com';
    const fwTo = fieldWithCopy(toInput);

    if (meta?.emails && meta.emails.length){ const dl = document.createElement('datalist'); dl.id='jea-emails'; meta.emails.forEach(e => { const o=document.createElement('option'); o.value=e; dl.appendChild(o); });
      toInput.setAttribute('list','jea-emails'); fwTo.wrap.appendChild(dl); toInput.value = meta.emails[0] || ''; }

    const roleRow=document.createElement('div'); roleRow.className='row'; roleRow.style.width='100%';
    const roleLabel=document.createElement('div'); roleLabel.className='muted'; roleLabel.textContent='Position';
    const roleSelect=document.createElement('select'); roleSelect.style.width='100%';
    if (meta?.roles && meta.roles.length){ meta.roles.forEach(r => roleSelect.appendChild(new Option(r, r))); } else { roleSelect.appendChild(new Option('(Not detected)', '')); }
    const fwRole = fieldWithCopy(roleSelect); roleRow.appendChild(roleLabel); roleRow.appendChild(fwRole.wrap);

    const labelH=document.createElement('div'); labelH.textContent='Heading'; labelH.className='muted';
    const inputH=document.createElement('input'); inputH.value=parts.heading; const fwHeading = fieldWithCopy(inputH);

    const labelB=document.createElement('div'); labelB.textContent='Body'; labelB.className='muted'; labelB.style.marginTop='6px';
    const ta=document.createElement('textarea'); ta.rows=12; ta.value=parts.body; const fwBody = fieldWithCopy(ta);

    const actions=document.createElement('div'); actions.className='row';
    const sendBtn=document.createElement('button'); sendBtn.className='jea-btn'; sendBtn.textContent='Send via mail app';
    const copyAll=document.createElement('button'); copyAll.className='jea-btn secondary'; copyAll.textContent='Copy all';
    copyAll.addEventListener('click', ()=>{ const all = `Heading:\n${inputH.value}\n\nBody :\n${ta.value}`; copyText(all); });
    actions.appendChild(sendBtn); actions.appendChild(copyAll);

    sendBtn.onclick=()=>{
      if (!toInput.value.trim()) { showToast('Enter recipient email'); toInput.focus(); return; }
      const url = encodeMailto({ to: toInput.value, subject: inputH.value, body: ta.value }); window.open(url, '_blank');
      lastSentText = `Heading:\n${inputH.value}\n\nBody :\n${ta.value}`; sentBadge.style.display='inline-flex'; copySent.style.display='inline-flex';
      if (lastPageKey) chrome.storage.session.set({ ['sent_'+lastPageKey]: true }); showToast('Opened mail app');
    };

    if (lastPageKey) { chrome.storage.session.get(['sent_'+lastPageKey]).then(v => { if (v && v['sent_'+lastPageKey]) { sentBadge.style.display='inline-flex'; copySent.style.display='inline-flex'; } }); }

    const container=currentModal.querySelector('.jea-body'); const topRow=document.createElement('div'); topRow.className='row'; topRow.style.width='100%'; topRow.appendChild(sentBadge); container.appendChild(topRow);
    container.appendChild(toLabel); container.appendChild(fwTo.wrap); container.appendChild(roleRow);
    container.appendChild(labelH); container.appendChild(fwHeading.wrap); container.appendChild(labelB); container.appendChild(fwBody.wrap); container.appendChild(actions);
  }

  function cropDataURL(fullDataURL, rect, dpr){
    return new Promise((resolve, reject)=>{
      const img=new Image(); img.onload=()=>{ try{ const canvas=document.createElement('canvas'); canvas.width=Math.max(1, Math.round(rect.width*dpr)); canvas.height=Math.max(1, Math.round(rect.height*dpr));
        const ctx=canvas.getContext('2d'); ctx.drawImage(img, Math.round(rect.left*dpr), Math.round(rect.top*dpr), Math.round(rect.width*dpr), Math.round(rect.height*dpr), 0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/png')); }catch(e){ reject(e); } }; img.onerror=reject; img.src = fullDataURL; });
  }

  async function startSelection(){
    removeOverlay(); createSelectionRect();
    function down(e){ selectionStart={x:e.clientX,y:e.clientY}; drawSelection(e); window.addEventListener('mousemove', move, true); window.addEventListener('mouseup', up, true);
      e.preventDefault(); e.stopPropagation(); }
    function move(e){ drawSelection(e); e.preventDefault(); e.stopPropagation(); }
    async function up(e){
      window.removeEventListener('mousemove', move, true); window.removeEventListener('mouseup', up, true);
      const rect=rectFromSelection(); removeOverlay(); document.removeEventListener('mousedown', down, true);
      if (!rect || rect.width<6 || rect.height<6){ return; }
      const dpr = window.devicePixelRatio || 1;
      chrome.runtime.sendMessage({ type:'CAPTURE_TAB' }, async (resp)=>{
        if (!resp || resp.error){ alert(resp?.error || 'Capture failed'); return; }
        try{
          const cropped = await cropDataURL(resp.dataURL, rect, dpr); lastCroppedImage = cropped; lastPageKey = location.origin + location.pathname;
          const ui = makeModal('Generating...'); const msg=document.createElement('div'); msg.className='muted'; msg.textContent='Running OCR & drafting...'; ui.body.appendChild(msg);
          chrome.runtime.sendMessage({ type:'OCR_EMAIL_FROM_IMAGE', imageDataURL: cropped, pageTitle: document.title, pageURL: location.href }, (res1)=>{
            if (!res1 || res1.error){ ui.modal.remove(); alert(res1?.error || 'Draft failed'); return; }
            chrome.runtime.sendMessage({ type:'OCR_EXTRACT_METADATA', imageDataURL: cropped, pageTitle: document.title, pageURL: location.href }, (metaRes)=>{
              ui.modal.remove(); const meta = (metaRes && !metaRes.error) ? metaRes : { emails:[], roles:[] }; renderDraft(res1.output, meta);
            });
          });
        }catch(err){ alert('Cropping failed: '+(err?.message || err)); }
      });
      e.preventDefault(); e.stopPropagation();
    }
    document.addEventListener('mousedown', down, true);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{ if (msg?.type === 'START_SELECTION') { startSelection(); sendResponse({ok:true}); } });
})();
