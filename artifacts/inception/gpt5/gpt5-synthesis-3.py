# Contextual collapse policies: choose metaphor branches based on recent narrative features
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple
from copy import deepcopy
import time, uuid
import pandas as pd
import pprint

# from caas_jupyter_tools import display_dataframe_to_user
def display_dataframe_to_user(title: str, df: pd.DataFrame):
    pprint.pprint(df.to_markdown(index=False))

# --- Minimal hybrid node/workbench reused for this demo ---
@dataclass
class Node:
    id: str
    type: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    semantics: List[str] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)

class HybridWB:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
    def create_node(self, type: str, id: Optional[str] = None):
        if id is None: id = f"n_{uuid.uuid4().hex[:6]}"
        self.nodes[id] = Node(id=id, type=type)
        return id
    def set_attr(self, path: str, value: Any, *, source="set", meaning: Optional[str]=None):
        ent, key = path.split(".",1)
        n = self.nodes[ent]
        old = n.attrs.get(key)
        n.attrs[key] = value
        n.history.append({"path":path,"from":old,"to":value,"source":source,"when":time.time(),"meaning":meaning})
        if meaning: n.semantics.append(meaning)
    def val(self, path: str):
        ent, key = path.split(".",1)
        return self.nodes[ent].attrs.get(key)
    def story(self, node_id: str) -> List[str]:
        return [f"{h.get('meaning') or 'Updated'}: {h['from']} → {h['to']} (via {h['source']})" for h in self.nodes[node_id].history]

# --- Metaphor forking from prior step (simplified) ---
def fork_metaphors(wb: HybridWB, source_path: str, target_path: str, context: List[str]):
    source_val = wb.val(source_path)
    ent, key = target_path.split(".",1)
    n = wb.nodes[ent]
    if "branches" not in n.attrs: n.attrs["branches"] = {}
    if key not in n.attrs["branches"]: n.attrs["branches"][key] = []
    def add_branch(name, metaphor, transform, confidence):
        val = transform(source_val)
        entry = {"name":name,"value":val,"metaphor":metaphor,"confidence":confidence,"context":context.copy(),"when":time.time()}
        n.attrs["branches"][key].append(entry)
        n.history.append({"path":target_path,"from":None,"to":val,"source":f"fork:{name}","when":entry["when"],"meaning":metaphor})
        n.semantics.append(metaphor)
    ctx = set(context)
    if "betrayal" in ctx:
        add_branch("pessimistic","Trust crumbles; each crack weakens the whole", lambda v: v*0.3, 0.7)
        add_branch("resilient","Trust bends but doesn't break; scars make it wiser", lambda v: v*0.6, 0.3)
    elif "repair" in ctx:
        add_branch("hopeful","Trust rebuilds stronger at the broken places", lambda v: v*1.1, 0.6)
        add_branch("cautious","Trust returns but keeps one eye open", lambda v: v*0.9, 0.4)
    else:
        add_branch("default","Trust flows like water, finding its level", lambda v: v, 1.0)

# --- Context feature extraction over recent history ---
def recent_features(wb: HybridWB, node_ids: List[str], k:int=5):
    events=[]
    for nid in node_ids:
        for h in wb.nodes[nid].history:
            if h.get("meaning"):
                lower = h["meaning"].lower()
                if "betrayal" in lower or "repair" in lower:
                    events.append({"node":nid,"type":("betrayal" if "betrayal" in lower else "repair"),"when":h["when"]})
    events.sort(key=lambda e: e["when"])
    last = events[-k:]
    counts = {"betrayal":0,"repair":0}
    for e in last: counts[e["type"]] += 1
    pattern = "-".join([e["type"] for e in last]) if last else ""
    return {"counts":counts,"pattern":pattern,"last_events":last}

