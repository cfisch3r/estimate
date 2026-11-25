Feature: Nobody sees anyone's values before the reveal

  Participants send their estimates to the facilitator only. What the
  facilitator shares with the participants, the session snapshot, says who has
  submitted but never what, until the facilitator reveals the round. This keeps
  the first estimates independent of each other.

  Rule: Before the reveal, participants learn who has submitted, never what

    Background:
      Given Sam and Jordan have joined the facilitator's session
      And the item "Login" is active
      And Sam has submitted an estimate for it

    Scenario: The snapshot before the reveal holds no values
      When the facilitator shares the session snapshot
      Then the snapshot holds no estimates
      And its roster reads
        | participant | submitted |
        | Sam         | yes       |
        | Jordan      | no        |

    Scenario: The roster says who is still connected
      Given Jordan's connection has dropped
      When the facilitator shares the session snapshot
      Then its roster reads
        | participant | connected |
        | Sam         | yes       |
        | Jordan      | no        |

  Rule: Once revealed, the round's estimates reach everyone

    Scenario: The snapshot after the reveal holds the estimates
      Given Sam and Jordan have joined the facilitator's session
      And the item "Login" is active
      And Sam and Jordan have submitted estimates for it
      When the facilitator reveals the round
      And shares the session snapshot
      Then the snapshot holds the estimates of Sam and Jordan

  Rule: The roster holds every participant who has joined or submitted

    Scenario: An estimate that arrives before its sender's name still counts
      Given Sam has joined the facilitator's session
      And the item "Login" is active
      And an estimate for it arrives from Jordan, who hasn't announced a name yet
      When the facilitator shares the session snapshot
      Then its roster reads
        | participant | submitted |
        | Sam         | no        |
        | Jordan      | yes       |

    Scenario: The facilitator is not a roster member
      Given Sam has joined the facilitator's session
      And the item "Login" is active
      When the facilitator shares the session snapshot
      Then its roster lists only Sam

  Rule: A final result is the group's, so it may reach participants before any reveal

    Scenario: An item finalized before the session started shows its result
      Given the facilitator loaded a session whose item "Login" is already finalized
      And the item "Login" is active
      When the facilitator shares the session snapshot
      Then the snapshot holds the final result of "Login"
      And the snapshot holds no estimates
