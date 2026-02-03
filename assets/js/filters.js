function norm(s){
  return String(s ?? "")
    .toLowerCase()
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
  const words = norm(needle).split(" ").filter(Boolean);
  if(!words.length) return true;
  const h = norm(hay);
  return words.every(w => h.includes(w));
}

function parseEventDate(str){
  const s = String(str ?? "").trim();
  if(!s) return null;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yy = Number(m[3]);
    const d = new Date(yy, mm-1, dd);
    return isNaN(d) ? null : d;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(m){
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yy = 2000 + Number(m[3]);
    const d = new Date(yy, mm-1, dd);
    return isNaN(d) ? null : d;
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m){
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(yy, mm-1, dd);
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function createdDateFromRow(row){
  const createdRaw = String(row?.CREATED ?? "").trim();
  if(!createdRaw) return null;

  const ms = Date.parse(createdRaw);
  if(!Number.isNaN(ms)) return new Date(ms);

  try{ return parseEventDate(createdRaw); }catch(e){ return null; }
}

function isRowNew(row){
  const d = createdDateFromRow(row);
  if(!d) return false;

  const now = new Date();
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  mid.setDate(mid.getDate() - 4);
  return d >= mid;
}

function extractNewEventsToken(q){
  const raw = String(q ?? "");
  const n = norm(raw);
  const wantsNew = n.includes("new events");
  if(!wantsNew) return { wantsNew:false, remaining: raw };

  const remainingNorm = n
    .replace(/\bnew\s+events\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { wantsNew:true, remaining: remainingNorm };
}

function monthYearLabel(dateStr){
  const str = String(dateStr ?? "").trim();
  if(!str) return "";
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

export function filterDirectory(rows, state){
  let out = rows;
  const opensSel = state?.index?.opens;
  if(opensSel && opensSel.size){
    const wantAll = opensSel.has("ALL");
    const wantSat = opensSel.has("SATURDAY");
    const wantSun = opensSel.has("SUNDAY");

    if(wantAll){
      out = out.filter(r => (r.SAT && String(r.SAT).trim()) || (r.SUN && String(r.SUN).trim()));
    } else {
      out = out.filter(r => {
        const hasSat = (r.SAT && String(r.SAT).trim());
        const hasSun = (r.SUN && String(r.SUN).trim());
        return (wantSat && hasSat) || (wantSun && hasSun);
      });
    }
  }

  const guestsSel = state?.index?.guests;
  if(guestsSel && guestsSel.size){
    out = out.filter(r => String(r.OTA ?? "").trim().toUpperCase() === "Y");
  }

  const statesSel = state?.index?.states;
  if(statesSel && statesSel.size){
    out = out.filter(r => statesSel.has(String(r.STATE ?? "").trim()));
  }

  const cs = clauses(state.index.q);
  if(!cs.length) return out;

  return out.filter(r=>{
    return cs.every(c=>{
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

export function filterEvents(rows, state){
  let out = rows;

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

  const token = extractNewEventsToken(state.events.q);
  const cs = clauses(token.remaining);
  const wantsNew = token.wantsNew;

  if(!cs.length && !wantsNew) return out;

  return out.filter(r=>{
    if(wantsNew && !isRowNew(r)) return false;

    if(!cs.length) return true;

    const group = monthYearLabel(r.DATE);
    const base = r.searchText ?? `${r.YEAR} ${r.STATE} ${r.CITY} ${r.GYM} ${r.TYPE} ${r.DATE}`;
    const hay = `${base} ${group}`;
    return cs.every(c => includesAllWords(hay, c));
  });
}
