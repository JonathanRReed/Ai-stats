import * as React from 'react';
import { Button } from './ui/button';

export function PrimaryCta() {
  const handleClick = React.useCallback(() => {
    window.location.href = '/compare';
  }, []);

  return (
    <Button size="lg" variant="default" onClick={handleClick}>
      Compare models
    </Button>
  );
}
