Feature: Warn before unsaved changes are lost

  A session survives only if it is saved to a file. While the session has
  changes that are not in the last saved or loaded file, leaving it or
  closing the tab asks for confirmation first.

  Scenario: Leaving with unsaved changes asks for confirmation
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex leaves the session
    Then Alex is asked to confirm leaving because of unsaved changes

  Scenario: Leaving right after saving needs no confirmation
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex saves the session
    And Alex leaves the session
    Then Alex is back at mode selection

  Scenario: Closing the tab with unsaved changes asks for confirmation
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex closes the tab
    Then the browser asks Alex to confirm leaving the page
