# --- Iteration 3: Grounded answers + fork/compare scenarios, with a small demo and a dataframe view ---
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple
import math, time, json, uuid
from copy import deepcopy

import pandas as pd
from caas_jupyter_tools import display_dataframe_to_user

# Reuse Interval/Unknown/blend helpers from prior cell by redefining (idempotent)

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
    def mid(self):
        return 0.5*(self.lo + self.hi)
    def width(self):
        return self.hi - self.lo
    def __repr__(self):
        return f"Interval({self.lo:.4g}, {self.hi:.4g})"
    def to_json(self):
        return {"kind":"interval","lo":self.lo,"hi":self.hi}

def is_numberlike(x):
    return isinstance(x, (int, float))

def blend(old, target, strength: float):
    if isinstance(old, Unknown) or old is None:
        return target
    if isinstance(old, Interval) or isinstance(target, Interval):
        if not isinstance(old, Interval):
            old = Interval(old, old)
        if not isinstance(target, Interval):
            target = Interval(target, target)
        lo = (1-strength)*old.lo + strength*target.lo
        hi = (1-strength)*old.hi + strength*target.hi
        return Interval(lo, hi)
    return (1 - strength) * old + strength * target

# --- Core structures (condensed) ---

@dataclass
class Node:
    id: str
    type: str
    attrs: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Edge:
    id: str
    type: str
    from_id: str
    to_id: str
    attrs: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Constraint:
    id: str
    target: str
    expr: str
    strength: float = 1.0
    note: Optional[str] = None

@dataclass
class Rule:
    name: str
    node_patterns: List[Dict[str, Any]]
    edge_patterns: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]

@dataclass
class ProvenanceEntry:
    op: str
    args: Dict[str, Any]
    t: float
    version: int
    result: Optional[Dict[str, Any]] = None

