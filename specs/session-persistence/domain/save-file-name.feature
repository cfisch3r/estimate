Feature: Name of a saved session file

  Saved sessions pile up in a downloads folder, so the filename tells them
  apart: the session name, then the local calendar date it was saved on.

  Scenario: The file is named after the session and its save date
    Given a session named "Checkout rework"
    When it is saved on 2026-11-12
    Then the file is named "checkout-rework-2026-11-12.estimate.json"

  Scenario: A single-digit month and day are written with two digits
    Given a session named "Checkout rework"
    When it is saved on 2026-03-05
    Then the file is named "checkout-rework-2026-03-05.estimate.json"

  Scenario Outline: The session name becomes a filename-safe slug
    Given a session named "<session name>"
    When it is saved on 2026-11-12
    Then the file is named "<slug>-2026-11-12.estimate.json"

    Examples:
      | session name                  | slug                      |
      | Sprint 42: Payments & Search! | sprint-42-payments-search |
      |   Checkout    rework          | checkout-rework           |
      | Café Übersicht                | cafe-ubersicht            |

  Scenario Outline: A session without a usable name gets a generic file name
    Given a session named "<session name>"
    When it is saved on 2026-11-12
    Then the file is named "estimate-session-2026-11-12.estimate.json"

    Examples:
      | session name |
      |              |
      | !!!          |
