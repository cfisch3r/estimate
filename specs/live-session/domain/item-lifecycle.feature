Feature: An item's way from pending to finalized

  An item is pending until it is finalized. In Live mode it goes through one or
  more rounds on the way: the participants estimate, the facilitator reveals the
  round, and the team either retries it or finalizes the item. In Manual mode the
  facilitator finalizes it straight from the values the team agreed on.

  How estimates are aggregated is specified in
  estimation-method/domain/aggregation.feature; this feature only shows when an
  item is finalized and from which estimates.

  Rule: An item is finalized from its round's estimates, and needs at least one

    Scenario: Finalizing aggregates the round's estimates
      Given the item "Login" has the revealed estimates
        | participant | best | likely | worst |
        | Sam         | 2    | 3      | 5     |
        | Jordan      | 3    | 4      | 8     |
      When the facilitator finalizes it
      Then its final result is the aggregate of those estimates

    Scenario: A round without estimates can't be finalized
      Given the item "Login" has a revealed round without estimates
      When the facilitator finalizes it
      Then finalizing is refused because no estimates have been submitted yet
      And the item is still pending

  Rule: In Live mode an item is finalized only after its round is revealed

    Scenario: A round that isn't revealed can't be finalized
      Given the item "Login" has the estimates of Sam and Jordan, not yet revealed
      When the facilitator finalizes it
      Then finalizing is refused until the round is revealed
      And the item is still pending

    Scenario: In Manual mode an item is finalized without a reveal
      Given the item "Login" in a Manual-mode session
      When the facilitator finalizes it with the values 2, 3 and 5
      Then its final result is the aggregate of those values

  Rule: Retrying a round starts a new one without its estimates

    Scenario: Retrying a revealed round
      Given the item "Login" in round 1 has the revealed estimates of Sam and Jordan
      When the facilitator retries the round
      Then the item is in round 2
      And the round is not revealed
      And the round has no estimates
      And the item is still pending

  Rule: Reopening a finalized item also clears its final result

    Scenario: Reopening a finalized item
      Given the item "Login" in round 1 is finalized from the revealed estimates of Sam and Jordan
      When the facilitator reopens it
      Then the item is in round 2
      And the round is not revealed
      And the round has no estimates
      And the item is pending again

  Rule: Updating a finalized item replaces its final result

    Scenario: In Manual mode new values replace the final result
      Given the item "Login" in a Manual-mode session is finalized with the values 2, 3 and 5
      When the facilitator finalizes it with the values 4, 6 and 10
      Then its final result is the aggregate of the values 4, 6 and 10
