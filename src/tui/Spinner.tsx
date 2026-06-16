import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import { isAsciiMode, ui } from '../display.js';

const FRAMES_UNICODE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAMES_ASCII = ['-', '\\', '|', '/'];

type SpinnerProps = {
  label?: string;
  color?: string;
};

// Lightweight Braille/ASCII spinner so loading states feel alive without
// pulling in an extra dependency.
export function Spinner({ label, color = 'yellow' }: SpinnerProps) {
  const frames = isAsciiMode() ? FRAMES_ASCII : FRAMES_UNICODE;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Text color={color}>
      {frames[frame]}
      {label ? ` ${ui(label)}` : ''}
    </Text>
  );
}
