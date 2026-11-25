Feature: A late joiner or a reconnecting participant lands on the right view

  The facilitator owns the live session's state. A participant who joins late,
  or whose connection drops and comes back, takes everything from the
  facilitator's latest snapshot, whatever they missed while away. Their own
  estimate survives a reconnect only if it still belongs to the running round.

  Rule: A participant takes the active item and its progress from the snapshot

    Scenario: Joining mid-round
      Given the facilitator's active item is "Login" in round 0
      And 1 of 2 participants has submitted
      When Jordan takes the snapshot, having seen nothing before
      Then Jordan sees the item "Login"
      And Jordan sees that 1 of 2 participants has submitted
      And the round is open for Jordan's estimate

    Scenario: Joining while the round is revealed
      Given the facilitator's active item is "Login" in round 0
      And the round is revealed with the estimates of Sam and Alex
      When Jordan takes the snapshot, having seen nothing before
      Then Jordan sees the revealed estimates of Sam and Alex

    Scenario: Joining on an item finalized before the session started
      Given the facilitator's active item is "Login", finalized in a loaded session
      When Jordan takes the snapshot, having seen nothing before
      Then Jordan sees the final result of "Login"
      And the round is not open for Jordan's estimate

    Scenario: The facilitator moves to no item
      Given Jordan has seen the round on "Login"
      And the facilitator has no active item
      When Jordan takes the snapshot
      Then Jordan has no round to estimate

    Scenario: A participant takes the session's name and unit
      Given the facilitator's session is named "Sprint 42" and estimated in weeks
      When Jordan takes the snapshot
      Then Jordan sees the session name "Sprint 42"
      And Jordan estimates in weeks

  Rule: A participant's own estimate survives a reconnect only within the same round

    Scenario Outline: Reconnecting after submitting
      Given Jordan has submitted an estimate for "Login" in round 1
      And Jordan's connection drops
      When Jordan reconnects and the facilitator's active item is "<item>" in round <round>
      Then Jordan's own estimate is <kept>

      Examples:
        | item   | round | kept    |
        | Login  | 1     | kept    |
        | Login  | 2     | dropped |
        | Search | 1     | dropped |

  Rule: The same participant id counts once in a round

    Scenario: A participant's second estimate replaces the first
      Given the round on "Login" has the estimates
        | participant | best | likely | worst |
        | Sam         | 2    | 3      | 5     |
        | Jordan      | 3    | 4      | 8     |
      When an estimate of 1, 2 and 4 arrives from Sam again
      Then the round has the estimates
        | participant | best | likely | worst |
        | Sam         | 1    | 2      | 4     |
        | Jordan      | 3    | 4      | 8     |

  Rule: The facilitator counts an estimate only for the open round of the active item

    Background:
      Given the facilitator's active item is "Login" in round 1

    Scenario: An estimate for the open round counts
      When an estimate from Sam arrives for "Login" in round 1
      Then the round has Sam's estimate

    Scenario Outline: A late or stale estimate is dropped
      Given <situation>
      When an estimate from Sam arrives for "<item>" in round <round>
      Then the estimate is dropped

      Examples:
        | situation             | item   | round |
        | the round is open     | Search | 1     |
        | the round is open     | Login  | 0     |
        | the round is revealed | Login  | 1     |
        | the item is finalized | Login  | 1     |