# --- Contextual collapse policy ---
def contextual_collapse(wb: HybridWB, target_path: str, source_node: str, policy: str="heuristic"):
    ent, key = target_path.split(".",1)
    n = wb.nodes[ent]
    branches = n.attrs.get("branches", {}).get(key, [])
    if not branches: return None
    feats = recent_features(wb, [source_node, ent], k=4)
    # Heuristic mapping from narrative features to preferred branch names
    preferred = None
    patt = feats["pattern"]
    c_b, c_r = feats["counts"]["betrayal"], feats["counts"]["repair"]
    if c_b >= 2 and c_r == 0:
        preferred = "pessimistic"   # sustained harm → pessimistic lens
    elif c_r >= 2 and "betrayal" in patt:
        preferred = "hopeful"       # sustained repair after betrayal → hopeful
    elif patt.endswith("betrayal-repair-betrayal") or patt.endswith("repair-betrayal-repair"):
        preferred = "cautious"      # oscillation → cautious
    elif c_r >= 2 and c_b == 0:
        preferred = "default"       # calm healing → default/neutral if exists
    # choose branch
    chosen = None
    if preferred:
        for b in branches:
            if b["name"] == preferred:
                chosen = b; break
    if not chosen:
        # fallback: max confidence
        chosen = max(branches, key=lambda b: b["confidence"])
    # record collapse
    n.attrs[key] = chosen["value"]
    n.history.append({"path":target_path,"from":None,"to":chosen["value"],"source":"collapse:contextual","when":time.time(),"meaning":f"Contextual collapse → {chosen['name']}"})
    return {"chosen": chosen, "features": feats}

# --- Demo: create histories then collapse with context ---
wb = HybridWB()
wb.create_node("Agent","human")
wb.create_node("Phenomenon","emergence")

# Simulate history: betrayal, repair, repair (recent)
wb.set_attr("human.trust", 0.8, source="initial", meaning="Grounded curiosity")
wb.set_attr("human.trust", 0.55, source="event", meaning="First betrayal cuts deepest")
wb.set_attr("human.trust", 0.62, source="experience", meaning="Repair after betrayal carries special weight")
wb.set_attr("human.trust", 0.68, source="experience", meaning="Repair continues; stabilizing")

# Fork branches twice (so we have both betrayal and repair branches recorded)
fork_metaphors(wb, "human.trust", "emergence.trust", ["betrayal"])
fork_metaphors(wb, "human.trust", "emergence.trust", ["repair"])

# Show branches
rows=[]
for b in wb.nodes["emergence"].attrs["branches"]["trust"]:
    rows.append({"branch":b["name"],"value":b["value"],"confidence":b["confidence"],"context":",".join(b["context"]), "metaphor":b["metaphor"]})
df = pd.DataFrame(rows)
display_dataframe_to_user("Branches before contextual collapse", df)

# Apply contextual collapse policy
result = contextual_collapse(wb, "emergence.trust", source_node="human")

# Prepare a compact summary
summary = {
    "chosen_branch": result["chosen"]["name"],
    "chosen_value": result["chosen"]["value"],
    "features": result["features"],
    "emergence_story_tail": wb.story("emergence")[-3:]
}
summary

# Output
#
# ('| branch      |   value |   confidence | context   | '
#  'metaphor                                           |\n'
#  '|:------------|--------:|-------------:|:----------|:---------------------------------------------------|\n'
#  '| pessimistic |   0.204 |          0.7 | betrayal  | Trust crumbles; each '
#  'crack weakens the whole       |\n'
#  "| resilient   |   0.408 |          0.3 | betrayal  | Trust bends but doesn't "
#  'break; scars make it wiser |\n'
#  '| hopeful     |   0.748 |          0.6 | repair    | Trust rebuilds stronger '
#  'at the broken places       |\n'
#  '| cautious    |   0.612 |          0.4 | repair    | Trust returns but keeps '
#  'one eye open               |')
# Out[6]:
# {'chosen_branch': 'pessimistic',
#  'chosen_value': 0.20400000000000001,
#  'features': {'counts': {'betrayal': 2, 'repair': 1},
#   'pattern': 'betrayal-betrayal-repair',
#   'last_events': [{'node': 'human',
#     'type': 'betrayal',
#     'when': 1757939434.4858072},
#    {'node': 'human', 'type': 'betrayal', 'when': 1757939434.485824},
#    {'node': 'human', 'type': 'repair', 'when': 1757939434.4858408}]},
#  'emergence_story_tail': ['Trust rebuilds stronger at the broken places: None → 0.7480000000000001 (via fork:hopeful)',
#   'Trust returns but keeps one eye open: None → 0.6120000000000001 (via fork:cautious)',
#   'Contextual collapse → pessimistic: None → 0.20400000000000001 (via collapse:contextual)']}