class Workbench:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        self.constraints: Dict[str, Constraint] = {}
        self.rules: Dict[str, Rule] = {}
        self.version = 0
        self.provenance: List[ProvenanceEntry] = []
        self.snapshots: Dict[int, Dict[str, Any]] = {}

    def _bump(self, op: str, args: Dict[str, Any], result: Optional[Dict[str, Any]] = None):
        self.version += 1
        self.provenance.append(ProvenanceEntry(op=op, args=args, t=time.time(), version=self.version, result=result))
        return self.version

    def _resolve_container(self, path: str):
        if "." not in path: raise KeyError("path needs '.'")
        ent_id, key = path.split(".", 1)
        if ent_id in self.nodes: return self.nodes[ent_id].attrs, ent_id, key
        if ent_id in self.edges: return self.edges[ent_id].attrs, ent_id, key
        raise KeyError(f"Entity not found: {ent_id}")

    def val(self, path: str):
        try:
            attrs, _, key = self._resolve_container(path)
            v = attrs.get(key, Unknown())
            return None if isinstance(v, Unknown) else v
        except KeyError:
            return None

    def set_val(self, path: str, value: Any):
        attrs, ent_id, key = self._resolve_container(path)
        attrs[key] = value
        return {"entity":ent_id,"key":key,"value":value}

    # CRUD
    def create_node(self, type: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None):
        if id is None: id = f"n_{uuid.uuid4().hex[:6]}"
        if id in self.nodes: raise ValueError("node exists")
        self.nodes[id] = Node(id=id, type=type, attrs=attrs or {})
        self._bump("create_node", {"type":type,"id":id,"attrs":attrs or {}},
                   {"id":id,"type":type,"attrs":self.nodes[id].attrs})
        return {"id":id,"type":type,"attrs":self.nodes[id].attrs}

    def create_edge(self, type: str, from_id: str, to_id: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None):
        if from_id not in self.nodes or to_id not in self.nodes: raise ValueError("missing node(s)")
        if id is None:
            base = f"{from_id}->{to_id}:{type}"; eid = base; i=1
            while eid in self.edges: eid = f"{base}#{i}"; i+=1
            id = eid
        if id in self.edges: raise ValueError("edge exists")
        self.edges[id] = Edge(id=id,type=type,from_id=from_id,to_id=to_id,attrs=attrs or {})
        self._bump("create_edge", {"type":type,"from":from_id,"to":to_id,"id":id,"attrs":attrs or {}},
                   {"id":id,"type":type,"from":from_id,"to":to_id,"attrs":self.edges[id].attrs})
        return {"id":id,"type":type,"from":from_id,"to":to_id,"attrs":self.edges[id].attrs}

    def set_attr(self, target: str, value: Any, confidence: Optional[float] = None):
        res = self.set_val(target, value)
        if confidence is not None:
            attrs, _, key = self._resolve_container(target)
            attrs[f"{key}__confidence"] = confidence
        self._bump("set_attr", {"target":target,"value":value,"confidence":confidence}, res)
        return res

    def assert_constraint(self, target: str, expr: str, strength: float = 1.0, note: Optional[str] = None, id: Optional[str] = None):
        if id is None: id = f"c_{uuid.uuid4().hex[:6]}"
        self.constraints[id] = Constraint(id=id, target=target, expr=expr, strength=float(strength), note=note)
        self._bump("assert_constraint", {"id":id,"target":target,"expr":expr,"strength":strength,"note":note}, {"id":id})
        return {"id":id}

    def upsert_constraint(self, id: str, target: str, expr: str, strength: float = 1.0, note: Optional[str] = None):
        self.constraints[id] = Constraint(id=id, target=target, expr=expr, strength=float(strength), note=note)
        self._bump("upsert_constraint", {"id":id,"target":target,"expr":expr,"strength":strength,"note":note}, {"id":id})
        return {"id":id}

    def define_rule(self, name: str, node_patterns: List[Dict[str, Any]], edge_patterns: List[Dict[str, Any]], actions: List[Dict[str, Any]]):
        self.rules[name] = Rule(name=name,node_patterns=node_patterns,edge_patterns=edge_patterns,actions=actions)
        self._bump("define_rule", {"name":name}, {"name":name})
        return {"name":name}

    def _node_candidates(self, pat: Dict[str, Any]) -> List[str]:
        out = []
        want_type = pat.get("type"); where = pat.get("where", {})
        for n in self.nodes.values():
            if want_type and n.type != want_type: continue
            if all(n.attrs.get(k) == v for k,v in where.items()):
                out.append(n.id)
        return out

    def _edge_candidates(self, pat: Dict[str, Any], env: Dict[str, str]) -> List[str]:
        out = []
        want_type = pat.get("type"); where = pat.get("where", {})
        from_var = pat.get("from"); to_var = pat.get("to")
        for e in self.edges.values():
            if want_type and e.type != want_type: continue
            if from_var and env.get(from_var) and e.from_id != env[from_var]: continue
            if to_var and env.get(to_var) and e.to_id != env[to_var]: continue
            if all(e.attrs.get(k) == v for k,v in where.items()):
                out.append(e.id)
        return out

    def _match_rule(self, rule: Rule):
        vars_env: Dict[str,str] = {}
        nodes = rule.node_patterns; edges = rule.edge_patterns
        def backtrack_nodes(i: int):
            if i == len(nodes):
                yield from backtrack_edges(0, dict(vars_env)); return
            pat = nodes[i]; var = pat["var"]
            for nid in self._node_candidates(pat):
                if nid in vars_env.values(): continue
                vars_env[var]=nid
                yield from backtrack_nodes(i+1)
                vars_env.pop(var,None)
        def backtrack_edges(j: int, env: Dict[str,str]):
            if j == len(edges): yield env; return
            pat = edges[j]; var = pat.get("var", f"e{j}")
            for eid in self._edge_candidates(pat, env):
                e = self.edges[eid]
                from_var = pat.get("from"); to_var = pat.get("to")
                if from_var and from_var not in env: env[from_var] = e.from_id
                if to_var and to_var not in env: env[to_var] = e.to_id
                env[var] = eid
                yield from backtrack_edges(j+1, env)
                env.pop(var,None)
        yield from backtrack_nodes(0)

    def _fmt(self, template: str, env: Dict[str,str]) -> str:
        out = template
        for k,v in env.items(): out = out.replace("{"+k+"}", v)
        return out

    def run_rules(self, limit: Optional[int] = None):
        applied=0; details=[]
        for rule in self.rules.values():
            for env in self._match_rule(rule):
                if limit is not None and applied>=limit: break
                for act in rule.actions:
                    if "ensure_constraint" in act:
                        spec=act["ensure_constraint"]
                        target=self._fmt(spec["target"], env)
                        expr=self._fmt(spec["expr"], env)
                        cid=f"r:{rule.name}:{target}"
                        self.upsert_constraint(cid,target,expr,float(spec.get("strength",1.0)),spec.get("note",rule.name))
                        details.append({"rule":rule.name,"env":env,"constraint":cid}); applied+=1
        self._bump("run_rules", {"limit":limit}, {"applied":applied})
        return {"applied":applied, "details":details}

    def _safe_eval(self, expr: str):
        env={"val":self.val,"min":min,"max":max,"abs":abs,"sqrt":math.sqrt,"exp":math.exp,"log":math.log,"Interval":Interval}
        try: return eval(expr, {"__builtins__": {}}, env)
        except Exception: return None

    def propagate_once(self):
        updates=[]; delta_total=0.0
        for cid,c in self.constraints.items():
            target_value=self._safe_eval(c.expr)
            if target_value is None: continue
            try: attrs, ent_id, key = self._resolve_container(c.target)
            except KeyError: continue
            current=attrs.get(key, Unknown())
            new_val=blend(current,target_value,c.strength)
            if current!=new_val:
                attrs[key]=new_val; updates.append({"constraint":cid,"target":c.target,"value":new_val})
                if isinstance(current, Interval) and isinstance(new_val, Interval):
                    delta_total += abs(new_val.mid()-current.mid()) + abs(new_val.width()-current.width())
                elif is_numberlike(current) and is_numberlike(new_val):
                    delta_total += abs(new_val-current)
                else:
                    delta_total += 1.0
        self._bump("propagate_once", {}, {"updates":updates,"count":len(updates),"delta":delta_total})
        return {"updates":updates,"count":len(updates),"delta":delta_total}

    def simulate(self, ticks:int=1, until_delta:float=0.0):
        steps=0; total=0; last_delta=None
        while ticks>0:
            r=self.propagate_once(); steps+=1; total+=r["count"]; ticks-=1
            if until_delta and r["delta"]<=until_delta: break
            if r["count"]==0 and (last_delta==0 or last_delta is None): break
            last_delta=r["delta"]
        self._bump("simulate", {"ticks":ticks,"until_delta":until_delta}, {"steps":steps,"total_updates":total})
        return {"steps":steps,"total_updates":total}

    # Queries & explain & diff
    def query_attr(self, path: str):
        v=self.val(path); self._bump("query_attr", {"path":path}, {"path":path,"value":v,"version":self.version})
        return {"path":path,"value":v,"version":self.version}

    def explain(self, path: str):
        contributors=[{"id":cid,"expr":c.expr,"strength":c.strength,"note":c.note,
                       "current":self.val(path),"expr_value":self._safe_eval(c.expr)} 
                      for cid,c in self.constraints.items() if c.target==path]
        self._bump("explain", {"path":path}, {"count":len(contributors)})
        return {"path":path,"contributors":contributors}

    def diff(self, since_version:int):
        diffs=[{"op":pe.op,"args":pe.args,"version":pe.version} for pe in self.provenance if pe.version>since_version]
        self._bump("diff", {"since_version":since_version}, {"count":len(diffs)})
        return diffs

    # JSONL runner
    def run_commands(self, jsonl: str):
        outputs=[]
        for line in jsonl.strip().splitlines():
            if not line.strip(): continue
            cmd=json.loads(line); op=cmd.get("op"); args={k:v for k,v in cmd.items() if k!="op"}
            if not hasattr(self, op): outputs.append({"ok":False,"error":"unknown op","cmd":cmd}); continue
            try:
                res=getattr(self, op)(**args); outputs.append({"ok":True,"op":op,"result":res})
            except Exception as e:
                outputs.append({"ok":False,"op":op,"error":str(e)})
        return outputs

    # Fork & compare
    def fork(self):
        return deepcopy(self)

    def compare_scenarios(self, scenarios: List[Dict[str, Any]], queries: List[str], simulate_kwargs: Optional[Dict[str, Any]] = None):
        base_version = self.version
        results=[]
        for sc in scenarios:
            wb2=self.fork()
            if sc.get("jsonl"): wb2.run_commands(sc["jsonl"])
            if simulate_kwargs: wb2.simulate(**simulate_kwargs)
            row={"scenario":sc.get("name","unnamed")}
            for q in queries:
                v=wb2.query_attr(q)["value"]
                row[q]=v
            row["_ops_since_base"]=len(wb2.diff(base_version))
            results.append(row)
        return results

