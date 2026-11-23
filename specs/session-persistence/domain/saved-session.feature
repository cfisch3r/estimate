Feature: What a saved session keeps

  A saved session is the part of a session that outlives its browser tab: its
  name, its unit, and its items with their descriptions, notes and final
  results. A running live round is never part of it, because its estimates
  belong to participants of a session that won't exist when it is restored.

  A saved session is restored whole or not at all. One that breaks a rule is
  refused, and the refusal names the first item that breaks it, so the user
  can find it.

  The rules a final result has to keep are specified once, in
  estimation-method/domain/final-result.feature. This feature only shows that a
  saved session breaking one of them is refused, naming the item.

  Rule: A saved session keeps only what outlives the tab

    Scenario: Saving leaves a running round out
      Given a session named "Sprint 42" estimated in weeks with the items
        | item   | state              |
        | Login  | estimated          |
        | Search | in a running round |
      When it is saved
      Then the saved session is named "Sprint 42" and estimated in weeks
      And it keeps the items
        | item   | state         |
        | Login  | estimated     |
        | Search | not estimated |

    Scenario: Saving keeps an item's description and notes
      Given a session with the item "Login" described as "OAuth only" with the notes "Ask security first"
      When it is saved and restored
      Then the item "Login" is described as "OAuth only" with the notes "Ask security first"

  Rule: A saved session is restored whole or refused, naming the item

    Background:
      Given a saved session named "Checkout rework" estimated in days with the items
        | id | item                    | state         |
        | a  | Payment provider switch | estimated     |
        | b  | Address autocomplete    | not estimated |

    Scenario: A saved session that keeps every rule is restored
      When it is restored
      Then the session is named "Checkout rework" and estimated in days
      And it has the items
        | item                    | state         |
        | Payment provider switch | estimated     |
        | Address autocomplete    | not estimated |
      And no item is in a running round

    Scenario Outline: A saved session that breaks a rule is refused
      Given <part> is <value>
      When it is restored
      Then it is refused because <reason>

      Examples:
        | part                            | value    | reason                                                                          |
        | its unit                        | "months" | the unit "months" isn't one EstiMate estimates in                               |
        | item 1's id                     | " "      | item 1 has no id                                                                |
        | item 1's title                  | ""       | item 1 has no title                                                             |
        | item 2's id                     | "a"      | item 2 has the same id as item 1                                                |
        | item 1's final result minimum   | -1       | item 1, "Payment provider switch", has a minimum of 0 or less                   |
        | item 1's final result 90% value | 9.6      | item 1, "Payment provider switch", has a 90% value that doesn't match its range |
