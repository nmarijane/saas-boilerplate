/**
 * Whether a value of type `Value` is accepted where `Target` is expected. A test
 * of what a type refuses reads it with `expectTypeOf<Accepts<...>>().toEqualTypeOf<false>()`:
 * `tsc` reads the assertion (`npm run check:types`), the test run does not, so a
 * rule of a type is held by the type check and not by a comment that silences it.
 * `[Value] extends [Target]` keeps a union from being read one member at a time.
 */
export type Accepts<Target, Value> = [Value] extends [Target] ? true : false;
