Feature: What an estimate may hold

  An estimate is one participant's best, likely and worst case for an item, in
  the session's unit. Wherever it comes from — the estimate form, a peer's
  message, or the facilitator's reconciled value in Manual mode — it has to keep
  these rules, so aggregating estimates never starts from a range that makes no
  sense. A rejected estimate names the values that break the rule, so they can
  be fixed.

  Rule: An estimate is ordered best ≤ likely ≤ worst, and every value is a finite number above 0

    A likely or worst case of 0 or less always breaks the order, because the best
    case has to be above 0 and no larger than either. Such an estimate is
    rejected for its order, not for the value itself.

    Scenario Outline: A consistent estimate is accepted
      When an estimate is made of
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the estimate is accepted

      Examples:
        | best | likely | worst | why                   |
        | 2    | 5      | 8     | ascending             |
        | 5    | 5      | 5     | equal values are fine |

    @fail
    Scenario Outline: An estimate that breaks a rule is rejected with its reason
      When an estimate is made of
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the estimate is rejected because it <reason>
      And the values breaking it are <values>

      Examples:
        | best | likely   | worst     | reason                                 | values           |
        | NaN  | 5        | 8         | has a value that isn't a finite number | best             |
        | 2    | Infinity | 8         | has a value that isn't a finite number | likely           |
        | 2    | 5        | -Infinity | has a value that isn't a finite number | worst            |
        | NaN  | 5        | Infinity  | has a value that isn't a finite number | best and worst   |
        | 0    | 5        | 8         | has a best case of 0 or less           | best             |
        | -2   | 0        | 3         | has a best case of 0 or less           | best             |
        | 8    | 5        | 9         | has a best case above its likely case  | best and likely  |
        | 2    | 9        | 8         | has a likely case above its worst case | likely and worst |
        | 2    | -1       | 8         | has a best case above its likely case  | best and likely  |
        | 2    | 0        | 8         | has a best case above its likely case  | best and likely  |
        | 2    | 5        | -3        | has a likely case above its worst case | likely and worst |

  Rule: The order is checked among the values given so far

    A participant gives one value at a time. A best case of 9 and a worst case
    of 4 are wrong whatever the likely case will be, so the order doesn't wait
    for all three values.

    Scenario Outline: Values given so far that break the order
      When only these values are given
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the order is broken by <values>

      Examples:
        | best | likely | worst | values           |
        | 10   | 5      |       | best and likely  |
        |      | 9      | 4     | likely and worst |
        | 9    |        | 4     | best and worst   |

    Scenario Outline: Values given so far that keep the order
      When only these values are given
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the order is not broken

      Examples:
        | best | likely | worst | why                       |
        | 1    |        | 4     | best below worst          |
        | 2    | 2      | 2     | equal values are fine     |
        |      |        |       | nothing given yet         |

  Rule: No value may be above 1,000,000, in any unit

    The limit is far above any real estimate. It exists so that aggregating
    estimates, however large, always gives a final result that keeps its rules.

    Scenario: The largest value is accepted
      When an estimate is made of
        | best | likely | worst   |
        | 1    | 2      | 1000000 |
      Then the estimate is accepted

    @fail
    Scenario Outline: A value above the largest is rejected
      When an estimate is made of
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the estimate is rejected because it has a value above 1,000,000
      And the values breaking it are <values>

      Examples:
        | best    | likely  | worst   | values                  |
        | 2       | 5       | 1000001 | worst                   |
        | 2000000 | 3000000 | 4000000 | best, likely and worst  |

    Scenario: Estimates at the largest value still give a final result
      Given the estimates
        | participant | best    | likely  | worst   |
        | Ana         | 1000000 | 1000000 | 1000000 |
        | Ben         | 1       | 1000000 | 1000000 |
      When they are aggregated
      Then the group range is a valid final result

  Rule: An estimate that breaks several rules is rejected with the first of them

    The rules are checked in this order: a value that isn't a finite number, a
    value above 1,000,000, a best case of 0 or less, then the order, best above
    likely before likely above worst. Only the first broken rule is reported.

    @fail
    Scenario Outline: The first broken rule is the reason
      When an estimate is made of
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the estimate is rejected because it <reason>
      And the values breaking it are <values>

      Examples:
        | best | likely | worst   | also broken                     | reason                                 | values          |
        | NaN  | 5      | 2000000 | a value above 1,000,000          | has a value that isn't a finite number | best            |
        | 0    | 5      | 2000000 | a best case of 0 or less         | has a value above 1,000,000            | worst           |
        | 0    | 5      | 3       | likely above worst               | has a best case of 0 or less           | best            |
        | 10   | 5      | 3       | likely above worst               | has a best case above its likely case  | best and likely |

  Rule: A rejected estimate is described by the rule it breaks

    Each rule has one description, so a rejected estimate can be reported in
    words wherever it came from.

    @fail
    Scenario Outline: Each broken rule has its own description
      When an estimate is made of
        | best   | likely   | worst   |
        | <best> | <likely> | <worst> |
      Then the estimate is described as "<description>"

      Examples:
        | best | likely | worst   | description                                         |
        | NaN  | 5      | 8       | best, likely, and worst must all be finite numbers  |
        | 2    | 5      | 1000001 | best, likely, and worst must all be at most 1000000 |
        | 0    | 5      | 8       | best, likely, and worst must all be greater than 0  |
        | 8    | 5      | 9       | best must be ≤ likely                               |
        | 2    | 9      | 8       | likely must be ≤ worst                              |
