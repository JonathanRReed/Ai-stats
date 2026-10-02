import type { EpochObservation } from './epoch-observations';
export type ComparisonEvidence<T> = {
  schemaVersion: 2;
  models: T[];
  observations: EpochObservation[];
};