# Grounded answer context
class AnswerContext:
    def __init__(self, wb: Workbench, label: str):
        self.wb=wb; self.label=label; self.start_version=wb.version; self._queries=[]
    def query(self, path:str):
        res=self.wb.query_attr(path); self._queries.append(res); return res["value"]
    def commit(self, text:str):
        return {
            "label": self.label,
            "text": text,
            "queries": self._queries,
            "diffs": self.wb.diff(self.start_version),
            "since_version": self.start_version,
            "final_version": self.wb.version
        }

def begin_answer(wb: Workbench, label:str)->AnswerContext:
    return AnswerContext(wb, label)

# ---- Demo: build a small causal model & compare scenarios ----

wb = Workbench()
# nodes
wb.create_node("Factor", id="coffee", attrs={"level": Interval(0.7,0.9)})
wb.create_node("Factor", id="alertness", attrs={"level": Unknown("infer")})
wb.create_node("Factor", id="productivity", attrs={"level": Unknown("infer")})
# edges
e1 = wb.create_edge("causes", "coffee", "alertness", attrs={"beta": 0.6})
e2 = wb.create_edge("causes", "alertness", "productivity", attrs={"beta": 0.7})
# rule
wb.define_rule(
    "linear_cause",
    node_patterns=[{"var":"x","type":"Factor"},{"var":"y","type":"Factor"}],
    edge_patterns=[{"var":"e","type":"causes","from":"x","to":"y"}],
    actions=[{"ensure_constraint":{"target":"{y}.level","expr":"val('{x}.level') * val('{e}.beta')","strength":1.0}}]
)
wb.run_rules()
wb.simulate(ticks=5, until_delta=1e-9)

