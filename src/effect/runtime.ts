import { Effect } from 'effect';

export function runEffect<A, E>(program: Effect.Effect<A, E, never>): Promise<A> {
  return Effect.runPromise(Effect.either(program)).then((result) => {
    if (result._tag === 'Left') {
      throw result.left;
    }

    return result.right;
  });
}
