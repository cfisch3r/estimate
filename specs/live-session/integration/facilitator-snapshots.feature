Feature: A participant takes the session's state only from the facilitator

  The facilitator owns the session's state and sends it to everyone as a
  snapshot. In a peer-to-peer room any peer can send one, so a participant's
  session hands on only the snapshots of the peer that announced itself as the
  facilitator. A snapshot sent before that announce is dropped; the participant
  asks the facilitator for one once it knows who that is.

  One peer's messages arrive in the order it sent them, so once a browser has a
  peer's announce, any snapshot that peer sent before it has arrived too.

  Rule: A participant takes a snapshot only from the facilitator

    Scenario: The facilitator's snapshot reaches a participant
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      And browser "F" has announced itself as the facilitator
      When browser "F" sends a snapshot of the item "Login"
      Then browser "P" takes the snapshot of "Login"

    Scenario: Another peer's snapshot doesn't reach a participant
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      And browser "X" has joined it as another facilitator
      And browser "F" has announced itself as the facilitator
      When browser "X" sends a snapshot of the item "Forged", then announces itself as a participant
      Then browser "P" takes no snapshot of "Forged"

    Scenario: A snapshot sent before the facilitator announced itself is dropped
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      When browser "F" sends a snapshot of the item "Early", then announces itself as the facilitator
      Then browser "P" takes no snapshot of "Early"

  Rule: A participant keeps the facilitator while it is there

    Scenario: A second peer claiming to be the facilitator is ignored
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      And browser "X" has joined it as another facilitator
      And browser "F" has announced itself as the facilitator
      When browser "X" announces itself as the facilitator, sends a snapshot of the item "Forged", then announces itself as a participant
      Then browser "P" takes no snapshot of "Forged"

  Rule: A participant's estimate and snapshot request go to the facilitator

    Scenario: The facilitator gets a participant's estimate
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      And browser "F" has announced itself as the facilitator
      When browser "P" sends an estimate for the item "Login"
      Then browser "F" gets the estimate for "Login"

    Scenario: The facilitator answers a participant's snapshot request
      Given browser "F" has started a session as the facilitator
      And browser "P" has joined it as a participant
      And browser "F" has announced itself as the facilitator
      And browser "F" answers snapshot requests with the item "Login"
      When browser "P" asks the facilitator for a snapshot
      Then browser "P" gets the snapshot of "Login"
