"""3D-граф каталога на 3d-force-graph (MIT, vasturiano).

Запуск: python catalog/build_graph.py  ->  catalog/out/graph.html
Узлы: сферы, сети и проекты. Связи: проект — сфера, проект — сеть.
"""
import csv
import json
import pathlib
import sys
import urllib.request

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
from spheres import BY_CATEGORY  # noqa: E402

LIMIT = 1800
LIBRARY = "https://cdn.jsdelivr.net/npm/3d-force-graph@1.80.3/dist/3d-force-graph.min.js"


def protocols():
    request = urllib.request.Request("https://api.llama.fi/protocols", headers={"User-Agent": "radar-catalog/0.1"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def catalog_rows():
    with open(HERE / "out" / "projects.csv", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def build(rows, raw):
    chains = {}
    for item in raw:
        chains[(item.get("name"), item.get("category"))] = item.get("chains") or []
    rows = sorted(rows, key=lambda r: int(r["significance"]), reverse=True)[:LIMIT]
    nodes, links = {}, []

    def hub(prefix, name, group):
        key = f"{prefix}:{name}"
        node = nodes.setdefault(key, {"id": key, "name": name, "group": group, "size": 1})
        node["size"] += 1
        return key

    for index, row in enumerate(rows):
        key = f"p:{index}"
        flags = row["danger_flags"].replace("|", ", ")
        group = "hacked" if "был взлом" in flags else "warning" if flags else "project"
        sphere = BY_CATEGORY.get(row["category"], "Крипто: прочее")
        nodes[key] = {"id": key, "name": row["name"], "group": group, "sphere": sphere, "flags": flags,
                      "score": int(row["significance"]), "url": row["url"],
                      "size": 1 + (int(row["significance"]) / 25) ** 2}
        links.append({"source": key, "target": hub("s", sphere, "sphere")})
        for chain in chains.get((row["name"], row["category"]), [])[:4]:
            links.append({"source": key, "target": hub("c", chain, "chain")})
    return {"nodes": list(nodes.values()), "links": links}


PAGE = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Radar 3D</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;background:#000011;color:#e6edf3;font:13px system-ui,sans-serif;overflow:hidden}
#panel{position:fixed;top:12px;left:12px;background:#161b22e6;border:1px solid #30363d;border-radius:8px;padding:12px;width:270px;z-index:2}
input,select{width:100%;margin-top:8px;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px}
.key span{display:inline-block;margin:8px 8px 0 0}.key i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
#info{margin-top:10px;overflow-wrap:anywhere}#info a{color:#58a6ff}
</style></head><body>
<div id="panel"><b>Radar 3D: крипто-проекты</b><div id="count"></div>
<select id="sphere" aria-label="Сфера"><option value="">Все сферы</option></select>
<input id="q" type="search" placeholder="Найти проект и подлететь" aria-label="Поиск">
<div class="key" id="key"></div><div id="info">Нажмите на узел. Красный цвет — взлом в истории, а не приговор.</div></div>
<div id="graph"></div>
<script src="__LIBRARY__" crossorigin="anonymous"></script>
<script>
const DATA=__DATA__;
const COLORS={sphere:'#ffffff',chain:'#58a6ff',project:'#3fb950',warning:'#e3b341',hacked:'#ff4d4f'};
const NAMES={sphere:'сфера',chain:'сеть',project:'без флагов',warning:'есть флаги',hacked:'был взлом'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
for(const [g,c] of Object.entries(COLORS))document.getElementById('key').insertAdjacentHTML('beforeend',`<span><i style="background:${c}"></i>${NAMES[g]}</span>`);
const info=document.getElementById('info'),count=document.getElementById('count'),select=document.getElementById('sphere');
if(typeof ForceGraph3D==='undefined'){info.textContent='Библиотека не загрузилась: нужен интернет.'}else{
const graph=ForceGraph3D()(document.getElementById('graph'))
 .nodeColor(n=>COLORS[n.group]).nodeVal(n=>n.group==='sphere'||n.group==='chain'?Math.min(n.size/6,60)+2:n.size)
 .nodeLabel(n=>esc(n.name)+(n.flags?'<br>'+esc(n.flags):'')).nodeResolution(8).linkOpacity(0.12)
 .cooldownTicks(120).onNodeClick(focus);
function focus(n){const r=1+160/Math.hypot(n.x||1,n.y||1,n.z||1);
 graph.cameraPosition({x:n.x*r,y:n.y*r,z:n.z*r},n,1200);
 info.innerHTML=`<b>${esc(n.name)}</b><br>${NAMES[n.group]}${n.score!==undefined?' · значимость '+n.score:''}`
 +(n.flags?'<br>'+esc(n.flags):'')+(/^https?:\\/\\//.test(n.url||'')?`<br><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">сайт проекта</a>`:'')}
function show(sphere){
 // библиотека меняет объекты связей, поэтому каждый раз берём копию
 const keep=new Set(DATA.nodes.filter(n=>!sphere||n.sphere===sphere||n.id==='s:'+sphere).map(n=>n.id));
 const links=DATA.links.filter(l=>keep.has(l.source));links.forEach(l=>keep.add(l.target));
 const nodes=DATA.nodes.filter(n=>keep.has(n.id));
 graph.graphData({nodes,links:links.filter(l=>keep.has(l.target)).map(l=>({...l}))});
 count.textContent=`узлов ${nodes.length}, связей ${links.length}`}
for(const n of DATA.nodes.filter(n=>n.group==='sphere').sort((a,b)=>b.size-a.size))select.add(new Option(n.name,n.name));
select.onchange=()=>show(select.value);
document.getElementById('q').addEventListener('keydown',e=>{if(e.key!=='Enter')return;
 const q=e.target.value.trim().toLowerCase();if(!q)return;
 const hit=graph.graphData().nodes.find(n=>n.name.toLowerCase().includes(q));
 if(hit)focus(hit);else info.textContent='Не найдено в показанной части.'});
show('');}
</script></body></html>
"""


def render(data):
    payload = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    return PAGE.replace("__LIBRARY__", LIBRARY).replace("__DATA__", payload)


if __name__ == "__main__":
    graph = build(catalog_rows(), protocols())
    (HERE / "out" / "graph.html").write_text(render(graph), encoding="utf-8")
    print(f"узлов {len(graph['nodes'])}, связей {len(graph['links'])}")
