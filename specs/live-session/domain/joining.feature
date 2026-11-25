Feature: Joining a live session

  The facilitator starts a live session and shares its code. A participant joins
  with the code and their name; nobody joins anonymously. A participant is in
  the session only once they reach the facilitator, and the app tells someone
  who never got in apart from someone who was in and lost the connection.

  Rule: A facilitator starting a session waits for participants

    Scenario: Starting a live session
      When the facilitator starts a live session with the code "7FQK2M"
      Then the session's code is "7FQK2M"
      And the facilitator is named "Facilitator"
      And the facilitator is connecting

  Rule: Joining needs a session code and a name

    Scenario: Joining with a code and a name
      When a participant joins with the code "7FQK2M" and the name "Jordan"
      Then they join the session "7FQK2M" as "Jordan"

    Scenario: A name's surrounding spaces are dropped
      When a participant joins with the code "7FQK2M" and the name " Sam "
      Then they join the session "7FQK2M" as "Sam"

    Scenario: Joining without a code
      When a participant joins with the code "" and the name "Jordan"
      Then the join doesn't go ahead

    Scenario: Joining with a blank name
      When a participant joins with the code "7FQK2M" and the name "  "
      Then the join doesn't go ahead

  Rule: A session code tolerates case and stray spaces

    Scenario: A code copied with spaces in lower case
      When a participant joins with the code " 7fqk2m " and the name "Jordan"
      Then they join the session "7FQK2M" as "Jordan"

  Rule: A participant is in the session only once they reach the facilitator

    Scenario Outline: What a participant's link means
      Given a participant whose link reports "<link>"
      And the participant <facilitator> the facilitator
      Then the participant is "<status>"

      Examples:
        | link         | facilitator     | status       |
        | connected    | has reached     | connected    |
        | connected    | hasn't reached  | connecting   |
        | connecting   | hasn't reached  | connecting   |
        | disconnected | hasn't reached  | disconnected |

    Scenario: A facilitator is connected as soon as anyone is there
      Given a facilitator whose link reports "connected"
      Then the facilitator is "connected"

  Rule: Never getting in stays apart from losing the connection

    Scenario: A participant who never got in
      Given a participant who is connecting
      When the link reports "disconnected"
      Then the participant has never been in the session

    Scenario: A participant who was in and lost it
      Given a participant who is connecting
      When the link reports "connected"
      And then the link reports "disconnected"
      Then the participant has been in the session before
