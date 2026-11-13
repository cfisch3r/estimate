Feature: Reading a saved session file

  A saved file is the only way a session outlives its browser tab. Reading it
  restores the whole session, or nothing at all: a file that breaks a rule is
  rejected with a reason the user can act on. A running live round is never
  part of the file, because its estimates belong to participants of a session
  that no longer exists.

  Rule: A file is restored whole or rejected with a reason

    Background:
      Given the file
        """
        {
          "version": 1,
          "sessionName": "Checkout rework",
          "unit": "days",
          "items": [
            {
              "id": "a",
              "title": "Payment provider switch",
              "description": "",
              "notes": "",
              "finalResult": { "min": 3, "expected": 5.8, "max": 12, "ci90": 9.6 }
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

    Scenario: A version-1 file restores the session
      When it is read
      Then the session is named "Checkout rework" and estimated in days
      And it has the items
        | item                    | state         |
        | Payment provider switch | estimated     |
        | Address autocomplete    | not estimated |

    Scenario Outline: A file that breaks a rule is rejected with its reason
      Given its <field> is <value>
      When it is read
      Then it is rejected with the reason: <reason>

      Examples:
        | field                         | value    | reason                                                                                 |
        | version                       | 2        | This file was saved by a newer version of EstiMate.                                    |
        | unit                          | "months" | The unit "months" isn't one EstiMate can estimate in.                                  |
        | items[0].title                | ""       | Item 1 has no title.                                                                   |
        | items[0].finalResult.min      | 13       | Item 1, "Payment provider switch", has a range where the minimum is above the maximum. |
        | items[0].finalResult.expected | 15       | Item 1, "Payment provider switch", has an expected value outside its range.            |

  Rule: A file only holds what outlives the session's tab

    Scenario: A saved session reads back without its running round
      Given a session named "Sprint 42" estimated in weeks with the items
        | item   | state              |
        | Login  | estimated          |
        | Search | in a running round |
      When it is saved and read back
      Then the session is named "Sprint 42" and estimated in weeks
      And it has the items
        | item   | state         |
        | Login  | estimated     |
        | Search | not estimated |

  Rule: Anything else is not a session file

    Scenario Outline: A file that isn't a session file is rejected
      Given the file contains <content>
      When it is read
      Then it is rejected with the reason: This isn't an EstiMate session file.

      Examples:
        | content                                            |
        | {"version": 1, "sessionName":                      |
        | []                                                 |
        | {"hello": "world"}                                 |
        | {"version": 1, "sessionName": "x", "unit": "days"} |
