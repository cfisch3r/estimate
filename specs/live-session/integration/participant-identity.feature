Feature: A browser keeps one participant id

  A participant's id is what tells a reconnect apart from a new person. The
  storage adapter keeps it in the browser, so it survives a reload. Two tabs of
  one browser share it, a trade-off ADR-003 accepts. A browser whose storage
  refuses still joins, but as a new person each time.

  Rule: The id is the browser's, not the page's

    Scenario: The same id after a reload
      Given browser "A" has a participant id
      When browser "A" reloads the page
      Then browser "A" has the same participant id

    Scenario: Two tabs of one browser share one id
      Given tab "1" of browser "A" has a participant id
      When tab "2" of browser "A" asks for a participant id
      Then both tabs have the same participant id

  Rule: Blocked storage never stops a join

    Scenario: A browser whose storage refuses writes gets a new id each time
      Given browser "A", whose storage refuses every write
      When browser "A" asks for a participant id twice
      Then it gets a participant id both times
      And the two ids differ
