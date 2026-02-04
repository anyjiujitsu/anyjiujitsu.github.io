// filters105.js — Search v2
// - Case-insensitive
// - Punctuation trimmed
// - Comma-separated terms are ANDed (intersection): "2025, comp" => must match BOTH
// - View A (Events) additionally matches group labels like "November 2025" derived from DATE

function norm(s){
  return String(s ?? "")
    .toLowerCase()
    // keep commas for splitting; remove other punctuation
    .replace(/[^\p{L}\p{N}\s,]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clauses(q){
  return norm(q)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function includesAllWords(hay, needle){
  // needle may include spaces; require all words to be present (AND within clause)
  const words = norm(needle).split(" ").filter(Boolean);
  if(!words.length) return true;
  const h = norm(hay);
  return words.every(w => h.includes(w));
}

function monthYearLabel(dateStr){
  const str = String(dateStr ?? "").trim();
  if(!str) return "";
  // Prefer MM/DD/YYYY (or M/D/YYYY) to avoid locale issues
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  let d = null;
  if(m){
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yy = Number(m[3]);
    d = new Date(yy, mm-1, dd);
  } else {
    const tmp = new Date(str);
    d = isNaN(tmp) ? null : tmp;
  }
  if(!d || isNaN(d)) return "";
  return d.toLocaleString("en-US", { month: "long", year: "numeric" }).toLowerCase();
}

// ------------------ INDEX ------------------
export function filterDirectory(rows, state){
  let out = rows;
  // OPENS pill (Index view) — multi-select: ALL | SATURDAY | SUNDAY
  const opensSel = state?.index?.opens;
  if(opensSel && opensSel.size){
    const wantAll = opensSel.has("ALL");
    const wantSat = opensSel.has("SATURDAY");
    const wantSun = opensSel.has("SUNDAY");

    // If ALL is selected (alone or with others), treat as "Sat OR Sun"
    if(wantAll){
      out = out.filter(r => (r.SAT && String(r.SAT).trim()) || (r.SUN && String(r.SUN).trim()));
    } else {
      // Otherwise, if multiple days selected, treat as OR across selected days.
      out = out.filter(r => {
        const hasSat = (r.SAT && String(r.SAT).trim());
        const hasSun = (r.SUN && String(r.SUN).trim());
        return (wantSat && hasSat) || (wantSun && hasSun);
      });
    }
  }



    // GUESTS pill (Index view) — "GUESTS WELCOME" means OTA === "Y"
  const guestsSel = state?.index?.guests;
  if(guestsSel && guestsSel.size){
    // Only one option right now, but keep Set semantics for [FILTER STRUCTURE]
    out = out.filter(r => String(r.OTA ?? "").trim().toUpperCase() === "Y");
  }

// STATE pill (Index view)
  const statesSel = state?.index?.states;
  if(statesSel && statesSel.size){
    out = out.filter(r => statesSel.has(String(r.STATE ?? "").trim()));
  }

  // Search query
  const cs = clauses(state.index.q);
  if(!cs.length) return out;

  return out.filter(r=>{
    return cs.every(c=>{
      // Special tokens (each clause can be a token or a normal text clause)
      if(c === "sat" || c === "saturday") return !!(r.SAT && String(r.SAT).trim());
      if(c === "sun" || c === "sunday") return !!(r.SUN && String(r.SUN).trim());
      if(c === "open mat") return !!((r.SAT && String(r.SAT).trim()) || (r.SUN && String(r.SUN).trim()));

      const hay = r.searchText ?? `${r.STATE} ${r.CITY} ${r.NAME} ${r.IG} ${r.SAT} ${r.SUN} ${r.OTA}`;
      return includesAllWords(hay, c);
    });
  });
}


function eventYear(row){
  const y = String(row?.YEAR ?? "").trim();
  if(y) return y;
  const d = String(row?.DATE ?? "").trim();
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m) return m[3];
  const tmp = new Date(d);
  if(!isNaN(tmp)) return String(tmp.getFullYear());
  return "";
}

// ------------------ EVENTS ------------------
export function filterEvents(rows, state){
  let out = rows;

  // YEAR pill (multi-select)
  const years = state?.events?.year;
  if(years && years.size){
    out = out.filter(r => years.has(eventYear(r)));
  }

  const statesSel = state?.events?.state;
  if(statesSel && statesSel.size){
    out = out.filter(r => statesSel.has(String(r.STATE ?? "").trim()));
  }

  const typesSel = state?.events?.type;
  if(typesSel && typesSel.size){
    out = out.filter(r => typesSel.has(String(r.TYPE ?? "").trim()));
  }

  // Search query
  const cs = clauses(state.events.q);
  if(!cs.length) return out;

  return out.filter(r=>{
    const group = monthYearLabel(r.DATE);
    const base = r.searchText ?? `${r.YEAR} ${r.STATE} ${r.CITY} ${r.GYM} ${r.TYPE} ${r.DATE}`;
    const hay = `${base} ${group}`;
    return cs.every(c => includesAllWords(hay, c));
  });
}
