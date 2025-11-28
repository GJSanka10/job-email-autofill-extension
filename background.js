

// async function callOpenRouter(messages) {
//   if (!API_KEY || API_KEY.startsWith("PASTE_")) {
//     throw new Error("API key missing in background.js. Edit background.js and set API_KEY.");
//   }
//   const res = await fetch(OPENROUTER_URL, {
//     method: "POST",
//     headers: {
//       "Authorization": `Bearer ${API_KEY}`,
//       "Content-Type": "application/json",
//       "HTTP-Referer": "https://example.local/extension",
//       "X-Title": "Job Email Autofill (Vision)",
//       "X-App-Id": "extention-prodmail-7b2f15128"
//     },
//     body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 600 })
//   });
//   if (!res.ok) { const t = await res.text().catch(()=>String(res.status)); throw new Error(`OpenRouter error: ${res.status} ${res.statusText} • ${t}`); }
//   const data = await res.json(); return data?.choices?.[0]?.message?.content || "";
// }

// async function generateDraft(imageDataURL, roleOverride){
//   const textParts = [
//     "You are a precise OCR+reasoning assistant for job applications.",
//     "Read the attached screenshot and produce a concise email draft in EXACTLY this format:",
//     "",
//     "Heading:",
//     "<one line subject>",
//     "",
//     "Body :",
//     "<2-6 short paragraphs, professional tone, mention the role/company if visible, and say a CV is attached. Do not invent facts or emails.>",
//     "",
//     "Rules:",
//     "- If you cannot confidently read the screenshot, say 'Heading:' then 'Body :' with a brief apology and ask for a clearer capture.",
//     "- Never output JSON or markdown fences.",
//     "- No hallucinations; only use what is in the image or safely generic phrasing."
//   ];
//   if (roleOverride && String(roleOverride).trim()) { textParts.push("", "User-selected role to target: " + String(roleOverride).trim()); }
//   const messages=[{ role:"user", content:[ {type:"text", text: textParts.join("\n")}, {type:"image_url", image_url:{url:imageDataURL}} ] }];
//   return callOpenRouter(messages);
// }

// async function extractMetadata(imageDataURL){
//   const messages=[{ role:"user", content:[
//     {type:"text", text: "From the screenshot, list any job position titles (roles) and any email addresses that appear. Output strict JSON with keys exactly: {\"roles\": string[], \"emails\": string[]}. Rules: only include texts you can clearly read. No guessing or fabrication."},
//     {type:"image_url", image_url:{url:imageDataURL}}
//   ]}];
//   const out = await callOpenRouter(messages);
//   try {
//     const jsonMatch = out.match(/\{[\s\S]*\}/);
//     const obj = JSON.parse(jsonMatch ? jsonMatch[0] : out);
//     return { roles: Array.isArray(obj.roles) ? obj.roles.filter(s => typeof s === "string").slice(0,10) : [],
//              emails: Array.isArray(obj.emails) ? obj.emails.filter(s => typeof s === "string").slice(0,5) : [] };
//   } catch(e) { return { roles: [], emails: [] }; }
// }

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message?.type === "CAPTURE_TAB") {
//     (async () => { try { const dataURL = await chrome.tabs.captureVisibleTab(null, { format: "png" }); sendResponse({ dataURL }); }
//       catch (e) { sendResponse({ error: e.message || String(e) }); } })(); return true;
//   }
//   if (message?.type === "OCR_EMAIL_FROM_IMAGE") {
//     (async () => { try { const out = await generateDraft(message.imageDataURL, message.roleOverride); sendResponse({ output: String(out || "").trim() }); }
//       catch (e) { sendResponse({ error: e.message || String(e) }); } })(); return true;
//   }
//   if (message?.type === "OCR_EXTRACT_METADATA") {
//     (async () => { try { const meta = await extractMetadata(message.imageDataURL); sendResponse(meta); }
//       catch (e) { sendResponse({ error: e.message || String(e) }); } })(); return true;
//   }
// });


// background.js — Worker proxy version (no secrets in client)
const OPENROUTER_URL = "https://openrouter-proxy.gjsanka11.workers.dev/chat";
const MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

async function callOpenRouter(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      // DO NOT add Authorization here — the Worker holds your secret.
      "Content-Type": "application/json",
      "HTTP-Referer": "https://example.local/extension",
      "X-Title": "Job Email Autofill (Vision)",
      // must match your Worker secret ALLOWED_APP_ID
      "X-App-Id": ""
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 600 })
  });
  if (!res.ok) throw new Error(`Proxy error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function generateDraft(imageDataURL, roleOverride){
  const textParts = [
    "You are a precise OCR+reasoning assistant for job applications.",
    "Read the attached screenshot and produce a concise email draft in EXACTLY this format:",
    "",
    "Heading:",
    "<one line subject>",
    "",
    "Body :",
    "<2-6 short paragraphs, professional tone, mention the role/company if visible, and say a CV is attached. Do not invent facts or emails.>",
    "",
    "Rules:",
    "- If you cannot confidently read the screenshot, say 'Heading:' then 'Body :' with a brief apology and ask for a clearer capture.",
    "- Never output JSON or markdown fences.",
    "- No hallucinations; only use what is in the image or safely generic phrasing."
  ];
  if (roleOverride && String(roleOverride).trim()) {
    textParts.push("", "User-selected role to target: " + String(roleOverride).trim());
  }
  const messages=[{
    role:"user",
    content:[ {type:"text", text: textParts.join("\n")}, {type:"image_url", image_url:{url:imageDataURL}} ]
  }];
  return callOpenRouter(messages);
}

async function extractMetadata(imageDataURL){
  const messages=[{
    role:"user",
    content:[
      {type:"text", text: [
        "From the screenshot, list any job position titles (roles) and any email addresses that appear.",
        "Output strict JSON with keys exactly: {\"roles\": string[], \"emails\": string[]}",
        "Rules: only include texts you can clearly read. No guessing or fabrication."
      ].join("\n")},
      {type:"image_url", image_url:{url:imageDataURL}}
    ]
  }];
  const out = await callOpenRouter(messages);
  try {
    const jsonMatch = out.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(jsonMatch ? jsonMatch[0] : out);
    return {
      roles: Array.isArray(obj.roles) ? obj.roles.filter(s => typeof s === "string").slice(0,10) : [],
      emails: Array.isArray(obj.emails) ? obj.emails.filter(s => typeof s === "string").slice(0,5) : []
    };
  } catch {
    return { roles: [], emails: [] };
  }
}

// Leave the message handlers exactly as you had them
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CAPTURE_TAB") {
    (async () => {
      try { const dataURL = await chrome.tabs.captureVisibleTab(null, { format: "png" }); sendResponse({ dataURL }); }
      catch (e) { sendResponse({ error: e.message || String(e) }); }
    })();
    return true;
  }
  if (message?.type === "OCR_EMAIL_FROM_IMAGE") {
    (async () => {
      try { const out = await generateDraft(message.imageDataURL, message.roleOverride); sendResponse({ output: String(out || "").trim() }); }
      catch (e) { sendResponse({ error: e.message || String(e) }); }
    })();
    return true;
  }
  if (message?.type === "OCR_EXTRACT_METADATA") {
    (async () => {
      try { const meta = await extractMetadata(message.imageDataURL); sendResponse(meta); }
      catch (e) { sendResponse({ error: e.message || String(e) }); }
    })();
    return true;
  }
});
