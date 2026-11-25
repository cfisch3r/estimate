Feature: The session's item list

  The facilitator adds, renames, reorders and removes items at any time, also
  during a live session. Every item has a title, so it can be told apart in the
  list, the report and the saved file.

  Rule: A new item needs a title

    Scenario: Adding an item to the end of the list
      Given the items "Login" and "Search"
      When the facilitator adds the item "  Checkout  "
      Then the items are "Login", "Search" and "Checkout"

    Scenario: An item with a blank title isn't added
      Given the items "Login" and "Search"
      When the facilitator adds the item "   "
      Then the items are "Login" and "Search"

  Rule: The first item added becomes the active one

    Scenario: Adding the first item
      Given no items
      When the facilitator adds the item "Login"
      Then the active item is "Login"

    Scenario: Adding another item keeps the active one
      Given the items "Login" and "Search" with "Login" active
      When the facilitator adds the item "Checkout"
      Then the active item is "Login"

  Rule: Renaming never leaves an item without a title

    Scenario: Renaming an item
      Given the items "Login" and "Search"
      When the facilitator renames "Login" to " Sign-in "
      Then the items are "Sign-in" and "Search"

    Scenario: A blank title is refused
      Given the items "Login" and "Search"
      When the facilitator renames "Login" to "  "
      Then the items are "Login" and "Search"

  Rule: Removing the active item moves on to the first pending one

    Scenario Outline: Removing an item
      Given the items
        | item     | state     |
        | Login    | finalized |
        | Search   | pending   |
        | Checkout | pending   |
      And "<active>" is active
      When the facilitator removes "<removed>"
      Then <outcome>

      Examples:
        | active   | removed  | outcome                     |
        | Checkout | Checkout | the active item is "Search" |
        | Login    | Search   | the active item is "Login"  |

    Scenario: Removing the last pending item leaves nothing active
      Given the items
        | item   | state     |
        | Login  | finalized |
        | Search | pending   |
      And "Search" is active
      When the facilitator removes "Search"
      Then no item is active

  Rule: Moving an item reorders the list

    Scenario: Moving an item down
      Given the items "Login", "Search" and "Checkout"
      When the facilitator moves "Login" to position 3
      Then the items are "Search", "Checkout" and "Login"

    Scenario: Moving an item up
      Given the items "Login", "Search" and "Checkout"
      When the facilitator moves "Checkout" to position 1
      Then the items are "Checkout", "Login" and "Search"
