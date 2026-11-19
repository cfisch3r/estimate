Feature: A tester can report how their live session connected

  @fail
  Scenario: A participant's diagnosis report shows how the session connected, without names or content
    Given a facilitator has started a collaborative session
    And the item "Checkout redesign" is active
    And Imogen has joined the session
    When Imogen opens the connection diagnosis
    Then Imogen's diagnosis report shows the session as connected
    And Imogen's diagnosis report lists the candidate types of a WebRTC connection
    And Imogen's diagnosis report does not mention "Imogen" or "Checkout redesign"
