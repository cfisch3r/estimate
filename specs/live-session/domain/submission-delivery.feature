Feature: A submission counts once the facilitator has it

  A participant's estimate only counts once it has reached the facilitator. The
  participant sees whether it has, and an estimate lost on the way is sent
  again after a reconnect, so nobody's estimate silently goes missing.

  Rule: The facilitator's roster decides whether an estimate has arrived

    Scenario Outline: What a participant sees about their own estimate
      Given Jordan has sent an estimate
      And the send <send>
      And the facilitator's roster <roster>
      Then Jordan's estimate is shown as "<shown>"

      Examples:
        | send                    | roster                     | shown         |
        | hasn't failed           | doesn't show it yet        | sending       |
        | failed                  | doesn't show it            | not delivered |
        | hasn't failed           | shows it as submitted      | submitted     |
        | failed                  | shows it as submitted      | submitted     |

  Rule: After a reconnect, an estimate the facilitator lacks is sent again

    Scenario Outline: Whether a reconnecting participant sends their estimate again
      Given Jordan <submitted>
      And the round <state>
      And the facilitator's roster <roster>
      When Jordan takes the facilitator's snapshot after reconnecting
      Then Jordan's estimate is <resent>

      Examples:
        | submitted                   | state           | roster                | resent        |
        | has submitted an estimate   | is open         | doesn't show it       | sent again    |
        | has submitted an estimate   | is open         | shows it as submitted | not sent again |
        | has submitted an estimate   | is revealed     | doesn't show it       | not sent again |
        | hasn't submitted            | is open         | doesn't show it       | not sent again |
