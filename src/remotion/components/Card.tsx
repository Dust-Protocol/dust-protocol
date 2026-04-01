import React from 'react';
import { COLORS } from '../styles/theme';
import { CornerAccents } from './CornerAccents';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  borderColor?: string;
  showCorners?: boolean;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  borderColor = COLORS.borderDefault,
  showCorners = true,
  padding = 24,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${borderColor}`,
        backgroundColor: COLORS.bgCard,
        borderRadius: 2,
        padding,
        ...style,
      }}
    >
      {showCorners && <CornerAccents />}
      {children}
    </div>
  );
};
