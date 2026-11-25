Feature: Moving between items

  Next and Previous move through the items in list order, as the item list
  shows them. They don't skip finalized items: revisiting one and pressing Next
  goes to the item after it. Next on the last item opens the Session Summary.

  Rule: Next goes to the item after this one, finalized or not

    Scenario Outline: Next from an item
      Given the items
        | item     | state     |
        | Login    | finalized |
        | Search   | finalized |
        | Checkout | pending   |
      And "<from>" is active
      When the facilitator presses Next
      Then the active item is "<to>"

      Examples:
        | from   | to       |
        | Login  | Search   |
        | Search | Checkout |

  Rule: Next on the last item opens the Session Summary

    Scenario Outline: Next from the last item
      Given the items
        | item     | state   |
        | Login    | <first> |
        | Checkout | pending |
      And "Checkout" is active
      When the facilitator presses Next
      Then the Session Summary opens
      And <selection>

      Examples:
        | first     | selection                            |
        | finalized | no item is active anymore            |
        | pending   | the active item is still "Checkout"  |

  Rule: Previous goes to the item before this one

    Scenario: Previous from the second item
      Given the items "Login", "Search" and "Checkout"
      And "Search" is active
      When the facilitator presses Previous
      Then the active item is "Login"

    Scenario: Previous from the first item
      Given the items "Login", "Search" and "Checkout"
      And "Login" is active
      When the facilitator presses Previous
      Then the active item is still "Login"
