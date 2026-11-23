@fail
Feature: What counts as unsaved

  A session is lost when the user leaves it or closes its tab, unless it was
  saved. So before either, the user is warned if the session holds something
  that neither the last save nor the last load has. What counts is what a save
  keeps: the session's name, its unit, and its items with their descriptions,
  notes and final results. A running round never counts, because saving
  leaves it out.

  Rule: A new session has nothing to lose until it gets content

    Scenario: An untouched session has nothing unsaved
      Given a new session
      Then it has no unsaved changes

    Scenario Outline: Content makes a new session unsaved
      Given a new session
      When <edit>
      Then it has unsaved changes

      Examples:
        | edit                      |
        | it is named "Sprint 42"   |
        | the item "Login" is added |
        | its unit becomes weeks    |

    Scenario: A blank name isn't content
      Given a new session
      When it is named "   "
      Then it has no unsaved changes

  Rule: After a save or a load, only a durable edit counts

    Background:
      Given a session named "Sprint 42" estimated in days with the items
        | item   | state         |
        | Login  | estimated     |
        | Search | not estimated |

    Scenario: Nothing is unsaved right after saving
      When it is saved
      Then it has no unsaved changes

    Scenario: Nothing is unsaved right after loading
      When it is saved and then loaded
      Then it has no unsaved changes

    Scenario Outline: Every durable edit counts
      Given it has just been saved
      When <edit>
      Then it has unsaved changes

      Examples:
        | edit                                                |
        | it is named "Sprint 43"                             |
        | its unit becomes weeks                              |
        | the item "Logout" is added                          |
        | the item "Search" is removed                        |
        | the item "Search" is moved before "Login"           |
        | the item "Search" is retitled "Find"                |
        | the item "Search" gets the description "Full text"  |
        | the item "Search" gets the notes "Ask Kim"          |
        | the item "Search" is finalized                      |

    Scenario: A running round doesn't count
      Given it has just been saved
      When a round on "Search" starts and collects an estimate
      Then it has no unsaved changes

    Scenario: An edit that is undone leaves nothing unsaved
      Given it has just been saved
      When it is named "Sprint 43"
      And it is named "Sprint 42"
      Then it has no unsaved changes