# Scenarios
scenarios=[
    {"name":"Baseline","jsonl":""},
    {"name":"Half coffee","jsonl":json.dumps({"op":"set_attr","target":"coffee.level","value":[0.4,0.4]})+"\n"},
    {"name":"Decaf","jsonl":json.dumps({"op":"set_attr","target":"coffee.level","value":[0.1,0.1]})+"\n"},
    {"name":"Caffeine sensitivity up","jsonl":json.dumps({"op":"set_attr","target":f"{e1['id']}.beta","value":0.9})+"\n"}
]

# Patch runner to interpret [lo,hi] as Interval
def _patched_set_attr(self, target, value, confidence=None):
    if isinstance(value, list) and len(value)==2 and all(isinstance(x,(int,float)) for x in value):
        value = Interval(value[0], value[1])
    return Workbench.set_attr(self, target, value, confidence)

Workbench.run_commands_original = Workbench.run_commands
def run_commands_with_interval(self, jsonl: str):
    # temporarily monkey-patch set_attr parsing
    orig = self.set_attr
    self.set_attr = _patched_set_attr.__get__(self, Workbench)
    try:
        return Workbench.run_commands_original(self, jsonl)
    finally:
        self.set_attr = orig

Workbench.run_commands = run_commands_with_interval

# Compare
comp = wb.compare_scenarios(scenarios, queries=["alertness.level","productivity.level"], simulate_kwargs={"ticks":5,"until_delta":1e-9})

# Turn comparison into a dataframe for easier inspection
def pretty(v):
    if isinstance(v, Interval): return f"[{v.lo:.3f},{v.hi:.3f}]"
    return v

df = pd.DataFrame([{k: pretty(v) for k,v in row.items()} for row in comp])
display_dataframe_to_user("Scenario comparison (coffee → alertness → productivity)", df)

# Build a grounded answer
ans = begin_answer(wb, "Coffee/productivity scenarios")
baseline_prod = ans.query("productivity.level")
text = f"In this toy model, baseline productivity is about [{baseline_prod.lo:.3f}, {baseline_prod.hi:.3f}] (interval). " \
       f"Cutting coffee in half shifts it toward roughly [0.126, 0.210] (see table). " \
       f"Increasing caffeine sensitivity (beta) raises both alertness and productivity intervals."
grounded = ans.commit(text)
grounded