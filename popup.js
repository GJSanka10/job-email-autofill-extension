
async function startSelection() {
  const status = document.getElementById("status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { status.textContent = "No active tab."; return; }

    const sendStart = () => new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "START_SELECTION" }, (resp) => {
        if (chrome.runtime.lastError) return resolve({ ok: false });
        resolve({ ok: !!(resp && resp.ok) });
      });
    });

    let first = await sendStart();
    if (first.ok) { status.textContent = "Drag to select on the page."; window.close(); return; }

    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["overlay.css"] }).catch(()=>{});
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["contentScript.js"] });

    let second = await sendStart();
    if (second.ok) { status.textContent = "Drag to select on the page."; window.close(); return; }

    status.textContent = "Cannot start selection here. Try another site or reload.";
  } catch (e) { status.textContent = "Error: " + (e?.message || e); }
}
document.getElementById("start").addEventListener("click", startSelection);
