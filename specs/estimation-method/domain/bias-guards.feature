Feature: Bias guards

  Three-point estimates fall into known traps: a symmetric range, false
  precision, a worst case too close to the best case for how uncertain the item
  still is, and one participant's view silently averaged away. The bias guards
  nudge against them. They never block submitting or finalizing; they only
  prompt a second look.

  Rule: A symmetric range gets a nudge

    The two spans, best to likely and likely to worst, count as symmetric when
    they differ by at most 15% of the whole range. In software the worst case
    usually needs more room than the best case.

    Scenario Outline: Whether a range looks symmetric
      When the range <best> / <likely> / <worst> is entered
      Then the symmetric-range nudge <nudge>

      Examples:
        | best | likely | worst | spans              | nudge          |
        | 2    | 5      | 8     | 3 and 3            | shows          |
        | 2    | 10.5   | 22    | differ by 15%      | shows          |
        | 2    | 10.4   | 22    | differ by 16%      | does not show  |
        | 2    | 4      | 10    | differ by 50%      | does not show  |
        | 5    | 5      | 5     | no range at all    | does not show  |

  Rule: A value finer than the unit's granularity gets a rounding suggestion

    Hours are estimated in whole hours, days and weeks in halves.

    Scenario Outline: Whether a value gets a rounding suggestion
      Given the session is estimated in <unit>
      When the value <value> is entered
      Then the rounding suggestion <suggestion>

      Examples:
        | unit  | value | suggestion     |
        | days  | 3.7   | shows          |
        | days  | 3.5   | does not show  |
        | days  | 4     | does not show  |
        | hours | 6     | does not show  |
        | hours | 6.25  | shows          |
        | hours | 3.5   | shows          |
        | weeks | 2.5   | does not show  |
        | weeks | 2.25  | shows          |

  Rule: A range narrower than its phase's guidance gets a nudge, one that meets it a calm confirmation

    Each participant picks the item's phase on the cone of uncertainty. The phase
    sets a guidance ceiling for the worst case: the best case times the phase's
    high multiplier divided by its low multiplier.

    Scenario Outline: Each phase sets its own guidance ceiling
      Given the phase "<phase>"
      When the best case 10 is entered
      Then the guidance ceiling is <ceiling>

      Examples:
        | phase                       | ceiling | multipliers  |
        | Initial Concept             | 160     | 4 / 0.25     |
        | Approved Product Definition | 40      | 2 / 0.5      |
        | Requirements Complete       | 22.39   | 1.5 / 0.67   |
        | UI Complete                 | 15.625  | 1.25 / 0.8   |
        | Detailed Design Complete    | 12.22   | 1.10 / 0.9   |

    Scenario Outline: A worst case below the ceiling gets a nudge
      Given the phase "Requirements Complete"
      When the range 10 to <worst> is entered
      Then the range gets <response>

      Examples:
        | worst | response              |
        | 10    | the narrow-range nudge |
        | 15    | the narrow-range nudge |
        | 100   | a calm confirmation   |

    Scenario: A worst case exactly at the ceiling gets a calm confirmation
      Given the phase "Requirements Complete"
      When the range 10 to the guidance ceiling is entered
      Then the range gets a calm confirmation

    Scenario Outline: The same range is narrow early on and fine late
      Given the phase "<phase>"
      When the range 10 to 20 is entered
      Then the range gets <response>

      Examples:
        | phase                    | response               |
        | Initial Concept          | the narrow-range nudge |
        | Detailed Design Complete | a calm confirmation    |

    Scenario Outline: A range that breaks an estimate rule gets no phase guidance
      The estimate form shows the broken rule instead, so the participant isn't
      nudged to widen a range that has to be fixed first.

      Given the phase "Requirements Complete"
      When the range <best> to <worst> is entered
      Then the range gets no phase guidance

      Examples:
        | best | worst | why                    |
        | 0    | 10    | a best case of 0       |
        | -5   | 10    | a negative best case   |
        | 10   | 5     | worst below best       |
        | 10   | 0     | worst below best, at 0 |

  Rule: A participant whose estimate stands apart from the others is flagged

    A participant is compared with the others only, never with a range that
    already includes their own estimate. They stand apart when their range
    doesn't overlap the others' range at all, or when their likely case is more
    than 40% of the others' range away from the others' median likely case. The
    flag is meant for the reveal: it highlights them to prompt discussion, and
    doesn't hide them.

    Scenario Outline: Whether a participant stands apart from a group that agrees
      Given the estimates
        | participant | best   | likely   | worst   |
        | Ana         | 2      | 4        | 6       |
        | Ben         | 2      | 4        | 6       |
        | Caro        | 2      | 4        | 6       |
        | Dana        | <best> | <likely> | <worst> |
      When they are compared with each other
      Then Dana is <flag>

      Examples:
        | best | likely | worst | why                                | flag        |
        | 10   | 15     | 20    | no overlap with the others          | flagged     |
        | 2    | 5.7    | 6     | likely case 42.5% away              | flagged     |
        | 2    | 5.5    | 6     | likely case 37.5% away              | not flagged |
        | 2    | 4      | 6     | the same estimate as the others     | not flagged |

    Scenario: In a group of two who disagree, both are flagged
      Given the estimates
        | participant | best | likely | worst |
        | Ana         | 2    | 4      | 6     |
        | Dana        | 10   | 15     | 20    |
      When they are compared with each other
      Then Ana is flagged
      And Dana is flagged

    Scenario: A single estimate is never flagged
      Given the estimates
        | participant | best | likely | worst |
        | Ana         | 2    | 4      | 6     |
      When they are compared with each other
      Then Ana is not flagged

    Scenario Outline: When the others all agree on one value, only overlap counts
      Given the estimates
        | participant | best   | likely   | worst   |
        | Ana         | 5      | 5        | 5       |
        | Ben         | 5      | 5        | 5       |
        | Dana        | <best> | <likely> | <worst> |
      When they are compared with each other
      Then Dana is <flag>

      Examples:
        | best | likely | worst | why                                     | flag        |
        | 4    | 6      | 8     | overlaps 5, though the likely case is 6| not flagged |
        | 6    | 7      | 8     | no overlap with 5                       | flagged     |
