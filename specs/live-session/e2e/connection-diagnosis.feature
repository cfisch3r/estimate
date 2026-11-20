Feature: A tester can report how their live session connected

  Scenario: A participant's diagnosis report shows how the session connected, without names or content
    Given a facilitator has started a collaborative session
    And the item "Checkout redesign" is active
    And Imogen has joined the session
    When Imogen opens the connection diagnosis
    Then Imogen's diagnosis report shows the session as "connected"
    And Imogen's diagnosis report lists a "host" candidate
    And Imogen's diagnosis report does not mention "Imogen" or "Checkout redesign"

  @fail
  Scenario: A participant who couldn't join opens the diagnosis from the problem notice
    Given Imogen has tried to join a session nobody is running
    When Imogen follows "Show diagnosis" on the problem notice
    Then the connection diagnosis opens in a new tab
    And Imogen's diagnosis report shows the session as "connecting"
