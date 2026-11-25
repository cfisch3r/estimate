Feature: How participants are named

  Participants join with a name, so the team can discuss each other's values
  directly. A name reaches the others when the participant announces it; until
  then they are shown as "Teammate N". The facilitator's reveal panel and every
  participant's revealed view label people the same way.

  Rule: A participant is shown by their announced name, otherwise as "Teammate N"

    Scenario: Named and unnamed participants
      Given the round has the participants
        | participant | announced name |
        | p1          | Sam            |
        | p2          |                |
        | p3          | Alex           |
      Then the participants are labelled "Sam", "Teammate 2" and "Alex"

  Rule: A teammate's number stays the same when someone else announces later

    Scenario: Another participant announcing doesn't renumber the rest
      Given the round has the unnamed participants p1, p2 and p3
      And they are labelled "Teammate 1", "Teammate 2" and "Teammate 3"
      When p2 announces the name "Jordan"
      Then the participants are labelled "Teammate 1", "Jordan" and "Teammate 3"

  Rule: Your own row is labelled as yours and takes no number

    Scenario: A participant's own row in their revealed view
      Given the round has the unnamed participants p1, p2 and p3
      When p2 looks at the revealed round, with their own row labelled "You"
      Then the participants are labelled "Teammate 1", "You" and "Teammate 2"

  Rule: A participant who leaves keeps their name only while it is still needed

    Scenario Outline: Whether a departed participant's name is kept
      Given Sam has left the session
      And Sam <submitted>
      And <tabs>
      Then Sam's name is <kept>

      Examples:
        | submitted                       | tabs                                  | kept      |
        | hasn't submitted                | no other tab of Sam's is connected    | forgotten |
        | has submitted an estimate       | no other tab of Sam's is connected    | kept      |
        | hasn't submitted                | another tab of Sam's is connected     | kept      |
