Feature: A file handed to the browser reaches the user as named

  Scenario: A downloaded file keeps its name and its text
    Given a browser tab
    When the tab downloads "estimate-session-2026-11-19.json" with the text '{"items":[]}'
    Then the browser saves a file named "estimate-session-2026-11-19.json"
    And the saved file contains exactly '{"items":[]}'

  Scenario: A downloaded file keeps non-ASCII text byte for byte
    Given a browser tab
    When the tab downloads "Schätzung ✓.json" with the text '{"sessionName":"Schätzung – Q4 ✓"}'
    Then the browser saves a file named "Schätzung ✓.json"
    And the saved file contains exactly '{"sessionName":"Schätzung – Q4 ✓"}'
