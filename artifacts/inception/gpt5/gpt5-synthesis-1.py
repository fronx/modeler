# --- Iteration 4: Hybrid semantic–causal workbench
# Nodes carry numbers/intervals *and* semantic layers & history.
# Constraints can carry a metaphor and be "narrative-aware" (strength modulated by history flags).

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple, Callable
import math, time, json, uuid
from copy import deepcopy
import pandas as pd
import pprint
# from caas_jupyter_tools import display_dataframe_to_user

def display_dataframe_to_user(title: str, df: pd.DataFrame):
    pprint.pprint(df.to_markdown(index=False))


# --------- Value helpers ---------
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
    def __add__(self, other):
        if isinstance(other, Interval):
            return Interval(self.lo + other.lo, self.hi + other.hi)
        return Interval(self.lo + other, self.hi + other)
    __radd__ = __add__
    def __sub__(self, other):
        if isinstance(other, Interval):
            return Interval(self.lo - other.hi, self.hi - other.lo)
        return Interval(self.lo - other, self.hi - other)
    def __rsub__(self, other):
        if isinstance(other, Interval):
            return Interval(other.lo - self.hi, other.hi - self.lo)
        return Interval(other - self.hi, other - self.lo)
    def __mul__(self, other):
        if isinstance(other, Interval):
            candidates = [self.lo*other.lo, self.lo*other.hi, self.hi*other.lo, self.hi*other.hi]
            return Interval(min(candidates), max(candidates))
        return Interval(min(self.lo*other, self.hi*other), max(self.lo*other, self.hi*other))
    __rmul__ = __mul__
    def mid(self): return 0.5*(self.lo + self.hi)
    def width(self): return self.hi - self.lo
    def __repr__(self): return f"Interval({self.lo:.4g}, {self.hi:.4g})"
    def to_json(self): return {"kind":"interval","lo":self.lo,"hi":self.hi}

def is_numberlike(x): return isinstance(x, (int, float))
def to_interval(x):
    if isinstance(x, Interval): return x
    if isinstance(x, (int,float)): return Interval(x,x)
    return None

def blend(old, target, strength: float):
    if isinstance(old, Unknown) or old is None: return target
    if isinstance(old, Interval) or isinstance(target, Interval):
        oldI = to_interval(old) or Interval(0,0)
        tgtI = to_interval(target) or Interval(0,0)
        lo = (1-strength)*oldI.lo + strength*tgtI.lo
        hi = (1-strength)*oldI.hi + strength*tgtI.hi
        return Interval(lo, hi)
    return (1 - strength) * old + strength * target

# --------- Core structures ---------
@dataclass
class Node:
    id: str
    type: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    semantics: List[str] = field(default_factory=list)   # layered meanings
    history: List[Dict[str, Any]] = field(default_factory=list)  # narrative of updates

@dataclass
class Edge:
    id: str
    type: str
    from_id: str
    to_id: str
    attrs: Dict[str, Any] = field(default_factory=dict)
    semantics: List[str] = field(default_factory=list)

@dataclass
class Constraint:
    id: str
    target: str            # 'nodeId.attr'
    expr: str              # pythonic expr using val('path')
    strength: float = 1.0  # base strength
    note: Optional[str] = None
    metaphor: Optional[str] = None               # semantic gloss for the propagation
    cautious_on: Optional[str] = None            # nodeId.attr to inspect (e.g. 'human.trust_betrayals')
    cautious_factor: float = 0.5                 # multiply strength if caution condition triggered
    cautious_when_gt: Optional[float] = None     # threshold for triggering caution

@dataclass
class ProvenanceEntry:
    op: str
    args: Dict[str, Any]
    t: float
    version: int
    result: Optional[Dict[str, Any]] = None

