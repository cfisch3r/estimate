Feature: Save a session to a file and resume it later

  A session lives only in the open browser tab. Saving downloads it as a file;
  loading that file on mode selection restores it, in either mode.

  Scenario: A saved session is resumed in single-user mode
    Given Alex is estimating alone in a session named "Checkout rework"
    And Alex has added the items
      | Payment provider switch |
      | Address autocomplete    |
    And Alex has finalized
      | item                    | best | likely | worst |
      | Payment provider switch | 3    | 5      | 12    |
    When Alex saves the session
    And Alex leaves the session
    And Alex loads the saved file
    And Alex continues alone
    Then Alex sees the session named "Checkout rework"
    And Alex is estimating "Address autocomplete"
    And Alex sees the finalized estimates
      | item                    | best | likely | worst |
      | Payment provider switch | 3    | 5      | 12    |

  Scenario: A saved session is resumed as a live session
    Given Alex has a saved session file "Sprint 42" with the items
      | item   | state         |
      | Login  | estimated     |
      | Search | not estimated |
    When Alex loads the saved file
    And Alex starts a collaborative session
    And Sam joins the session
    Then Alex sees the items
      | Login  |
      | Search |
    And Sam is estimating "Search"

  Scenario: A damaged session file is rejected
    Given Alex has a saved session file with the estimated item "Login", changed to
      | minimum | 9 |
      | maximum | 3 |
    When Alex loads the saved file
    Then Alex is told the file can't be loaded
    And Alex has no session loaded
