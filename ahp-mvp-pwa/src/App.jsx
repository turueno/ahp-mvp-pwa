import React, { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

/********************\
 *   AHP APP (v2)   *
 *  - Jerarquías    *
 *  - Sensibilidad  *
\********************/

// -------- Helpers: Saaty scale & math --------
const SAATY_SCALE = [
  { v: 1, label: "1 (igual importancia)" },
  { v: 2, label: "2 (entre 1 y 3)" },
  { v: 3, label: "3 (moderada)" },
  { v: 4, label: "4 (entre 3 y 5)" },
  { v: 5, label: "5 (fuerte)" },
  { v: 6, label: "6 (entre 5 y 7)" },
  { v: 7, label: "7 (muy fuerte)" },
  { v: 8, label: "8 (entre 7 y 9)" },
  { v: 9, label: "9 (extrema)" },
];

// Random Index (RI) de Saaty
const RI = { 1:0, 2:0, 3:0.58, 4:0.90, 5:1.12, 6:1.24, 7:1.32, 8:1.41, 9:1.45, 10:1.49 };

function zeros(n){ return Array.from({length:n}, ()=>0); }
function cloneMatrix(M){ return M.map(r=>r.slice()); }
function reciprocal(x){ return x===0?0:1/x; }
function initializePairwise(n){
  return Array.from({length:n}, (_,i)=>Array.from({length:n},(_,j)=> i===j?1:1));
}
function weightsFromMatrix(M){
  const n = M.length; if(n===0) return [];
  const gm = M.map(row=> Math.pow(row.reduce((a,b)=>a*b,1), 1/n));
  const s = gm.reduce((a,b)=>a+b,0) || 1;
  return gm.map(x=>x/s);
}
function consistencyRatio(M, w){
  const n = M.length; if(n<3) return {CI:0, CR:0, lambdaMax:n};
  const Aw = M.map(row=> row.reduce((acc,x,j)=>acc + x*(w[j]||0), 0));
  const ratios = Aw.map((val,i)=> val/(w[i]||1e-12));
  const lambdaMax = ratios.reduce((a,b)=>a+b,0)/n;
  const CI = (lambdaMax-n)/(n-1);
  const CR = CI/(RI[n]||1);
  return {CI,CR,lambdaMax};
}

// -------- IDs --------
let __uid=0; const uid=()=>`n_${Date.now().toString(36)}_${(__uid++)}`;

// -------- Data Model --------
function makeNode(name){ return {id:uid(), name, children:[]}; }
const defaultAlternatives=["A","B","C"];
function createDefaultTree(){
  const root=makeNode("Objetivo");
  const c1=makeNode("Costo"), c2=makeNode("Calidad"), c3=makeNode("Tiempo");
  root.children=[c1,c2,c3];
  return {root, nodesById:Object.fromEntries([root,c1,c2,c3].map(n=>[n.id,n]))};
}
function createDefaultState(){
  const {root,nodesById}=createDefaultTree();
  const topM=initializePairwise(root.children.length);
  const MbyNode={[root.id]:topM};
  const MaltByLeaf=Object.fromEntries(root.children.map(l=>[l.id, initializePairwise(defaultAlternatives.length)]));
  return {alternatives:defaultAlternatives.slice(), treeRootId:root.id, nodesById, MbyNode, MaltByLeaf, rootSensitivity:{}};
}

// -------- UI helpers --------
function Section({title,children,right}){
  return <div className="bg-white rounded-2xl shadow p-4 md:p-6 mb-6">
    <div className="flex items-start justify-between gap-4 mb-4">
      <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>{right}
    </div>{children}
  </div>
}
function Pill({children}){return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs md:text-sm">{children}</span>}
function ScaleSelect({value,onChange}){
  return <select className="border rounded-lg px-2 py-1" value={value} onChange={e=>onChange(Number(e.target.value))}>
    {SAATY_SCALE.map(s=><option key={s.v} value={s.v}>{s.label}</option>)}
  </select>
}
function ConsistencyBadge({CR,n}){
  const ok=CR<0.1||n<3;
  return <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${ok?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
    <span>CR {CR.toFixed(3)}</span><span>• n={n}</span><span>• {ok?'Consistente':'Revisar comparaciones'}</span>
  </div>
}
function WeightsTable({labels,weights,title="Pesos"}){
  const data=labels.map((l,i)=>({name:l, peso:Number(weights[i]||0)}));
  return <div className="grid md:grid-cols-2 gap-4">
    <div>
      <table className="w-full">
        <thead><tr className="text-left text-sm text-gray-600"><th className="p-2">{title}</th><th className="p-2">Valor</th></tr></thead>
        <tbody>{data.map((d,i)=><tr key={i} className="odd:bg-gray-50"><td className="p-2">{d.name}</td><td className="p-2 font-mono">{d.peso.toFixed(4)}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}><XAxis dataKey="name"/><YAxis domain={[0,1]}/><Tooltip/><Legend/><Bar dataKey="peso" name="Peso"/></BarChart>
      </ResponsiveContainer>
    </div>
  </div>
}
function MatrixEditor({labels,matrix,setMatrix}){
  const handleChange=(i,j,val)=>{const M=cloneMatrix(matrix);M[i][j]=val;M[j][i]=reciprocal(val);setMatrix(M);}
  return <div className="overflow-auto"><table className="min-w-full border-separate border-spacing-0"><thead><tr><th>—</th>{labels.map((l,j)=><th key={j}>{l}</th>)}</tr></thead>
  <tbody>{labels.map((row,i)=><tr key={i}><th>{row}</th>{labels.map((c,j)=><td key={j}>{i===j?1:i<j?<ScaleSelect value={matrix[i][j]} onChange={(v)=>handleChange(i,j,v)}/>:Number(matrix[i][j]).toFixed(3)}</td>)}</tr>)}</tbody></table></div>
}

// -------- Main App --------
export default function App(){
  const [state,setState]=useState(createDefaultState);
  const {alternatives,treeRootId,nodesById,MbyNode,MaltByLeaf,rootSensitivity}=state;
  const root=nodesById[treeRootId];

  const topKids=root.children.map(c=>nodesById[c.id]);
  const topM=MbyNode[root.id]||initializePairwise(topKids.length);
  const topW=weightsFromMatrix(topM);
  const topCons=consistencyRatio(topM,topW);

  return <div className="min-h-screen bg-gray-100 p-4 md:p-8">
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">AHP – Jerárquico + Sensibilidad (MVP v2)</h1>
        <p className="text-gray-600 mt-2">Subcriterios ilimitados, sensibilidad en nivel superior, CR, exportar/importar JSON.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>Escala 1–9</Pill><Pill>Media geométrica</Pill><Pill>CR &lt; 0.10</Pill>
        </div>
      </header>

      <Section title="1) Criterios nivel superior">
        <MatrixEditor labels={topKids.map(c=>c.name)} matrix={topM} setMatrix={M=>setState(s=>({...s,MbyNode:{...s.MbyNode,[root.id]:M}}))}/>
        <div className="mt-3"><WeightsTable labels={topKids.map(c=>c.name)} weights={topW} title="Pesos de criterios"/></div>
        <div className="mt-3"><ConsistencyBadge CR={topCons.CR} n={topKids.length}/></div>
      </Section>

      <footer className="text-xs text-gray-500 mt-8">
        <p>Metodología Saaty 1–9, pesos por media geométrica, λmax y CR aproximados.</p>
      </footer>
    </div>
  </div>
}
