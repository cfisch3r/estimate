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

  Scenario: Leaving a live session with unsaved changes names both losses
    Given Alex is facilitating a collaborative session named "Sprint 42"
    And Alex has added the items
      | Login |
    And Sam has joined the session
    When Alex leaves the session
    Then Alex is asked to confirm leaving because of unsaved changes and the session ending for everyone

  Scenario: Leaving right after saving needs no confirmation
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex saves the session
    And Alex leaves the session
    Then Alex is back at mode selection

  Scenario: Leaving right after loading needs no confirmation
    Given Alex has a saved session file "Checkout rework" with the items
      | item                    | state     |
      | Payment provider switch | estimated |
    When Alex loads the saved file
    And Alex continues alone
    And Alex leaves the session
    Then Alex is back at mode selection

  Scenario: Closing the tab with unsaved changes asks for confirmation
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex closes the tab
    Then the browser asks Alex to confirm leaving the page

  Scenario: Going back in the browser keeps a session with unsaved changes
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
    When Alex goes back in the browser
    Then Alex sees the items
      | Payment provider switch |

  Scenario: Going back after reloading the workspace keeps unsaved changes
    Given Alex has started estimating alone and reloaded the page
    And Alex has added the items
      | Payment provider switch |
    When Alex goes back in the browser
    Then Alex sees the items
      | Payment provider switch |
