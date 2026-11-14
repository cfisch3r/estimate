Feature: A finalized item's result

  A final result is the four values an item is finalized with: the minimum, the
  expected value, the maximum and the 90% value McConnell's formula derives from
  them. Whatever produces one — aggregating estimates, or reading a saved file —
  goes through the same check, so no result that breaks a rule reaches a session.

  Rule: A final result is valid only when it keeps every rule

    Scenario: A consistent result is accepted
      When a final result is made of
        | minimum | expected | maximum | 90% value |
        | 3       | 5.8      | 12      | 9.64      |
      Then the final result is accepted

    Scenario Outline: A result that breaks a rule is rejected with its reason
      When a final result is made of
        | minimum   | expected   | maximum   | 90% value |
        | <minimum> | <expected> | <maximum> | <ci90>    |
      Then the final result is rejected because it <reason>

      Examples:
        | minimum  | expected | maximum | ci90  | reason                                             |
        | Infinity | 5.8      | 12      | 9.64  | has a value that isn't a finite number             |
        | 0        | 5.8      | 12      | 10.92 | has a minimum of 0 or less                         |
        | -3       | 5.8      | 12      | 12.2  | has a minimum of 0 or less                         |
        | 15       | 13.5     | 12      | 12.22 | has a range where the minimum is above the maximum |
        | 3        | 15       | 12      | 18.84 | has an expected value outside its range            |
        | 3        | 5.8      | 12      | 9.6   | has a 90% value that doesn't match its range       |