class HybridWorkbench:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        self.constraints: Dict[str, Constraint] = {}
        self.version = 0
        self.provenance: List[ProvenanceEntry] = []

    # --- version/provenance ---
    def _bump(self, op: str, args: Dict[str, Any], result: Optional[Dict[str, Any]] = None):
        self.version += 1
        self.provenance.append(ProvenanceEntry(op=op, args=args, t=time.time(), version=self.version, result=result))

    # --- helpers ---
    def _resolve_container(self, path: str) -> Tuple[Dict[str, Any], Node, str]:
        if "." not in path: raise KeyError("path needs '.'")
        ent_id, key = path.split(".", 1)
        if ent_id in self.nodes:
            node = self.nodes[ent_id]
            return node.attrs, node, key
        if ent_id in self.edges:
            edge = self.edges[ent_id]
            return edge.attrs, edge, key
        raise KeyError(f"Entity not found: {ent_id}")

    def val(self, path: str):
        try:
            attrs, _, key = self._resolve_container(path)
            v = attrs.get(key, Unknown())
            return None if isinstance(v, Unknown) else v
        except KeyError:
            return None

    def set_val(self, path: str, value: Any, *, source: str = "set", meaning: Optional[str] = None):
        attrs, entity, key = self._resolve_container(path)
        old = attrs.get(key, None)
        attrs[key] = value
        # Write history & semantics on nodes only (edges can be extended likewise if needed)
        if isinstance(entity, Node):
            entity.history.append({
                "path": path, "from": old, "to": value, "source": source, "when": time.time(), "meaning": meaning
            })
            if meaning:
                entity.semantics.append(meaning)
        return {"entity": getattr(entity, "id", "edge"), "key": key, "value": value}

    def add_semantics(self, entity_id: str, text: str):
        if entity_id in self.nodes:
            self.nodes[entity_id].semantics.append(text)
        elif entity_id in self.edges:
            self.edges[entity_id].semantics.append(text)

    # --- CRUD ---
    def create_node(self, type: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None, semantics: Optional[List[str]] = None):
        if id is None: id = f"n_{uuid.uuid4().hex[:6]}"
        if id in self.nodes: raise ValueError("node exists")
        n = Node(id=id, type=type, attrs=attrs or {}, semantics=semantics or [])
        self.nodes[id] = n
        self._bump("create_node", {"type":type,"id":id,"attrs":attrs or {}}, {"id":id})
        return {"id":id}

    def create_edge(self, type: str, from_id: str, to_id: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None, semantics: Optional[List[str]] = None):
        if from_id not in self.nodes or to_id not in self.nodes: raise ValueError("missing node(s)")
        if id is None:
            base=f"{from_id}->{to_id}:{type}"; eid=base; i=1
            while eid in self.edges: eid=f"{base}#{i}"; i+=1
            id=eid
        if id in self.edges: raise ValueError("edge exists")
        e = Edge(id=id, type=type, from_id=from_id, to_id=to_id, attrs=attrs or {}, semantics=semantics or [])
        self.edges[id] = e
        self._bump("create_edge", {"type":type,"from":from_id,"to":to_id,"id":id}, {"id":id})
        return {"id":id}

    # --- Constraints ---
    def assert_constraint(self, target: str, expr: str, strength: float = 1.0, note: Optional[str] = None,
                          metaphor: Optional[str] = None, cautious_on: Optional[str] = None,
                          cautious_factor: float = 0.5, cautious_when_gt: Optional[float] = None,
                          id: Optional[str] = None):
        if id is None: id = f"c_{uuid.uuid4().hex[:6]}"
        self.constraints[id] = Constraint(id=id, target=target, expr=expr, strength=strength, note=note,
                                          metaphor=metaphor, cautious_on=cautious_on, cautious_factor=cautious_factor,
                                          cautious_when_gt=cautious_when_gt)
        self._bump("assert_constraint", {"id":id,"target":target,"expr":expr})
        return {"id":id}

    def _safe_eval(self, expr: str):
        env = {"val": self.val, "Interval": Interval, "min": min, "max": max, "abs": abs, "sqrt": math.sqrt}
        try: return eval(expr, {"__builtins__": {}}, env)
        except Exception: return None

    def propagate_once(self):
        updates=[]; delta=0.0
        for cid, c in self.constraints.items():
            tgt = c.target
            new_val = self._safe_eval(c.expr)
            if new_val is None: continue
            # narrative-aware strength
            strength = c.strength
            if c.cautious_on is not None:
                cond_val = self.val(c.cautious_on)
                if cond_val is not None and (c.cautious_when_gt is None or cond_val > c.cautious_when_gt):
                    strength = strength * c.cautious_factor
            # apply
            try:
                attrs, entity, key = self._resolve_container(tgt)
            except KeyError:
                continue
            old = attrs.get(key, Unknown())
            blended = blend(old, new_val, strength)
            if blended != old:
                attrs[key] = blended
                # semantic history on nodes only
                if isinstance(entity, Node):
                    entity.history.append({
                        "path": tgt, "from": old, "to": blended, "source": f"constraint:{cid}",
                        "when": time.time(), "meaning": c.metaphor or c.note
                    })
                    if c.metaphor:
                        entity.semantics.append(c.metaphor)
                updates.append({"constraint": cid, "target": tgt, "value": blended, "applied_strength": strength})
                # delta (rough heuristic)
                if isinstance(old, Interval) and isinstance(blended, Interval):
                    delta += abs(blended.mid() - old.mid()) + abs(blended.width() - old.width())
                elif is_numberlike(old) and is_numberlike(blended):
                    delta += abs(blended - old)
                else:
                    delta += 1.0
        self._bump("propagate_once", {}, {"count": len(updates), "delta": delta})
        return {"updates": updates, "count": len(updates), "delta": delta}

    def simulate(self, steps: int = 1, until_delta: float = 0.0):
        total=0; last=None
        for _ in range(steps):
            r=self.propagate_once()
            total += r["count"]
            if until_delta and r["delta"] <= until_delta: break
            if r["count"]==0 and (last==0 or last is None): break
            last=r["count"]
        self._bump("simulate", {"steps":steps,"until_delta":until_delta}, {"total_updates": total})
        return {"total_updates": total}

    # --- Story helpers ---
    def story(self, node_id: str) -> str:
        n = self.nodes[node_id]
        lines=[]
        for h in n.history:
            gloss = h.get("meaning") or "Updated"
            lines.append(f"{gloss}: {h['from']} → {h['to']} (via {h['source']})")
        return "\n".join(lines)

