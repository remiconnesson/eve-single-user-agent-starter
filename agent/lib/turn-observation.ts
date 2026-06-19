import { defineState } from "eve/context";

export interface TurnObservation {
  readonly actionErrors: number;
  readonly actionNames: readonly string[];
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly inputCharacters: number;
  readonly inputTokens: number;
  readonly outputCharacters: number;
  readonly outputTokens: number;
  readonly steps: number;
  readonly turnId: string | null;
}

export function emptyTurnObservation(turnId: string | null = null): TurnObservation {
  return {
    actionErrors: 0,
    actionNames: [],
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    inputCharacters: 0,
    inputTokens: 0,
    outputCharacters: 0,
    outputTokens: 0,
    steps: 0,
    turnId,
  };
}

export const turnObservation = defineState<TurnObservation>(
  "starter.turn-observation",
  () => emptyTurnObservation(),
);
