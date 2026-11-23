Feature: An item's group range

  At reveal, everyone's estimates for an item become one group range: the lowest
  best case, the median likely case and the highest worst case. The extremes are
  kept rather than averaged, because the worst case in particular tends to get
  averaged down. The 90% value then follows from that range with McConnell's
  formula. In Manual mode the facilitator enters a single estimate, which is its
  own group range.

  Rule: The group range keeps the extremes and takes the median likely case

    Scenario: Three estimates give one group range
      Given the estimates
        | participant | best | likely | worst |
        | Ana         | 2    | 5      | 8     |
        | Ben         | 1    | 6      | 10    |
        | Caro        | 3    | 4      | 9     |
      When they are aggregated
      Then the group range is
        | minimum | expected | maximum |
        | 1       | 5        | 10      |

    Scenario: One high worst case raises the group's worst case
      Given the estimates
        | participant | best | likely | worst |
        | Ana         | 2    | 4      | 6     |
        | Ben         | 2    | 4      | 6     |
        | Caro        | 2    | 4      | 20    |
      When they are aggregated
      Then the group range is
        | minimum | expected | maximum |
        | 2       | 4        | 20      |

    Scenario: With an even number of estimates the expected value is the mean of the two middle likely cases
      Given the estimates
        | participant | best | likely | worst |
        | Ana         | 1    | 1      | 5     |
        | Ben         | 1    | 2      | 5     |
        | Caro        | 1    | 3      | 5     |
        | Dana        | 1    | 4      | 5     |
      When they are aggregated
      Then the group range is
        | minimum | expected | maximum |
        | 1       | 2.5      | 5       |

    Scenario: A single estimate is its own group range
      Given the estimates
        | participant | best | likely | worst |
        | Facilitator | 3    | 5      | 9     |
      When they are aggregated
      Then the group range is
        | minimum | expected | maximum |
        | 3       | 5        | 9       |

  Rule: The 90% value is the expected value plus 1.28 times a third of the range

    Scenario Outline: The 90% value follows from the group range
      Given the estimates
        | participant | best   | likely   | worst   |
        | Facilitator | <best> | <likely> | <worst> |
      When they are aggregated
      Then the 90% value is <90% value>

      Examples:
        | best | likely | worst | 90% value | why                               |
        | 3    | 5      | 9     | 7.56      | 5 + 1.28 × (6 / 3)                |
        | 1    | 4      | 10    | 7.84      | 4 + 1.28 × (9 / 3)                |
        | 10   | 10     | 10    | 10        | no spread: the expected value     |
