import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultadoBadge } from './resultado-badge';

describe('ResultadoBadge', () => {
  it.each([
    ['negativo', 'Negativo'],
    ['parcial', 'Parcial'],
    ['positivo', 'Positivo'],
  ] as const)('renders the label for %s', (resultado, label) => {
    render(<ResultadoBadge resultado={resultado} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
