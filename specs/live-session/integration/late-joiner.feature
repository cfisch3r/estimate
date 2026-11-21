Feature: A browser joining a session that has been running for a while connects

  A browser that has been in a session for a while has prepared its connection
  offers long ago. A browser joining later must still connect to every one of them.

  Scenario: A browser joining after a minute connects to everyone
    Given browsers "A", "B" and "C" have joined the same session
    And a minute has passed in browsers "A", "B" and "C"
    When browser "D" joins the same session
    Then browsers "A", "B", "C" and "D" are all connected to each other
