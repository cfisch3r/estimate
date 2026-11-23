@fail
Feature: Reading and writing a session file

  A session file is how a saved session leaves the browser and comes back.
  Saving hands it to the user as a download; opening reads a file the user
  picked. The file adapter writes and reads the version-1 format, so a file
  saved by an earlier release keeps opening.

  A picked file is untrusted. One the browser can't read, or that isn't a
  version-1 session file, is rejected. A session file whose session breaks a
  rule is rejected with the reason the domain gives (the rules are in
  domain/saved-session.feature).

  Background:
    Given a browser tab

  Rule: A saved file opens as the session it was saved from

    Scenario: A saved session reads back whole
      Given a saved session named "Schätzung – Q4 ✓" estimated in weeks with the items
        | item   | state         |
        | Login  | estimated     |
        | Search | not estimated |
      When the tab saves it
      And the user opens the file the browser saved
      Then the tab opens the same session

    Scenario: A file saved by an earlier release still opens
      When the user opens a file containing
        """
        {
          "version": 1,
          "sessionName": "Checkout rework",
          "unit": "days",
          "items": [
            {
              "id": "a",
              "title": "Payment provider switch",
              "description": "Move to the new provider",
              "notes": "Contract ends in March",
              "finalResult": { "min": 3, "expected": 5.8, "max": 12, "ci90": 9.64 }
            },
            {
              "id": "b",
              "title": "Address autocomplete",
              "description": "",
              "notes": "",
              "finalResult": null
            }
          ]
        }
        """
      Then the tab opens a session named "Checkout rework" estimated in days with the items
        | item                    | state         | description              | notes                  |
        | Payment provider switch | estimated     | Move to the new provider | Contract ends in March |
        | Address autocomplete    | not estimated |                          |                        |

  Rule: Any other file is rejected, with the reason

    Scenario: A file from a newer version is rejected
      When the user opens a session file of version 2
      Then it is rejected as saved by a newer version of EstiMate

    Scenario Outline: A file that isn't a session file is rejected
      When the user opens a file containing '<content>'
      Then it is rejected as not a session file

      Examples:
        | content                                                           |
        | {"version": 1, "sessionName":                                     |
        | []                                                                |
        | {"hello": "world"}                                                |
        | {"version": 1, "sessionName": "x", "unit": "days"}                |
        | {"version": 0, "sessionName": "x", "unit": "days", "items": []}   |
        | {"version": "1", "sessionName": "x", "unit": "days", "items": []} |

    Scenario: A session file whose session breaks a rule is rejected with the domain's reason
      When the user opens a session file whose item 2 has the same id as item 1
      Then it is rejected because item 2 has the same id as item 1

    Scenario: A file that can no longer be read is rejected
      Given the user picked a file that was deleted afterwards
      When the tab opens it
      Then it is rejected as unreadable
