# Hybrid semantic–causal prototype + metaphor forking + provenance-first answers
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple, Callable
from copy import deepcopy
import math, time, json, uuid
import pandas as pd
import pprint

# from caas_jupyter_tools import display_dataframe_to_user
def display_dataframe_to_user(title: str, df: pd.DataFrame):
    pprint.pprint(df.to_markdown(index=False))

# ---------- Core value helpers ----------
class Unknown:
    def __init__(self, hint: Optional[str] = None):
        self.hint = hint
    def __repr__(self):
        return f"Unknown({self.hint!r})"
    def to_json(self):
        return {"kind":"unknown","hint":self.hint}

@dataclass
class Interval:
    lo: float
    hi: float
    def __post_init__(self):
        if self.lo > self.hi:
            self.lo, self.hi = self.hi, self.lo
    def __mul__(self, k: float):
        return Interval(min(self.lo*k, self.hi*k), max(self.lo*k, self.hi*k))
    __rmul__ = __mul__
    def mid(self): return 0.5*(self.lo+self.hi)
    def width(self): return self.hi - self.lo
    def __repr__(self): return f"[{self.lo:.3f},{self.hi:.3f}]"
    def to_json(self): return {"kind":"interval","lo":self.lo,"hi":self.hi}

def to_interval(v):
    if isinstance(v, Interval): return v
    if isinstance(v, (int,float)): return Interval(v, v)
    return None

# ---------- Hybrid workbench ----------
@dataclass
class Node:
    id: str
    type: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    semantics: List[str] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ProvenanceEntry:
    op: str
    args: Dict[str, Any]
    t: float

class HybridWB:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.provenance: List[ProvenanceEntry] = []
        self.version = 0

    def _bump(self, op, args):
        self.version += 1
        self.provenance.append(ProvenanceEntry(op=op, args=args, t=time.time()))

    def create_node(self, type: str, id: Optional[str] = None, attrs=None, semantics=None):
        if id is None: id = f"n_{uuid.uuid4().hex[:6]}"
        self.nodes[id] = Node(id=id, type=type, attrs=attrs or {}, semantics=semantics or [])
        self._bump("create_node", {"id":id,"type":type})
        return id

    def set_attr(self, path: str, value: Any, *, source="set", meaning: Optional[str]=None):
        ent, key = path.split(".",1)
        n = self.nodes[ent]
        old = n.attrs.get(key, None)
        n.attrs[key] = value
        n.history.append({"path":path,"from":old,"to":value,"source":source,"when":time.time(),"meaning":meaning})
        if meaning: n.semantics.append(meaning)
        self._bump("set_attr", {"path":path,"value":str(value),"meaning":meaning})
        return {"entity": ent, "key": key, "value": value}

    def val(self, path: str):
        ent, key = path.split(".",1)
        n = self.nodes.get(ent)
        if not n: return None
        v = n.attrs.get(key, Unknown())
        return None if isinstance(v, Unknown) else v

    def story(self, node_id: str) -> str:
        n = self.nodes[node_id]
        lines=[]
        for h in n.history:
            gloss = h.get("meaning") or "Updated"
            lines.append(f"{gloss}: {h['from']} → {h['to']} (via {h['source']})")
        return "\n".join(lines)

# ---------- Metaphor forking ----------
class MetaphorFork:
    """
    Returns context-dependent branches with (metaphor, transform, confidence).
    transform: function that maps number or interval -> same kind
    """
    def interpret(self, context: List[str]):
        ctx = set(context)
        def mul(k):
            return (lambda v: (to_interval(v) * k) if to_interval(v) else v)
        if "betrayal" in ctx:
            return {
                "pessimistic": {"metaphor":"Trust crumbles; each crack weakens the whole","transform":mul(0.3),"confidence":0.7},
                "resilient":  {"metaphor":"Trust bends but doesn't break; scars make it wiser","transform":mul(0.6),"confidence":0.3},
            }
        if "repair" in ctx:
            return {
                "hopeful": {"metaphor":"Trust rebuilds stronger at the broken places","transform":mul(1.1),"confidence":0.6},
                "cautious":{"metaphor":"Trust returns but keeps one eye open","transform":mul(0.9),"confidence":0.4},
            }
        return {
            "default": {"metaphor":"Trust flows like water, finding its level","transform":mul(1.0),"confidence":1.0}
        }

def apply_metaphor_fork(wb: HybridWB, source_path: str, target_path: str, context: List[str], fork: MetaphorFork):
    source_val = wb.val(source_path)
    branches = fork.interpret(context)
    ent, key = target_path.split(".",1)
    n = wb.nodes[ent]
    out = []
    for name, spec in branches.items():
        new_val = spec["transform"](source_val)
        # record branch as hypothesis without collapsing
        if "branches" not in n.attrs:
            n.attrs["branches"] = {}
        if key not in n.attrs["branches"]:
            n.attrs["branches"][key] = []
        entry = {
            "name": name,
            "value": new_val,
            "metaphor": spec["metaphor"],
            "confidence": spec["confidence"],
            "from": source_val,
            "context": list(context),
            "when": time.time()
        }
        n.attrs["branches"][key].append(entry)
        # story
        n.history.append({"path": target_path, "from": None, "to": new_val, "source": f"fork:{name}", "when": entry["when"], "meaning": spec["metaphor"]})
        n.semantics.append(spec["metaphor"])
        out.append(entry)
    wb._bump("apply_metaphor_fork", {"source":source_path,"target":target_path,"context":list(context)})
    return out

