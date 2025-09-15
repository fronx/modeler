# --- Iteration 2: Add rules/pattern-matching, interval values, better convergence, explain, and a JSONL runner ---
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Tuple, Callable, Iterable
import math
import time
import json
import uuid
from copy import deepcopy
import pprint

# Reuse classes by redefining with added features (fresh workspace in this cell)

# ---------- Value helpers ----------

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
    def scale(self, factor: float):
        return self * factor
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
    """Blend numbers or intervals; Unknown becomes target."""
    if isinstance(old, Unknown) or old is None:
        return target
    if isinstance(old, Interval) or isinstance(target, Interval):
        # Promote numbers to intervals if needed
        if not isinstance(old, Interval):
            old = Interval(old, old)
        if not isinstance(target, Interval):
            target = Interval(target, target)
        # Linear blend by endpoints
        lo = (1-strength)*old.lo + strength*target.lo
        hi = (1-strength)*old.hi + strength*target.hi
        return Interval(lo, hi)
    # numeric blend
    return (1 - strength) * old + strength * target

# ---------- Core data structures ----------

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
    target: str          # e.g. "nodeId.attr" or "edgeId.attr"
    expr: str            # pythonic expression, can use val('path') and variables
    strength: float = 1.0  # 0..1 (1 = hard set)
    note: Optional[str] = None

@dataclass
class Rule:
    name: str
    node_patterns: List[Dict[str, Any]]  # e.g., [{"var":"x","type":"Factor","where":{"kind":"level"}}]
    edge_patterns: List[Dict[str, Any]]  # e.g., [{"var":"e","type":"causes","from":"x","to":"y","where":{"beta":0.6}}]
    actions: List[Dict[str, Any]]        # e.g., [{"ensure_constraint":{"target":"{y}.level","expr":"val('{x}.level') * val('{e}.beta')","strength":1.0}}]

@dataclass
class ProvenanceEntry:
    op: str
    args: Dict[str, Any]
    t: float
    version: int
    result: Optional[Dict[str, Any]] = None

# ---------- Workbench ----------

