export const state = {
  view: "events",

  index: {
    q: "",
    states: new Set(),
    opens: new Set(),
    openMat: "",
    guests: new Set(),
  },

  // View A (Events)
  events: {
    q: "",
    year: new Set(),
    state: new Set(),
    type: new Set(),
  },
};

export function setView(v){
  state.view = "events";
}

export function setIndexQuery(q){ state.index.q = String(q ?? ""); }
export function setEventsQuery(q){ state.events.q = String(q ?? ""); }

export function hasIndexSelections(){
  return state.index.q.trim().length > 0 ||
    state.index.states.size > 0 ||
    state.index.opens.size > 0 ||
    state.index.guests.size > 0;
}

export function hasEventsSelections(){
  return state.events.q.trim().length > 0 ||
    state.events.year.size > 0 ||
    state.events.state.size > 0 ||
    state.events.type.size > 0;
}
