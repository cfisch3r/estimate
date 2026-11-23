@fail
Feature: Name of a saved session file

  Saved sessions pile up in a downloads folder, so the file name tells them
  apart: the session name, then the local calendar date it was saved on, then
  .estimate.json. The browser saves the file under the name the save reports.

  Background:
    Given a browser tab

  Scenario: The file is named after the session and its save date
    Given a saved session named "Checkout rework"
    When the tab saves it on 2026-11-12
    Then the browser saves the file as "checkout-rework-2026-11-12.estimate.json"

  Scenario: A single-digit month and day are written with two digits
    Given a saved session named "Checkout rework"
    When the tab saves it on 2026-03-05
    Then the browser saves the file as "checkout-rework-2026-03-05.estimate.json"

  Scenario Outline: The session name becomes a filename-safe slug
    Given a saved session named "<session name>"
    When the tab saves it on 2026-11-12
    Then the browser saves the file as "<slug>-2026-11-12.estimate.json"

    Examples:
      | session name                  | slug                      |
      | Sprint 42: Payments & Search! | sprint-42-payments-search |
      |   Checkout    rework          | checkout-rework           |
      | Café Übersicht                | cafe-ubersicht            |
      | 2026                          | 2026                      |

  Scenario Outline: A session without a usable name gets a generic file name
    Given a saved session named "<session name>"
    When the tab saves it on 2026-11-12
    Then the browser saves the file as "estimate-session-2026-11-12.estimate.json"

    Examples:
      | session name |
      |              |
      | !!!          |
