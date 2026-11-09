Feature: A late joiner catches up with the running round

  @baseline
  Scenario: A participant joining mid-round sees the current item and progress
    Given a facilitator has started a collaborative session
    And the item "Checkout redesign" is active
    And Sam has joined the session
    And Sam has submitted an estimate
    When Jordan joins the session
    Then Jordan sees the item "Checkout redesign"
    And Jordan sees that 1 of 2 teammates has submitted