class Workbench:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        self.constraints: Dict[str, Constraint] = {}
        self.rules: Dict[str, Rule] = {}
        self.version: int = 0
        self.provenance: List[ProvenanceEntry] = []
        self.snapshots: Dict[int, Dict[str, Any]] = {}  # version -> state snapshot

    # --- helpers ---
    def _bump(self, op: str, args: Dict[str, Any], result: Optional[Dict[str, Any]] = None):
        self.version += 1
        pe = ProvenanceEntry(op=op, args=args, t=time.time(), version=self.version, result=result)
        self.provenance.append(pe)
        return pe

    def _resolve_container(self, path: str) -> Tuple[Dict[str, Any], str, str]:
        if "." not in path:
            raise KeyError(f"Invalid target path (missing '.'): {path}")
        ent_id, key = path.split(".", 1)
        if ent_id in self.nodes:
            return self.nodes[ent_id].attrs, ent_id, key
        if ent_id in self.edges:
            return self.edges[ent_id].attrs, ent_id, key
        raise KeyError(f"Entity not found for path: {path}")

    def val(self, path: str):
        try:
            attrs, _, key = self._resolve_container(path)
            v = attrs.get(key, Unknown())
            if isinstance(v, Unknown):
                return None
            return v
        except KeyError:
            return None

    def set_val(self, path: str, value: Any):
        attrs, ent_id, key = self._resolve_container(path)
        attrs[key] = value
        return {"entity": ent_id, "key": key, "value": value}

    # --- Ops ---

    def create_node(self, type: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None):
        if id is None:
            id = f"n_{uuid.uuid4().hex[:6]}"
        if id in self.nodes:
            raise ValueError(f"Node id already exists: {id}")
        node = Node(id=id, type=type, attrs=attrs or {})
        self.nodes[id] = node
        result = {"id": id, "type": type, "attrs": node.attrs}
        self._bump("create_node", {"type": type, "id": id, "attrs": attrs or {}}, result)
        return result

    def create_edge(self, type: str, from_id: str, to_id: str, id: Optional[str] = None, attrs: Optional[Dict[str, Any]] = None):
        if from_id not in self.nodes or to_id not in self.nodes:
            raise ValueError("from_id and to_id must be existing node ids")
        if id is None:
            base = f"{from_id}->{to_id}:{type}"
            eid = base
            i = 1
            while eid in self.edges:
                eid = f"{base}#{i}"
                i += 1
            id = eid
        if id in self.edges:
            raise ValueError(f"Edge id already exists: {id}")
        edge = Edge(id=id, type=type, from_id=from_id, to_id=to_id, attrs=attrs or {})
        self.edges[id] = edge
        result = {"id": id, "type": type, "from": from_id, "to": to_id, "attrs": edge.attrs}
        self._bump("create_edge", {"type": type, "from": from_id, "to": to_id, "id": id, "attrs": attrs or {}}, result)
        return result

    def set_attr(self, target: str, value: Any, confidence: Optional[float] = None):
        res = self.set_val(target, value)
        if confidence is not None:
            res_meta_key = f"{res['key']}__confidence"
            attrs, _, key = self._resolve_container(target)
            attrs[res_meta_key] = confidence
        self._bump("set_attr", {"target": target, "value": value, "confidence": confidence}, res)
        return res

    def assert_constraint(self, target: str, expr: str, strength: float = 1.0, note: Optional[str] = None, id: Optional[str] = None):
        if id is None:
            id = f"c_{uuid.uuid4().hex[:6]}"
        if id in self.constraints:
            raise ValueError(f"Constraint id already exists: {id}")
        c = Constraint(id=id, target=target, expr=expr, strength=float(strength), note=note)
        self.constraints[id] = c
        self._bump("assert_constraint", {"id": id, "target": target, "expr": expr, "strength": strength, "note": note}, {"id": id})
        return {"id": id}

    def upsert_constraint(self, id: str, target: str, expr: str, strength: float = 1.0, note: Optional[str] = None):
        if id in self.constraints:
            c = self.constraints[id]
            c.target, c.expr, c.strength, c.note = target, expr, float(strength), note
        else:
            self.constraints[id] = Constraint(id=id, target=target, expr=expr, strength=float(strength), note=note)
        self._bump("upsert_constraint", {"id": id, "target": target, "expr": expr, "strength": strength, "note": note}, {"id": id})
        return {"id": id}

    def remove_constraint(self, id: str):
        if id in self.constraints:
            del self.constraints[id]
            self._bump("remove_constraint", {"id": id}, {"removed": id})
            return {"removed": id}
        return {"removed": None}

    def define_rule(self, name: str, node_patterns: List[Dict[str, Any]], edge_patterns: List[Dict[str, Any]], actions: List[Dict[str, Any]]):
        rule = Rule(name=name, node_patterns=node_patterns, edge_patterns=edge_patterns, actions=actions)
        self.rules[name] = rule
        self._bump("define_rule", {"name": name}, {"name": name})
        return {"name": name}

    def _node_candidates(self, pat: Dict[str, Any]) -> List[str]:
        out = []
        want_type = pat.get("type")
        where = pat.get("where", {})
        for n in self.nodes.values():
            if want_type and n.type != want_type:
                continue
            ok = True
            for k, v in where.items():
                if n.attrs.get(k) != v:
                    ok = False
                    break
            if ok:
                out.append(n.id)
        return out

    def _edge_candidates(self, pat: Dict[str, Any], env: Dict[str, str]) -> List[str]:
        out = []
        want_type = pat.get("type")
        where = pat.get("where", {})
        from_var = pat.get("from")
        to_var = pat.get("to")
        for e in self.edges.values():
            if want_type and e.type != want_type:
                continue
            if from_var and env.get(from_var) and e.from_id != env[from_var]:
                continue
            if to_var and env.get(to_var) and e.to_id != env[to_var]:
                continue
            ok = True
            for k, v in where.items():
                if e.attrs.get(k) != v:
                    ok = False
                    break
            if ok:
                out.append(e.id)
        return out

    def _match_rule(self, rule: Rule) -> Iterable[Dict[str, str]]:
        # Backtracking over node patterns then edge patterns
        vars_env: Dict[str, str] = {}
        nodes = rule.node_patterns
        edges = rule.edge_patterns

        def backtrack_nodes(i: int):
            if i == len(nodes):
                yield from backtrack_edges(0, dict(vars_env))
                return
            pat = nodes[i]
            var = pat["var"]
            for nid in self._node_candidates(pat):
                if nid in vars_env.values():
                    continue
                vars_env[var] = nid
                yield from backtrack_nodes(i+1)
                vars_env.pop(var, None)

        def backtrack_edges(j: int, current_env: Dict[str, str]):
            if j == len(edges):
                yield current_env
                return
            pat = edges[j]
            var = pat.get("var", f"e{j}")
            for eid in self._edge_candidates(pat, current_env):
                if eid in current_env.values():
                    continue
                # check var constraints: ensure endpoints variable bindings consistent
                e = self.edges[eid]
                from_var = pat.get("from")
                to_var = pat.get("to")
                # bind if not bound
                if from_var and from_var not in current_env:
                    current_env[from_var] = e.from_id
                if to_var and to_var not in current_env:
                    current_env[to_var] = e.to_id
                # if bound, they already matched by _edge_candidates
                current_env[var] = eid
                yield from backtrack_edges(j+1, current_env)
                # undo
                current_env.pop(var, None)
                if from_var and from_var in rule.node_patterns and current_env.get(from_var) == e.from_id:
                    pass  # keep node binding
                if to_var and to_var in rule.node_patterns and current_env.get(to_var) == e.to_id:
                    pass

        yield from backtrack_nodes(0)

    def _format(self, template: str, env: Dict[str, str]) -> str:
        # Replace {x} with bound id
        out = template
        for k, v in env.items():
            out = out.replace("{"+k+"}", v)
        return out

    def run_rules(self, limit: Optional[int] = None) -> Dict[str, Any]:
        applied = 0
        details = []
        for rule in self.rules.values():
            for env in self._match_rule(rule):
                if limit is not None and applied >= limit:
                    break
                for act in rule.actions:
                    if "ensure_constraint" in act:
                        spec = act["ensure_constraint"]
                        target = self._format(spec["target"], env)
                        expr = self._format(spec["expr"], env)
                        note = spec.get("note", rule.name)
                        # Stable id derived from rule + target
                        cid = f"r:{rule.name}:{target}"
                        self.upsert_constraint(id=cid, target=target, expr=expr, strength=float(spec.get("strength", 1.0)), note=note)
                        details.append({"rule": rule.name, "env": env, "constraint": cid})
                        applied += 1
        self._bump("run_rules", {"limit": limit}, {"applied": applied})
        return {"applied": applied, "details": details}

    def snapshot(self, label: Optional[str] = None):
        snap = {
            "nodes": deepcopy(self.nodes),
            "edges": deepcopy(self.edges),
            "constraints": deepcopy(self.constraints),
        }
        self.snapshots[self.version] = snap
        self._bump("snapshot", {"label": label or ""}, {"version": self.version})
        return {"version": self.version}

    def revert(self, version: int):
        if version not in self.snapshots:
            raise ValueError(f"No snapshot for version {version}")
        snap = self.snapshots[version]
        self.nodes = deepcopy(snap["nodes"])
        self.edges = deepcopy(snap["edges"])
        self.constraints = deepcopy(snap["constraints"])
        self._bump("revert", {"to_version": version}, {"version": self.version})
        return {"version": self.version}

    # --- Simulation / propagation ---

    def _safe_eval(self, expr: str) -> Optional[Any]:
        env = {
            "val": self.val,
            "min": min,
            "max": max,
            "abs": abs,
            "sqrt": math.sqrt,
            "exp": math.exp,
            "log": math.log,
            "Interval": Interval,
        }
        try:
            return eval(expr, {"__builtins__": {}}, env)
        except Exception:
            return None

    def propagate_once(self) -> Dict[str, Any]:
        updates = []
        delta_total = 0.0
        for cid, c in self.constraints.items():
            target_value = self._safe_eval(c.expr)
            if target_value is None:
                continue
            try:
                attrs, ent_id, key = self._resolve_container(c.target)
            except KeyError:
                continue
            current = attrs.get(key, Unknown())
            new_val = blend(current, target_value, c.strength)
            if current != new_val:
                attrs[key] = new_val
                updates.append({"constraint": cid, "target": c.target, "value": new_val})
                # numeric delta for convergence heuristic
                if isinstance(current, Interval) and isinstance(new_val, Interval):
                    delta_total += abs(new_val.mid() - current.mid()) + abs(new_val.width() - current.width())
                elif is_numberlike(current) and is_numberlike(new_val):
                    delta_total += abs(new_val - current)
                else:
                    delta_total += 1.0  # count unknown/structural changes
        changed = {"updates": updates, "count": len(updates), "delta": delta_total}
        self._bump("propagate_once", {}, changed)
        return changed

    def simulate(self, ticks: int = 1, dt: float = 1.0, until_delta: float = 0.0, max_steps: Optional[int] = None):
        steps = 0
        total_updates = 0
        last_delta = None
        while ticks > 0 or (max_steps and steps < max_steps):
            result = self.propagate_once()
            steps += 1
            total_updates += result["count"]
            ticks -= 1
            if until_delta and result["delta"] <= until_delta:
                break
            if max_steps and steps >= max_steps:
                break
            if result["count"] == 0 and (last_delta == 0 or last_delta is None):
                break
            last_delta = result["delta"]
        summary = {"steps": steps, "total_updates": total_updates}
        self._bump("simulate", {"ticks": ticks, "dt": dt, "until_delta": until_delta, "max_steps": max_steps}, summary)
        return summary

    # --- Queries, explain & diffs ---
    def query_attr(self, path: str) -> Dict[str, Any]:
        v = self.val(path)
        res = {"path": path, "value": v, "version": self.version}
        self._bump("query_attr", {"path": path}, res)
        return res

    def query_nodes(self, type: Optional[str] = None, where: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        out = []
        for n in self.nodes.values():
            if type and n.type != type:
                continue
            ok = True
            if where:
                for k, v in where.items():
                    if n.attrs.get(k) != v:
                        ok = False
                        break
            if ok:
                out.append({"id": n.id, "type": n.type, "attrs": deepcopy(n.attrs)})
        self._bump("query_nodes", {"type": type, "where": where or {}}, {"count": len(out)})
        return out

    def explain(self, path: str) -> Dict[str, Any]:
        explains = []
        for c in self.constraints.values():
            if c.target == path:
                explains.append({
                    "id": c.id, "expr": c.expr, "strength": c.strength, "note": c.note,
                    "current": self.val(path), "expr_value": self._safe_eval(c.expr)
                })
        res = {"path": path, "contributors": explains}
        self._bump("explain", {"path": path}, {"count": len(explains)})
        return res

    def diff(self, since_version: int) -> List[Dict[str, Any]]:
        diffs = []
        for pe in self.provenance:
            if pe.version > since_version:
                diffs.append({
                    "op": pe.op,
                    "args": pe.args,
                    "t": pe.t,
                    "version": pe.version,
                    "result": pe.result
                })
        self._bump("diff", {"since_version": since_version}, {"count": len(diffs)})
        return diffs

    # --- JSONL command runner (tool-like) ---
    def run_commands(self, jsonl: str) -> List[Dict[str, Any]]:
        outputs = []
        for line in jsonl.strip().splitlines():
            if not line.strip():
                continue
            cmd = json.loads(line)
            op = cmd.get("op")
            args = {k: v for k, v in cmd.items() if k != "op"}
            if not hasattr(self, op):
                outputs.append({"error": f"Unknown op: {op}", "cmd": cmd})
                continue
            fn = getattr(self, op)
            try:
                res = fn(**args)
                outputs.append({"ok": True, "op": op, "result": res})
            except Exception as e:
                outputs.append({"ok": False, "op": op, "error": str(e), "cmd": cmd})
        return outputs

# ---------- Demo 1: Recreate causal chain using a rule ----------

wb = Workbench()
wb.create_node("Factor", id="coffee", attrs={"level": Interval(0.7, 0.9)})
wb.create_node("Factor", id="alertness", attrs={"level": Unknown("infer")})
wb.create_node("Factor", id="productivity", attrs={"level": Unknown("infer")})
e1 = wb.create_edge("causes", "coffee", "alertness", attrs={"beta": 0.6})
e2 = wb.create_edge("causes", "alertness", "productivity", attrs={"beta": 0.7})

# Define a generic causal propagation rule: For any causes edge x -(e)-> y, ensure constraint y.level = x.level * e.beta
wb.define_rule(
    name="linear_cause",
    node_patterns=[
        {"var":"x","type":"Factor"},
        {"var":"y","type":"Factor"}
    ],
    edge_patterns=[
        {"var":"e","type":"causes","from":"x","to":"y"}
    ],
    actions=[
        {"ensure_constraint": {
            "target":"{y}.level",
            "expr":"val('{x}.level') * val('{e}.beta')",
            "strength": 1.0,
            "note":"linear_cause"
        }}
    ]
)

wb.run_rules()
wb.simulate(ticks=5, until_delta=1e-9)
baseline = wb.query_attr("productivity.level")

# Counterfactual: tighten coffee interval lower
wb.set_attr("coffee.level", Interval(0.3, 0.5))
wb.simulate(ticks=5, until_delta=1e-9)
after = wb.query_attr("productivity.level")
exp = wb.explain("productivity.level")

demo1 = {
    "baseline_productivity_interval": baseline["value"],
    "after_change_productivity_interval": after["value"],
    "explain_productivity": exp
}

# ---------- Demo 2: JSONL commands ----------
jsonl = """
{"op":"create_node","type":"Claim","id":"c1","attrs":{"text":"LLMs hallucinate"}}
{"op":"create_node","type":"Reason","id":"r1","attrs":{"text":"No explicit model grounding"}}
{"op":"create_edge","type":"supports","from_id":"r1","to_id":"c1","attrs":{"weight":0.8}}
{"op":"assert_constraint","target":"c1.score","expr":"val('r1.weight')","strength":1.0,"note":"naive support passthrough"}
{"op":"simulate","ticks":2}
{"op":"query_attr","path":"c1.score"}
"""
jsonl_out = wb.run_commands(jsonl)

pprint.pprint({
  "demo1": demo1,
  "jsonl_out_first3": jsonl_out[:3],
  "jsonl_out_last2": jsonl_out[-2:]
})