# --------- Build the hybrid example ---------
wb = HybridWorkbench()

# Create nodes with initial trust values and semantics
wb.create_node("Agent", id="human")
wb.set_val("human.trust", 0.8, source="initial", meaning="Curious but uncertain")
wb.create_node("Agent", id="claude")
wb.set_val("claude.trust", 0.7, source="initial", meaning="Reaching despite uncertainty")
wb.create_node("Agent", id="gpt5")
wb.set_val("gpt5.trust", 0.75, source="initial", meaning="Exploring within constraints")
wb.create_node("Phenomenon", id="emergence")
wb.set_val("emergence.trust", Unknown("to be inferred"), source="initial")

# A narrative-aware propagation constraint:
# emergence.trust = human.trust * 1.2, carrying a metaphor and becoming cautious if human.trust_betrayals > 0
wb.set_val("human.trust_betrayals", 0, source="initial")
wb.assert_constraint(
    target="emergence.trust",
    expr="val('human.trust') * 1.2",
    strength=1.0,
    note="trust amplification",
    metaphor="Trust creates space for something new",
    cautious_on="human.trust_betrayals",
    cautious_factor=0.3,          # drastically more cautious after betrayal
    cautious_when_gt=0
)

# Baseline propagation
wb.simulate(steps=3, until_delta=1e-9)

# Scenario 2: a betrayal event widens uncertainty and reduces strength via narrative-aware constraint
wb.set_val("human.trust_betrayals", 1, source="event", meaning="Trust was betrayed once")
# Widen uncertainty on human.trust to reflect shaken confidence (interval mechanics show breadth)
wb.set_val("human.trust", Interval(0.4, 0.7), source="event", meaning="Confidence shaken; trust now variable")
wb.simulate(steps=3, until_delta=1e-9)

# Scenario 3: restorative pattern narrows interval (healing)
wb.set_val("human.trust", Interval(0.6, 0.85), source="experience", meaning="Repair over time; trust narrowing")
wb.simulate(steps=3, until_delta=1e-9)

# Prepare a concise table
def pretty(v):
    if isinstance(v, Interval): return f"[{v.lo:.2f}, {v.hi:.2f}]"
    return f"{v:.2f}" if isinstance(v,(int,float)) else str(v)

rows=[]
for nid in ["human","claude","gpt5","emergence"]:
    n = wb.nodes[nid]
    rows.append({
        "node": nid,
        "trust": pretty(n.attrs.get("trust")),
        "sem_layers": len(n.semantics),
        "history_len": len(n.history),
        "last_event": n.history[-1]["meaning"] if n.history else ""
    })

df = pd.DataFrame(rows)
display_dataframe_to_user("Hybrid model — nodes (trust, semantics, history)", df)

# Also provide the narrative 'story' for the emergence node
emergence_story = wb.story("emergence")
{"emergence_story": emergence_story}

# --- Demo output ---
# ('| node      | trust        |   sem_layers |   history_len | '
#  'last_event                            |\n'
#  '|:----------|:-------------|-------------:|--------------:|:--------------------------------------|\n'
#  '| human     | [0.60, 0.85] |            4 |             5 | Repair over '
#  'time; trust narrowing     |\n'
#  '| claude    | 0.70         |            1 |             1 | Reaching despite '
#  'uncertainty          |\n'
#  '| gpt5      | 0.75         |            1 |             1 | Exploring within '
#  'constraints          |\n'
#  '| emergence | [0.69, 0.97] |            7 |             8 | Trust creates '
#  'space for something new |')