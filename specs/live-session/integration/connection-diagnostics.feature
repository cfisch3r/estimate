Feature: The network adapter records how a live session connected

  Rule: An attempt is recorded by candidate type and protocol, never by address

    Scenario: Two browsers that connect record the attempt
      Given browsers "A" and "B" have joined the same session
      Then browser "A" records a WebRTC attempt that ended "connected"
      And that attempt lists local candidates "host/udp" and remote candidates "host/udp"
      And that attempt's selected pair is "host/udp" to "host/udp"
      And browser "A"'s diagnostics contain no IP address and no host name

    Scenario: A browser that can't open direct connections records why it couldn't connect
      Given browser "A" has joined a session
      And browser "B" has joined the same session without direct connections
      Then browser "B" records a WebRTC attempt that ended "closed"
      And that attempt lists local candidates "none"
      And browser "B" records the join error "could not connect to peer"

  Rule: Peers are recorded by a shortened id

    Scenario: A peer joining and leaving
      Given browsers "A" and "B" have joined the same session
      When browser "B" leaves the session
      Then browser "A" records a peer "joined" and the same peer "left"
      And both lines name the peer by a 6-character id

  Rule: The recording outlives the page and is shared by the browser's tabs

    Scenario: The recording survives a reload
      Given browsers "A" and "B" have joined the same session
      When browser "A" reloads the page
      Then browser "A"'s diagnostics still record a peer "joined"

    Scenario: Two tabs of one browser keep each other's entries
      Given tab "1" of browser "A" and browser "B" have joined one session
      And tab "2" of browser "A" and browser "C" have joined another session
      Then the diagnostics read in tab "1" hold the entries of tabs "1" and "2"
      And the diagnostics read in tab "2" hold the same entries

  Rule: Recording never gets in the way of connecting

    Scenario: A browser whose storage refuses writes still connects
      Given browser "A", whose storage refuses every write
      When browsers "A" and "B" join the same session
      Then browsers "A" and "B" are connected to each other
      And browser "A"'s diagnostics say recording is unavailable
