import React from 'react';
import { COLORS } from '../styles/theme';

interface CornerAccentsProps {
  color?: string;
  size?: number;
}

export const CornerAccents: React.FC<CornerAccentsProps> = ({
  color = COLORS.white10,
  size = 8,
}) => {
  const style = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: size,
      height: size,
    };
    if (pos === 'tl') return { ...base, top: 0, left: 0, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` };
    if (pos === 'tr') return { ...base, top: 0, right: 0, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` };
    if (pos === 'bl') return { ...base, bottom: 0, left: 0, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` };
    return { ...base, bottom: 0, right: 0, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` };
  };

  return (
    <>
      <div style={style('tl')} />
      <div style={style('tr')} />
      <div style={style('bl')} />
      <div style={style('br')} />
    </>
  );
};
