import React, { useRef } from 'react';
import { GraphData } from '../types';

interface Props {
  graphData?: GraphData;
  width?: number;
  height?: number;
}

export const TransactionGraphViewer: React.FC<Props> = ({ graphData, width = 600, height = 400 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return <div className="text-slate-500 text-sm flex items-center justify-center bg-slate-800 rounded border border-slate-700" style={{ width, height }}>No graph data available.</div>;
  }

  // Very naive non-force-directed circular layout for demo purposes since we aren't using d3.
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 60;
  
  const nodesWithPositions = graphData.nodes.map((node, i) => {
    const angle = (i / graphData.nodes.length) * 2 * Math.PI;
    const isCenter = node.type === 'intermediary' || graphData.nodes.length === 1;
    return {
      ...node,
      x: isCenter ? cx : cx + radius * Math.cos(angle),
      y: isCenter ? cy : cy + radius * Math.sin(angle),
    };
  });

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'source': return '#f87171'; // red-400
      case 'destination': return '#34d399'; // emerald-400
      case 'intermediary': return '#fbbf24'; // yellow-400
      default: return '#94a3b8'; // slate-400
    }
  };

  return (
    <div className="relative bg-slate-900 rounded-lg border border-slate-700 overflow-hidden" style={{ width: '100%', height }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="25" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>
        
        {/* Draw Edges */}
        {graphData.edges.map((edge, i) => {
          const source = nodesWithPositions.find(n => n.id === edge.source);
          const target = nodesWithPositions.find(n => n.id === edge.target);
          if (!source || !target) return null;
          
          return (
            <g key={`edge-${i}`}>
              <line 
                x1={source.x} y1={source.y} 
                x2={target.x} y2={target.y} 
                stroke="#475569" strokeWidth="2" 
                markerEnd="url(#arrowhead)"
              />
              <text 
                x={(source.x + target.x) / 2} 
                y={(source.y + target.y) / 2 - 5}
                fill="#cbd5e1" fontSize="10" textAnchor="middle"
              >
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(edge.amount).replace('₫', '')}
              </text>
            </g>
          );
        })}

        {/* Draw Nodes */}
        {nodesWithPositions.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <circle r="15" fill={getNodeColor(node.type)} stroke="#1e293b" strokeWidth="3" />
            <text y="28" fill="#e2e8f0" fontSize="11" textAnchor="middle" fontWeight="500">
              {node.id}
            </text>
          </g>
        ))}
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-800/80 p-2 rounded border border-slate-700 text-xs flex gap-3 backdrop-blur-sm">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-400"></div> Source</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Intermediary</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-400"></div> Destination</div>
      </div>
    </div>
  );
};
