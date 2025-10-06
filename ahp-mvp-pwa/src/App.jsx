import React, { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

// ---- AHP helpers ----
const SAATY_SCALE = [
  { v: 1, label: "1 (igual importancia)" },
  { v: 3, label: "3 (moderada)" },
  { v: 5, label: "5 (fuerte)" },
  { v: 7, label: "7 (muy fuerte)" },
  { v: 9, label: "9 (extrema)" },
];
const RI = { 1:0, 2:0, 3:0.58, 4:0.90, 5:1.12 };

function reciprocal(x){ return 1/x; }
function initializePairwise(n){ return Array.from({length:n}, (_,i)=>Array.from({length:n},(_,j)=> i===j?1:1)); }
function weightsFromMatrix(M){
  const n = M.length;
  const gm = M.map(row => Math.pow(row.reduce((a,b)=>a*b,1), 1/n));
  const s = gm.reduce((a,b)=>a+b,0);
  return gm.map(x=>x/s);
}
function consistencyRatio(M, w){
  const n = M.length;
  if(n<3) return {CI:0, CR:0, lambdaMax:n};
  const Aw = M.map(row=> row.reduce((acc,x,j)=>acc + x*w[j], 0));
  const ratios = Aw.map((val,i)=> val/w[i]);
  const lambdaMax = ratios.reduce((a,b)=>a+b,0)/n;
  const CI = (lambdaMax-n)/(n-1);
  const CR = CI/(RI[n]||1);
  return {CI,CR,lambdaMax};
}

// ---- UI ----
function ScaleSelect({value,onChange}){
  return (
    <select value={value} onChange={e=>onChange(Number(e.target.value))}>
      {SAATY_SCALE.map(s=><option key={s.v} value={s.v}>{s.label}</option>)}
    </select>
  );
}
function MatrixEditor({labels,matrix,setMatrix}){
  const handleChange=(i,j,val)=>{
    const M=matrix.map(r=>r.slice());
    M[i][j]=val; M[j][i]=reciprocal(val);
    setMatrix(M);
  };
  return (
    <table>
      <thead><tr><th>-</th>{labels.map((l,j)=><th key={j}>{l}</th>)}</tr></thead>
      <tbody>
        {labels.map((row,i)=>
          <tr key={i}>
            <th>{row}</th>
            {labels.map((c,j)=>
              <td key={j}>
                {i===j? 1 : i<j ?
                  <ScaleSelect value={matrix[i][j]} onChange={v=>handleChange(i,j,v)}/> :
                  Number(matrix[i][j]).toFixed(2)}
              </td>
            )}
          </tr>
        )}
      </tbody>
    </table>
  );
}
function WeightsTable({labels,weights}){
  const data=labels.map((l,i)=>({name:l,peso:weights[i]}));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="name"/>
        <YAxis domain={[0,1]}/>
        <Tooltip/>
        <Legend/>
        <Bar dataKey="peso" fill="#4F46E5"/>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Main App ----
export default function App(){
  const criteria=["Costo","Calidad","Tiempo"];
  const [matrix,setMatrix]=useState(initializePairwise(criteria.length));
  const weights=weightsFromMatrix(matrix);
  const cons=consistencyRatio(matrix,weights);

  return (
    <div style={{padding:20}}>
      <h1>AHP MVP</h1>
      <MatrixEditor labels={criteria} matrix={matrix} setMatrix={setMatrix}/>
      <WeightsTable labels={criteria} weights={weights}/>
      <p>CR = {cons.CR.toFixed(3)} {cons.CR<0.1? "✔️ Consistente":"⚠️ Revisar"}</p>
    </div>
  );
}