def collapse_branches(wb: HybridWB, target_path: str, method="max_conf"):
    ent, key = target_path.split(".",1)
    n = wb.nodes[ent]
    branches = n.attrs.get("branches", {}).get(key, [])
    if not branches: return None
    if method == "max_conf":
        best = max(branches, key=lambda b: b["confidence"])
        chosen = best
    elif method == "weighted_mean":
        # collapse numeric or interval via confidence-weighted average of mids; width is confidence-weighted average of widths
        mids = []; widths = []; total_c=0.0
        for b in branches:
            v = to_interval(b["value"])
            if v is None: continue
            c = b["confidence"]
            mids.append(v.mid()*c); widths.append(v.width()*c); total_c += c
        if total_c == 0: chosen = branches[0]
        else:
            mid = sum(mids)/total_c; width = sum(widths)/total_c
            lo = mid - width/2; hi = mid + width/2
            chosen = {"name":"weighted","value": Interval(lo,hi), "metaphor":"Weighted collapse of branches","confidence":1.0}
    else:
        chosen = branches[0]
    # set collapsed value as the official attribute
    wb.set_attr(target_path, chosen["value"], source=f"collapse:{method}", meaning=f"Collapsed from branches via {method}")
    return chosen

# ---------- Provenance-first answer ----------
class ProvenanceAnswer:
    def __init__(self, question: str):
        self.question = question
        self.queries = []
        self.narratives = []
        self.confidences = []
        self.conclusion = None
    def query(self, wb: HybridWB, path: str, note: Optional[str]=None):
        v = wb.val(path)
        story = wb.story(path.split(".",1)[0])
        self.queries.append({"path":path,"value":v,"story":story,"note":note})
        return v
    def narrative(self, text: str, confidence: float=1.0):
        self.narratives.append({"text":text,"confidence":confidence})
        self.confidences.append(confidence)
    def conclude(self, text: str):
        self.conclusion = text
    def render(self):
        avgC = (sum(self.confidences)/len(self.confidences)) if self.confidences else 1.0
        return {
            "question": self.question,
            "conclusion": self.conclusion,
            "confidence": round(avgC, 3),
            "reasoning": {
                "based_on_queries": [f"{q['path']} = {q['value']}" for q in self.queries],
                "narrative_fragments": [n["text"] for n in self.narratives],
                "story_excerpt": " → ".join(filter(None, [q["note"] for q in self.queries]))
            },
            "traceable": True
        }

# ---------- Demo: betrayal & repair with forked metaphors ----------
wb = HybridWB()
wb.create_node("Agent", id="human")
wb.create_node("Phenomenon", id="emergence")

# Start with interval trust on human
wb.set_attr("human.trust", Interval(0.6,0.85), source="initial", meaning="Grounded curiosity")
fork = MetaphorFork()

# After betrayal: widen uncertainty upstream and branch interpretations at emergence
wb.set_attr("human.trust", Interval(0.4,0.7), source="event", meaning="Betrayal widens uncertainty")
betrayal_branches = apply_metaphor_fork(wb, "human.trust", "emergence.trust", context=["betrayal"], fork=fork)

# After repair: apply another branching on top (new set of hypotheses)
wb.set_attr("human.trust", Interval(0.6,0.8), source="experience", meaning="Repair narrows uncertainty")
repair_branches = apply_metaphor_fork(wb, "human.trust", "emergence.trust", context=["repair"], fork=fork)

# Collapse branches (choose by highest confidence)
chosen = collapse_branches(wb, "emergence.trust", method="max_conf")

# Show branches table
def fmt(v):
    if isinstance(v, Interval): return f"{v}"
    if isinstance(v, float): return f"{v:.3f}"
    return str(v)

rows = []
for name, entries in wb.nodes["emergence"].attrs.get("branches", {}).items():
    for b in entries:
        rows.append({
            "attr": name,
            "branch": b["name"],
            "value": fmt(b["value"]),
            "confidence": b["confidence"],
            "metaphor": b["metaphor"],
            "context": ",".join(b["context"])
        })
df = pd.DataFrame(rows)
display_dataframe_to_user("Metaphor branches for emergence.trust", df)

# Build a provenance-first answer
ans = ProvenanceAnswer("How trustworthy is the emergence after betrayal and repair?")
ans.query(wb, "human.trust", note="Upstream uncertainty narrowed after repair")
ans.query(wb, "emergence.trust", note="Collapsed from branches (max_conf)")
ans.narrative("Betrayal introduced pessimistic vs resilient branches; repair introduced hopeful vs cautious branches", 0.85)
ans.narrative("We chose the highest-confidence branch to collapse hypotheses", 0.9)
ans.conclude("Trust is cautiously positive and explicitly conditioned by its narrative history")
provenance_result = ans.render()

# Provide human-readable story snippet for emergence
emergence_story = wb.story("emergence")
{"chosen_branch": chosen, "provenance": provenance_result, "emergence_story_excerpt": emergence_story.splitlines()[-5:]}

# Output:
#
# ('| attr   | branch      | value         |   confidence | '
#  'metaphor                                           | context   |\n'
#  '|:-------|:------------|:--------------|-------------:|:---------------------------------------------------|:----------|\n'
#  '| trust  | pessimistic | [0.120,0.210] |          0.7 | Trust crumbles; each '
#  'crack weakens the whole       | betrayal  |\n'
#  '| trust  | resilient   | [0.240,0.420] |          0.3 | Trust bends but '
#  "doesn't break; scars make it wiser | betrayal  |\n"
#  '| trust  | hopeful     | [0.660,0.880] |          0.6 | Trust rebuilds '
#  'stronger at the broken places       | repair    |\n'
#  '| trust  | cautious    | [0.540,0.720] |          0.4 | Trust returns but '
#  'keeps one eye open               | repair    |')
#